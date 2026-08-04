import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "./AppIcon";
import type { BackupReadiness, BackupRecord } from "../types/ticket";

interface BackupPanelProps {
  backups: BackupRecord[];
  readiness: BackupReadiness | null;
  isBusy: boolean;
  statusMessage: string;
  onCreateBackup: () => void;
  onExportArchiveBundle: () => void;
  onImportArchiveBundle: (bundlePath: string) => void;
  onRestoreBackup: (backupId: string) => void;
  onExportBackup: (backupId: string) => void;
  onDeleteBackup: (backupId: string) => Promise<void> | void;
}

const BACKUPS_PAGE_SIZE = 10;

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 19);
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

export function BackupPanel({
  backups,
  readiness,
  isBusy,
  statusMessage,
  onCreateBackup,
  onRestoreBackup,
  onExportBackup,
  onDeleteBackup,
}: BackupPanelProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [pendingDeleteBackup, setPendingDeleteBackup] = useState<BackupRecord | null>(null);
  const latestBackup = backups[0] ?? null;
  const totalPages = Math.max(1, Math.ceil(backups.length / BACKUPS_PAGE_SIZE));

  useEffect(() => {
    setHistoryPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const visibleBackups = useMemo(() => {
    const startIndex = (historyPage - 1) * BACKUPS_PAGE_SIZE;
    return backups.slice(startIndex, startIndex + BACKUPS_PAGE_SIZE);
  }, [backups, historyPage]);

  const handleConfirmDeleteBackup = async () => {
    if (!pendingDeleteBackup) {
      return;
    }

    await onDeleteBackup(pendingDeleteBackup.id);
    setPendingDeleteBackup(null);
  };

  const historyModal = isHistoryOpen ? createPortal((
    <div className="modal-backdrop" role="presentation">
      <div aria-labelledby="backup-history-dialog-title" aria-modal="true" className="modal-shell tickets-modal backup-history-modal" role="dialog">
        <div className="tickets-modal-header">
          <h3 id="backup-history-dialog-title">Local backups</h3>
          <button
            aria-label="Close backup history"
            className="modal-close-button"
            disabled={isBusy}
            onClick={() => setIsHistoryOpen(false)}
            type="button"
          >
            <AppIcon className="modal-close-icon" name="close" size={20} />
          </button>
        </div>

        <div className="tickets-modal-body backup-history-body">
          {visibleBackups.length === 0 ? (
            <div className="empty-state backup-history-empty">
              <strong>No backups yet</strong>
              <p>Create the first backup before you start long-term ticket entry.</p>
            </div>
          ) : (
            <div className="backup-list">
              {visibleBackups.map((backup) => (
                <div className="backup-card" key={backup.id}>
                  <div className="backup-card-main">
                    <strong>{backup.label}</strong>
                    <span>{formatDateTime(backup.createdAt)}</span>
                  </div>
                  <div className="backup-card-meta">
                    <span>{`${backup.ticketCount} ticket(s)`}</span>
                    <span>{`${backup.attachmentCount} attachment(s)`}</span>
                    <span>{formatSize(backup.databaseSizeBytes)}</span>
                  </div>
                  <div className="backup-card-actions backup-card-actions-end">
                    <button
                      className="ghost-button compact-button"
                      disabled={isBusy}
                      onClick={() => onExportBackup(backup.id)}
                      type="button"
                    >
                      Export backup
                    </button>
                    <button
                      className="ghost-button compact-button"
                      disabled={isBusy}
                      onClick={() => onRestoreBackup(backup.id)}
                      type="button"
                    >
                      Restore this backup
                    </button>
                    <button
                      aria-label={`Delete backup ${backup.label}`}
                      className="ghost-icon-button"
                      disabled={isBusy}
                      onClick={() => setPendingDeleteBackup(backup)}
                      type="button"
                    >
                      <AppIcon name="trash" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {backups.length > BACKUPS_PAGE_SIZE ? (
            <div className="backup-history-pagination">
              <button
                className="ghost-button compact-button"
                disabled={isBusy || historyPage <= 1}
                onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span>{`Page ${historyPage} of ${totalPages}`}</span>
              <button
                className="ghost-button compact-button"
                disabled={isBusy || historyPage >= totalPages}
                onClick={() => setHistoryPage((current) => Math.min(totalPages, current + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {pendingDeleteBackup ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-labelledby="delete-backup-dialog-title" aria-modal="true" className="modal-shell tickets-modal backup-delete-modal" role="dialog">
            <div className="tickets-modal-header">
              <div>
                <h3 id="delete-backup-dialog-title">Delete this backup?</h3>
                <p className="hero-copy">
                  This removes only the selected local backup. It will not delete current tickets or attachments.
                </p>
              </div>
              <button
                aria-label="Close delete backup dialog"
                className="modal-close-button"
                disabled={isBusy}
                onClick={() => setPendingDeleteBackup(null)}
                type="button"
              >
                <AppIcon className="modal-close-icon" name="close" size={20} />
              </button>
            </div>

            <div className="tickets-modal-body backup-delete-body">
              <div className="backup-delete-summary">
                <strong>{pendingDeleteBackup.label}</strong>
                <span>{formatDateTime(pendingDeleteBackup.createdAt)}</span>
              </div>
              <div className="backup-card-meta backup-delete-meta">
                <span>{`${pendingDeleteBackup.ticketCount} ticket(s)`}</span>
                <span>{`${pendingDeleteBackup.attachmentCount} attachment(s)`}</span>
                <span>{formatSize(pendingDeleteBackup.databaseSizeBytes)}</span>
              </div>
              <div className="backup-history-pagination backup-delete-actions">
                <button className="ghost-button compact-button" disabled={isBusy} onClick={() => setPendingDeleteBackup(null)} type="button">
                  Cancel
                </button>
                <button className="ghost-button compact-button danger-button" disabled={isBusy} onClick={() => void handleConfirmDeleteBackup()} type="button">
                  Delete backup
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  ), document.body) : null;

  return (
    <section className="panel backup-panel">
      <div className="panel-heading">
        <div>
          <h3>Local backups</h3>
        </div>
        <div className="backup-card-actions">
          <button className="ghost-button compact-button" disabled={isBusy} onClick={onCreateBackup} type="button">
            Create backup
          </button>
          <button className="ghost-button compact-button" disabled={isBusy} onClick={() => setIsHistoryOpen(true)} type="button">
            View backups
          </button>
        </div>
      </div>

      <p className="backup-copy">
        Create a local backup before major edits, imports, or restores. Use View backups to export, restore, or delete older local backups.
      </p>

      <div className="backup-summary-grid">
        {readiness ? (
          <div className="backup-highlight">
            <strong>Backup readiness</strong>
            <span>{readiness.databaseExists ? "Database file available" : "Database file missing"}</span>
            <small>{`${readiness.ticketCount} ticket(s) - ${readiness.attachmentCount} attachment(s)`}</small>
          </div>
        ) : null}

        <div className="backup-highlight">
          <strong>Total backups</strong>
          <span>{backups.length === 0 ? "No backups yet" : `${backups.length} backup${backups.length === 1 ? "" : "s"}`}</span>
          <small>Local backup folders only. Exported archive zip files are not part of this count.</small>
        </div>

        <div className="backup-highlight">
          <strong>Latest backup</strong>
          {latestBackup ? (
            <>
              <span>{latestBackup.label}</span>
              <small>{`${formatDateTime(latestBackup.createdAt)} - ${formatSize(latestBackup.databaseSizeBytes)}`}</small>
            </>
          ) : (
            <>
              <span>No backups yet</span>
              <small>Create the first backup before you start long-term ticket entry.</small>
            </>
          )}
        </div>
      </div>

      {statusMessage ? <p className="backup-status">{statusMessage}</p> : null}
      {historyModal}
    </section>
  );
}
