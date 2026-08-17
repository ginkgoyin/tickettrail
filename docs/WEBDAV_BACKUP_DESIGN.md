# TicketTrail WebDAV Backup Design

Task: `WEBDAV-BACKUP-DESIGN-001`

Status: Design baseline. `WEBDAV-BACKUP-001A` implements configuration, secure device-local password storage, and connection/capability testing. `WEBDAV-BACKUP-001B` implements manual archive publication, strict remote summary/listing, and remote retention. `WEBDAV-BACKUP-001C` now implements guarded remote delete and two-stage manual restore; automatic backup remains unimplemented.

## 1. Purpose

TicketTrail is a local-first desktop application. The local SQLite database and local attachments remain the active working copy. WebDAV is a user-owned backup repository, not an active database, synchronization service, or record-level merge system.

This design separates two responsibilities:

```text
Archive engine
  -> creates, validates, and restores a TicketTrail archive in local temporary storage

Backup transport
  -> uploads, lists, downloads, and deletes backup objects in WebDAV
```

The existing manual `Export archive bundle` and `Import archive bundle` workflow remains available for offline migration and troubleshooting.

## 2. Approved Product Rules

- SQLite and live attachments stay local.
- Never place the live SQLite file directly on WebDAV.
- TicketTrail provides no first-party storage, account system, real-time sync, merge, or conflict resolution.
- WebDAV configuration and credentials are device-local.
- Once WebDAV is configured, the normal user-facing backup history represents actual complete backups in WebDAV.
- WebDAV keeps at most 30 complete TicketTrail backups. Retention deletes remote objects; it does not merely hide them.
- A cloud backup succeeds only after its archive is uploaded and published remotely.
- Restore is always manual and destructive.
- A remote restore may begin only after the selected archive validates locally and a pre-restore safety snapshot has been uploaded successfully to WebDAV.
- Network failure must never roll back a successful local business change or corrupt live local data.
- Manual archive export/import remains independent of WebDAV.

### User-facing backup surface

Once WebDAV is configured, `Settings > Data & Backup` presents one primary `Backups` module. Its create action publishes a WebDAV backup and its history reads validated remote metadata. The local SQLite database remains working data, while old local backup folders are legacy/internal protection rather than a second ongoing user-facing repository. WebDAV credentials and connection testing stay available through a secondary settings dialog. Offline archive export/import remains a separate transfer workflow.

## 3. Current-State Audit

### 3.1 Current archive payload

The current archive format is version `1` and contains:

- `tickettrail.sqlite3`
- `attachments/` when attached files exist
- `backup.json`

`backup.json` records format version, app version, created time, ticket/journey/attachment counts, database size, attachment inclusion, platform, and optional device name. A missing format version is accepted as legacy format `0`. Unsupported future versions are rejected before destructive restore.

This payload is sufficient for the first WebDAV MVP. WebDAV does not require archive format `2`.

### 3.2 Current backend behavior

Current functions are concentrated in `src-tauri/src/db.rs`:

- `create_backup` creates a persistent directory under app data.
- `list_backups`, `restore_backup`, `delete_backup`, and `export_backup` operate on that local directory history.
- local retention prunes the oldest local backup after count exceeds 30.
- `export_archive_bundle` creates a local backup directory and zips it to the Downloads export folder.
- `import_archive_bundle` expands and validates a ZIP, creates a persistent local safety backup, then restores the database and attachments.
- archive compression/expansion currently shells out to Windows PowerShell.

The archive validation, manifest parsing, legacy compatibility, ZIP handling, and restore primitives are reusable. The current `create_backup` function is not a suitable cloud primitive because archive creation is coupled to persistent local history and local retention.

### 3.3 Current frontend behavior

- `SettingsPage` contains local data, offline transfer, local backups, export location, and a future WebDAV placeholder.
- `BackupPanel` provides a compact summary and a paginated full-screen history modal.
- `App.tsx` owns create/list/export/delete/restore orchestration and notifications.
- `ticketService.ts` exposes Tauri commands and a browser localStorage fallback.

The modal, pagination, metadata cards, confirmation UX, and toast patterns can be reused with remote records. The data source and action names must move behind WebDAV-specific service methods.

### 3.4 Current secret storage

Flight-provider configuration already uses a useful public/secret boundary:

- the frontend receives only `hasApiKey` and a masked preview;
- the real key is read and used only by Rust;
- config and secret values are separated into different files.

However, the secret file is plain JSON in the app config directory. That is not production-grade storage for WebDAV credentials and must not be reused as the credential backend. Only the backend-only API shape and masked public payload should be reused.

Current Cargo dependencies already include `reqwest` with blocking requests and Rustls. There is no WebDAV, XML, credential-manager, scheduler, or Tauri Stronghold dependency. Current Tauri capabilities contain only `core:default`.

## 4. Proposed Architecture

### 4.1 Modules

Keep the first implementation small but establish these backend boundaries:

```text
archive_engine
  create_temporary_archive(purpose) -> TemporaryArchive
  validate_archive(path) -> ValidatedArchive
  restore_validated_archive(path)

backup_transport::WebDavTransport
  test_connection()
  upload_temp(local_path, remote_temp_name)
  publish_temp(temp_name, final_name)
  list_metadata_objects()
  download_archive(remote_id, local_temp_path)
  delete_known_backup(remote_id)

cloud_backup_service
  backup_now()
  list_remote_backups()
  delete_remote_backup(id)
  restore_remote_backup(id)
  enforce_retention(protected_ids)

cloud_backup_state
  non-secret configuration
  dirty/schedule/retry state
  active-operation journal for cleanup and pruning protection

secret_store
  set/get/delete WebDAV password
```

Do not move ticket or journey business logic into these modules. Do not expose arbitrary remote paths to the frontend.

### 4.2 Archive engine extraction

Refactor the useful parts of `db.rs` without changing archive format:

- create a temporary backup directory and manifest without registering it in local history;
- compress it to an app-private temporary ZIP;
- validate a downloaded ZIP using current validation and format compatibility;
- restore an already validated extracted payload;
- clean temporary directories best-effort;
- preserve current manual export/import commands as wrappers around the same engine.

The cloud path must not call current `create_backup()` because that would create a second persistent local history entry.

## 5. Remote Storage Contract

### 5.1 Folder structure

The WebDAV server URL may already contain a path. TicketTrail appends a validated optional user folder whose default is `TicketTrail`, then its managed `backups` child:

```text
<configured WebDAV base>/<remote folder>/backups/
```

Default relative layout:

```text
TicketTrail/backups/
```

Rules:

- use these exact ASCII path segments and casing;
- normalize URL/path separators in Rust, not by string concatenation in React;
- reject `.` and `..`, encoded traversal, query/fragment components in folder input, and empty malformed segments;
- create missing managed directories with `MKCOL` one level at a time;
- never enumerate or delete outside the normalized managed `backups/` folder.

### 5.2 Final object names

Each complete backup has two final objects with one shared stem:

```text
tickettrail-v1-YYYYMMDDTHHMMSSZ-<32-lowercase-hex-uuid>.zip
tickettrail-v1-YYYYMMDDTHHMMSSZ-<32-lowercase-hex-uuid>.meta.json
```

Example:

```text
tickettrail-v1-20260816T070019Z-6adc040628f24208a0e2dd98a369625b.zip
tickettrail-v1-20260816T070019Z-6adc040628f24208a0e2dd98a369625b.meta.json
```

Temporary upload names are never considered backups:

```text
tickettrail-uploading-<operation-uuid>.zip.part
tickettrail-uploading-<operation-uuid>.meta.json.part
```

Display labels are not identity. The backend uses a strict filename parser plus metadata validation and an opaque backup ID returned to the frontend.

### 5.3 Remote metadata sidecar

Use one sidecar per archive instead of a global index file.

Reasons:

- avoids downloading every ZIP to render history;
- avoids a single shared index that can be lost or overwritten by two devices;
- allows independent upload/delete and simple eventual cleanup;
- works with generic WebDAV `PROPFIND` and `GET` rather than server-specific custom properties.

Sidecar schema version `1` contains only non-secret metadata:

```json
{
  "remoteMetadataVersion": 1,
  "backupId": "backup-...",
  "archiveObjectName": "tickettrail-v1-...zip",
  "archiveSizeBytes": 253952,
  "archiveFormatVersion": 1,
  "createdAt": "2026-08-16T07:00:19Z",
  "label": "Backup 2026-08-16 17:00:19",
  "purpose": "manual",
  "appVersion": "0.1.0",
  "deviceId": "device-local-uuid",
  "deviceName": "MSI",
  "platform": "windows",
  "ticketCount": 23,
  "journeyCount": 13,
  "attachmentCount": 0,
  "attachmentsIncluded": false
}
```

Allowed purposes are `manual`, `automatic`, and `preRestoreSafety`.

The sidecar is an efficient listing hint, not proof that the ZIP is safe. Before restore, TicketTrail downloads the ZIP, runs current structural/format validation, and verifies that its internal manifest ID and format match the selected sidecar.

Implementation clarification from `WEBDAV-BACKUP-001C-SAFETY`: committed `001B` backups use a remote sidecar `backupId` that differs from the historical `temporary-manual-*` ID inside `backup.json`. Those existing backups remain eligible through the strict compatibility checks documented in `docs/WEBDAV_RESTORE_SAFETY_REVIEW.md`. New backups created after the 001C identity change should use one matching ID in both locations. This compatibility rule does not weaken ZIP validation or permit arbitrary internal IDs.

No global `index.json` is used in the MVP. A global index creates multi-device lost-update and recovery problems. No archive format change is required because the sidecar is a transport-level object outside the ZIP.

### 5.4 Listing flow

1. Run `PROPFIND Depth: 1` on the managed backups folder.
2. Keep only strict final `*.meta.json` names matching the TicketTrail pattern.
3. Download the small matching sidecars, with a hard count and response-size limit.
4. Validate JSON schema, object names, IDs, and expected sibling ZIP names.
5. Optionally confirm ZIP existence and size from the `PROPFIND` response.
6. Ignore malformed sidecars, unrelated files, temp objects, and orphan ZIPs.
7. Sort by validated UTC `createdAt`, newest first, and return at most the actual valid complete remote entries.

Listing does not download ZIP payloads. At the 30-backup cap it downloads at most 30 small sidecars in normal operation. Orphan cleanup can be a separate best-effort maintenance pass.

## 6. Upload and Publish Flow

### 6.1 Manual `Backup now`

1. Acquire a single cloud-backup operation lock.
2. Create a format-v1 archive in app-private temporary storage.
3. Validate the local archive before network transfer.
4. Build its remote sidecar.
5. Upload ZIP to a unique `.part` object with `PUT`.
6. Verify success with HTTP status plus `HEAD` or `PROPFIND` size comparison where supported.
7. Upload sidecar to a unique `.part` object.
8. Prefer WebDAV `MOVE` to publish the ZIP final name.
9. Publish the final sidecar last. Only this final sidecar makes the backup discoverable.
10. Refresh the remote list and enforce retention with the new backup ID protected.
11. Clean local temp and remaining remote temp objects best-effort.
12. Mark the data revision successfully backed up and report success.

If `MOVE` is unsupported, the compatibility fallback uploads the final ZIP name directly and publishes the final sidecar last. A partially uploaded final ZIP remains undiscoverable because no final sidecar exists. `Test connection` records whether `MOVE` is supported so the behavior is explicit.

No strategy can make two WebDAV objects fully atomic. Publishing the sidecar last provides an atomic-ish visibility boundary. Future integrity work may add a checksum, but it is not required for this design checkpoint.

### 6.2 Backup success and retention warning

- ZIP creation without remote upload is not success.
- A failed upload keeps local user data unchanged, keeps dirty state set, and reports `Backup failed`.
- A published remote archive counts as a successful backup.
- If upload succeeds but retention deletion fails, report `Backup uploaded; remote cleanup pending`, retain dirty-cleared success state, and retry retention later. The remote repository may temporarily exceed 30 rather than deleting an unsafe object.
- Temporary local files are never shown as backups and are removed best-effort after success or failure.

## 7. Remote Retention

The cap counts complete backup pairs only, including manual, automatic, and pre-restore safety backups.

Retention algorithm:

1. Acquire the same remote-operation lock used by upload/restore/delete.
2. List and validate complete backup pairs.
3. Build a protected-ID set containing:
   - the newly published backup;
   - an active restore target;
   - the new pre-restore safety backup;
   - any object in the active operation journal.
4. Sort eligible backups by `createdAt`, then backup ID for deterministic ties.
5. While complete count exceeds 30, delete the oldest eligible pair.
6. Never choose a protected ID. If no eligible entry exists, stop and report cleanup pending.
7. Refresh the list and verify the resulting count.

For deletion ordering, remove the final sidecar first so the backup immediately becomes undiscoverable, then remove the ZIP. If ZIP deletion fails, leave an ignored orphan and schedule cleanup. If sidecar deletion fails, do not delete the ZIP.

## 8. Safe Remote Delete

The frontend sends only an opaque `backupId`, never a URL or path.

The backend:

1. rejects malformed IDs;
2. rejects IDs protected by an active operation;
3. performs a fresh remote list;
4. resolves the ID to a strict validated sidecar/archive pair inside the managed folder;
5. asks the UI for confirmation with backup metadata;
6. deletes sidecar then archive;
7. refreshes the remote list;
8. reports partial cleanup separately if an orphan ZIP remains.

The confirmation explicitly says remote backup deletion does not delete current tickets, journeys, or attachments.

## 9. Restore and Safety Snapshot

### 9.1 Required sequence

1. Acquire the cloud restore lock and protect the selected remote backup ID.
2. Resolve the ID through a fresh validated remote list.
3. Download the selected ZIP to app-private temporary storage.
4. Verify expected remote size where available.
5. Expand and run existing archive structure, manifest, legacy, and supported-format validation.
6. Confirm the internal manifest matches the selected remote record.
7. Create a temporary current-state archive with purpose `preRestoreSafety`.
8. Validate that safety archive locally.
9. Upload and publish the safety archive and sidecar to WebDAV.
10. Verify that the safety backup is visible remotely and protect its ID.
11. If safety upload did not complete, abort before touching the live database or live attachments.
12. Ask for final destructive confirmation, naming the remote safety backup.
13. Restore the previously validated selected archive using current restore primitives.
14. Refresh live app state and remote history.
15. Enforce retention while protecting both restore target and safety backup for this operation.
16. Clean temporary files and release locks.

The safety snapshot is a normal valid format-v1 ZIP plus a sidecar purpose of `preRestoreSafety`. It counts toward the 30-backup limit.

### 9.2 Failure behavior

- Download failure: abort; live data untouched.
- Validation failure: abort; live data untouched; no safety upload required.
- Safety archive creation failure: abort; live data untouched.
- Safety upload or publish failure: abort; live data untouched.
- Restore failure after safety upload: report the safety backup ID and leave it remotely available. Automatic rollback remains out of scope.
- Retention failure after safety upload: do not discard the safety backup and do not delete the active target. Complete or abort restore according to restore state, report cleanup pending, and retry retention later.

The current manual archive import continues using its existing local pre-import safety backup. The WebDAV restore command must not also create a duplicate persistent local safety history entry.

## 10. Credential Strategy

### 10.1 Stored values

Non-secret local config may store:

- normalized server URL;
- username;
- normalized remote folder;
- automatic-backup mode;
- device ID/name;
- non-secret connection capability results and timestamps.

The password/application password is stored separately as a secret. Credentials must never appear in archive manifests, sidecars, logs, diagnostics, Git, frontend localStorage, or error payloads.

### 10.2 Recommended backend

For the Windows-first desktop MVP, implement a Rust-only `SecretStore` backed by Windows Credential Manager, using a fixed service name such as `com.ginkgoyin.tickettrail.webdav` and a device-local account key. The frontend receives only `hasPassword` and a masked status. Microsoft explicitly recommends credential storage rather than plain-text app data, and Windows Credential Management supports application-defined generic credentials.

The Rust `keyring` ecosystem can provide a narrow cross-platform interface and a Windows native credential store, but the exact crate/features must be pinned and reviewed during `WEBDAV-BACKUP-001A`. Do not expose a generic keyring API to React.

Tauri Stronghold is an official cross-platform alternative, but it requires a sound vault-password/key initialization strategy and additional plugin permissions. It is not automatically safer if the app hardcodes or stores the vault password beside the vault. Evaluate it as a fallback or future cross-platform path, not as a reason to delay the Windows Credential Manager implementation.

The current plain JSON flight secret file is not acceptable for WebDAV. A later migration should move both WebDAV and flight-provider secrets behind the same `SecretStore` abstraction, but WebDAV implementation must not silently migrate or delete flight credentials in 001A.

References:

- Microsoft Windows Credential Management: https://learn.microsoft.com/en-us/windows/win32/secauthn/credentials-management
- Microsoft Credential Locker guidance: https://learn.microsoft.com/en-us/windows/apps/develop/security/credential-locker
- Tauri Stronghold plugin: https://v2.tauri.app/plugin/stronghold/
- Rust keyring crate documentation: https://docs.rs/keyring/latest/keyring/

## 11. Automatic Backup Model

### 11.1 Local state

Persist non-secret state in an app-config JSON file, written atomically with temp-file plus rename:

```text
mode: off | afterEveryChange | every1Day | every3Days | every7Days
dataRevision: monotonically increasing integer
lastSuccessfulRevision: integer
dirtySince: optional UTC timestamp
lastSuccessfulBackupAt: optional UTC timestamp
lastAttemptAt: optional UTC timestamp
consecutiveFailures: integer
nextRetryAt: optional UTC timestamp
lastErrorCode: optional sanitized code
pendingRemoteObjects: operation journal without credentials
```

Dirty means `dataRevision > lastSuccessfulRevision`.

No database migration is needed. A backend helper marks dirty after successful meaningful persisted mutations. A best-effort startup check against database/attachment modification times may conservatively mark dirty if a crash occurred between a database commit and state-file update; an unnecessary extra backup is safer than missing a change.

### 11.2 Meaningful change triggers

Mark dirty after successful:

- create, update, delete, or status change of a ticket;
- add or delete a ticket attachment;
- create, update, or delete a Journey;
- persisted Stay/Stop changes;
- archive import or local backup restore that replaces live data;
- future persisted business-data mutations explicitly registered with the helper.

Do not mark dirty for keystrokes, form drafts, navigation, filters, map state, backup listing/deletion, archive export, WebDAV config tests, or flight-provider config changes.

### 11.3 `After every change`

- Create one WebDAV backup event after every successful meaningful persisted business change, not after every keystroke, SQL statement, or draft update.
- Each event is independent: do not use a quiet-window debounce, maximum-delay timer, or coalescing to reduce the number of backups.
- Examples include one backup for creating, editing, or deleting a ticket; adding or deleting an attachment; creating, editing, or deleting a Journey; and each persisted Stay/Stop change.
- UI-only activity such as navigation, filters, map state, and other non-persisted changes does not create an event.
- A single-flight uploader is allowed, but if another meaningful change occurs while an upload is running, the later backup event must be preserved and processed afterward rather than silently merged into the in-flight event. Exact queue and retry behavior belongs to `WEBDAV-AUTO-BACKUP-001`.
- When this mode is selected, warn that backups may be created frequently and may use more WebDAV traffic and storage. This frequency is a deliberate user choice.

### 11.4 Day intervals

For 1/3/7-day modes, run only when both are true:

- dirty state exists;
- the interval since `lastSuccessfulBackupAt` has elapsed.

Evaluate on app startup, after meaningful changes, and periodically while the desktop app is open. TicketTrail is not a background service; no backup is promised while the app is closed. If there is no previous successful backup and data is dirty, the first backup is due immediately.

### 11.5 Retry behavior

- A failed automatic upload leaves dirty state unchanged.
- Retry with bounded exponential backoff: 1 minute, 5 minutes, 15 minutes, then 1 hour maximum while the app remains open.
- Manual `Backup now` may bypass the delay but cannot start concurrently with another operation.
- Show a compact persistent cloud-backup warning after repeated failures; do not interrupt every local save.
- Reset failure count only after a successful published remote backup.
- Never roll back the local mutation because cloud backup failed.

## 12. Network and Provider Failure Matrix

| Failure | Required behavior |
| --- | --- |
| DNS/network unavailable or timeout | Keep local data; leave dirty; retry later. |
| Authentication failure | Stop request; show re-authentication status; never log password. |
| Permission denied | Report folder/action permission; do not fall back outside managed folder. |
| Directory missing | `Test connection` or backup may create managed directories with `MKCOL`; fail clearly if denied. |
| Partial upload | Do not publish final sidecar; clean temp best-effort; backup is failed. |
| `MOVE` unsupported | Use direct-final ZIP fallback with sidecar published last; record capability. |
| Remote retention deletion fails | Preserve new/protected backups; report cleanup pending; retry later. |
| Remote list fails | Do not show stale entries as confirmed current state; allow retry. |
| Download fails | Abort restore; live data untouched. |
| Download validates incorrectly | Abort restore; live data untouched. |
| Safety upload fails | Abort restore before live database/attachments change. |
| Restore fails after safety upload | Report remote safety ID; no automatic rollback. |
| Redirect to another origin | Do not forward credentials; reject or require a new explicit connection test. |

Use HTTPS by default. Plain HTTP should be rejected except an explicit localhost development case; do not present insecure HTTP as normal production configuration.

## 13. Generic WebDAV Compatibility

The backend uses standard methods only:

- `OPTIONS` for basic capability probing;
- `PROPFIND` for listing/metadata;
- `MKCOL` for managed directories;
- `PUT` for uploads;
- `GET`/`HEAD` for download and verification;
- `MOVE` when available for atomic-ish publication;
- `DELETE` for remote removal.

`Test connection` must verify authentication and read/write/delete capability in the configured managed folder using a uniquely named harmless probe object. It should test `MOVE` separately and clean the probe. It must not create a backup.

Use generic Basic authentication only over HTTPS for the first provider-compatible MVP unless audit of a target server requires another standard authentication mode. Do not embed credentials in the URL. Disable cross-origin credential forwarding on redirects.

Jianguoyun is an intended test provider, not an architectural special case. Provider-specific help text may be added later without provider-specific transport logic.

## 14. Settings Migration

Proposed `Settings > Data & Backup` structure:

1. `Local data`
   - current read-only app data folder;
   - `Open data folder`.
2. `Move to another computer`
   - existing `Export archive bundle`;
   - existing `Import archive bundle`.
3. `Cloud backup - WebDAV`
   - server URL, username, password/application password, remote folder;
   - `Save`, `Test connection`, `Backup now`;
   - automatic-backup selector and status.
4. `WebDAV backup history`
   - compact latest/count summary;
   - existing full-screen paginated `View backups` modal backed by remote data;
   - remote restore and delete actions.

Transition policy:

- before WebDAV is configured, existing local backup UI may remain available to avoid removing current protection;
- once WebDAV is configured and working, the primary backup summary/history switches to actual remote backups;
- do not create persistent local history entries for WebDAV operations;
- do not automatically delete pre-existing local backup folders during migration;
- provide a later one-time cleanup/export decision for old local backups rather than maintaining two ongoing user-visible histories;
- offline archive export/import remains visible in all modes.

## 15. Current Code Reuse and Refactor Map

| Current piece | Direction |
| --- | --- |
| format-v1 manifest and legacy parser | Reuse unchanged. |
| archive structural/format validation | Reuse unchanged. |
| unsupported future-format rejection | Reuse unchanged. |
| ZIP compress/expand helpers | Reuse initially behind archive engine; later replace PowerShell if portability requires. |
| destructive payload restore primitive | Reuse behind safe remote restore orchestration. |
| manual archive export/import | Keep for offline migration. |
| import's persistent local safety backup | Keep for manual import only. Do not use for WebDAV restore. |
| `create_backup` persistent local directory | Refactor archive creation out; do not call for cloud backup. |
| local list/delete/restore/export commands | Keep during unconfigured/legacy transition; retire from primary UI after WebDAV configuration. |
| local retention 30 | Keep for remaining local mode; do not reuse as remote retention implementation. |
| `BackupPanel` modal/pagination/cards | Reuse UI structure with remote models/actions. |
| App-level backup orchestration | Move cloud orchestration to backend service; React should request operations and render state. |
| `ticketService` Tauri wrappers | Add narrow WebDAV commands; never accept arbitrary remote paths. |
| browser localStorage backup fallback | Not part of Desktop WebDAV MVP. |
| flight secret public/masked response pattern | Reuse interface pattern only. |
| flight plain JSON secret file | Do not reuse; later migrate behind `SecretStore`. |

Likely future refactor targets are `src-tauri/src/archive.rs`, `src-tauri/src/cloud_backup.rs`, `src-tauri/src/webdav.rs`, `src-tauri/src/secret_store.rs`, and small command/model modules. This is a boundary extraction, not a broad rewrite of all `db.rs` business logic.

## 16. Security Considerations

- Keep all WebDAV requests and credentials in Rust.
- Return sanitized error codes/messages to React; never raw headers or credential-bearing URLs.
- Redact `Authorization`, username, passwords, and query strings from logs.
- Validate URL scheme, origin redirects, folder segments, object names, content length limits, XML/JSON size limits, and timeouts.
- Treat remote sidecars as untrusted input.
- Limit `PROPFIND` parsing and sidecar downloads to the managed folder and expected maximums.
- Use app-private temp directories with random operation IDs.
- Do not include WebDAV or flight-provider secrets in archives or sidecars.
- Current archive validation is structural/version validation, not cryptographic integrity. `ARCHIVE-BUNDLE-INTEGRITY-001` remains future work.
- Do not overclaim encryption: HTTPS protects transport; the WebDAV provider controls at-rest storage.

## 17. MVP Boundaries

Explicitly out of scope:

- real-time or record-level synchronization;
- merge/conflict resolution;
- automatic restore;
- first-party cloud storage or accounts;
- live SQLite on WebDAV;
- web/mobile implementation;
- archive format v2;
- checksums, signatures, archive encryption, and passwords;
- automatic rollback after destructive restore starts;
- cross-version database migration policy;
- DB schema migration;
- multi-device write coordination beyond independent immutable backup objects.

## 18. Phased Implementation Plan

### `WEBDAV-BACKUP-001A` - Configuration, secret boundary, and connection test

Implemented and manually verified against Jianguoyun WebDAV:

- non-secret WebDAV config is stored in app-config `webdav.json` with automatic backup mode reserved as `off`;
- the password is stored through a Rust-only `SecretStore` backed by Windows Credential Manager service `com.ginkgoyin.tickettrail.webdav`;
- React receives only `hasPassword`, never the stored password;
- server URL and remote folder are normalized and validated in Rust;
- automatic redirects are disabled so Basic credentials are never forwarded to a redirected origin;
- `Test connection` creates `TicketTrail/backups/` one level at a time, verifies `PROPFIND`, writes and verifies a unique probe, tests `MOVE`, and deletes only its exact probe objects;
- configuration save does not perform a network request, while Test connection saves the current form before testing;
- real user manual verification passed: the Jianguoyun connection and `Test connection` succeeded, configuration survived a TicketTrail restart, and the saved credential continued to work after restart;
- no archive upload, sidecar, remote listing, retention, delete, download, restore, or automatic backup runtime is included.

### `WEBDAV-BACKUP-001B` - Archive engine extraction and manual remote backup

Implemented and manually verified against Jianguoyun WebDAV, together with the `WEBDAV-BACKUP-001B-UX` Settings consolidation:

- extract temporary archive creation from persistent local backup history;
- add sidecar generation;
- implement temp upload, publish, verification, remote listing, and 30-backup retention;
- add `Backup now` and remote summary/history read path;
- preserve manual archive export/import.

### `WEBDAV-BACKUP-001C` - Remote management and safe restore

Implemented / manually verified against Jianguoyun WebDAV:

- the history modal exposes app-themed Restore and Delete confirmation flows using only opaque backup IDs;
- restore preparation freshly resolves the ID, streams a bounded archive download to app-private storage, validates the format-v1 payload, publishes and freshly confirms a `preRestoreSafety` pair, then returns a short-lived confirmation token;
- final confirmation revalidates the prepared local payload immediately before the existing destructive restore primitive runs;
- cancellation, expiry, configuration changes, and concurrent mutations are blocked or cleaned through the shared process-local cloud-operation state;
- new manual backups use the same `backup-<uuid>` identity in `backup.json` and the sidecar; the narrowly validated historical `temporary-manual-<uuid>` format remains restorable;
- remote deletion and retention both resolve only validated discovered pairs and delete sidecar first, then ZIP. A ZIP cleanup failure leaves an ignored orphan and must be reported as cleanup pending.
- real provider verification passed: Restore replaced current local data from the selected backup; Prepare -> final confirmation -> Cancel left local data unchanged while the remote `preRestoreSafety` backup remained; user-triggered remote Delete removed the selected backup without modifying current Ticket/Journey data.
- accepted remaining risks: destructive restore is not transactional across SQLite plus attachments, and automatic rollback is not implemented.

### `WEBDAV-AUTO-BACKUP-001` - Dirty state, schedules, and retries

- register meaningful backend mutation triggers;
- persist data revision and last successful revision;
- implement Off / After every change / 1 / 3 / 7 day semantics;
- preserve one backup event per meaningful change, startup checks, single-flight execution, event queuing, backoff, and failure UX.

### Later

- `ARCHIVE-BUNDLE-INTEGRITY-001`: checksum/integrity design and implementation.
- `WEBDAV-PROVIDER-TEST-001`: scripted compatibility tests against Jianguoyun and at least one other generic WebDAV server.
- migrate the flight-provider plaintext secret to the shared secret store after WebDAV credential storage is proven.

## 19. Decision Summary

1. Remote folder: `<base>/<remote folder>/backups/`, default `TicketTrail/backups/`.
2. Filename: strict `tickettrail-v1-<UTC>-<uuid>.zip` plus matching `.meta.json`.
3. Identity: strict backend-parsed filename plus sidecar ID; never a display label or frontend path.
4. Listing: `PROPFIND` plus small sidecar downloads; no ZIP download for history.
5. Metadata: per-backup sidecar, not a shared index.
6. Publication: temp upload, `MOVE` when supported, final sidecar published last.
7. Retention: delete oldest eligible complete pairs until at most 30, with operation-protected IDs.
8. Restore target protection: active target and uploaded safety backup stay protected through restore retention.
9. Safety snapshot: current-state format-v1 temp archive uploaded and verified before local overwrite.
10. Safety upload failure: abort with live data untouched.
11. Delete validation: opaque ID resolved by a fresh backend list within the fixed managed folder.
12. Credentials: Rust-only Windows Credential Manager behind `SecretStore`; Stronghold remains an evaluated alternative.
13. Existing secret pattern: reuse masked/public boundary, not plaintext JSON storage.
14. Automatic state: local non-secret revision, schedule, success, retry, and operation-journal state.
15. Dirty tracking: increment after meaningful successful domain mutations, with conservative startup recovery.
16. Every-change trigger: one backup event per successful meaningful persisted business change; no debounce or coalescing. A single-flight uploader may queue later events.
17. Repeated failure: local changes remain; dirty remains; bounded backoff and compact persistent warning.
18. UI migration: remote history becomes primary once configured; old local history is transitional, not a second ongoing repository.
19. Reuse: archive format/validation/restore and history UI; refactor archive creation away from local persistence.
20. Archive format: version `1` is sufficient for first WebDAV MVP; sidecar is transport metadata.
21. Out of scope: sync/merge, first-party cloud, web/mobile, integrity crypto, rollback, and DB migration.
