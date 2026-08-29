type Page = "home" | "settings";

export function Dock({
  page,
  onHome,
  onSettings,
  needRefresh,
  onReload,
}: {
  page: Page;
  onHome: () => void;
  onSettings: () => void;
  needRefresh: boolean;
  onReload: () => void;
}) {
  return (
    <nav className="dock" aria-label="App">
      {needRefresh && (
        <div className="dock-update">
          <span>New version ready</span>
          <button type="button" className="primary" onClick={onReload}>
            Reload
          </button>
        </div>
      )}
      <div className="dock-tabs">
        <button
          type="button"
          className={page === "home" ? "on" : ""}
          aria-current={page === "home" ? "page" : undefined}
          onClick={onHome}
        >
          Home
        </button>
        <button
          type="button"
          className={page === "settings" ? "on" : ""}
          aria-current={page === "settings" ? "page" : undefined}
          onClick={onSettings}
        >
          Settings
          {needRefresh ? <span className="dock-dot" aria-hidden /> : null}
        </button>
      </div>
    </nav>
  );
}
