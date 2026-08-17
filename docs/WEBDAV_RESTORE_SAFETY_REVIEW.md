# TicketTrail WebDAV Restore Safety Review

Task: `WEBDAV-BACKUP-001C-SAFETY`

Status: Implemented and manually verified. Safety verdict: `PASS WITH FIXES`; no remaining BLOCKER.

## 1. Scope and Current-Code Audit

This review uses the committed `WEBDAV-BACKUP-001A`, `001B`, and `001B-UX` code as the source of truth. TicketTrail remains local-first: SQLite and attachments are the live working copy, while WebDAV contains immutable backup archives and sidecars.

### Current reusable seams

| Current seam | Actual behavior | 001C disposition |
| --- | --- | --- |
| `db::create_temporary_archive` | Creates and validates a format-v1 ZIP under app-private `temporary-archives/` without adding local backup history | Reuse for `preRestoreSafety`; extend narrowly so remote and internal identity can be correlated |
| `validate_backup_payload` / `validate_backup_manifest` | Validates `backup.json`, supported format, SQLite presence, and attachment consistency after extraction | Extract behind a `pub(crate)` archive-engine boundary and reuse |
| `restore_from_backup_dir` | Revalidates, copies SQLite, then replaces attachments | Reuse only behind the safety gate; it is destructive and can leave partial state if attachment replacement fails |
| `import_archive_bundle` | Validates first, creates a persistent local safety backup, then restores | Keep unchanged for offline import only |
| `WebDavClient` | Backend-only authenticated WebDAV requests with redirects disabled | Extend with bounded streaming download and purpose-specific delete errors |
| `list_complete_backups` | Lists strict final sidecars, requires sibling ZIP name, validates sidecar schema, ignores malformed/orphan objects | Reuse for fresh opaque-ID resolution; add stronger selected-object verification |
| `backup_now` publication | ZIP first and final sidecar last; uses `.part` + `MOVE` when available, otherwise final-name compatibility mode | Extract a shared publish helper for manual and safety backups |
| `enforce_retention` | Deletes sidecar then ZIP and protects one newly created ID | Refactor to accept a protected-ID set and share one validated pair-deletion primitive |
| `CLOUD_BACKUP_LOCK` | `try_lock` protects only `backup_now`; listing is intentionally unlocked | Replace with the smallest shared cloud-operation state that covers backup, prepare/confirm/cancel restore, and delete |
| `BackupPanel` | Full-screen paginated WebDAV history, currently read-only | Keep layout; add Restore/Delete controls and purpose label only |
| Tauri API | High-level config/test/backup/list commands; no arbitrary WebDAV methods or paths | Preserve the narrow boundary and add opaque-ID/token commands |

### Current limitations that affect 001C

- The implemented 001C transport streams both uploads and bounded downloads from app-private files. It does not buffer a complete archive in memory.
- All requests currently share a 20-second whole-request timeout. Archive transfer needs a bounded but longer transfer timeout and a separate connect timeout.
- PowerShell `Expand-Archive` is the current extraction implementation. 001C must extract only into a unique app-private directory and verify the resolved payload remains below that directory. A native ZIP entry-by-entry boundary check is preferable later, but archive format v2 is not required.
- Remote listing proves that names form a pair, but it does not prove ZIP content or size. Restore preparation must download, compare size, and validate locally.
- Current 001B archives have different identities: sidecar `backupId` is `backup-<uuid>`, while internal `backup.json.id` is `temporary-manual-<uuid>`. Existing remote backups must remain restorable through a documented compatibility rule.
- `restore_from_backup_dir` copies the live database before removing/replacing attachments. A failure after database copy can leave mixed live state. Automatic rollback is out of scope, so final confirmation and the verified remote safety backup are mandatory.
- Retention accepts only one protected ID. Restore needs a protected set containing at least the target and safety backup.
- `delete_exact` treats `404` as success and uses probe-specific error copy. A shared pair-delete helper needs operation-specific results so sidecar and ZIP failures remain distinguishable.

## 2. Hard Safety Invariants

### Invariant A: no early destructive restore

Live SQLite and live attachments must not be modified until all are true:

1. the selected opaque backup ID was freshly resolved from a validated remote list;
2. its ZIP was downloaded into app-private temporary storage;
3. actual downloaded size matched the selected sidecar and configured limit;
4. the ZIP was extracted and passed local archive validation;
5. current live state was archived into a temporary format-v1 safety archive;
6. the safety ZIP and sidecar were published successfully;
7. a fresh remote list and object-size verification confirmed the safety backup as a visible complete pair; and
8. the user gave final confirmation for the exact prepared operation.

### Invariant B: safety failure blocks restore

Failure to create, upload, publish, or remotely verify the safety archive must produce a failed preparation. The destructive restore primitive must not be called, and live SQLite and attachments must remain untouched.

### Invariant C: no arbitrary delete or download paths

React supplies only a strict opaque backup ID. Rust freshly resolves that ID to a validated sidecar/ZIP pair inside the normalized managed `backups/` collection. React never supplies a URL, remote object name, local path, credentials, method, or header.

### Invariant D: retention protection

While a restore operation exists, its selected target and published `preRestoreSafety` backup are protected. Retention and manual delete must consult the same protected-ID registry.

### Invariant E: sidecar-first delete

Delete the final sidecar first. Attempt ZIP deletion only after sidecar deletion succeeds. A sidecar failure leaves the ZIP untouched. A ZIP failure after sidecar success leaves an ignored orphan and returns a cleanup warning.

### Invariant F: preserve safety after restore failure

Once published, a safety backup survives destructive restore failure, refresh failure, cancellation after publication, and retention failure. Cleanup must never delete its final pair as part of the failed operation.

### Additional invariants

- A prepared restore is bound to exactly one target ID, downloaded/extracted payload, safety ID, repository configuration fingerprint, and operation ID.
- A restore operation is single-use. Success, destructive failure, cancellation, expiry, configuration change, or process restart prevents reuse.
- Remote publication uses the sidecar as the visibility boundary. A final sidecar is never published before its ZIP is uploaded and size-verified.
- No remote management action rolls back or blocks a successful ordinary ticket/journey mutation.
- Offline archive import keeps its existing persistent local safety backup. WebDAV restore creates no persistent local backup-history entry.
- No cleanup failure may be converted into permission to cross the destructive boundary.

## 3. Chosen Restore State Machine

Use an in-memory backend operation registry. Only Rust owns paths and remote object names.

| State | Artifacts and protection | Live data | Allowed exit/cleanup |
| --- | --- | --- | --- |
| `Idle` | No operation artifacts or protected IDs | Untouched | Start preparation |
| `ResolvingTarget` | Target ID requested; cloud lock held; no paths exposed | Untouched | Fresh-list failure returns to `Idle` |
| `DownloadingTarget` | Validated pair resolved; target ID protected; unique temp directory and partial local file may exist | Untouched | Delete only this operation's partial local file |
| `ValidatingTarget` | Complete downloaded ZIP and expected size; target protected; extracted temp payload may exist | Untouched | Validation failure removes local temp and releases target |
| `CreatingSafetyArchive` | Validated target retained; current-state temporary archive being created; target protected | Untouched | Creation failure removes local temp and releases target |
| `PublishingSafetyBackup` | Target and proposed safety ID protected; safety `.part` or final ZIP may exist | Untouched | Best-effort removal of this operation's temporary/unpublished objects only; never target |
| `VerifyingSafetyBackup` | Safety final pair may exist; target and safety protected | Untouched | If verification fails, keep any visible safety pair, remove only unpublished temp objects, abort |
| `ReadyForFinalConfirmation` | Validated extracted target, published/verified safety pair, opaque operation token; both IDs protected | Untouched | Confirm, cancel, or expire. Cancel/expiry removes local temp but keeps safety remote |
| `RestoringLocalData` | Token atomically consumed; both IDs protected; destructive primitive running | May be modified | No cancellation. Safety and target remain remote regardless of result |
| `RefreshingApplicationState` | Restore succeeded; backend result ready; both IDs protected until operation closes | Replaced | Local temp cleanup; no remote pair cleanup |
| `Completed` | No token/temp; protection released after result is recorded | Replaced | UI refreshes tickets/journeys/history |
| `FailedBeforeRestore` | No destructive call occurred | Untouched | Safe retry from a new operation; published safety remains if one exists |
| `FailedDuringRestore` | Destructive primitive returned failure; safety remains remote | May be partially modified | Report safety ID and restart/recovery guidance; never retry token |

Forbidden transitions:

- Any pre-confirmation state directly to `RestoringLocalData`.
- `ReadyForFinalConfirmation` to restore using a different target or repository configuration.
- Any failed, cancelled, expired, or consumed operation back to an active state.
- Cleanup or retention deleting either protected ID.

The destructive boundary is the single call from `ReadyForFinalConfirmation` to `RestoringLocalData`, after atomic token consumption.

## 4. Backend/Frontend Boundary and Final Confirmation

Choose **Option B: a two-step backend workflow with an opaque restore-ready token**.

Option A is simpler but asks for confirmation before the safety backup result is known and cannot give the user a meaningful final decision at the true destructive boundary. Option B fits the existing Tauri command style and keeps orchestration in Rust.

Recommended narrow commands:

```text
prepare_webdav_restore(backup_id) -> RestoreReadyPublicPayload
confirm_webdav_restore(operation_id) -> RestoreResultPayload
cancel_webdav_restore(operation_id) -> ()
delete_webdav_backup(backup_id) -> RemoteDeleteResultPayload
```

`RestoreReadyPublicPayload` contains only:

- random opaque `operationId`;
- safe target display metadata;
- published safety backup ID/label/time;
- expiry time;
- concise warnings.

Token requirements:

- cryptographically random UUID/128-bit equivalent, not derived from paths;
- stored only in the Rust in-memory registry;
- bound to target ID, selected sidecar snapshot, extracted target path, expected size, safety ID, and normalized repository/config fingerprint;
- single use, atomically moved to `RestoringLocalData` before the destructive call;
- 10-minute confirmation lifetime;
- cancellation and expiry remove local temp and protection, but keep a published safety pair;
- process restart invalidates all tokens; startup may best-effort remove stale app-private temp directories;
- saving/changing WebDAV configuration cancels prepared operations or is rejected while one exists;
- stale/consumed token returns a sanitized error and can never select another target.

React displays final overwrite confirmation only after `prepare_webdav_restore` succeeds. React does not sequence download, validation, safety publication, or restore through separate primitives.

## 5. Remote Delete Primitive

Extract one backend helper used by retention and manual delete:

```text
delete_validated_remote_pair(client, managed_url, CompleteRemoteBackup)
  -> Deleted | ArchiveCleanupPending
```

The helper accepts a `CompleteRemoteBackup` produced by a fresh validated list, never an arbitrary string path. The calling service must first check the shared protected-ID set.

Manual flow:

1. acquire the shared cloud-operation lock;
2. validate backup ID syntax;
3. fetch a fresh complete remote list;
4. resolve exactly one matching ID;
5. reject protected or missing ID before any `DELETE`;
6. build both URLs only through `remote_object_url` and validated names;
7. delete sidecar;
8. if successful, delete ZIP;
9. fetch fresh history and return result.

Failure semantics:

- Sidecar delete fails: do not issue ZIP delete; entry remains discoverable; return failure.
- Sidecar delete succeeds and ZIP delete fails: return success-with-cleanup-warning; orphan ZIP is ignored by history and may be cleaned by a later scoped maintenance task.
- Protected ID: reject without a remote delete request.
- Malformed, unrelated, stale, or missing ID: reject without deleting arbitrary content.
- A provider returning `404` after the fresh list may be treated as already absent only for that exact resolved object; never broaden the target.

Retention should call the same primitive and accept `HashSet<String>` protected IDs, not the current single string.

## 6. Download and Local Validation

### Download contract

- Resolve the archive name from a fresh `CompleteRemoteBackup` only.
- Download to `<app-data>/temporary-archives/webdav-restore-<operation-id>/target.zip.part`, then rename locally to `target.zip` only after complete receipt.
- Stream response chunks to disk; do not buffer the full archive in memory.
- MVP hard maximum: **2 GiB** per archive. Reject a sidecar or `Content-Length` over the cap before writing; abort if streamed bytes exceed it.
- Require final byte count to equal sidecar `archiveSizeBytes`. If HTTP `Content-Length` exists, it must also agree.
- Keep the existing 10-second connect timeout, but use a separate bounded archive-transfer timeout (recommended 10 minutes) rather than the current 20-second request timeout.
- On timeout/error/size mismatch, close and delete only the operation's partial local file.
- Never return the remote URL or local temp path to React.

### Validation before safety creation

The target must pass:

- ZIP extraction into a unique empty app-private directory;
- resolved-path containment checks for extracted content;
- exactly one located payload root under the operation directory;
- readable `backup.json`;
- `tickettrail.sqlite3` presence;
- attachments directory/type/count/inclusion rules;
- legacy format behavior currently accepted by `validate_backup_manifest`;
- format v1 required fields;
- rejection of unsupported future archive versions.

The extracted ZIP/internal manifest is the restore payload authority. Sidecar matching is an additional selection/substitution guard, not a replacement for local validation.

### Sidecar/internal-manifest consistency

For **new 001C-created backups**, generate the remote backup ID before archive creation and use the same ID in `backup.json.id` and sidecar `backupId`. Require exact match during restore.

For **existing 001B backups**, internal IDs use `temporary-manual-*` and cannot equal sidecar IDs. Keep a narrow compatibility path:

- sidecar purpose must be `manual`;
- internal ID must match the strict historical `temporary-manual-<uuid>` shape;
- archive format version, created time, app version when present, ticket/journey/attachment counts, and attachment-inclusion flag must match the sidecar;
- actual ZIP size must match the sidecar;
- sidecar archive object name must match the strict sibling filename.

Display-only label, device name, and platform should not block restore. Database size is internal-only and need not match a sidecar field. A mismatch in any identity/payload field aborts before safety creation. Do not weaken this compatibility path to accept arbitrary unrelated internal IDs.

This remains substitution detection, not cryptographic integrity. Checksums/signatures stay in `ARCHIVE-BUNDLE-INTEGRITY-001`.

## 7. Pre-Restore Safety Archive

The safety archive captures the current live TicketTrail state immediately before restore preparation completes.

- Use temporary format-v1 archive creation, not `create_backup` and not local backup retention.
- Generate one remote-safe backup ID and use it consistently in internal manifest and sidecar.
- Use sidecar purpose `preRestoreSafety` and a clear label such as `Before WebDAV restore <local time>`.
- Publish through the extracted existing sidecar-last flow, with `.part` + `MOVE` when supported and final-name compatibility mode otherwise.
- Verify upload size, final sidecar publication, fresh listing visibility, ID/purpose, and final ZIP size.
- Only `ReadyForFinalConfirmation` may be returned after verification succeeds.
- If confirmation fails, keep the safety backup remotely visible. It counts toward the 30-backup limit and appears with a subtle `Safety backup` label.
- Local safety archive/temp extraction is deleted best-effort on cancel, expiry, success, or failure. It never appears in local backup history.

## 8. Retention and Protected IDs

Refactor retention to accept a protected-ID set.

When 30 complete backups exist and safety publication creates number 31:

1. protect selected restore target and new safety ID before listing candidates;
2. sort all other complete backups oldest-first by `createdAt`, then ID;
3. delete another oldest eligible pair through the shared sidecar-first primitive;
4. verify the valid complete count returns to 30 when possible;
5. if no eligible pair can be removed or cleanup fails, allow a temporary count above 30 and report cleanup pending.

Retention failure **after a verified safety publication does not remove restore readiness by itself**. The safety gate is satisfied, and the final confirmation may proceed with a cleanup warning because both protected backups remain. Retention must never choose the target or safety backup merely to meet the cap.

## 9. Operation Locking and Races

Use one small process-local `CloudOperationState` protected by a mutex:

```text
active_mutation: None | Backup | Delete | PreparingRestore | Restoring
prepared_restores: map<operationId, PreparedRestore>
protected_ids: set<backupId>
```

- `Backup now`, delete, restore preparation, restore confirmation, and retention are serialized remote mutations.
- Preparation may release the network mutation slot while waiting for user confirmation, but its target/safety IDs remain in the protected registry.
- Confirm/cancel reacquires the mutex and atomically consumes or cancels the token.
- `Backup now` during a prepared confirmation may run only if it consults protected IDs; the simpler first implementation should reject it as busy.
- Delete + delete, delete + restore, and backup + restore must not race.
- Read-only list may remain unlocked, as today, but its result is never authoritative for mutation; every mutation performs a fresh locked list.
- Test connection may run concurrently only if it uses unique probe names and configuration is immutable during the operation. Saving/clearing configuration should be rejected while a prepared restore exists.
- No cross-process lock exists. TicketTrail should remain single-instance for this MVP, or 001C must explicitly add an app-level single-instance guard before claiming cross-process safety.

## 10. Failure Matrix

| Failure | Live data touched? | Safety exists? | Protected/cleanup behavior | User result and retry |
| --- | --- | --- | --- | --- |
| ID disappears before backend action | No | No | Release requested ID; no delete/download path guessed | `Backup no longer exists`; refresh and retry |
| Fresh remote list fails | No | No | No remote cleanup | Network/auth error; retry safe |
| Authentication expires | No before restore; possibly after restore only during refresh | As reached | Keep published safety; local temp cleanup | Re-authenticate; new preparation required |
| Target ZIP download fails | No | No | Delete partial local file; release target | Retry safe |
| Target exceeds cap or size mismatches | No | No | Delete partial local file; keep target remote | Validation error; retry only after repository fixed |
| ZIP invalid/corrupt | No | No | Delete extracted/temp target; keep remote target | Reject archive |
| Unsupported archive format | No | No | Same as invalid ZIP | Update TicketTrail; no restore |
| Sidecar/internal manifest mismatch | No | No | Same as invalid ZIP | Reject possible mismatched backup |
| Safety archive creation fails | No | No | Delete local safety temp; release target | Retry safe after local issue fixed |
| Safety ZIP upload fails | No | No complete safety | Remove exact temp/unpublished objects best-effort | Restore blocked; retry safe |
| Safety sidecar publication fails | No | No visible safety | Keep/remove orphan ZIP best-effort; never target | Restore blocked; retry safe |
| Safety remote verification fails | No | Maybe visible but unconfirmed | Preserve any valid final pair; remove only temp objects | Restore blocked; refresh/retry preparation |
| Retention cleanup fails after verified safety | No | Yes | Target+safety stay protected; allow >30 | Show cleanup warning; final confirmation may continue |
| User cancels final confirmation | No | Yes | Consume token, delete local temp, retain safety | Cancelled; new preparation required |
| Token expires/restart | No | Yes if published | Invalidate token/protection; best-effort temp cleanup | Prepare again |
| Destructive DB copy fails | Possibly | Yes | Consume token; keep target+safety; no remote cleanup | Critical restore failure with safety ID; do not reuse token |
| Attachment replacement fails | Yes, possibly mixed state | Yes | Same; keep remote safety and target | Critical recovery guidance; no automatic retry/rollback |
| Frontend refresh fails after restore succeeds | Yes, restored | Yes | Backend reports restore success; release operation after result | Ask user to restart/reload; do not rerun restore |
| Delete sidecar fails | No | Not applicable | Do not issue ZIP delete | Delete failed; retry safe |
| Delete ZIP fails after sidecar succeeds | No | Not applicable | Orphan ZIP ignored; cleanup warning | Backup removed from history; cleanup may retry |
| Protected ID delete requested | No | As operation state | No DELETE request | Explain backup is in use |
| Local temp cleanup fails | No additional change | As reached | Record sanitized warning; never delete outside operation dir | Operation result stands; startup cleanup later |
| Remote `.part` cleanup fails | No | As reached | Record exact operation object as pending; no broad scan/delete | Result plus cleanup warning |

## 11. Mandatory Terra Tests

Automated tests must use fake archive/restore/transport boundaries and temporary directories. They must not access real AppData, Windows Credential Manager, or external WebDAV.

### Delete tests

- Sidecar delete is issued before ZIP delete.
- Sidecar failure yields ZIP delete call count `0`.
- ZIP failure after sidecar deletion yields an ignored orphan/cleanup warning.
- Malformed, unknown, stale, or unrelated ID yields remote delete call count `0`.
- Protected target and protected safety IDs yield remote delete call count `0`.

### Safety-gate tests

Use an explicit fake destructive restore call counter:

- safety archive creation failure -> restore call count `0`;
- safety ZIP upload failure -> restore call count `0`;
- safety sidecar publication failure -> restore call count `0`;
- safety remote verification failure -> restore call count `0`;
- target download/size/validation failure -> restore call count `0`;
- user cancellation/expired token -> restore call count `0`.

An error-message assertion alone is insufficient.

### Retention test

Start with 30 valid pairs, choose an old target, publish safety as number 31, protect target+safety, and verify another oldest eligible pair is selected sidecar-first. The valid count returns to 30 when possible. Also verify no eligible candidate permits a safe temporary count of 31.

### Restore validation tests

- missing ZIP object after fresh list;
- response/sidecar size mismatch and stream exceeding 2 GiB cap through a small configurable test cap;
- invalid/corrupt ZIP;
- missing `backup.json` or SQLite;
- unsupported future format;
- current 001B internal-ID compatibility accepted only under strict historical rules;
- new exact sidecar/internal ID match accepted;
- sidecar/internal format, time, counts, or attachment mismatch rejected.

### Restore operation tests

- prepared target cannot be substituted by another ID;
- token is random, single-use, and cannot be replayed after success or destructive failure;
- cancellation and expiry prevent restore and remove local temp;
- process-local registry restart invalidates token;
- config change invalidates/rejects prepared operation;
- successful restore releases target/safety protection after result recording;
- restore failure keeps safety protected through failure handling;
- concurrent backup/delete/restore attempts are rejected or serialized as designed.

### Destructive primitive tests

- The prepared payload is revalidated immediately before destructive restore.
- A successful restore uses only the backend-held extracted path.
- Database-copy failure and attachment-replacement failure return the published safety ID.
- Frontend refresh failure cannot cause the backend restore command to run twice.

## 12. UI Contract

Keep the existing full-screen `View backups` modal and pagination.

- Add `Restore backup` and an accessible trash/Delete action to each complete remote backup.
- Delete confirmation: `Delete this remote backup? This will not delete current tickets, journeys, or attached files.`
- Initial restore action explains that the selected backup will replace local data and that TicketTrail must first publish a WebDAV safety backup.
- Preparation shows non-destructive progress states and can be cancelled before restore starts.
- Only after preparation succeeds, show final confirmation naming the selected backup and verified safety backup.
- After final confirmation starts, disable close/cancel until Rust returns.
- Show `preRestoreSafety` entries with a subtle `Safety backup` label; they remain normal visible entries and count toward 30.
- Refresh history after delete, preparation safety publication, cancellation, and restore completion.

## 13. Local Backup Separation

- Keep the existing local backup backend and files untouched.
- Keep local backups hidden from the primary WebDAV-backed history UI.
- Keep offline `Export archive bundle` / `Import archive bundle` unchanged.
- Offline archive import continues creating a persistent local `Before archive import ...` backup.
- WebDAV restore creates and publishes a temporary WebDAV safety snapshot and does not create a persistent local backup-history entry.
- Do not clean or migrate historical local backups in 001C.

## 14. Manual Verification Outline for 001C

The real Jianguoyun manual verification passed:

- Restore replaced current local data with the selected remote backup.
- Prepare -> final confirmation -> Cancel left current local data unchanged.
- The remote `preRestoreSafety` backup remained after cancellation.
- User-triggered remote Delete removed the selected backup without modifying current local Ticket/Journey data.

1. Create current-state records and a remote backup; change local records afterward.
2. Start Restore and verify final overwrite confirmation appears only after a visible `Safety backup` appears remotely.
3. Cancel final confirmation; verify local records are unchanged and safety backup remains.
4. Restore again and confirm; verify target tickets, journeys, attachments, and refreshed UI.
5. Simulate wrong credentials/network failure during safety upload; verify no local records change.
6. Try delete on a normal remote backup; verify current local records remain.
7. Force sidecar delete failure and verify ZIP remains; force ZIP delete failure and verify history ignores the orphan.
8. At 30 backups, restore an old target and verify target+safety survive while another eligible oldest backup is pruned.
9. Confirm offline archive import still creates its local safety backup independently.

## 15. Remaining Risks and Explicit Exclusions

Risks requiring careful implementation/manual testing:

- The current destructive primitive is not transactional across SQLite and attachments; automatic rollback remains absent.
- PowerShell ZIP extraction needs strict temp-root containment review; a native archive library may be a later hardening task.
- No checksum/signature protects against same-size remote object substitution or corruption.
- 001C now streams both archive upload and download; the remaining transfer risk is operational timeout/provider behavior rather than whole-archive memory buffering.
- The cloud lock is process-local; cross-process behavior depends on single-instance desktop use.
- Provider-specific WebDAV behavior, timeouts, and partial DELETE/MOVE responses need fake-server and real-provider testing.

Out of scope remains automatic backup, scheduling/dirty tracking, sync/merge, first-party storage/accounts, Web client, archive format v2, checksum/signature/encryption, automatic rollback, DB migration, local-backup cleanup, and flight-secret migration.

## 16. Recommended 001C Implementation Order

1. Extract testable archive validation/restore and WebDAV transport traits without changing behavior.
2. Add shared cloud operation registry, protected-ID set, and pair-delete primitive.
3. Add bounded streaming download and strict sidecar/internal compatibility validation.
4. Add shared remote publisher for `preRestoreSafety` with protected-set retention.
5. Implement prepare/confirm/cancel restore commands and mandatory call-counter tests.
6. Add remote delete command and failure-order tests.
7. Wire existing history modal controls, confirmations, progress, and refresh.
8. Run fake-server, full Rust/frontend, and manual real-provider safety verification before commit.
