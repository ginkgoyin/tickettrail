export type AppSection = "overview" | "tickets" | "journeys" | "map" | "exports" | "settings";

const navItems: Array<{ label: string; value: string; section: AppSection }> = [
  { label: "Overview", value: "01", section: "overview" },
  { label: "Tickets", value: "02", section: "tickets" },
  { label: "Journeys", value: "03", section: "journeys" },
  { label: "Map", value: "04", section: "map" },
  { label: "Exports", value: "05", section: "exports" },
];

const utilityItems: Array<{ label: string; value: string; section: AppSection }> = [
  { label: "Settings", value: "06", section: "settings" },
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
            <span>{item.label}</span>
            <strong>{item.value}</strong>
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
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
