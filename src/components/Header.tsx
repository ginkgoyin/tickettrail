export function Header() {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Desktop-first travel archive</p>
        <h2>Journey workspace</h2>
      </div>
      <div className="header-actions">
        <button className="ghost-button" type="button">
          Import later
        </button>
        <button className="primary-button" type="button">
          Export stub
        </button>
      </div>
    </header>
  );
}
