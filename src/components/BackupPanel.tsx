import { useI18n } from "../lib/i18n";
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
}

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
}: BackupPanelProps) {
  const { language } = useI18n();
  const latestBackup = backups[0];
  const copy = {
    localBackups: language === "zh" ? "本地备份" : "Local backups",
    localBackupsCopy:
      language === "zh"
        ? "在进行大改动、导入或恢复前，先创建一个本地备份。"
        : "Create a local backup before major edits, imports, or restores.",
    createBackup: language === "zh" ? "创建备份" : "Create backup",
    backupReadiness: language === "zh" ? "备份就绪检查" : "Backup readiness",
    databaseAvailable: language === "zh" ? "数据库文件可用" : "Database file available",
    databaseMissing: language === "zh" ? "数据库文件缺失" : "Database file missing",
    latestBackup: language === "zh" ? "最近一次备份" : "Latest backup",
    noBackupsYet: language === "zh" ? "还没有备份" : "No backups yet",
    noBackupsHint:
      language === "zh"
        ? "建议在开始长期录入前先创建第一份备份。"
        : "Create the first backup before you start long-term ticket entry.",
    tickets: language === "zh" ? "张票" : "ticket(s)",
    attachments: language === "zh" ? "个附件" : "attachment(s)",
    exportBackup: language === "zh" ? "导出备份" : "Export backup",
    restoreBackup: language === "zh" ? "恢复这个备份" : "Restore this backup",
  } as const;

  return (
    <section className="panel backup-panel">
      <div className="panel-heading">
        <div>
          <h3>{copy.localBackups}</h3>
        </div>
        <div className="backup-card-actions">
          <button className="ghost-button compact-button" disabled={isBusy} onClick={onCreateBackup} type="button">
            {copy.createBackup}
          </button>
        </div>
      </div>

      <p className="backup-copy">{copy.localBackupsCopy}</p>

      {readiness ? (
        <div className="backup-highlight">
          <strong>{copy.backupReadiness}</strong>
          <span>{readiness.databaseExists ? copy.databaseAvailable : copy.databaseMissing}</span>
          <small>{`${readiness.ticketCount} ${copy.tickets} - ${readiness.attachmentCount} ${copy.attachments}`}</small>
        </div>
      ) : null}

      {latestBackup ? (
        <div className="backup-highlight">
          <strong>{copy.latestBackup}</strong>
          <span>{latestBackup.label}</span>
          <small>{formatDateTime(latestBackup.createdAt)}</small>
        </div>
      ) : null}

      {statusMessage ? <p className="backup-status">{statusMessage}</p> : null}

      <div className="backup-list">
        {backups.length === 0 ? (
          <div className="empty-state">
            <strong>{copy.noBackupsYet}</strong>
            <p>{copy.noBackupsHint}</p>
          </div>
        ) : (
          backups.map((backup) => (
            <div className="backup-card" key={backup.id}>
              <div className="backup-card-main">
                <strong>{backup.label}</strong>
                <span>{formatDateTime(backup.createdAt)}</span>
              </div>
              <div className="backup-card-meta">
                <span>{`${backup.ticketCount} ${copy.tickets}`}</span>
                <span>{`${backup.attachmentCount} ${copy.attachments}`}</span>
                <span>{formatSize(backup.databaseSizeBytes)}</span>
              </div>
              <div className="backup-card-actions">
                <button
                  className="ghost-button compact-button"
                  disabled={isBusy}
                  onClick={() => onExportBackup(backup.id)}
                  type="button"
                >
                  {copy.exportBackup}
                </button>
                <button
                  className="ghost-button compact-button"
                  disabled={isBusy}
                  onClick={() => onRestoreBackup(backup.id)}
                  type="button"
                >
                  {copy.restoreBackup}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
