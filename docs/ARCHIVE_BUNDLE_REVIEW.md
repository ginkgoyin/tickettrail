# ARCHIVE_BUNDLE_REVIEW

## Purpose

This review records what the current `Export archive bundle` and `Import archive bundle`
behavior actually does today, so future work can judge:

- whether the current bundle is safe enough for manual migration between computers
- whether the current bundle can become the future WebDAV backup payload
- what must be improved before WebDAV backup/restore is implemented

This is an audit checkpoint only. It does not change runtime backup/export/import behavior.

## Code Paths Inspected

- `src/pages/SettingsPage.tsx`
- `src/components/BackupPanel.tsx`
- `src/App.tsx`
- `src/lib/ticketService.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/db.rs`

## Current UI/Frontend Wiring

### Settings wiring

`Settings > Data & Backup` uses the shared backup/export/import actions passed from `App.tsx`.

- `Export archive bundle` calls `handleExportArchiveBundle`
- `Import archive bundle` calls `handleImportArchiveBundle`
- `Create backup` calls `handleCreateBackup`
- `Restore backup` calls `handleRestoreBackup`
- `Export backup` calls `handleExportBackup`

### Frontend service layer

Desktop runtime calls Tauri commands through `src/lib/ticketService.ts`:

- `list_backups`
- `create_backup`
- `get_backup_readiness`
- `restore_backup`
- `export_backup`
- `export_archive_bundle`
- `import_archive_bundle`

Web fallback behavior is different:

- local fallback backups are stored in browser localStorage snapshots
- web fallback does **not** support archive bundle import

This review is focused on the desktop/Tauri path.

## Current Local Backup Behavior

### What `Create backup` does

`create_backup(app)` in `src-tauri/src/db.rs` creates a real backup directory under:

- `<app data>/backups/backup-YYYYMMDD-HHMMSS/`

The backup currently includes:

- `tickettrail.sqlite3`
- `attachments/` directory, if it exists
- `backup.json`

### Current backup manifest fields

`backup.json` currently contains:

- `id`
- `label`
- `createdAt`
- `ticketCount`
- `attachmentCount`
- `databaseSizeBytes`

### What is not currently included in the manifest

The current manifest does **not** include:

- app version
- backup format version
- schema version
- archive/bundle version
- device name
- profile name
- checksum/hash
- attachments included yes/no flag
- rendered artifact/stub metadata

### Backup history

Backup history is already real, not placeholder-only.

`list_backups(app)` reads backup directories from `<app data>/backups/`, loads `backup.json`,
and returns visible backup records sorted by `createdAt` descending.

### Backup restore behavior

`restore_backup(app, backup_id)` restores directly from the stored backup directory by calling
`restore_from_backup_dir`.

Current restore behavior:

- requires `tickettrail.sqlite3` to exist inside the backup directory
- copies that database over the current live database path
- deletes the current live attachments directory if it exists
- copies backup `attachments/` over if present
- otherwise creates an empty live attachments directory
- reopens the database afterward

Current restore safety gaps:

- no automatic safety backup before restore
- no rollback if attachment restore fails after database copy
- no checksum/integrity validation
- no app restart flow

## Current Archive Bundle Export Behavior

### How `Export archive bundle` works today

`export_archive_bundle(app)` currently:

1. calls `create_backup(app)`
2. locates that newly created backup directory
3. writes a zip file to:
   - `<downloads|desktop|documents|app data>/TicketTrail Backups/backup-...-archive.zip`
4. compresses the whole backup directory using PowerShell `Compress-Archive`

### Current archive bundle contents

The zip bundle therefore currently contains the same payload as a local backup directory:

- `tickettrail.sqlite3`
- `attachments/`
- `backup.json`

### What the current archive bundle does not include

It does not currently include any additional archive-only metadata such as:

- bundle manifest separate from `backup.json`
- app version
- schema version
- device name
- profile name
- export timestamp beyond the backup timestamp already embedded in `backup.json`
- rendered artifacts/stubs as a separately managed payload, unless they happen to live under attachments

### Export format observations

- the bundle is a `.zip`
- it is produced by zipping a backup directory, not by zipping the raw live app data root
- this is a good local-first direction because the bundle already uses a reviewable backup-shaped payload

## Current Archive Bundle Import Behavior

### How `Import archive bundle` works today

`import_archive_bundle(app, bundle_path)` currently:

1. checks whether the selected zip file exists
2. extracts it into:
   - `<app data>/imports/<uuid>/`
3. calls `locate_backup_dir(import_root)`
4. restores from that located backup directory through `restore_from_backup_dir`

### What `locate_backup_dir` validates

Current validation is minimal:

- accept the extraction root directly if `backup.json` exists there
- otherwise accept the first child directory containing `backup.json`
- otherwise fail with:
  - `Could not locate a valid backup manifest inside the archive bundle.`

### Current destructive behavior

Import currently behaves as a destructive local restore:

- it overwrites the live database with the bundled database
- it removes and replaces the live attachments directory

### What import does not currently do

Current import does **not**:

- create a safety backup first
- validate manifest schema/version compatibility
- validate ticket/attachment counts before overwrite
- validate checksums
- perform transactional rollback across database plus attachments
- clean up extracted imports afterward in the reviewed code path
- prompt for restart

### Current UI warning accuracy

The current UI warning is broadly accurate:

- it warns that import overwrites the current database and attachments

However, it is still incomplete because it does not mention:

- no automatic safety backup is created first
- no rollback is guaranteed if restore fails mid-process

## What Data Is Preserved Today

Based on the current implementation, a successful backup/archive export and import should preserve:

- SQLite database contents
- ticket records
- journey records
- attachments stored under the app attachment root

If those data live only in the database plus attachments tree, the migration should preserve them.

## What Is Unclear Or Potentially Missing

The current code does not clearly prove inclusion of:

- rendered artifacts or exported ticket stubs stored outside attachments
- extra local config/preferences stored outside the database and attachments
- future provider config/secret files stored under config directories rather than the app data backup payload

That means the current archive bundle should be treated as:

- a database + attachments migration bundle
- not a full desktop-profile snapshot

## Migration Safety Conclusion

### Current conclusion

The current archive bundle is **probably good enough for manual same-app migration between Windows computers**
if the user goal is:

- move the database
- move ticket/journey records
- move stored attachments

### Why it is not fully safe yet

It is not fully hardened because:

- there is no manifest versioning
- there is no schema version metadata
- there is no automatic pre-import safety backup
- there is no rollback across database + attachment replacement
- there is no checksum/integrity validation
- there is no explicit cleanup/retry strategy for extracted import temp data
- non-database/non-attachment local config may be excluded

### Manual verification still needed

Before claiming this as a polished migration path, verify on a clean second machine/profile:

1. export archive bundle on machine A
2. install/open TicketTrail on machine B
3. import archive bundle
4. confirm tickets, journeys, attachments, and representative details all load correctly
5. confirm no important local settings or artifacts are missing

## WebDAV Suitability Conclusion

### Is the current archive bundle a reasonable future WebDAV payload?

Yes, directionally.

The current archive bundle is a better future WebDAV payload than uploading the raw active SQLite file because:

- it already packages a backup-shaped snapshot
- it can include attachments together with the database
- it avoids treating the live app data root as the sync target

### Should future WebDAV upload archive bundles instead of raw active SQLite files?

Yes.

Future WebDAV backup should upload versioned archive bundles, not the active live database file directly.

### What should be improved before WebDAV backup

Before using the current bundle as the future WebDAV payload, add:

- bundle/manifest format version
- app version
- database schema version
- created-at/exported-at clarity
- optional device name/profile name
- attachment-included metadata
- safer pre-import restore flow
- import validation before overwrite

## Risks And Gaps

- No manifest/version metadata beyond simple backup counts
- No schema version recorded in the bundle
- No app version recorded in the bundle
- No checksum/integrity validation
- No automatic safety backup before destructive import
- No rollback across database replacement and attachment replacement
- No proof that all local config outside DB/attachments is preserved
- Import temp extraction cleanup is unclear in the current code path
- Archive bundle relies on Windows PowerShell archive commands in the current implementation

## Recommended Follow-Up Tasks

### `ARCHIVE-BUNDLE-MANIFEST-001`

Add richer archive/backup manifest metadata:

- backup format version
- app version
- schema version
- createdAt/exportedAt
- optional device name
- attachments included yes/no

### `ARCHIVE-IMPORT-SAFETY-001`

Improve destructive import safety:

- validate manifest before overwrite
- create a local safety backup before import
- define rollback expectations or explicit non-rollback behavior

### `ARCHIVE-BUNDLE-TEST-001`

Add a repeatable migration verification path:

- export on one profile
- import on another profile
- confirm representative records and attachments

### `WEBDAV-BACKUP-DESIGN-001`

Use this review as the baseline for future WebDAV design:

- upload archive bundles
- keep restore manual/destructive
- avoid raw live-database sync semantics

## Current Recommendation

Treat the current archive bundle as:

- acceptable for cautious manual migration testing
- not yet polished enough to be the final WebDAV backup contract without manifest and import-safety improvements
