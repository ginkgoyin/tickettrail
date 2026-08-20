# TicketTrail WebDAV Automatic Backup Safety Review

Task: `WEBDAV-AUTO-BACKUP-001-SAFETY`

Status: Design/audit complete and amended by `WEBDAV-AUTO-BACKUP-001-SAFETY-AMEND`. `ARCHIVE-SQLITE-SNAPSHOT-001` is implemented, Rust-tested, and manually verified through the real Jianguoyun backup/restore flow. The SQLite/WAL prerequisite is resolved; automatic runtime implementation is unblocked but remains deferred pending the remaining staged state/journal and local-coordination work.

## 1. Scope and Current-Code Audit

TicketTrail remains local-first. SQLite and the attachment directory are the working data. WebDAV stores immutable backup pairs and is not synchronization, merge, or first-party storage.

The committed `001A/B/C` implementation provides the correct transport foundation:

- `src-tauri/src/webdav.rs` owns config, Credential Manager access, remote publication/list/delete/restore, retention, and the process-local cloud mutation lock.
- `backup_now` and `backup_now_inner` create and publish a temporary format-v1 archive, publish its sidecar last, verify it remotely, and use the shared 30-backup retention implementation.
- `begin_cloud_mutation` serializes manual Backup, Delete, Restore Prepare/Confirm, and configuration mutation. A prepared Restore also blocks later mutations while waiting for final confirmation.
- `src-tauri/src/db.rs` owns archive creation and all Ticket/Journey/attachment mutations.
- `src-tauri/src/commands.rs` is the narrow authoritative Tauri command boundary. It currently forwards mutation results directly and is the safest small integration point for automatic-backup event registration.
- `StoredWebDavConfig.auto_backup_mode` and matching Rust/TypeScript public fields already exist, default to `off`, and are not yet editable or executable.
- No revision, durable event queue, timer, retry worker, or automatic status model exists today.

The current `write_stored_config` uses a synced temporary file but removes the old file before renaming the new one. That is adequate for the existing simple config but leaves a crash gap and must not be copied unchanged for the event journal.

### Existing mutation consistency caveat

Most Ticket and Journey writes use explicit SQLite transactions. Attachment files and SQLite rows cannot share one transaction:

- add attachment writes the file, inserts the row, then touches the Ticket timestamp;
- delete attachment removes the row/touches the Ticket, then removes the file;
- delete Ticket commits database deletion, then removes attachment files best-effort.

Terra must register an event only after the current command returns success. Before relying on that rule, attachment-focused tests must cover the existing partial-failure windows. A later narrow attachment consistency hardening may be needed, but automatic backup must not guess that a failed command was a successful business change.

## 2. Exact Meaningful-Change Inventory

Registration belongs in Rust after the authoritative backend mutation succeeds, never in React event handlers. Success alone is not enough: registration occurs only when the command reports that it actually changed meaningful persisted TicketTrail business state.

Use a narrow backend-only mutation result such as `MutationOutcome<T> { value: T, changed: bool }` (or an equivalent tuple/internal wrapper). Keep existing Tauri response payloads stable; `commands.rs` consumes `changed` for reservation finalization and returns only `value` to React. The authoritative `db.rs` function must determine `changed` before writing. React equality checks are not authoritative.

The current audit found no no-op detection in `update_ticket`, `update_ticket_status`, `update_journey`, or `replace_journey_stops`: they update timestamps/version or replace related rows even when submitted semantics are unchanged. Terra must add narrow comparisons before those writes:

- `update_ticket`: compare the normalized submitted Ticket draft/segments with the persisted draft/segments; exclude generated timestamps/version.
- `update_ticket_status`: if normalized status already equals the requested status, return the current payload with `changed = false` and do not update timestamps/version.
- `update_journey`: compare normalized Journey fields plus ordered/canonical ticket IDs and companion names; exclude generated timestamps.
- `replace_journey_stops`: compare normalized submitted Stops with persisted Stops in order, excluding generated IDs and timestamps.
- attachment creation is meaningful only after file, row, and Ticket timestamp work all succeed; attachment deletion is meaningful only after the selected existing attachment is successfully removed according to the command's current success contract.
- create commands and successful deletes of an existing entity are always meaningful. A missing delete target remains an error, not a no-op event.

Whole-data replacements remain one meaningful replacement command when they successfully apply an accepted restore/import payload. Determining byte-for-byte equivalence of a requested restore is outside this amendment and must not be inferred in React.

| Business operation | Current command | Authoritative implementation | Registration point | Event count |
| --- | --- | --- | --- | --- |
| Create Ticket | `commands::create_ticket` | `db::create_ticket`, after transaction commit and successful result | command wrapper after `Ok` | 1 |
| Edit Ticket, including segment replacement | `commands::update_ticket` | `db::update_ticket`, after semantic comparison and commit | finalize only when `Ok` and `changed = true` | 0 or 1 |
| Change persisted Ticket status | `commands::update_ticket_status` | `db::update_ticket_status`, after status comparison and commit | finalize only when `Ok` and `changed = true` | 0 or 1 |
| Delete Ticket, links, segment data, and attachment records | `commands::delete_ticket` | `db::delete_ticket`, after commit and current filesystem cleanup | command wrapper after `Ok` | 1 |
| Add attachment | `commands::add_ticket_attachment` | `db::add_ticket_attachment`, after file, row, and Ticket timestamp succeed | command wrapper after `Ok` | 1 |
| Delete attachment | `commands::delete_ticket_attachment` | `db::delete_ticket_attachment`, after row/timestamp/file path work succeeds | command wrapper after `Ok` | 1 |
| Create Journey and ticket/companion links | `commands::create_journey` | `db::create_journey`, after commit and payload load | command wrapper after `Ok` | 1 |
| Edit Journey and replace ticket/companion links | `commands::update_journey` | `db::update_journey`, after semantic comparison, commit, and payload load | finalize only when `Ok` and `changed = true` | 0 or 1 |
| Delete Journey and related rows | `commands::delete_journey` | `db::delete_journey`, after commit | command wrapper after `Ok` | 1 |
| Add/update/delete/reorder persisted Stops/Stays | `commands::replace_journey_stops` | `db::replace_journey_stops`, after ordered semantic comparison, commit, and reload | finalize only when `Ok` and `changed = true` | 0 or 1 |
| Restore an old local backup | `commands::restore_backup` | `db::restore_backup`, after full restore returns `Ok` | reserve before command; finalize after `Ok` | 1 whole-data replacement |
| Import an offline archive | `commands::import_archive_bundle` | `db::import_archive_bundle`, after safety backup and restore return `Ok` | reserve before command; finalize after `Ok` | 1 whole-data replacement |
| Confirm WebDAV Restore | `commands::confirm_webdav_restore` | `webdav::confirm_webdav_restore`, after token-gated restore returns `Ok` | reserve before destructive command; finalize after `Ok` | 1 whole-data replacement |

The current Journey UI calls `update_journey` and then `replace_journey_stops`, or `create_journey` and then `replace_journey_stops`. They remain separate authoritative commands, but each produces an event only when it changes persisted semantics:

- Journey fields changed and Stops changed: `update_journey` creates one event and `replace_journey_stops` creates one event; total two.
- Journey fields changed and submitted Stops equal persisted Stops: only `update_journey` creates an event; total one.
- Journey fields unchanged and Stops changed: only `replace_journey_stops` creates an event; total one.
- Journey fields and Stops both unchanged: no event.

This preserves the current non-atomic Journey architecture without creating backup traffic for write-shaped no-ops. Do not combine Journey and Stops into one transaction in this task, and do not hide real separate changes with frontend coalescing.

Ticket deletion is one event even though it also clears Journey links and Stop ticket references inside that command. One authoritative command success, not the number of SQL statements, defines the event.

## 3. Explicit Non-Triggers

Do not register events for:

- list/get/search commands, bootstrap reads, route maps, statistics, or backup readiness;
- form typing, unsaved drafts, OCR preview, lookup candidates, navigation, filters, sorting, pagination, map interaction, and detail opening;
- WebDAV list, Test connection, config save, password replacement, capability probes, remote Delete, Restore Prepare, or Restore Cancel;
- flight-provider configuration, flight lookup, export folder actions, or folder opening;
- local backup creation/deletion/export, remote manual backup publication, archive export, or ticket-stub rendering/export;
- retention cleanup, sidecar listing, retry timer ticks, application startup by itself, or failed business mutations.

Tempting but incorrect trigger points include `App.tsx` Ticket handlers, `JourneysPage.tsx` save handlers, `ticketService.ts`, and `journeyService.ts`. Those layers can fail during refresh after the backend mutation already committed, and they cannot cover future callers reliably.

## 4. Chosen `After Every Change` Semantics

### Decision

Use publication-event semantics:

> Every successful meaningful backend mutation creates one durable, distinct, FIFO automatic backup event. Each event must eventually publish its own complete remote backup pair. The archive represents the latest stable local state when that event begins archive creation, not necessarily the exact state immediately after its originating mutation.

For A, B, and C:

```text
A succeeds -> event A
A uploads
B succeeds -> event B remains queued
C succeeds -> event C remains queued
worker publishes A, then B, then C as three distinct backup pairs
```

If B reaches the worker after C committed, B and C may contain the same latest state C. B and C are still separate required publications and neither may be dropped, merged, or satisfied by A.

### Why this is the MVP recommendation

- Exact post-mutation snapshots would require synchronously freezing/copying SQLite plus attachments before the mutation command returns. Current PowerShell ZIP creation and filesystem payload can be expensive and are not an atomic database/filesystem snapshot facility.
- Synchronous archive creation after every save would make local saves depend on compression latency and temporary disk capacity, conflicting with local-first responsiveness.
- Execution-time snapshots preserve recoverability: later backups contain at least the originating change and normally all changes committed before archive creation.
- Distinct event IDs preserve the non-coalescing product rule even when two archives contain identical state.
- The tradeoff must be reflected in copy/help: `After every change` means one backup publication per saved change, not an exact historical database image at each save instant.

### Local snapshot coordination

Add one process-local `LocalDataCoordinator` used by all authoritative business mutation wrappers and archive creation. A mutation holds the exclusive mutation guard through commit and event finalization. Archive creation obtains the snapshot guard only while it creates an isolated, consistent SQLite snapshot and copies attachments. After the isolated payload exists, release the guard before ZIP compression and always before network upload.

This is not a second WebDAV lock. It prevents a local mutation from changing SQLite/attachments while a temporary archive payload is being created. Do not hold it during compression if the payload has already been copied into an isolated temporary directory, and never hold it during WebDAV upload.

### Mandatory global lock order

There are two independent authorities: the existing WebDAV cloud-operation state and the new local-data coordinator. The global invariant is:

```text
cloud-operation authority -> LocalDataCoordinator -> release LocalDataCoordinator -> compression/network
```

Only cloud operations that need a local snapshot or destructive local replacement follow both. Normal Ticket/Journey/attachment mutations acquire `LocalDataCoordinator` only and must never wait for cloud authority or HTTP work. No code may acquire cloud authority while holding `LocalDataCoordinator`.

- Manual `backup_now`, the future automatic worker, and Restore Prepare first own cloud-operation authority, briefly acquire local coordination to materialize the isolated payload, then release local coordination before compression and HTTP upload.
- Restore Prepare performs target network download/validation without local coordination; it acquires local coordination only for the current-state Safety snapshot, releases it, then compresses/uploads/verifies the Safety pair while retaining cloud authority.
- Restore Confirm is a special seam. Do not wrap `commands::confirm_webdav_restore` in the generic mutation wrapper if that wrapper acquires local coordination first. Persist the automatic reservation before invoking Confirm without holding `LocalDataCoordinator`; `webdav::confirm_webdav_restore` consumes the prepared token/cloud authority, then acquires local coordination only immediately around `restore_validated_archive_payload`. Finalize the reservation after the command succeeds and cloud handling returns.
- Offline archive Import and local backup Restore do not require cloud authority; reserve first, then acquire local coordination around destructive local replacement.

The short-lived `cloud_state` mutex that edits `active`/`prepared` must never remain held while waiting for `LocalDataCoordinator` or performing filesystem/network work. Cloud operation authority is logical state, not a held Rust mutex guard. The automatic-state file mutex must also be released before waiting for local coordination or doing HTTP I/O.

## 5. Durable State and Event Journal

Use a non-secret app-config file separate from `webdav.json`, for example:

`webdav-auto-backup-state.json`

It must never contain credentials, Authorization data, remote arbitrary paths, archive payloads, or user record contents.

This state file is the single runtime source of truth for automatic mode and queue state. On first creation only, initialize its mode from the existing `webdav.json.autoBackupMode` compatibility field (currently `off`). After that, connection-config saves must not overwrite automatic state. The public config/status command should compose connection fields from `webdav.json` with mode/status from this state file. Do not maintain two independently writable mode values; the old field may remain as a compatibility mirror until a later cleanup.

Recommended versioned model:

```text
stateVersion
generation
mode
deviceId
nextSequence
dataRevision
lastSuccessfulRevision
dirtySince
lastSuccessfulBackupAt
lastAttemptAt
consecutiveFailures
nextRetryAt
lastErrorCode
pendingEvents[]
scheduledIntervalEvent?
```

Each every-change event contains:

```text
eventId                 // random 32-lowercase-hex UUID
sequence                // monotonically increasing on this device
source                  // ticketCreate, journeyStopsReplace, archiveImport, etc.
registeredAtUtc
status                  // reserved | pending | inFlight
mutationRevision?
snapshotRevision?
attemptCount
nextRetryAt?
lastErrorCode?
plannedBackupId         // backup-<eventId>
plannedObjectTimestamp  // fixed when event is finalized
```

`dataRevision` increments once per successful authoritative business command, including a whole-data replacement. It does not increment for backup operations. `lastSuccessfulRevision` is the highest revision captured by a successfully published normal manual/automatic backup. It may be used for interval dirty state, but it must never remove or satisfy pending every-change events.

### Recoverable file replacement

Do not copy the current remove-then-rename config writer. Write a new generation to a unique temp file, flush and `sync_all`, then replace while retaining a previous valid generation. On startup inspect `current`, `previous`, and leftover temp candidates, validate schema, and choose the highest valid generation. Remove older files only after the new current generation is durable.

A small append-only intent log is also acceptable, but Terra must choose one authoritative mechanism rather than maintaining a snapshot file and an unrelated queue that can disagree.

### Reservation protocol and crash window

For every authoritative mutation command:

1. acquire the local mutation coordinator;
2. create and durably persist a `reserved` event/intent before invoking the mutation;
3. run the existing database/filesystem mutation;
4. on success with `changed = true`, increment `dataRevision`, convert the reservation according to the active mode, persist, then return the business result;
5. on success with `changed = false`, remove/cancel the reservation, do not increment `dataRevision`, and do not create an every-change event;
6. on ordinary failure, remove/cancel the reservation, persist, and return the original error;
7. wake the worker after releasing the mutation guard only when meaningful work is pending/eligible.

While mode is `After every change`, a successful reservation becomes a FIFO `pending` event. In interval/Off modes it increments revision/dirty state but does not create one remote event per change.

If the state file cannot be written before mutation, local business data must still be allowed to change. Keep an in-memory conservative event and expose `Automatic backup tracking unavailable` persistently. A guarantee across process restart is impossible when the local disk refuses all durable writes; the implementation must state this limitation rather than rolling back or blocking local data entry.

If the process crashes after reservation but before the backend can durably record `changed = false`, startup keeps the existing conservative rule and promotes the unresolved reservation. This may create one unnecessary backup, but it avoids silently losing a real committed change.

## 6. Crash Recovery Matrix

| Crash point | Durable evidence | Startup behavior |
| --- | --- | --- |
| Mutation commits before final event write | Pre-mutation `reserved` event exists | Promote reservation to a conservative pending event/revision; an extra backup is preferable to a miss |
| Reservation exists but mutation never began/committed | Same reservation | Also promote conservatively; may publish one unnecessary backup |
| Mutation fails normally | Reservation is removed | No event |
| Event recorded before archive creation | Pending event | Resume oldest event |
| Temporary archive exists during upload | Pending/in-flight event plus app-private temp | Revert event to pending; delete only that event's temp directory; rebuild snapshot |
| Final ZIP exists but final sidecar does not | Pending event, deterministic backup ID/name | Treat as unpublished; clean/reuse exact event objects safely, then retry sidecar-last publication |
| Complete sidecar/ZIP published before local success write | Pending event with `plannedBackupId` | Fresh remote list; if the exact valid ID exists, mark event complete without republishing |
| State file replacement interrupted | Multiple generations | Load highest valid generation; ignore truncated/invalid candidate |

Use the event UUID as the remote backup UUID and `backup-<eventId>` as the backup ID. Keep the object timestamp fixed in the event. This gives restart reconciliation without adding fields to remote metadata, changing sidecar version, or changing archive format v1.

If a complete object with the planned ID exists but its immutable metadata does not match the event, stop that event with a sanitized conflict error. Never overwrite an unrelated complete pair.

## 7. Every-Change Queue State Machine

```text
Reserved -> Pending -> Preparing -> Uploading -> Published -> Completed
                         |             |
                         +-> PendingRetry <-+
```

- The durable queue is FIFO by `sequence`, then `eventId` as a deterministic tie-break.
- Only one automatic upload runs at a time.
- B and C append while A uploads. They remain durable and visible as pending.
- Strict FIFO is recommended. A failed head event blocks later events until its retry is due; this preserves publication ordering and simplifies crash reconciliation.
- `inFlight` is treated as `pending` after restart unless the exact planned remote backup is already complete.
- Retry uses the same logical event ID and planned backup ID; it never creates a second logical event.
- A successful publication removes only that event, updates success metadata, runs shared retention, cleans its local temp, and wakes the next event.
- A retention cleanup warning does not return the event to pending. The backup publication succeeded.
- Switching mode or running a manual backup cannot silently delete required every-change events.

When mode is `Off`, existing required events are suspended, not discarded. Switching back on resumes them. Switching from `After every change` to an interval mode also preserves existing every-change obligations; while automatic backup remains enabled, those FIFO obligations are eligible before interval work. If the product later wants a destructive `Discard pending automatic events` action, it needs separate explicit confirmation and is out of scope.

If the user selects `Off` with pending events, show compact explanatory copy such as: `5 pending automatic backups are paused. They will resume when automatic backup is enabled again.` Do not add a discard/reset action in this phase.

## 8. Interval Modes

Modes are `every1Day`, `every3Days`, and `every7Days`, evaluated using UTC durations of 24, 72, and 168 hours.

A scheduled event is eligible only when:

1. `dataRevision > lastSuccessfulRevision`; and
2. the interval since `lastSuccessfulBackupAt` has elapsed.

Rules:

- With no successful normal backup and dirty data, the first interval backup is due immediately.
- A mutation before the due time only marks dirty; it does not upload.
- Evaluate at startup, immediately after a successful mutation/mode change, after cloud operation completion, and on a lightweight backend timer (recommended once per minute) while the app is open.
- TicketTrail is not a service. Closed-time backups are not promised. Startup runs an overdue evaluation.
- When due, persist one deterministic `scheduledIntervalEvent` before archive creation. Mutations occurring during its upload increase `dataRevision`; after success only revisions through its captured `snapshotRevision` are clean.
- Switching to a shorter interval reevaluates immediately. Switching to a longer interval uses the last successful normal backup time.
- Switching from `Off` retains revision history. If current data is not represented by a successful normal backup, enabling an interval mode is dirty and may be due immediately.
- Switching to `Off` suspends scheduled work and retries but preserves dirty state and every-change obligations.
- Switching into `After every change` creates at most one bootstrap event for pre-existing dirty state, then one event for every later mutation. It does not invent one event for each historical mutation that occurred while the mode was Off/interval.
- Existing every-change events survive a switch to an interval mode and are processed before interval scheduling while automatic backup remains enabled.

## 9. Manual and Safety Backup Interaction

### Manual `Create backup`

Capture `snapshotRevision` when the isolated local payload is complete.

- In interval modes, a successful manual WebDAV backup sets `lastSuccessfulBackupAt` and advances `lastSuccessfulRevision` through that snapshot revision. It clears dirty state only through that revision; a concurrent later mutation remains dirty.
- In `After every change`, it may advance the informational successful revision/time but must not remove, satisfy, merge, or reorder pending every-change events.
- Manual backup bypasses automatic retry backoff but uses the same cloud operation lock. It does not interrupt an active upload. Give a user-requested manual operation priority after the current operation completes where practical.
- Retention cleanup failure is still publication success.

### `preRestoreSafety`

A safety backup protects destructive Restore. It does not:

- set `lastSuccessfulBackupAt` for scheduling;
- advance `lastSuccessfulRevision`;
- clear interval dirty state;
- satisfy any every-change event.

It remains visible and counts toward the same retention cap of 30.

## 10. Restore and Import Interaction

Successful local backup Restore, offline archive Import, and WebDAV Restore Confirm each count as one whole-data replacement mutation.

- Reserve their intent before invoking the destructive command.
- On success, increment `dataRevision` once.
- In `After every change`, create one post-replacement automatic event.
- In interval modes, mark the replacement dirty and apply normal due-time rules.
- In `Off`, preserve the new revision without uploading.
- A failed restore/import does not finalize an automatic event. A crash with an unresolved reservation is conservatively promoted on restart.

For WebDAV Restore, the existing `preRestoreSafety` publication is not the automatic event. After Confirm succeeds and releases the cloud lock, the new post-restore event wakes normally. Backup publication is itself a non-trigger, so there is no restore/backup loop.

Offline archive Import retains its existing persistent local safety backup. WebDAV Restore retains its remote safety behavior. Automatic backup must not merge or replace either safety mechanism.

## 11. Retry and Failure State

For an actual publication failure, increment the head event's failure counter and schedule:

1. 1 minute;
2. 5 minutes;
3. 15 minutes;
4. 1 hour for all later failures while the app remains open.

Rules:

- Success resets failure state for the completed event and the compact global status.
- Network, timeout, auth, permission, archive creation, and publication failures retain the event.
- Authentication/permission errors show `Authentication required` or `Permission required` but remain retryable hourly; saving/test-confirming corrected config wakes an immediate retry.
- A busy cloud operation is not an upload failure and must not increment the failure counter. Keep the event pending and wake it when the operation ends, with a short fallback reevaluation.
- Retention cleanup warning means publication succeeded; do not upload the same event again.
- Manual Backup ignores the automatic event's `nextRetryAt`, but does not clear it in `After every change`.
- On restart, an overdue pending retry is eligible immediately. Future retry timestamps remain in UTC.

Automatic failure never changes the already successful local command result and never causes a modal on every save.

## 12. Interaction with the Existing Cloud Lock

Use the existing `begin_cloud_mutation`/`end_cloud_mutation` state. Do not add a competing WebDAV lock.

- Automatic worker attempts to acquire the same lock with operation kind `automatic backup`.
- Manual Backup, Delete, Restore Prepare, Restore Confirm, and settings mutation retain their current authority.
- If manual Backup/Delete/Restore is active, automatic events remain pending.
- During `ReadyForFinalConfirmation`, the prepared Restore registry intentionally blocks automatic publication. Target and safety protections remain authoritative.
- Do not hold the durable event-state mutex or local snapshot coordinator during network I/O.
- Cloud operation completion should wake the worker; periodic evaluation is only a fallback.
- Read-only remote listing may remain concurrent, as today.

The current lock is process-local. The desktop MVP assumes one TicketTrail process per profile. Do not claim cross-process serialization.

## 13. Multi-Device Semantics

Each installation owns its local revision/event state and device ID. Devices do not exchange revisions or mark another device's event complete.

- Device A and Device B publish immutable, uniquely named backups into the same repository.
- Retention counts complete pairs from all devices and uses the existing deterministic remote algorithm.
- There is no sync, merge, leader election, or distributed queue.
- Simultaneous devices can race retention. Sidecar-first deletion and unique IDs prevent arbitrary-path deletion, but the process-local protected set cannot advertise Device A's active Restore target to Device B.
- The MVP therefore cannot guarantee cross-device active-Restore protection against another device's simultaneous retention. Users should avoid Restore while another device is actively publishing. A future remote lease/operation marker would be required for that guarantee.
- Event counts and `Up to date` status are device-local, not a statement that all devices contain the same data.

## 14. Settings and Status Contract

Put the mode selector inside `WebDAV settings`, next to credentials and connection state. It is repository/device configuration and should not crowd the primary backup history controls.

Keep a compact automatic status row in the main `Backups` card:

- `Automatic backup off`
- `Up to date`
- `Backup pending`
- `Uploading`
- `N automatic backup events pending`
- `Retry scheduled`
- `Authentication required`
- `Remote cleanup pending`
- `Last successful backup <time>`

When selecting `After every change`, show: `Creates one WebDAV backup for every successful saved change. This may use more network traffic and storage.`

Do not expose revision numbers, local temp paths, credentials, or raw protocol errors in normal UI. A compact persistent warning belongs in the Backups card/settings status; no modal should interrupt each successful local save. Manual Backup keeps immediate success/failure feedback.

## 15. Shared Retention

Automatic backups use purpose `automatic`, archive format v1, the current sidecar-last publisher, and the existing retention implementation.

- Manual, automatic, and `preRestoreSafety` pairs all count toward 30.
- Protect the newly published automatic backup and all IDs already protected by Restore state.
- Never create a second automatic retention algorithm.
- Queue length is unrelated to retention count; events are removed only by successful publication/reconciliation, not because 30 remote backups already exist.
- If retention fails after publication, mark the event complete and report cleanup pending.

## 16. SQLite/WAL Snapshot Audit

Actual source evidence:

- `db::open_connection` calls `Connection::open`, migrations/schema setup, and seed helpers. It does not set, query, or enforce `PRAGMA journal_mode`, and the repository contains no WAL checkpoint path.
- A fresh SQLite database ordinarily begins in rollback/DELETE journal mode. However, WAL mode is persistent database state; because TicketTrail does not enforce or reject it, an existing database may use WAL even though the currently inspected AppData directory had no `tickettrail.sqlite3-wal` or `tickettrail.sqlite3-shm` file at audit time.
- Before `ARCHIVE-SQLITE-SNAPSHOT-001`, `create_temporary_archive_with_identity` and `create_backup_with_label` independently counted rows and then called `fs::copy` on only the live main database file. Neither path closed all possible connections, copied WAL/SHM, checkpointed, nor asked SQLite to produce a consistent destination database.
- Before the prerequisite, existing tests exercised manifest/archive shape and restore validation but did not prove that a copied database contained committed WAL-resident data or was consistent during a concurrent write.

Therefore raw main-file copying was not a sufficient safety basis for repeated automatic backup. The absence of WAL files during one inspection is not a repository invariant. `LocalDataCoordinator` closes in-process copy races but does not checkpoint WAL pages.

`ARCHIVE-SQLITE-SNAPSHOT-001` now provides one shared SQLite online-snapshot primitive through the narrowly enabled `rusqlite` `backup` feature, writing and `PRAGMA quick_check(1)`-verifying an independent `tickettrail.sqlite3` destination before publication. It routes both `create_temporary_archive_with_identity` and `create_backup_with_label`, includes committed state regardless of rollback/WAL representation, and avoids changing the live journal mode or putting `-wal`/`-shm` files in an archive. Focused Rust coverage keeps a WAL writer open with auto-checkpoint disabled, proves a raw main-file copy misses the committed row, and proves the online snapshot remains independently readable. The coordinator remains necessary to align attachment copying with the chosen local snapshot boundary.

## 17. Mandatory Terra Tests

Tests must use temporary state/config directories, fake archive/transport boundaries, and a fake clock. They must not access real AppData, Credential Manager, or external WebDAV.

### Trigger coverage

For create/update/status/delete Ticket, add/delete attachment, create/update/delete Journey, replace Stops, local Restore, archive Import, and WebDAV Restore Confirm:

- success finalizes exactly one expected revision/event for that command;
- failure finalizes none;
- reserved crash state recovers conservatively;
- Ticket/Journey multi-table SQL statements do not create multiple events.

Test Journey/Stops no-op semantics explicitly:

- Journey fields changed + Stops changed = two events;
- Journey fields changed + equal Stops = one event;
- unchanged Journey fields + changed Stops = one event;
- unchanged Journey fields + equal Stops = zero events.

Also prove equal Ticket edits and same-value status updates return `changed = false`, do not rewrite timestamps/version, cancel their reservation, and register no event. Test Ticket deletion with link/Stop cleanup as one event.

### Non-trigger coverage

Assert no revision/event for list/get/search, backup list/delete, Test connection, config save, flight lookup/config, archive export, local/remote backup creation, Restore Prepare/Cancel, and retention.

### Every-change queue

Use a blocking fake upload:

```text
A succeeds; upload A starts; B succeeds; C succeeds
```

Prove B and C are durably present, no event is coalesced, maximum concurrent upload count is one, FIFO order is A/B/C, and three distinct planned backup IDs are eventually complete.

For the chosen snapshot semantics, prove B may capture snapshot revision C when C commits before B archive creation, while B and C still publish separately. Also prove a mutation after B's snapshot is not falsely marked clean by B.

### Retry and reconciliation

- upload failure keeps the same event ID pending;
- later mutation is retained behind the failed head event;
- backoff is 1m, 5m, 15m, then 1h;
- busy cloud lock does not increment failure count;
- success resets failure state;
- retention warning is success and causes no republication;
- remote complete pair with planned ID after restart completes the event without duplicate upload;
- orphan ZIP/no sidecar is not success and retry touches only exact event objects;
- conflicting complete pair with the same planned ID is rejected.

### State/crash recovery

- highest valid state generation wins;
- truncated current file falls back to valid previous/temp generation;
- `reserved` at restart becomes conservative pending/dirty;
- `inFlight` becomes pending unless exact remote completion is found;
- event ordering and IDs survive restart;
- no credentials or record contents serialize into state.
- successful `changed = false` cancels its reservation without revision/event creation;
- a crash before recording that no-op outcome is conservatively recoverable as a possible extra event.

### Interval modes

- not dirty + due: no event;
- dirty + not due: no event;
- dirty + due: one scheduled event;
- no previous success + dirty: immediately due;
- startup overdue: event runs;
- app closed: no promise/runtime;
- shorter/longer interval switches follow the documented clock;
- Off suspends without clearing dirty/events;
- After every change -> Off preserves and pauses every pending event;
- After every change -> interval preserves the FIFO obligations and processes them before interval work;
- re-enabling resumes the same event IDs/order;
- entering After every change creates at most one bootstrap event for pre-existing dirty state.

### Manual, safety, and restore

- successful manual Backup clears interval dirty state only through captured revision;
- manual Backup never removes every-change events;
- manual failure changes no success revision;
- `preRestoreSafety` changes none of the automatic state;
- successful local Restore/Import/WebDAV Confirm creates exactly one replacement revision/event;
- failed replacement creates none in normal execution;
- post-WebDAV-restore automatic event waits until the Restore cloud lock is released;
- automatic backup publication itself does not recursively trigger another event.

### Attachment and coordinator tests

- archive snapshot and business mutation do not overlap the isolated-copy boundary;
- attachment add/delete success includes both row and file in the subsequent snapshot;
- attachment partial failures do not get incorrectly finalized as successful automatic events;
- local mutation result remains successful when WebDAV upload fails.
- automatic snapshot + concurrent mutation and manual snapshot + concurrent mutation serialize only the isolated local-copy boundary;
- a prepared Restore blocks automatic cloud upload but does not hold `LocalDataCoordinator` while waiting for user confirmation;
- Restore Confirm and backup snapshot creation cannot deadlock under forced interleaving;
- no `LocalDataCoordinator`, automatic-state mutex, or `cloud_state` mutex guard is held during WebDAV HTTP upload;
- ZIP compression occurs after the isolated payload exists and after local coordination is released.

### SQLite snapshot tests (implemented database prerequisite; coordination cases remain future work)

- create a source database in WAL mode, commit a row that is observable through SQLite while still represented by WAL state, create the archive snapshot through the shared archive engine, and prove the copied snapshot contains that row;
- open and run integrity/query checks against the generated snapshot independently of the source connection and source `-wal`/`-shm` files;
- exercise concurrent committed writes through `LocalDataCoordinator` and prove each snapshot is a complete SQLite database, never a torn main-file copy;
- prove both temporary WebDAV archives and persistent local backups use the same safe SQLite snapshot primitive;
- prove attachment copying remains within the same local coordination boundary while documenting that SQLite plus filesystem attachments are not one transactional storage engine.

## 18. Implementation Checklist and Order

1. Add a testable `auto_backup_state` module with mode enum, versioned state, recoverable generation writer, fake clock, and durable queue/journal.
2. Add the backend-only `MutationOutcome<T>`/equivalent meaningful-change contract and authoritative semantic no-op checks.
3. Add reservation handling, including `changed = false` cancellation and conservative crash recovery.
4. Add focused attachment failure tests and one process-local `LocalDataCoordinator`.
5. Encode and test the global cloud-authority -> local-coordination order, including the special Restore Confirm seam.
6. `ARCHIVE-SQLITE-SNAPSHOT-001` is complete: the shared archive paths use a WAL-safe SQLite online snapshot and focused WAL tests pass.
7. Refactor the existing WebDAV publisher narrowly so manual and automatic callers can provide purpose, stable backup ID/object identity, and captured revision without changing format v1.
8. Implement the FIFO worker using the existing cloud operation lock, deterministic event IDs, startup reconciliation, and exact temp cleanup.
9. Add interval evaluation and fake-clock scheduling; wire startup and operation-completion wakeups before adding a periodic timer.
10. Update manual Backup success accounting and whole-data replacement hooks while keeping Safety backup excluded.
11. Add backend public status/config commands and the WebDAV-settings selector plus compact Backups status.
12. Run mandatory fake-boundary tests, full Rust/frontend tests, production build, and real-provider manual verification before commit.

Do not start with React triggers or a timer. Durable registration and crash recovery must exist before any automatic upload can run. Stage 6, the SQLite snapshot blocker, is now resolved and tested; stages 7-11 remain the future implementation sequence after the state/journal, reservation, and `LocalDataCoordinator` foundations above are complete.

## 19. Remaining Risks and Decisions

- The chosen MVP preserves event count, not an exact post-mutation image for every event. Exact images would need a stronger SQLite/attachment snapshot facility and materially higher save latency/temp storage.
- Durable tracking cannot be guaranteed across restart if the local filesystem refuses every state write. Local data remains primary and must not be rolled back for that condition.
- Attachment row/file operations have existing partial-failure windows that require focused tests/hardening.
- **Resolved prerequisite:** `open_connection` still deliberately does not set or verify `PRAGMA journal_mode`, and journal mode can persist as WAL. Both `create_temporary_archive_with_identity` and `create_backup_with_label` now call the tested `create_sqlite_snapshot` helper, which uses the narrowly enabled `rusqlite` SQLite online-backup API, checks the private destination with `PRAGMA quick_check(1)`, and publishes it only after success. It does not copy `-wal`/`-shm`, checkpoint or change the live database journal mode. The dedicated regression test keeps a committed row in a non-empty WAL and proves it appears only in the online snapshot, not a raw main-file copy.
- SQLite/attachment atomicity remains a separate prerequisite for the automatic runtime: a future `LocalDataCoordinator` must define the in-process boundary while attachment files remain a separate filesystem store.
- SQLite and attachment files remain separate storage engines. Local coordination can prevent in-process app mutations during snapshot materialization, but cannot provide a single transactional commit across both. The snapshot order and attachment partial-failure behavior remain documented MVP risks.
- Strict FIFO means one persistent failure can grow the queue. The UI must show pending count and auth/network status clearly.
- Two devices have no distributed operation lock; active Restore protection is process/device-local.
- Remote backup cap 30 means frequent every-change backups may quickly prune older history. This is expected and should be stated near the mode warning.

No unresolved product decision requires user input. The publication-event and reservation semantics are accepted. The SQLite/WAL snapshot prerequisite is resolved, but Terra must still implement the accepted state/journal and `LocalDataCoordinator` stages before publisher/worker runtime work.

## 20. Explicit Exclusions

This plan does not implement runtime, timers, UI controls, DB migrations, synchronization, merge, first-party cloud, background services, OS startup tasks, Web/mobile clients, archive format v2, checksum/signature/encryption, rollback, a new Local backups UI, rail/place work, AeroDataBox changes, or flight-secret migration.
