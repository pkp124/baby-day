export type AppPage = "home" | "settings" | "report" | "crib" | "watch";

export function pageFromHash(hash: string): AppPage {
  const id = hash.replace(/^#\/?/, "").split(/[/?#]/)[0] ?? "";
  switch (id) {
    case "settings":
    case "report":
    case "crib":
    case "watch":
      return id;
    case "home":
    case "":
      return "home";
    default:
      return "home";
  }
}

export function hashFromPage(page: AppPage): string {
  switch (page) {
    case "home":
      return "";
    case "settings":
    case "report":
    case "crib":
    case "watch":
      return `#/${page}`;
    default: {
      const _never: never = page;
      return _never;
    }
  }
}

export function applyPageHash(page: AppPage) {
  const next = hashFromPage(page);
  if (window.location.hash === next) return;
  if (page === "home") {
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", url);
    return;
  }
  window.location.hash = next.replace(/^#/, "");
}
