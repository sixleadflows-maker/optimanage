/**
 * Daily database backup.
 *
 * Produces a gzipped, data-only SQL file (plain INSERT statements) that can be
 * replayed into any PostgreSQL database that already has the OptiManage schema.
 * Recovery is therefore: `npm run db:push` to recreate the schema, then
 * `npm run db:restore <file>` to load the data back.
 *
 * Deliberately written in plain Node rather than shelling out to `pg_dump`, so
 * it runs anywhere Node runs (a laptop, a CI runner) without needing a
 * PostgreSQL client installed, and without the client's major version having to
 * match the server's.
 *
 * Usage:  npm run db:backup            -> writes into ./backups
 *         npm run db:backup -- <dir>   -> writes into <dir>
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// Neon talks over WebSockets. Node only exposes a global WebSocket from v22, so
// supply one explicitly — otherwise this works on a dev machine but fails on
// any older Node (which is exactly how it broke on the CI runner).
neonConfig.webSocketConstructor = globalThis.WebSocket ?? ws;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set — cannot take a backup.");
  process.exit(1);
}

/** Renders a JS value as a PostgreSQL literal. */
function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;
  // Json / array columns
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const outDir = process.argv[2] || "backups";
  fs.mkdirSync(outDir, { recursive: true });

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    const { rows: tableRows } = await client.query<{ table_name: string }>(
      `SELECT table_name::text AS table_name
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          AND table_name <> '_prisma_migrations'
        ORDER BY table_name`
    );

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const counts: Record<string, number> = {};
    const parts: string[] = [
      `-- OptiManage data backup`,
      `-- Taken: ${new Date().toISOString()}`,
      `-- Restore: recreate the schema (npm run db:push) then npm run db:restore <this file>`,
      `--`,
      `BEGIN;`,
      ``,
    ];

    for (const { table_name: table } of tableRows) {
      const { rows } = await client.query(`SELECT * FROM "${table}"`);
      counts[table] = rows.length;
      if (rows.length === 0) {
        parts.push(`-- ${table}: 0 rows`, ``);
        continue;
      }
      const columns = Object.keys(rows[0]);
      const columnList = columns.map((c) => `"${c}"`).join(", ");
      parts.push(`-- ${table}: ${rows.length} rows`);
      for (const row of rows) {
        const values = columns.map((c) => toSqlLiteral((row as Record<string, unknown>)[c])).join(", ");
        parts.push(`INSERT INTO "${table}" (${columnList}) VALUES (${values});`);
      }
      parts.push(``);
    }

    parts.push(`COMMIT;`, ``);

    const sql = parts.join("\n");
    const gz = gzipSync(Buffer.from(sql, "utf8"), { level: 9 });
    const file = path.join(outDir, `optimanage-${stamp}.sql.gz`);
    fs.writeFileSync(file, gz);

    // A manifest makes it obvious at a glance whether a backup looks complete,
    // without having to unzip and read the SQL.
    const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
    const manifest = { takenAt: new Date().toISOString(), file: path.basename(file), bytes: gz.length, tables: counts, totalRows };
    fs.writeFileSync(path.join(outDir, "latest-manifest.json"), JSON.stringify(manifest, null, 2));

    console.log(`Backup written: ${file}`);
    console.log(`  ${tableRows.length} tables, ${totalRows} rows, ${(gz.length / 1024).toFixed(1)} KB gzipped`);
    if (totalRows === 0) {
      console.error("Refusing to treat an empty database as a successful backup.");
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
