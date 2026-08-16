import { useEffect, useState, type ComponentProps } from "react";
import { AppIcon } from "../components/AppIcon";
import { BackupPanel } from "../components/BackupPanel";
import {
  getExportFolderInfo,
  getLocalDataFolderInfo,
  openExportFolder,
  openLocalDataFolder,
  pickArchiveBundleFile,
  type ExportFolderInfo,
} from "../lib/ticketService";
import {
  getFlightDataSourceConfig,
  saveFlightDataSourceConfig,
  type FlightDataSourceConfig,
  type FlightDataSourceGateway,
  type FlightDataSourceProvider,
} from "../lib/flightLookup";
import { useI18n, type Language } from "../lib/i18n";
import {
  getWebDavConfig,
  saveWebDavConfig,
  testWebDavConnection,
  type WebDavConfig,
} from "../lib/webdav";

type BackupPanelProps = ComponentProps<typeof BackupPanel>;
type SettingsSubview = "appearance" | "export" | "about";

interface SettingsPageProps {
  archiveTransferNotice: {
    kind: "success" | "error";
    title: string;
    message: string;
  } | null;
  backupPanelProps: BackupPanelProps;
  initialSubview?: SettingsSubview;
  onDismissArchiveTransferNotice: () => void;
}

function formatSavedAt(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function readableError(error: unknown, fallback: string) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function SettingsPage({
  archiveTransferNotice,
  backupPanelProps,
  initialSubview = "appearance",
  onDismissArchiveTransferNotice,
}: SettingsPageProps) {
  const { language, setLanguage, t } = useI18n();
  const [subview, setSubview] = useState<SettingsSubview>(initialSubview);
  const [flightDataSourceConfig, setFlightDataSourceConfig] = useState<FlightDataSourceConfig>({
    provider: "mock",
    gateway: "apiMarket",
    hasApiKey: false,
  });
  const [flightDataSourceApiKeyDraft, setFlightDataSourceApiKeyDraft] = useState("");
  const [flightDataSourceBusy, setFlightDataSourceBusy] = useState(false);
  const [flightDataSourceStatus, setFlightDataSourceStatus] = useState("");
  const [showFlightDataSourceApiKey, setShowFlightDataSourceApiKey] = useState(false);
  const [exportFolderInfo, setExportFolderInfo] = useState<ExportFolderInfo | null>(null);
  const [exportFolderBusy, setExportFolderBusy] = useState(false);
  const [exportFolderStatus, setExportFolderStatus] = useState("");
  const [localDataFolderInfo, setLocalDataFolderInfo] = useState<ExportFolderInfo | null>(null);
  const [localDataFolderBusy, setLocalDataFolderBusy] = useState(false);
  const [localDataFolderStatus, setLocalDataFolderStatus] = useState("");
  const [bundlePath, setBundlePath] = useState("");
  const [archiveBundlePickerBusy, setArchiveBundlePickerBusy] = useState(false);
  const [webDavConfig, setWebDavConfig] = useState<WebDavConfig>({
    configured: false,
    serverUrl: "",
    username: "",
    remoteFolder: "TicketTrail",
    hasPassword: false,
    autoBackupMode: "off",
  });
  const [webDavPasswordDraft, setWebDavPasswordDraft] = useState("");
  const [showWebDavPassword, setShowWebDavPassword] = useState(false);
  const [webDavBusy, setWebDavBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [webDavStatus, setWebDavStatus] = useState("");
  const settingsTabs: Array<{ value: SettingsSubview; label: string }> = [
    { value: "appearance", label: t("appearance") },
    { value: "export", label: t("dataAndBackup") },
    { value: "about", label: t("about") },
  ];

  useEffect(() => {
    setSubview(initialSubview);
  }, [initialSubview]);

  useEffect(() => {
    let isMounted = true;

    const loadFlightDataSourceConfig = async () => {
      try {
        const config = await getFlightDataSourceConfig();
        if (!isMounted) {
          return;
        }

        setFlightDataSourceConfig({
          provider: config.provider,
          gateway: config.gateway,
          hasApiKey: config.hasApiKey,
          apiKeyPreview: config.apiKeyPreview,
          updatedAt: config.updatedAt,
        });
        setFlightDataSourceApiKeyDraft("");
        setFlightDataSourceStatus("");
      } catch {
        if (isMounted) {
          setFlightDataSourceStatus("Failed to load the local flight data source configuration.");
        }
      }
    };

    void loadFlightDataSourceConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadWebDavConfig = async () => {
      try {
        const config = await getWebDavConfig();
        if (!isMounted) {
          return;
        }
        setWebDavConfig(config);
        setWebDavPasswordDraft("");
        setWebDavStatus("");
      } catch (error) {
        if (isMounted) {
          setWebDavStatus(
            readableError(error, "Failed to load the local WebDAV configuration."),
          );
        }
      }
    };

    void loadWebDavConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadExportFolderInfo = async () => {
      try {
        const info = await getExportFolderInfo();
        if (!isMounted) {
          return;
        }

        setExportFolderInfo(info);
        setExportFolderStatus("");
      } catch {
        if (isMounted) {
          setExportFolderStatus(t("exportFolderLoadFailed"));
        }
      }
    };

    void loadExportFolderInfo();

    return () => {
      isMounted = false;
    };
  }, [t]);

  useEffect(() => {
    let isMounted = true;

    const loadLocalDataFolderInfo = async () => {
      try {
        const info = await getLocalDataFolderInfo();
        if (!isMounted) {
          return;
        }

        setLocalDataFolderInfo(info);
        setLocalDataFolderStatus("");
      } catch {
        if (isMounted) {
          setLocalDataFolderStatus("Failed to resolve the local TicketTrail data folder.");
        }
      }
    };

    void loadLocalDataFolderInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateFlightDataSourceProvider = (provider: FlightDataSourceProvider) => {
    setFlightDataSourceConfig((current) => ({
      ...current,
      provider,
    }));
    setFlightDataSourceStatus("");
  };

  const handleUpdateFlightDataSourceGateway = (gateway: FlightDataSourceGateway) => {
    setFlightDataSourceConfig((current) => ({
      ...current,
      gateway,
    }));
    setFlightDataSourceStatus("");
  };

  const handleSaveFlightDataSourceConfig = async () => {
    setFlightDataSourceBusy(true);
    setFlightDataSourceStatus("");

    try {
      const savedConfig = await saveFlightDataSourceConfig({
        provider: flightDataSourceConfig.provider,
        gateway: flightDataSourceConfig.gateway,
        apiKey: flightDataSourceApiKeyDraft.trim() || undefined,
      });
      setFlightDataSourceConfig({
        provider: savedConfig.provider,
        gateway: savedConfig.gateway,
        hasApiKey: savedConfig.hasApiKey,
        apiKeyPreview: savedConfig.apiKeyPreview,
        updatedAt: savedConfig.updatedAt,
      });
      setFlightDataSourceApiKeyDraft("");
      setShowFlightDataSourceApiKey(false);
      setFlightDataSourceStatus("Flight data source settings saved locally.");
    } catch {
      setFlightDataSourceStatus("Failed to save the local flight data source configuration.");
    } finally {
      setFlightDataSourceBusy(false);
    }
  };

  const handleClearFlightDataSourceApiKey = async () => {
    setFlightDataSourceBusy(true);
    setFlightDataSourceStatus("");

    try {
      const savedConfig = await saveFlightDataSourceConfig({
        provider: flightDataSourceConfig.provider,
        gateway: flightDataSourceConfig.gateway,
        clearApiKey: true,
      });
      setFlightDataSourceConfig({
        provider: savedConfig.provider,
        gateway: savedConfig.gateway,
        hasApiKey: savedConfig.hasApiKey,
        apiKeyPreview: savedConfig.apiKeyPreview,
        updatedAt: savedConfig.updatedAt,
      });
      setFlightDataSourceApiKeyDraft("");
      setShowFlightDataSourceApiKey(false);
      setFlightDataSourceStatus("Saved flight data source API key was cleared locally.");
    } catch {
      setFlightDataSourceStatus("Failed to clear the saved flight data source API key.");
    } finally {
      setFlightDataSourceBusy(false);
    }
  };

  const updateWebDavField = (field: "serverUrl" | "username" | "remoteFolder", value: string) => {
    setWebDavConfig((current) => ({
      ...current,
      [field]: value,
      lastConnectionSucceeded: undefined,
      capabilities: undefined,
    }));
    setWebDavStatus("");
  };

  const saveCurrentWebDavConfig = async (clearPassword = false) => {
    const saved = await saveWebDavConfig({
      serverUrl: webDavConfig.serverUrl,
      username: webDavConfig.username,
      remoteFolder: webDavConfig.remoteFolder,
      password: clearPassword ? undefined : webDavPasswordDraft || undefined,
      clearPassword,
    });
    setWebDavConfig(saved);
    setWebDavPasswordDraft("");
    setShowWebDavPassword(false);
    return saved;
  };

  const handleSaveWebDavConfig = async () => {
    setWebDavBusy("save");
    setWebDavStatus("");
    try {
      const saved = await saveCurrentWebDavConfig();
      setWebDavStatus(
        saved.configured
          ? "WebDAV settings saved. Run Test connection before using cloud backup."
          : "WebDAV settings saved, but an application password is still required.",
      );
    } catch (error) {
      setWebDavStatus(readableError(error, "Failed to save the WebDAV configuration."));
    } finally {
      setWebDavBusy(null);
    }
  };

  const handleTestWebDavConnection = async () => {
    setWebDavBusy("test");
    setWebDavStatus("");
    try {
      await saveCurrentWebDavConfig();
      const result = await testWebDavConnection();
      const refreshed = await getWebDavConfig();
      setWebDavConfig(refreshed);
      setWebDavStatus(
        result.cleanupWarning
          ? `${result.message} ${result.cleanupWarning}`
          : result.message,
      );
    } catch (error) {
      setWebDavStatus(readableError(error, "The WebDAV connection test failed."));
      try {
        setWebDavConfig(await getWebDavConfig());
      } catch {
        // Keep the current draft visible if the status refresh also fails.
      }
    } finally {
      setWebDavBusy(null);
    }
  };

  const handleClearWebDavPassword = async () => {
    setWebDavBusy("clear");
    setWebDavStatus("");
    try {
      await saveCurrentWebDavConfig(true);
      setWebDavStatus("The saved WebDAV password was removed from Windows Credential Manager.");
    } catch (error) {
      setWebDavStatus(readableError(error, "Failed to clear the saved WebDAV password."));
    } finally {
      setWebDavBusy(null);
    }
  };

  const exportFolderLabel =
    exportFolderInfo?.resolutionKind === "downloads"
      ? t("defaultSystemDownloadsFolder")
      : t("bestAvailableExportFolder");

  const handleOpenExportFolder = async () => {
    setExportFolderBusy(true);
    setExportFolderStatus("");

    try {
      const info = await openExportFolder();
      setExportFolderInfo(info);
      setExportFolderStatus(t("exportFolderOpened"));
    } catch (error) {
      setExportFolderStatus(
        error instanceof Error && error.message ? error.message : t("exportFolderOpenFailed"),
      );
    } finally {
      setExportFolderBusy(false);
    }
  };

  const handleChooseArchiveBundleFile = async () => {
    setArchiveBundlePickerBusy(true);
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    try {
      const selectedPath = await pickArchiveBundleFile();
      if (selectedPath) {
        setBundlePath(selectedPath);
      }
    } finally {
      setArchiveBundlePickerBusy(false);
    }
  };

  const handleOpenLocalDataFolder = async () => {
    setLocalDataFolderBusy(true);
    setLocalDataFolderStatus("");

    try {
      const info = await openLocalDataFolder();
      setLocalDataFolderInfo(info);
      setLocalDataFolderStatus("Local TicketTrail data folder opened.");
    } catch (error) {
      setLocalDataFolderStatus(
        error instanceof Error && error.message
          ? error.message
          : "Failed to open the local TicketTrail data folder.",
      );
    } finally {
      setLocalDataFolderBusy(false);
    }
  };

  const appearanceView = (
    <section className="section-stack">
      <div className="panel settings-intro-card">
        <h3>{t("appearance")}</h3>
        <p className="hero-copy">
          Appearance preferences will live here later. This phase only reserves the structure for future
          desktop settings.
        </p>
      </div>

      <div className="panel settings-section-card">
        <h3>{t("themeMode")}</h3>
        <div className="settings-option-list">
          <div className="settings-option-card">
            <div>
              <strong>{t("language")}</strong>
            </div>
            <select
              aria-label={t("language")}
              className="settings-language-select"
              onChange={(event) => setLanguage(event.target.value as Language)}
              value={language}
            >
              <option value="en">{t("english")}</option>
              <option value="zh">{t("chinese")}</option>
            </select>
          </div>
        </div>
        <div className="settings-option-list">
          <div className="settings-option-card">
            <div>
              <strong>{t("lightDayMode")}</strong>
              <p className="hero-copy">Coming soon. Theme switching is not implemented in this phase.</p>
            </div>
            <span className="ticket-status ticket-status-draft">{t("disabled")}</span>
          </div>
        </div>
      </div>
    </section>
  );

  const exportView = (
    <section className="section-stack">
      <div className="panel settings-intro-card">
        <h3>Data & Backup</h3>
        <p className="hero-copy">
          TicketTrail is local-first. Keep your working archive on this computer, use archive bundle
          export/import to move to another computer, and treat WebDAV as future backup/restore rather
          than real-time sync.
        </p>
      </div>

      <div className="content-grid settings-grid">
        <div className="panel-stack">
          <div className="panel settings-section-card">
            <h3>Local data</h3>
            <div className="settings-option-list">
              <div className="settings-option-card settings-option-card-block">
                <div>
                  <strong>Current app data folder</strong>
                  <p className="hero-copy">
                    TicketTrail keeps the working database and local files on this computer.
                  </p>
                  <p className="settings-helper-copy">
                    {localDataFolderInfo?.path || "Path unavailable outside the desktop runtime."}
                  </p>
                  <p className="hero-copy">
                    Changing the live data folder is not supported in this MVP.
                  </p>
                </div>
                <div className="settings-inline-controls">
                  <button
                    className="ghost-button"
                    disabled={localDataFolderBusy || !localDataFolderInfo?.path}
                    onClick={() => void handleOpenLocalDataFolder()}
                    type="button"
                  >
                    {localDataFolderBusy ? t("openingFolder") : "Open data folder"}
                  </button>
                  <span className="ticket-status ticket-status-draft">Read only</span>
                </div>
              </div>
            </div>
            {localDataFolderStatus ? (
              <p className="settings-status-message">{localDataFolderStatus}</p>
            ) : null}
          </div>

          <div className="panel settings-section-card">
            <h3>Move to another computer</h3>
            <div className="settings-option-list">
              <div className="settings-option-card settings-option-card-block">
                <div>
                  <strong>Archive bundle transfer</strong>
                  <p className="hero-copy">
                    Export a complete archive bundle from the old computer, then import it on the new one.
                  </p>
                  <p className="settings-helper-copy">
                    Importing an archive bundle validates the payload first, creates a local safety backup, and then replaces the current local data.
                  </p>
                </div>
                <div className="settings-inline-controls">
                  <button
                    className="ghost-button compact-button"
                    disabled={backupPanelProps.isBusy}
                    onClick={backupPanelProps.onExportArchiveBundle}
                    type="button"
                  >
                    Export archive bundle
                  </button>
                  <button
                    className="ghost-button compact-button"
                    disabled={exportFolderBusy}
                    onClick={() => void handleOpenExportFolder()}
                    type="button"
                  >
                    {exportFolderBusy ? t("openingFolder") : "Open backup folder"}
                  </button>
                </div>
                <label className="settings-field">
                  <span>Import archive bundle path</span>
                  <div className="backup-import-panel">
                    <input
                      onChange={(event) => setBundlePath(event.target.value)}
                      placeholder="Example: C:\Users\YourUser\Downloads\tickettrail-archive.zip"
                      value={bundlePath}
                    />
                    <button
                      className="ghost-button compact-button"
                      disabled={backupPanelProps.isBusy || archiveBundlePickerBusy}
                      onClick={() => void handleChooseArchiveBundleFile()}
                      type="button"
                    >
                      {archiveBundlePickerBusy ? "Choosing..." : "Choose file"}
                    </button>
                    <button
                      className="ghost-button compact-button"
                      disabled={backupPanelProps.isBusy || !bundlePath.trim()}
                      onClick={() => backupPanelProps.onImportArchiveBundle(bundlePath.trim())}
                      type="button"
                    >
                      Import archive bundle
                    </button>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <BackupPanel {...backupPanelProps} />
        </div>

        <div className="panel-stack">
          <div className="panel settings-section-card">
            <h3>{t("defaultExportLocation")}</h3>
            <div className="settings-option-list">
              <div className="settings-option-card settings-option-card-block">
                <div>
                  <strong>{t("currentExportFolder")}</strong>
                  <p className="hero-copy">{exportFolderLabel}</p>
                  <p className="settings-helper-copy">
                    {exportFolderInfo?.path || t("exportFolderPathUnavailable")}
                  </p>
                  <p className="hero-copy">
                    This is where exported files are saved. It does not move the working database.
                  </p>
                </div>
                <div className="settings-inline-controls">
                  <button
                    className="ghost-button"
                    disabled={exportFolderBusy || !exportFolderInfo?.path}
                    onClick={() => void handleOpenExportFolder()}
                    type="button"
                  >
                    {exportFolderBusy ? t("openingFolder") : t("openFolder")}
                  </button>
                </div>
              </div>
            </div>
            {exportFolderStatus ? <p className="settings-status-message">{exportFolderStatus}</p> : null}
          </div>

          <div className="panel settings-section-card">
            <h3>Cloud backup - WebDAV</h3>
            <div className="settings-option-list">
              <div className="settings-option-card settings-option-card-block">
                <div>
                  <p className="hero-copy">
                    Connect your own WebDAV storage. TicketTrail data stays local; this connection
                    will be used for backup and restore, not real-time sync.
                  </p>
                  <p className="settings-helper-copy">
                    This phase only saves configuration and tests the managed remote directory. It
                    does not upload archive backups yet.
                  </p>
                </div>

                <div className="settings-field-stack webdav-config-fields">
                  <label className="settings-field">
                    <span>WebDAV server URL</span>
                    <input
                      autoComplete="url"
                      disabled={webDavBusy !== null}
                      onChange={(event) => updateWebDavField("serverUrl", event.target.value)}
                      placeholder="https://dav.example.com/"
                      type="url"
                      value={webDavConfig.serverUrl}
                    />
                  </label>

                  <label className="settings-field">
                    <span>Username</span>
                    <input
                      autoComplete="username"
                      disabled={webDavBusy !== null}
                      onChange={(event) => updateWebDavField("username", event.target.value)}
                      placeholder="Your WebDAV account"
                      value={webDavConfig.username}
                    />
                  </label>

                  <label className="settings-field">
                    <span>Password / application password</span>
                    <div className="settings-secret-input-row">
                      <input
                        autoComplete="new-password"
                        disabled={webDavBusy !== null}
                        onChange={(event) => setWebDavPasswordDraft(event.target.value)}
                        placeholder={
                          webDavConfig.hasPassword
                            ? "Password saved - type a new value to replace it"
                            : "Stored securely on this Windows device"
                        }
                        type={showWebDavPassword ? "text" : "password"}
                        value={webDavPasswordDraft}
                      />
                      <button
                        className="ghost-button compact-button"
                        disabled={!webDavPasswordDraft || webDavBusy !== null}
                        onClick={() => setShowWebDavPassword((current) => !current)}
                        type="button"
                      >
                        {showWebDavPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    {webDavConfig.hasPassword ? (
                      <p className="settings-helper-copy">Password saved in Windows Credential Manager.</p>
                    ) : null}
                  </label>

                  <label className="settings-field">
                    <span>Remote folder</span>
                    <input
                      disabled={webDavBusy !== null}
                      onChange={(event) => updateWebDavField("remoteFolder", event.target.value)}
                      placeholder="TicketTrail"
                      value={webDavConfig.remoteFolder}
                    />
                    <p className="settings-helper-copy">
                      TicketTrail manages the <strong>backups</strong> child inside this folder.
                    </p>
                  </label>

                  <div className="settings-inline-controls">
                    <button
                      className="primary-button"
                      disabled={webDavBusy !== null}
                      onClick={() => void handleSaveWebDavConfig()}
                      type="button"
                    >
                      {webDavBusy === "save" ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="ghost-button"
                      disabled={webDavBusy !== null}
                      onClick={() => void handleTestWebDavConnection()}
                      type="button"
                    >
                      {webDavBusy === "test" ? "Testing..." : "Test connection"}
                    </button>
                    {webDavConfig.hasPassword ? (
                      <button
                        className="ghost-button compact-button danger-button"
                        disabled={webDavBusy !== null}
                        onClick={() => void handleClearWebDavPassword()}
                        type="button"
                      >
                        {webDavBusy === "clear" ? "Clearing..." : "Clear password"}
                      </button>
                    ) : null}
                  </div>

                  <div className="webdav-connection-summary">
                    <span
                      className={`ticket-status ${
                        webDavConfig.lastConnectionSucceeded === true
                          ? "ticket-status-saved"
                          : webDavConfig.lastConnectionSucceeded === false
                            ? "ticket-status-warning"
                            : "ticket-status-draft"
                      }`}
                    >
                      {webDavConfig.lastConnectionSucceeded === true
                        ? "Connected"
                        : webDavConfig.lastConnectionSucceeded === false
                          ? "Connection failed"
                          : webDavConfig.configured
                            ? "Saved - not yet tested"
                            : "Not configured"}
                    </span>
                    {webDavConfig.capabilities ? (
                      <span className="settings-helper-copy">
                        {webDavConfig.capabilities.moveSupported
                          ? "Managed directory writable; standard publish mode available."
                          : "Managed directory writable; compatibility publish mode will be required."}
                      </span>
                    ) : null}
                  </div>
                  {webDavConfig.lastTestedAt ? (
                    <p className="settings-helper-copy">
                      Last tested: {formatSavedAt(webDavConfig.lastTestedAt)}
                    </p>
                  ) : null}
                  {webDavStatus ? (
                    <p
                      className={`settings-status-message ${
                        webDavConfig.lastConnectionSucceeded === false
                          ? "settings-status-message-error"
                          : ""
                      }`}
                      role={webDavConfig.lastConnectionSucceeded === false ? "alert" : "status"}
                    >
                      {webDavStatus}
                    </p>
                  ) : null}
                  <p className="settings-helper-copy">
                    Non-secret settings are stored in the TicketTrail app config folder. The password
                    is never written to that JSON file or returned to this screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const archiveTransferToast = archiveTransferNotice ? (
    <div
      aria-live={archiveTransferNotice.kind === "error" ? "assertive" : "polite"}
      className={`settings-toast settings-toast-${archiveTransferNotice.kind}`}
      role={archiveTransferNotice.kind === "error" ? "alert" : "status"}
    >
      <div className="settings-toast-copy">
        <strong>{archiveTransferNotice.title}</strong>
        <p>{archiveTransferNotice.message}</p>
      </div>
      <button
        aria-label="Dismiss archive transfer notice"
        className="settings-toast-close"
        onClick={onDismissArchiveTransferNotice}
        type="button"
      >
        <AppIcon name="close" size={16} />
      </button>
    </div>
  ) : null;
  const aboutView = (
    <section className="section-stack">
      <div className="panel settings-intro-card">
        <h3>{t("about")}</h3>
        <p className="hero-copy">
          This area will later show desktop app metadata and software/runtime information more clearly.
        </p>
      </div>

      <div className="panel settings-section-card">
        <div className="settings-option-list">
          <div className="settings-meta-card">
            <span>{t("appName")}</span>
            <strong>TicketTrail</strong>
          </div>
          <div className="settings-meta-card">
            <span>{t("versionInformation")}</span>
            <strong>Placeholder - desktop app version will be shown here later</strong>
          </div>
          <div className="settings-meta-card">
            <span>{t("softwareInformation")}</span>
            <strong>Placeholder - runtime and build details will be shown here later</strong>
          </div>
        </div>
      </div>

      <div className="panel settings-section-card">
        <h3>Data sources</h3>
        <div className="settings-option-list">
          <div className="settings-option-card settings-option-card-block">
            <div>
              <strong>Flight lookup provider</strong>
              <p className="hero-copy">
                Mock works without an API key. AeroDataBox can be selected and stored locally now for
                future provider integration, but real provider calls are still not connected in this phase.
              </p>
            </div>

            <div className="settings-field-stack">
              <label className="settings-field">
                <span>Provider</span>
                <select
                  aria-label="Flight lookup provider"
                  onChange={(event) =>
                    handleUpdateFlightDataSourceProvider(
                      event.target.value as FlightDataSourceProvider,
                    )
                  }
                  value={flightDataSourceConfig.provider}
                >
                  <option value="mock">Mock</option>
                  <option value="aerodatabox">AeroDataBox</option>
                </select>
              </label>

              {flightDataSourceConfig.provider === "aerodatabox" ? (
                <label className="settings-field">
                  <span>AeroDataBox gateway</span>
                  <select
                    aria-label="AeroDataBox gateway"
                    onChange={(event) =>
                      handleUpdateFlightDataSourceGateway(
                        event.target.value as FlightDataSourceGateway,
                      )
                    }
                    value={flightDataSourceConfig.gateway}
                  >
                    <option value="apiMarket">API.Market</option>
                    <option value="rapidApi">RapidAPI</option>
                  </select>
                </label>
              ) : null}

              <label className="settings-field">
                <span>Provider API key</span>
                <div className="settings-secret-input-row">
                  <input
                    aria-label="Flight data provider API key"
                    onChange={(event) => setFlightDataSourceApiKeyDraft(event.target.value)}
                    placeholder={
                      flightDataSourceConfig.provider === "mock"
                        ? flightDataSourceConfig.hasApiKey
                          ? "Optional for mock mode; saved key is kept locally"
                          : "Optional for mock mode"
                        : flightDataSourceConfig.hasApiKey
                          ? "Type a new key to replace the saved one"
                          : "Stored locally for future AeroDataBox integration"
                    }
                    type={showFlightDataSourceApiKey ? "text" : "password"}
                    value={flightDataSourceApiKeyDraft}
                  />
                  <button
                    className="ghost-button compact-button"
                    disabled={!flightDataSourceApiKeyDraft}
                    onClick={() => setShowFlightDataSourceApiKey((current) => !current)}
                    type="button"
                  >
                    {showFlightDataSourceApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                {flightDataSourceConfig.hasApiKey ? (
                  <p className="settings-helper-copy">
                    {flightDataSourceConfig.apiKeyPreview
                      ? `Saved key: ${flightDataSourceConfig.apiKeyPreview}`
                      : "API key saved locally"}
                  </p>
                ) : null}
              </label>

              <div className="settings-inline-controls">
                <button
                  className="primary-button"
                  disabled={flightDataSourceBusy}
                  onClick={() => void handleSaveFlightDataSourceConfig()}
                  type="button"
                >
                  {flightDataSourceBusy ? "Saving..." : t("save")}
                </button>
                {flightDataSourceConfig.hasApiKey ? (
                  <button
                    className="ghost-button compact-button danger-button"
                    disabled={flightDataSourceBusy}
                    onClick={() => void handleClearFlightDataSourceApiKey()}
                    type="button"
                  >
                    Clear saved key
                  </button>
                ) : null}
                <span className="ticket-status ticket-status-draft">
                  {flightDataSourceConfig.provider === "mock"
                    ? "Lookup remains mock-only in this phase"
                    : "Provider selection is stored, but live lookup is not connected yet"}
                </span>
              </div>

              <p className="settings-helper-copy">
                API keys are now stored through a desktop-side local secret file and are no longer
                returned to the frontend after save. This is still not final OS-level secure storage.
              </p>
              {flightDataSourceConfig.updatedAt ? (
                <p className="settings-helper-copy">{`Last saved: ${formatSavedAt(flightDataSourceConfig.updatedAt)}`}</p>
              ) : null}
              {flightDataSourceStatus ? (
                <p className="settings-status-message">{flightDataSourceStatus}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <>
      {archiveTransferToast}
    <section className="section-stack settings-page">
      <div className="journeys-subview-bar">
        <div className="tickets-tab-group" aria-label="Settings subviews" role="tablist">
          {settingsTabs.map((tab) => (
            <button
              aria-selected={subview === tab.value}
              className={subview === tab.value ? "theme-chip active" : "theme-chip"}
              key={tab.value}
              onClick={() => setSubview(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {subview === "appearance" ? appearanceView : subview === "export" ? exportView : aboutView}
    </section>
    </>
  );
}
