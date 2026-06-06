import { useEffect, useState, type ComponentProps } from "react";
import { BackupPanel } from "../components/BackupPanel";
import { getExportFolderInfo, openExportFolder, type ExportFolderInfo } from "../lib/ticketService";
import {
  getFlightDataSourceConfig,
  saveFlightDataSourceConfig,
  type FlightDataSourceConfig,
  type FlightDataSourceGateway,
  type FlightDataSourceProvider,
} from "../lib/flightLookup";
import { useI18n, type Language } from "../lib/i18n";

type BackupPanelProps = ComponentProps<typeof BackupPanel>;
type SettingsSubview = "appearance" | "export" | "about";

interface SettingsPageProps {
  backupPanelProps: BackupPanelProps;
  initialSubview?: SettingsSubview;
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

export function SettingsPage({ backupPanelProps, initialSubview = "appearance" }: SettingsPageProps) {
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
  const settingsTabs: Array<{ value: SettingsSubview; label: string }> = [
    { value: "appearance", label: t("appearance") },
    { value: "export", label: t("export") },
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
        <h3>{t("backupAndExport")}</h3>
        <p className="hero-copy">
          Backup and export-related preferences now live under Settings. The existing backup workflow
          remains available here, and stub exports now show the current default download folder for
          desktop use.
        </p>
      </div>

      <div className="content-grid settings-grid">
        <div className="panel-stack">
          <BackupPanel {...backupPanelProps} />
        </div>

        <div className="panel-stack">
          <div className="panel settings-section-card">
            <h3>{t("storage")}</h3>
            <div className="settings-option-list">
              <div className="settings-option-card">
                <div>
                  <strong>Data storage location</strong>
                  <p className="hero-copy">
                    Coming soon. Desktop data-path configuration is not available yet.
                  </p>
                </div>
                <span className="ticket-status ticket-status-draft">{t("disabled")}</span>
              </div>
            </div>
          </div>

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
                  <p className="hero-copy">{t("exportFolderDefaultFlowNote")}</p>
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
        </div>
      </div>
    </section>
  );

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
  );
}
