const navItems = [
  { label: "Overview", value: "01" },
  { label: "Tickets", value: "02" },
  { label: "Journeys", value: "03" },
  { label: "Map", value: "04" },
  { label: "Exports", value: "05" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <p className="logo-mark">TT</p>
        <h2 className="sidebar-title">TicketTrail</h2>
        <p className="sidebar-copy">
          Ticket history, visual routes, and shareable stubs in one place.
        </p>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map((item) => (
          <button className="nav-item" key={item.label} type="button">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </button>
        ))}
      </nav>
    </aside>
  );
}
