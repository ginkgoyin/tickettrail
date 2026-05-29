export function SettingsPage() {
  return (
    <section className="section-stack settings-page">
      <div className="panel settings-intro-card">
        <h3>Settings scaffold</h3>
        <p className="hero-copy">
          This page reserves space for future desktop preferences without implying that those controls are
          implemented yet.
        </p>
      </div>

      <div className="content-grid settings-grid">
        <div className="panel-stack">
          <div className="panel">
            <h3>Appearance</h3>
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

          <div className="panel">
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
        </div>

        <div className="panel-stack">
          <div className="panel">
            <h3>Export</h3>
            <div className="settings-option-list">
              <div className="settings-option-card">
                <div>
                  <strong>Default export location</strong>
                  <p className="hero-copy">
                    Coming soon. Export destination preferences are not implemented yet.
                  </p>
                </div>
                <span className="ticket-status ticket-status-draft">Disabled</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>About</h3>
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
        </div>
      </div>
    </section>
  );
}
