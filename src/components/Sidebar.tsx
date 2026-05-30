export type AppSection = "overview" | "tickets" | "journeys" | "map" | "exports" | "settings";

const navItems: Array<{ label: string; section: AppSection }> = [
  { label: "Overview", section: "overview" },
  { label: "Tickets", section: "tickets" },
  { label: "Journeys", section: "journeys" },
  { label: "Map", section: "map" },
];

const utilityItems: Array<{ label: string; icon?: string; section: AppSection }> = [
  { label: "Settings", icon: "⚙", section: "settings" },
];

interface SidebarProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
}

export function Sidebar({ activeSection, onSelectSection }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-intro">
        <p className="logo-mark">TT</p>
        <h2 className="sidebar-title">TicketTrail</h2>
        <p className="sidebar-copy">
          Ticket history, visual routes, and shareable stubs in one place.
        </p>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button
            aria-pressed={activeSection === item.section}
            className={`nav-item ${activeSection === item.section ? "active" : ""}`}
            key={item.label}
            onClick={() => onSelectSection(item.section)}
            type="button"
          >
            <span className="nav-item-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-utility">
        <span className="sidebar-utility-label">Preferences</span>
        <nav className="nav-list" aria-label="Utility navigation">
          {utilityItems.map((item) => (
            <button
              aria-pressed={activeSection === item.section}
              className={`nav-item ${activeSection === item.section ? "active" : ""}`}
              key={item.label}
              onClick={() => onSelectSection(item.section)}
              type="button"
            >
              <span className="nav-item-label">
                {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
