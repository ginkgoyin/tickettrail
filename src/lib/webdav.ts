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
