export type AppPage = "home" | "settings" | "report" | "camera" | "crib" | "watch" | "guide" | "tech";

const PAGES = new Set<AppPage>(["home", "settings", "report", "camera", "crib", "watch", "guide", "tech"]);

function hashParts(hash: string): string[] {
  return hash.replace(/^#\/?/, "").split(/[/?#]/).filter(Boolean);
}

export function pageFromHash(hash: string): AppPage {
  const id = hashParts(hash)[0] ?? "";
  if (id === "home" || id === "") return "home";
  if (PAGES.has(id as AppPage)) return id as AppPage;
  return "home";
}

export function pageSectionFromHash(hash: string): string {
  return hashParts(hash)[1] ?? "";
}

export function hashFromPage(page: AppPage, section = ""): string {
  if (page === "home") return "";
  return section ? `#/${page}/${section}` : `#/${page}`;
}

export function applyPageHash(page: AppPage, section = "") {
  const next = hashFromPage(page, section);
  if (window.location.hash === next) return;
  if (page === "home") {
    const url = `${window.location.pathname}${window.location.search}`;
    window.history.pushState(null, "", url);
    return;
  }
  window.location.hash = next.replace(/^#/, "");
}
