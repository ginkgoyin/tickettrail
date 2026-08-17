import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { WebDavRemoteBackup, WebDavRestoreReadyResult } from "../lib/webdav";
import { AppIcon } from "./AppIcon";

interface BackupPanelProps {
  backups: WebDavRemoteBackup[];
  isBusy: boolean;
  isConfigured: boolean;
  connectionSucceeded?: boolean;
  lastTestedAt?: string;
  statusMessage: string;
  onCreateBackup: () => void;
  onOpenWebDavSettings: () => void;
  onDeleteBackup: (backup: WebDavRemoteBackup) => Promise<void>;
  onPrepareRestore: (backup: WebDavRemoteBackup) => Promise<WebDavRestoreReadyResult>;
  onConfirmRestore: (operationId: string) => Promise<void>;
  onCancelRestore: (operationId: string) => Promise<void>;
}

const BACKUPS_PAGE_SIZE = 10;

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.replace("T", " ").slice(0, 19);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatBackupEnvironment(backup: WebDavRemoteBackup) {
  return [backup.deviceName, backup.platform].filter(Boolean).join(" - ");
}

function actionErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

export function BackupPanel({ backups, isBusy, isConfigured, connectionSucceeded, lastTestedAt, statusMessage, onCreateBackup, onOpenWebDavSettings, onDeleteBackup, onPrepareRestore, onConfirmRestore, onCancelRestore }: BackupPanelProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [actionBusy, setActionBusy] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<WebDavRemoteBackup | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<WebDavRemoteBackup | null>(null);
  const [restoreReady, setRestoreReady] = useState<WebDavRestoreReadyResult | null>(null);
  const [actionError, setActionError] = useState("");
  const latestBackup = backups[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(backups.length / BACKUPS_PAGE_SIZE));
  useEffect(() => setHistoryPage((current) => Math.min(current, totalPages)), [totalPages]);
  const visibleBackups = useMemo(() => {
    const startIndex = (historyPage - 1) * BACKUPS_PAGE_SIZE;
    return backups.slice(startIndex, startIndex + BACKUPS_PAGE_SIZE);
  }, [backups, historyPage]);
  const connectionLabel = connectionSucceeded === true ? "Connected" : connectionSucceeded === false ? "Connection failed" : isConfigured ? "Saved - not yet tested" : "WebDAV not configured";

  const historyModal = isHistoryOpen ? createPortal(
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="backup-history-dialog-title" aria-modal="true" className="modal-shell tickets-modal backup-history-modal" role="dialog">
        <div className="tickets-modal-header">
          <div><h3 id="backup-history-dialog-title">Backups</h3><p className="hero-copy">Complete WebDAV backups. Restoring first creates and verifies a separate safety backup.</p></div>
          <button aria-label="Close backup history" className="modal-close-button" disabled={isBusy || actionBusy} onClick={() => setIsHistoryOpen(false)} type="button"><AppIcon className="modal-close-icon" name="close" size={20} /></button>
        </div>
        <div className="tickets-modal-body backup-history-body">
          {visibleBackups.length === 0 ? <div className="empty-state backup-history-empty"><strong>No WebDAV backups yet</strong><p>Create the first backup after connecting your WebDAV storage.</p></div> : (
            <div className="backup-list">{visibleBackups.map((backup) => (
              <div className="backup-card" key={backup.id}>
                <div className="backup-card-main"><strong>{backup.label}</strong><span>{formatDateTime(backup.createdAt)}</span></div>
                <div className="backup-card-meta"><span>{`${backup.ticketCount} ticket(s)`}</span><span>{`${backup.journeyCount} journey(s)`}</span><span>{`${backup.attachmentCount} attached file(s)${backup.attachmentsIncluded ? " included" : ""}`}</span><span>{formatSize(backup.archiveSizeBytes)}</span></div>
                <div className="backup-card-meta backup-card-source-meta"><span>{`Format v${backup.archiveFormatVersion}`}</span>{backup.purpose === "preRestoreSafety" ? <span>Restore safety backup</span> : null}{backup.appVersion ? <span>{`TicketTrail ${backup.appVersion}`}</span> : null}{formatBackupEnvironment(backup) ? <span>{formatBackupEnvironment(backup)}</span> : null}</div>
                <div className="backup-card-actions"><button className="ghost-button compact-button" disabled={isBusy || actionBusy} onClick={() => { setActionError(""); setRestoreCandidate(backup); }} type="button">Restore</button><button className="danger-button compact-button" disabled={isBusy || actionBusy} onClick={() => { setActionError(""); setDeleteCandidate(backup); }} type="button">Delete</button></div>
              </div>
            ))}</div>
          )}
          {backups.length > BACKUPS_PAGE_SIZE ? <div className="backup-history-pagination"><button className="ghost-button compact-button" disabled={isBusy || historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} type="button">Previous</button><span>{`Page ${historyPage} of ${totalPages}`}</span><button className="ghost-button compact-button" disabled={isBusy || historyPage >= totalPages} onClick={() => setHistoryPage((current) => Math.min(totalPages, current + 1))} type="button">Next</button></div> : null}
          {actionError ? <p className="settings-status-message">{actionError}</p> : null}
        </div>
      </div>
    </div>, document.body,
  ) : null;

  const confirmationModal = (deleteCandidate || restoreCandidate || restoreReady) ? createPortal(
    <div className="modal-backdrop" role="presentation"><div aria-modal="true" className="modal-shell tickets-modal" role="dialog">
      <div className="tickets-modal-header"><div><h3>{deleteCandidate ? "Delete remote backup" : restoreReady ? "Confirm restore" : "Prepare restore"}</h3></div></div>
      <div className="tickets-modal-body">
        {deleteCandidate ? <><p className="hero-copy">Delete “{deleteCandidate.label}” from WebDAV? This removes only the remote backup and cannot be undone. Current local tickets, journeys, and attached files are unaffected.</p><div className="backup-card-actions"><button className="danger-button" disabled={actionBusy} onClick={() => void (async () => { setActionBusy(true); try { await onDeleteBackup(deleteCandidate); setDeleteCandidate(null); } catch (error) { setActionError(actionErrorMessage(error, "Could not delete the remote backup.")); setDeleteCandidate(null); } finally { setActionBusy(false); } })()} type="button">Delete backup</button><button className="ghost-button" disabled={actionBusy} onClick={() => setDeleteCandidate(null)} type="button">Cancel</button></div></> : null}
        {restoreCandidate && !restoreReady ? <><p className="hero-copy">TicketTrail will download and validate this backup, then create and verify a safety backup of your current local data. Your local data will not change in this step.</p><div className="backup-card-actions"><button className="ghost-button" disabled={actionBusy} onClick={() => void (async () => { setActionBusy(true); try { setRestoreReady(await onPrepareRestore(restoreCandidate)); } catch (error) { setActionError(actionErrorMessage(error, "Could not prepare the restore.")); setRestoreCandidate(null); } finally { setActionBusy(false); } })()} type="button">Prepare restore</button><button className="ghost-button" disabled={actionBusy} onClick={() => setRestoreCandidate(null)} type="button">Cancel</button></div></> : null}
        {restoreReady ? <><p className="hero-copy">Safety backup “{restoreReady.safetyBackup.label}” is verified. Restore “{restoreReady.targetBackup.label}” to this computer now? This replaces the active local database and attachments.</p>{actionError ? <p className="settings-status-message">{actionError}</p> : null}<div className="backup-card-actions"><button className="danger-button" disabled={actionBusy} onClick={() => void (async () => { setActionBusy(true); try { await onConfirmRestore(restoreReady.operationId); setRestoreReady(null); setRestoreCandidate(null); setIsHistoryOpen(false); } catch (error) { setActionError(actionErrorMessage(error, "Restore failed. Your safety backup remains available.")); setRestoreReady(null); setRestoreCandidate(null); } finally { setActionBusy(false); } })()} type="button">Restore now</button><button className="ghost-button" disabled={actionBusy} onClick={() => void (async () => { try { await onCancelRestore(restoreReady.operationId); setRestoreReady(null); setRestoreCandidate(null); } catch (error) { setActionError(actionErrorMessage(error, "Could not cancel the prepared restore.")); } })()} type="button">Cancel</button></div></> : null}
      </div>
    </div></div>, document.body,
  ) : null;

  return <section className="panel backup-panel">
    <div className="panel-heading"><div><h3>Backups</h3></div><div className="backup-card-actions">
      <button className="ghost-button compact-button" disabled={isBusy || connectionSucceeded !== true} onClick={onCreateBackup} type="button">{isBusy ? "Creating backup..." : "Create backup"}</button>
      <button className="ghost-button compact-button" disabled={isBusy} onClick={() => setIsHistoryOpen(true)} type="button">View backups</button>
      <button className="ghost-button compact-button" disabled={isBusy} onClick={onOpenWebDavSettings} type="button">WebDAV settings</button>
    </div></div>
    <p className="backup-copy">TicketTrail keeps working data on this computer and stores completed backups in your WebDAV repository.</p>
    <div className="backup-summary-grid">
      <div className="backup-highlight"><strong>Backup connection</strong><span>{connectionLabel}</span><small>{lastTestedAt ? `Last tested ${formatDateTime(lastTestedAt)}` : "Configure WebDAV to enable backups."}</small></div>
      <div className="backup-highlight"><strong>Total backups</strong><span>{backups.length === 0 ? "No backups yet" : `${backups.length} backup${backups.length === 1 ? "" : "s"}`}</span><small>Complete WebDAV backups only.</small></div>
      <div className="backup-highlight"><strong>Latest backup</strong>{latestBackup ? <><span>{latestBackup.label}</span><small>{`${formatDateTime(latestBackup.createdAt)} - ${formatSize(latestBackup.archiveSizeBytes)}`}</small></> : <><span>No backups yet</span><small>Create a backup after connecting WebDAV.</small></>}</div>
    </div>
    {statusMessage ? <p className="backup-status">{statusMessage}</p> : null}
    {historyModal}
    {confirmationModal}
  </section>;
}
