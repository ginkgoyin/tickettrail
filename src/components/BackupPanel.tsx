import { useState } from "react";
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
  onExportArchiveBundle,
  onImportArchiveBundle,
  onRestoreBackup,
  onExportBackup,
}: BackupPanelProps) {
  const { language } = useI18n();
  const latestBackup = backups[0];
  const [bundlePath, setBundlePath] = useState("");
  const copy = {
    createBackup: language === "zh" ? "创建备份" : "Create backup",
    exportArchiveBundle: language === "zh" ? "导出整库包" : "Export archive bundle",
    description:
      language === "zh"
        ? "备份会保存当前 SQLite 数据库和附件目录。恢复备份或导入整库包后，当前票据和附件会被备份内容覆盖。"
        : "Backups include the current SQLite database and attachment directory. Restoring a backup or importing an archive bundle will overwrite the current tickets and attachments.",
    importArchivePath: language === "zh" ? "导入整库包路径" : "Import archive bundle path",
    importArchivePlaceholder:
      language === "zh"
        ? "例如：C:\\Users\\YourUser\\Downloads\\tickettrail-archive.zip"
        : "Example: C:\\Users\\YourUser\\Downloads\\tickettrail-archive.zip",
    importArchiveBundle: language === "zh" ? "导入整库包" : "Import archive bundle",
    backupReadiness: language === "zh" ? "备份前校验" : "Backup readiness",
    databaseAvailable: language === "zh" ? "数据库文件可用" : "Database file available",
    databaseMissing: language === "zh" ? "数据库文件不存在" : "Database file missing",
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
          <h3>Backups</h3>
        </div>
        <div className="backup-card-actions">
          <button className="ghost-button compact-button" disabled={isBusy} onClick={onCreateBackup} type="button">
            {copy.createBackup}
          </button>
          <button
            className="ghost-button compact-button"
            disabled={isBusy}
            onClick={onExportArchiveBundle}
            type="button"
          >
            {copy.exportArchiveBundle}
          </button>
        </div>
      </div>

      <p className="backup-copy">{copy.description}</p>

      <div className="backup-import-panel">
        <label>
          {copy.importArchivePath}
          <input
            onChange={(event) => setBundlePath(event.target.value)}
            placeholder={copy.importArchivePlaceholder}
            value={bundlePath}
          />
        </label>
        <button
          className="ghost-button compact-button"
          disabled={isBusy || !bundlePath.trim()}
          onClick={() => onImportArchiveBundle(bundlePath.trim())}
          type="button"
        >
          {copy.importArchiveBundle}
        </button>
      </div>

      {readiness ? (
        <div className="backup-highlight">
          <strong>{copy.backupReadiness}</strong>
          <span>{readiness.databaseExists ? copy.databaseAvailable : copy.databaseMissing}</span>
          <small>{`${readiness.ticketCount} ${copy.tickets} · ${readiness.attachmentCount} ${copy.attachments}`}</small>
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
