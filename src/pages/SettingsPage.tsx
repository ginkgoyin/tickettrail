import { useEffect, useState, type ComponentProps } from "react";
import { BackupPanel } from "../components/BackupPanel";

type BackupPanelProps = ComponentProps<typeof BackupPanel>;
type SettingsSubview = "appearance" | "export" | "about";

interface SettingsPageProps {
  backupPanelProps: BackupPanelProps;
  initialSubview?: SettingsSubview;
}

const settingsTabs: Array<{ value: SettingsSubview; label: string }> = [
  { value: "appearance", label: "Appearance" },
  { value: "export", label: "Export" },
  { value: "about", label: "About" },
];

export function SettingsPage({ backupPanelProps, initialSubview = "appearance" }: SettingsPageProps) {
  const [subview, setSubview] = useState<SettingsSubview>(initialSubview);

  useEffect(() => {
    setSubview(initialSubview);
  }, [initialSubview]);

  const appearanceView = (
    <section className="section-stack">
      <div className="panel settings-intro-card">
        <h3>Appearance</h3>
        <p className="hero-copy">
          Appearance preferences will live here later. This phase only reserves the structure for future
          desktop settings.
        </p>
      </div>

      <div className="panel settings-section-card">
        <h3>Theme mode</h3>
        <div className="settings-option-list">
          <div className="settings-option-card">
            <div>
              <strong>Light/day mode</strong>
              <p className="hero-copy">Coming soon. Theme switching is not implemented in this phase.</p>
            </div>
            <span className="ticket-status ticket-status-draft">Disabled</span>
          </div>
        </div>
      </div>
    </section>
  );

  const exportView = (
    <section className="section-stack">
      <div className="panel settings-intro-card">
        <h3>Export and backup</h3>
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
            <h3>Storage</h3>
            <div className="settings-option-list">
              <div className="settings-option-card">
                <div>
                  <strong>Data storage location</strong>
                  <p className="hero-copy">
                    Coming soon. Desktop data-path configuration is not available yet.
                  </p>
                </div>
                <span className="ticket-status ticket-status-draft">Disabled</span>
              </div>
            </div>
          </div>

          <div className="panel settings-section-card">
            <h3>Default export location</h3>
            <div className="settings-option-list">
              <div className="settings-option-card">
                <div>
                  <strong>Export destination preference</strong>
                  <p className="hero-copy">
                    Coming soon. Default export location behavior is not implemented yet.
                  </p>
                </div>
                <span className="ticket-status ticket-status-draft">Disabled</span>
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
        <h3>About</h3>
        <p className="hero-copy">
          This area will later show desktop app metadata and software/runtime information more clearly.
        </p>
      </div>

      <div className="panel settings-section-card">
        <div className="settings-option-list">
          <div className="settings-meta-card">
            <span>App name</span>
            <strong>TicketTrail</strong>
          </div>
          <div className="settings-meta-card">
            <span>Version information</span>
            <strong>Placeholder - desktop app version will be shown here later</strong>
          </div>
          <div className="settings-meta-card">
            <span>Software information</span>
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
