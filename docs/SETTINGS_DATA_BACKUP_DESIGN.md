# SETTINGS_DATA_BACKUP_DESIGN

## Purpose

Settings should evolve from `Export` into `Data & Backup`.

This page should answer:

- Where is my data stored on this computer?
- How do I move my data to another computer?
- How do I create a local backup?
- How can I back up to my own WebDAV storage?
- How do I restore from WebDAV?
- Is this real-time sync? No.

This area should be described as:

- backup / restore
- migration between computers
- local-first cloud backup

It should not be described as:

- real-time sync
- multi-device merge
- account sync
- server-backed sync

## Local-First Principle

TicketTrail is local-first.

- The working database lives on the current computer.
- Attachments and related local artifacts also live on the current computer.
- WebDAV is a user-provided backup destination, not the active database.
- No first-party TicketTrail account or server is planned for the current MVP.
- The app should not claim full multi-device sync.
- Backup / restore is safer and simpler than real-time sync for the current product stage.

## Explicit Non-Goal: Changing Data Storage Location

The current MVP should not let users change the SQLite or app-data storage location.

This is risky because it affects:

- database path
- attachments folder
- migration
- permissions
- rollback
- app restart behavior
- backup / restore semantics

Instead:

- show the current app data folder read-only
- provide `Open data folder`

Do not provide `Choose data folder` in the MVP.

## Recommended Future Settings Structure

### Settings > Data & Backup

### A. Local data

- Show the current app data folder.
- Provide `Open data folder`.
- Keep the location read-only for now.
- Do not expose database relocation.

Questions this section answers:

- Where does TicketTrail store my current local data?
- How do I open that folder if I need to inspect it?

### B. Move to another computer

This should be the recommended current migration path.

Suggested explanation:

- On the old computer: `Export archive bundle`
- On the new computer: `Import archive bundle`

The archive bundle should include, subject to current implementation or later format review:

- SQLite database
- attachments
- rendered artifacts / stubs if current archive behavior includes them
- manifest / version metadata if available or later added

This section should frame archive bundle import/export as:

- the recommended no-cloud migration workflow
- a safe way to move a local archive between machines

### C. Local backups

This section should consolidate the current local safety tools:

- `Create backup`
- backup readiness
- backup history
- restore warnings

Restore/import language should clearly state:

- restoring/importing overwrites current local data
- current tickets and attachments will be replaced
- create a backup first when appropriate

### D. Default export location

This is about where exported files go, not where the live database lives.

Recommended controls:

- `Open export folder`
- `Choose export folder`
- `Reset to Downloads`

Recommended copy:

- Current export folder
- Export output location

Avoid language that suggests the database is being moved.

### E. Cloud backup - WebDAV

This should be designed as a future local-first cloud backup section.

Core principles:

- the user provides their own WebDAV storage
- WebDAV configuration is stored locally on each device
- no TicketTrail account/server is required
- WebDAV stores backup bundles, not the active database

Future fields:

- Server URL
- Username/account
- App password/token
- Remote folder such as `/TicketTrail/`

Future actions:

- `Test connection`
- `Backup to WebDAV`
- `Restore from WebDAV`
- `View WebDAV backups`

Future status examples:

- Not configured
- Connected
- Last backup time
- Last restore time
- Automatic WebDAV backup: enabled / disabled

### F. WebDAV backup list / restore UX

The future restore flow should look like backup history, not file syncing.

Each remote backup item should show:

- backup time
- device name
- app version
- file size
- ticket count / journey count if available
- backup type: manual or auto
- restore / download action

Restore confirmation should clearly say:

- this will overwrite local data
- local existing data will be replaced
- create a local backup first
- continue / cancel

### G. Future account sync

Out of scope for the current MVP.

Do not design first-party account login now.

If true account sync is ever considered later, it would require:

- server infrastructure
- authentication
- conflict handling
- encryption/security design
- paid operations cost

That direction should remain a long-term optional idea only.

## WebDAV Behavior Model

WebDAV should be designed as backup / restore first.

### Manual operations

- `Backup to WebDAV`
- `Restore from WebDAV`

### Optional automatic backup later

Automatic backup should be user-controlled and later configurable.

Possible modes:

- manually only
- after every meaningful local change, with debounce
- on app close
- daily

If after-change upload is implemented later:

- do not upload on every keystroke
- upload after save operations
- wait a short delay
- skip when no data changed
- optionally keep only a limited number of recent backups

### Restore

Restore should remain:

- manual only
- full overwrite by default
- no automatic merge
- no real-time sync
- no conflict resolution in MVP

Before restore, the app should warn clearly and recommend or create a local backup.

## WebDAV Backup File Model

Future remote backups should be versioned archive bundles, not live database files.

Recommended naming:

- `tickettrail-backup-YYYYMMDD-HHMMSS.zip`

Recommended remote folder:

- `/TicketTrail/Backups/`

Each backup should include or be accompanied by manifest metadata such as:

- app version
- createdAt
- device name
- counts
- backup format version
- database schema version if available
- attachments included: yes / no

Do not design the default long-term WebDAV behavior around uploading raw active SQLite files unless a later audit explicitly proves that safe.

## WebDAV Security Notes

- WebDAV credentials should not be stored in frontend `localStorage` as plain text.
- Prefer desktop-side storage.
- If the app already has a provider secret storage pattern, reuse or adapt it later.
- For release-quality security claims, evaluate OS keychain / Windows Credential Manager / stronger secret storage.
- Do not overclaim encryption or security guarantees in the current design.
- Do not commit example real credentials.
- Do not include WebDAV credentials inside archive bundles.

## UX Language

Prefer:

- `Data & Backup`
- `Local data`
- `Move to another computer`
- `Export archive bundle`
- `Import archive bundle`
- `Local backups`
- `Cloud backup - WebDAV`
- `Automatic WebDAV backup`
- `Restore from WebDAV`
- `Open data folder`
- `Open export folder`
- `Choose export folder`
- `Reset to Downloads`

Avoid:

- `Storage` when it implies the user can move the database
- `Sync` for the first WebDAV version
- `Account` unless explicitly describing future out-of-scope sync
- `Change data location`

## Recommended Phasing

### `SETTINGS-DATA-BACKUP-001`

- rename/restructure `Settings > Export` into `Settings > Data & Backup`
- make `Data storage location` read-only as `Local data`
- keep existing local backup/export/import actions
- add future WebDAV placeholder only
- do not implement WebDAV yet

### `SETTINGS-EXPORT-FOLDER-001`

- add custom default export folder
- support:
  - choose folder
  - reset to Downloads
  - open folder
- persist safely without DB migration if possible

### `ARCHIVE-BUNDLE-REVIEW-001`

- audit current archive export/import format
- confirm exactly what is included
- confirm whether current bundle shape is appropriate for moving between computers

### `WEBDAV-BACKUP-DESIGN-001`

- design WebDAV config
- design test connection flow
- design secret storage approach
- design remote folder, backup naming, manifest metadata, and restore safety

### `WEBDAV-BACKUP-001`

- implement manual WebDAV backup/restore after the design is accepted

### `WEBDAV-AUTO-BACKUP-001`

- add optional automatic upload after local changes
- keep restore manual and full-overwrite

### `ACCOUNT-SYNC-FUTURE`

- out of scope for the current MVP

## Future Testing Strategy

Future implementation should verify:

- opening the app data folder
- archive export creates a usable bundle
- archive import restores on a clean machine/profile
- export folder selection persists
- WebDAV test connection handles success/failure
- WebDAV backup uploads a complete archive bundle
- WebDAV backup list displays metadata
- WebDAV restore warns before replacing local data
- restore can create a local safety backup first
- auto backup does not upload too frequently
- no first-party account server is required

## Boundaries

This design does not:

- move the database
- migrate app data
- implement WebDAV
- implement account login
- implement real-time sync
- implement merge/conflict resolution
- change backup/restore behavior yet
- change current data

## Recommended Next Implementation Task

The recommended next step is:

- `SETTINGS-DATA-BACKUP-001`

That task should rename and restructure the current Settings Export page into `Data & Backup`, keep the current local-first backup/export/import actions, make local data location read-only, and add a clear future WebDAV placeholder without implementing WebDAV yet.
