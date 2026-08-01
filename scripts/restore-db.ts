/**
 * Restores a backup produced by scripts/backup-db.ts.
 *
 * Expects the schema to already exist (run `npm run db:push` first on a fresh
 * database). Existing rows are cleared and replaced, inside a single
 * transaction — so a failure part-way leaves the database untouched rather
 * than half-restored.
 *
 * Usage: npm run db:restore -- backups/optimanage-....sql.gz
 *        npm run db:restore -- <file> --yes     (skip the confirmation prompt)
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { gunzipSync } from "node:zlib";
import fs from "node:fs";
import readline from "node:readline/promises";

// See backup-db.ts — don't depend on Node exposing a global WebSocket, since a
// restore may well be run on whatever machine is to hand during an outage.
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — cannot restore.");
  process.exit(1);
}

const file = process.argv[2];
const skipPrompt = process.argv.includes("--yes");
if (!file) {
  console.error("Usage: npm run db:restore -- <backup-file.sql.gz> [--yes]");
  process.exit(1);
}

/** Splits the dump into individual statements, ignoring comments and the outer transaction. */
function parseStatements(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("--") && t !== "BEGIN;" && t !== "COMMIT;";
    })
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const raw = fs.readFileSync(file);
  const sql = (file.endsWith(".gz") ? gunzipSync(raw) : raw).toString("utf8");
  const statements = parseStatements(sql);
  const inserts = statements.filter((s) => s.toUpperCase().startsWith("INSERT INTO"));

  // Which tables the dump actually touches, in the order they appear (the dump
  // is written alphabetically, so ordering is resolved by FK graph below).
  const tablesInDump = [...new Set(inserts.map((s) => /INSERT INTO "([^"]+)"/.exec(s)?.[1] ?? ""))].filter(Boolean);

  console.log(`Backup file : ${file}`);
  console.log(`Statements  : ${inserts.length} inserts across ${tablesInDump.length} tables`);

  if (!skipPrompt) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `\nThis REPLACES all current data in the target database.\nType "restore" to continue: `
    );
    rl.close();
    if (answer.trim().toLowerCase() !== "restore") {
      console.log("Aborted — nothing was changed.");
      process.exit(0);
    }
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    // Order tables so parents load before children, derived from the live FK
    // graph rather than a hardcoded list (which would rot as the schema grows).
    const { rows: fks } = await client.query<{ child: string; parent: string }>(
      `SELECT tc.table_name::text AS child, ccu.table_name::text AS parent
         FROM information_schema.table_constraints tc
         JOIN information_schema.constraint_column_usage ccu
           ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
    );
    const parentsOf = new Map<string, Set<string>>();
    for (const t of tablesInDump) parentsOf.set(t, new Set());
    for (const { child, parent } of fks) {
      if (child !== parent && parentsOf.has(child) && tablesInDump.includes(parent)) {
        parentsOf.get(child)!.add(parent);
      }
    }
    const ordered: string[] = [];
    const remaining = new Set(tablesInDump);
    while (remaining.size > 0) {
      const ready = [...remaining].filter((t) => [...parentsOf.get(t)!].every((p) => ordered.includes(p)));
      // A cycle (or self-reference) shouldn't happen here, but never loop forever.
      const batch = ready.length > 0 ? ready : [...remaining];
      for (const t of batch) {
        ordered.push(t);
        remaining.delete(t);
      }
    }

    await client.query("BEGIN");
    // Children first when clearing, parents first when inserting.
    for (const table of [...ordered].reverse()) {
      await client.query(`DELETE FROM "${table}"`);
    }
    let done = 0;
    for (const table of ordered) {
      for (const stmt of inserts.filter((s) => s.startsWith(`INSERT INTO "${table}"`))) {
        await client.query(stmt);
        done++;
      }
    }
    await client.query("COMMIT");
    console.log(`\nRestored ${done} rows into ${ordered.length} tables.`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("\nRestore failed — database rolled back, nothing changed.");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
