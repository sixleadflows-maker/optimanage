# Database backups & recovery

The OptiManage database (products, customers, sales, prescriptions) lives on
Neon. A snapshot is taken **every night at 1:00 AM Pakistan time** and copied to
Google Drive, so the catalogue never has to be re-entered by hand.

- Backup job: `.github/workflows/db-backup.yml`
- Snapshot format: gzipped SQL (`optimanage-<timestamp>.sql.gz`), roughly 50 KB
- Retention: about 60 days of daily snapshots

---

## One-time setup

Three repository secrets are needed. Add them under
**GitHub → the repo → Settings → Secrets and variables → Actions → New repository secret**.

> The repository is public, so backups are **never** stored in it — only in
> Drive. Secrets themselves are never visible in the repo or in job logs.

### 1. `DATABASE_URL`

The Neon connection string — the same value set in Vercel
(Neon dashboard → your project → Connection string).

### 2. `RCLONE_CONF`

This is what lets the job write into your Google Drive. Generated once on your
PC, using your own Google account (so the files land in your Drive and count
against your own storage):

1. Download rclone from <https://rclone.org/downloads/> (Windows, "AMD64").
   Unzip it and open a terminal in that folder.
2. Run:
   ```bash
   rclone config
   ```
3. Answer the prompts:
   - `n` for a new remote
   - name: **gdrive**
   - storage: type `drive` (Google Drive)
   - `client_id` / `client_secret`: press Enter to leave both blank
   - scope: choose `1` (full access)
   - `root_folder_id`, `service_account_file`: press Enter to skip
   - "Edit advanced config?" → `n`
   - "Use web browser to automatically authenticate?" → `y`
     (a browser opens — sign in and allow access)
   - "Configure this as a Shared Drive?" → `n`
   - `y` to confirm, then `q` to quit
4. Show the resulting config and copy **all** of it:
   ```bash
   rclone config file    # prints where rclone.conf lives
   ```
   Open that `rclone.conf` and copy its entire contents (it starts with
   `[gdrive]`) into the `RCLONE_CONF` secret.

### 3. `GDRIVE_DIR` (optional)

Folder name in Drive to write into. Defaults to `OptiManage-Backups`, which is
created automatically.

### Check it works

Go to **Actions → Daily database backup → Run workflow**. It should finish green
and the file should appear in the Drive folder. After that it runs itself
nightly — nothing further to do.

---

## Restoring after a crash

Everything needed is in the snapshot. To bring a fresh database back to life:

1. Create the new database (a new Neon project, or any PostgreSQL 17 server) and
   put its connection string in `.env.local` as `DATABASE_URL`.
2. Recreate the (empty) tables:
   ```bash
   npm run db:push
   ```
3. Download the most recent `optimanage-*.sql.gz` from the Drive folder, then:
   ```bash
   npm run db:restore -- path/to/optimanage-2026-08-01T01-00-48.sql.gz
   ```
   It asks for confirmation before touching anything, and runs as a single
   transaction — if it fails part-way the database is left untouched rather than
   half-restored.
4. Point Vercel's `DATABASE_URL` at the new database and redeploy.

### Taking a backup by hand

Any time, for example before a risky change:

```bash
npm run db:backup
```

The file is written to `./backups` (which is git-ignored).

---

## What this does and does not cover

- **Covered:** losing the Neon database or its contents — accidental deletion,
  account problems, a bad bulk edit. Recovery point is the previous night, so up
  to a day of entries made since then would need re-entering.
- **Not covered:** uploaded product photos, which live in Vercel Blob storage
  rather than the database.
- To reduce the "up to a day" window to minutes, Neon's paid plans add
  point-in-time restore, which rewinds the live database to any moment in the
  last 7 days. That is independent of these file backups and complements them.
