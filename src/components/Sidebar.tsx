import { useI18n } from "../lib/i18n";

export type AppSection = "overview" | "tickets" | "journeys" | "map" | "exports" | "settings";

const navItems: Array<{ key: "overview" | "tickets" | "journeys" | "map"; section: AppSection }> = [
  { key: "overview", section: "overview" },
  { key: "tickets", section: "tickets" },
  { key: "journeys", section: "journeys" },
  { key: "map", section: "map" },
];

const utilityItems: Array<{ key: "settings"; icon?: string; section: AppSection }> = [
  { key: "settings", icon: "\u2699", section: "settings" },
];

interface SidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
}

export function Sidebar({ activeSection, onSelectSection }: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-intro">
        <p className="logo-mark">TT</p>
        <h2 className="sidebar-title">TicketTrail</h2>
        <p className="sidebar-copy">
          Ticket history, visual routes, and shareable stubs in one place.
        </p>
      </div>
      <nav aria-label="Primary navigation" className="nav-list">
        {navItems.map((item) => (
          <button
            aria-pressed={activeSection === item.section}
            className={`nav-item ${activeSection === item.section ? "active" : ""}`}
            key={item.key}
            onClick={() => onSelectSection(item.section)}
            type="button"
          >
            <span className="nav-item-label">{t(item.key)}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-utility">
        <span className="sidebar-utility-label">{t("preferences")}</span>
        <nav aria-label="Utility navigation" className="nav-list">
          {utilityItems.map((item) => (
            <button
              aria-pressed={activeSection === item.section}
              className={`nav-item ${activeSection === item.section ? "active" : ""}`}
              key={item.key}
              onClick={() => onSelectSection(item.section)}
              type="button"
            >
              <span className="nav-item-label">
                {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                <span>{t(item.key)}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
