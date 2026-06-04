import { useEffect, useState, type ComponentProps } from "react";
import { BackupPanel } from "../components/BackupPanel";
import { useI18n, type Language } from "../lib/i18n";

type BackupPanelProps = ComponentProps<typeof BackupPanel>;
type SettingsSubview = "appearance" | "export" | "about";

interface SettingsPageProps {
  backupPanelProps: BackupPanelProps;
  initialSubview?: SettingsSubview;
}

export function SettingsPage({ backupPanelProps, initialSubview = "appearance" }: SettingsPageProps) {
  const { language, setLanguage, t } = useI18n();
  const [subview, setSubview] = useState<SettingsSubview>(initialSubview);
  const settingsTabs: Array<{ value: SettingsSubview; label: string }> = [
    { value: "appearance", label: t("appearance") },
    { value: "export", label: t("export") },
    { value: "about", label: t("about") },
  ];

  useEffect(() => {
    setSubview(initialSubview);
  }, [initialSubview]);

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
          Backup and export-related preferences now live under Settings. Placeholder controls below are not
          active yet unless they belong to the existing backup workflow.
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
              <div className="settings-option-card">
                <div>
                  <strong>{t("exportDestinationPreference")}</strong>
                  <p className="hero-copy">
                    Coming soon. Default export location behavior is not implemented yet.
                  </p>
                </div>
                <span className="ticket-status ticket-status-draft">{t("disabled")}</span>
              </div>
            </div>
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
