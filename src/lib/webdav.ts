import { invoke } from "@tauri-apps/api/core";

export interface WebDavCapabilities {
  webdavAccessible: boolean;
  managedDirectoryWritable: boolean;
  moveSupported: boolean;
}

export interface WebDavConfig {
  configured: boolean;
  serverUrl: string;
  username: string;
  remoteFolder: string;
  hasPassword: boolean;
  autoBackupMode: "off" | "afterEveryChange" | "every1Day" | "every3Days" | "every7Days";
  lastTestedAt?: string;
  lastConnectionSucceeded?: boolean;
  capabilities?: WebDavCapabilities;
}

export interface WebDavConfigSaveInput {
  serverUrl: string;
  username: string;
  remoteFolder: string;
  password?: string;
  clearPassword?: boolean;
}

export interface WebDavConnectionTestResult {
  success: boolean;
  testedAt: string;
  managedDirectory: string;
  capabilities?: WebDavCapabilities;
  errorCode?: string;
  message: string;
  cleanupWarning?: string;
}

export interface WebDavRemoteBackup {
  id: string;
  label: string;
  createdAt: string;
  purpose: "manual" | "automatic" | "preRestoreSafety";
  appVersion?: string;
  deviceName?: string;
  platform?: string;
  ticketCount: number;
  journeyCount: number;
  attachmentCount: number;
  attachmentsIncluded: boolean;
  archiveFormatVersion: number;
  archiveSizeBytes: number;
}

export interface WebDavBackupNowResult {
  backup: WebDavRemoteBackup;
  cleanupWarning?: string;
}

export interface WebDavRestoreReadyResult {
  operationId: string;
  targetBackup: WebDavRemoteBackup;
  safetyBackup: WebDavRemoteBackup;
  expiresAt: string;
  cleanupWarning?: string;
}

export interface WebDavRestoreResult {
  restoredBackupId: string;
  safetyBackup: WebDavRemoteBackup;
}

export interface WebDavDeleteResult {
  deletedBackupId: string;
  cleanupWarning?: string;
}

const DEFAULT_CONFIG: WebDavConfig = {
  configured: false,
  serverUrl: "",
  username: "",
  remoteFolder: "TicketTrail",
  hasPassword: false,
  autoBackupMode: "off",
};

function supportsTauri() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getWebDavConfig(): Promise<WebDavConfig> {
  if (!supportsTauri()) {
    return DEFAULT_CONFIG;
  }
  return invoke<WebDavConfig>("get_webdav_config");
}

export async function saveWebDavConfig(
  config: WebDavConfigSaveInput,
): Promise<WebDavConfig> {
  if (!supportsTauri()) {
    throw new Error("Secure WebDAV configuration is available in the desktop app only.");
  }
  return invoke<WebDavConfig>("save_webdav_config", { config });
}

export async function testWebDavConnection(): Promise<WebDavConnectionTestResult> {
  if (!supportsTauri()) {
    throw new Error("WebDAV connection testing is available in the desktop app only.");
  }
  return invoke<WebDavConnectionTestResult>("test_webdav_connection");
}

export async function backupNowWebDav(): Promise<WebDavBackupNowResult> {
  if (!supportsTauri()) {
    throw new Error("Cloud backup is available in the desktop app only.");
  }
  return invoke<WebDavBackupNowResult>("backup_now_webdav");
}

export async function listWebDavBackups(): Promise<WebDavRemoteBackup[]> {
  if (!supportsTauri()) {
    return [];
  }
  return invoke<WebDavRemoteBackup[]>("list_webdav_backups");
}

export async function prepareWebDavRestore(backupId: string): Promise<WebDavRestoreReadyResult> {
  if (!supportsTauri()) throw new Error("WebDAV restore is available in the desktop app only.");
  return invoke<WebDavRestoreReadyResult>("prepare_webdav_restore", { backupId });
}

export async function confirmWebDavRestore(operationId: string): Promise<WebDavRestoreResult> {
  if (!supportsTauri()) throw new Error("WebDAV restore is available in the desktop app only.");
  return invoke<WebDavRestoreResult>("confirm_webdav_restore", { operationId });
}

export async function cancelWebDavRestore(operationId: string): Promise<void> {
  if (!supportsTauri()) return;
  await invoke("cancel_webdav_restore", { operationId });
}

export async function deleteWebDavBackup(backupId: string): Promise<WebDavDeleteResult> {
  if (!supportsTauri()) throw new Error("WebDAV backup deletion is available in the desktop app only.");
  return invoke<WebDavDeleteResult>("delete_webdav_backup", { backupId });
}
