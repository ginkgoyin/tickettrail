import type { BackupReadiness, BackupRecord } from "../types/ticket";

interface BackupPanelProps {
  backups: BackupRecord[];
  readiness: BackupReadiness | null;
  isBusy: boolean;
  statusMessage: string;
  onCreateBackup: () => void;
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
  const latestBackup = backups[0];

  return (
    <section className="panel backup-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Safety</p>
          <h3>Backups</h3>
        </div>
        <button className="ghost-button compact-button" disabled={isBusy} onClick={onCreateBackup} type="button">
          创建备份
        </button>
      </div>

      <p className="backup-copy">
        备份会保存当前 SQLite 数据库和附件目录。恢复后，当前票据和附件会被备份内容覆盖。
      </p>

      {readiness ? (
        <div className="backup-highlight">
          <strong>备份前校验</strong>
          <span>{readiness.databaseExists ? "数据库文件可用" : "数据库文件不存在"}</span>
          <small>{`${readiness.ticketCount} 张票 · ${readiness.attachmentCount} 个附件`}</small>
        </div>
      ) : null}

      {latestBackup ? (
        <div className="backup-highlight">
          <strong>最近一次备份</strong>
          <span>{latestBackup.label}</span>
          <small>{formatDateTime(latestBackup.createdAt)}</small>
        </div>
      ) : null}

      {statusMessage ? <p className="backup-status">{statusMessage}</p> : null}

      <div className="backup-list">
        {backups.length === 0 ? (
          <div className="empty-state">
            <strong>还没有备份</strong>
            <p>建议在开始长期录入之前先创建第一份备份。</p>
          </div>
        ) : (
          backups.map((backup) => (
            <div className="backup-card" key={backup.id}>
              <div className="backup-card-main">
                <strong>{backup.label}</strong>
                <span>{formatDateTime(backup.createdAt)}</span>
              </div>
              <div className="backup-card-meta">
                <span>{backup.ticketCount} 张票</span>
                <span>{backup.attachmentCount} 个附件</span>
                <span>{formatSize(backup.databaseSizeBytes)}</span>
              </div>
              <div className="backup-card-actions">
                <button
                  className="ghost-button compact-button"
                  disabled={isBusy}
                  onClick={() => onExportBackup(backup.id)}
                  type="button"
                >
                  导出备份
                </button>
                <button
                  className="ghost-button compact-button"
                  disabled={isBusy}
                  onClick={() => onRestoreBackup(backup.id)}
                  type="button"
                >
                  恢复这个备份
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
