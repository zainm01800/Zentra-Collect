/**
 * src/lib/nav-customization.ts
 *
 * User-customisable sidebar sections for the "Other tools" nav area.
 * Sections and item positions are persisted in localStorage so they
 * survive logout / login (no server round-trip needed).
 */

export interface CustomNavSection {
  id: string;
  label: string;
  /** Ordered list of nav hrefs that belong to this section. */
  items: string[];
}

export const NAV_SECTIONS_KEY = "zentra.navSections.v1";

/** The hrefs that can be moved between custom sections (excludes /banking — always its own fixed section). */
export const CUSTOMISABLE_HREFS: string[] = ["/expenses", "/tax", "/pl", "/bills"];

export const DEFAULT_CUSTOM_SECTIONS: CustomNavSection[] = [
  {
    id: "default-books",
    label: "Books",
    items: ["/expenses", "/pl", "/bills", "/tax"],
  },
];

export function loadCustomSections(): CustomNavSection[] {
  if (typeof window === "undefined") return clone(DEFAULT_CUSTOM_SECTIONS);
  try {
    const raw = window.localStorage.getItem(NAV_SECTIONS_KEY);
    if (!raw) return clone(DEFAULT_CUSTOM_SECTIONS);
    const parsed = JSON.parse(raw) as CustomNavSection[];
    if (!Array.isArray(parsed) || parsed.length === 0) return clone(DEFAULT_CUSTOM_SECTIONS);

    // Migrate: old defaults (single "Other tools" or two-section Banking+Books) → new single Books section
    const isOldSingle = parsed.length === 1 &&
      (parsed[0].id === "default-other-tools" || parsed[0].label === "Other tools");
    const isOldTwo = parsed.length === 2 &&
      parsed.some((s) => s.id === "default-banking") &&
      parsed.some((s) => s.id === "default-books");
    if (isOldSingle || isOldTwo) {
      const migrated = clone(DEFAULT_CUSTOM_SECTIONS);
      saveCustomSections(migrated);
      return migrated;
    }

    // Ensure any new CUSTOMISABLE_HREFS that aren't in any section yet get appended to Books
    const allAssigned = new Set(parsed.flatMap((s) => s.items));
    const orphaned = CUSTOMISABLE_HREFS.filter((h) => !allAssigned.has(h));
    if (orphaned.length > 0) {
      const booksIdx = parsed.findIndex((s) => s.id === "default-books") ?? 0;
      const idx = booksIdx >= 0 ? booksIdx : 0;
      parsed[idx] = { ...parsed[idx], items: [...parsed[idx].items, ...orphaned] };
    }
    return parsed;
  } catch {
    return clone(DEFAULT_CUSTOM_SECTIONS);
  }
}

export function saveCustomSections(sections: CustomNavSection[]): void {
  try {
    window.localStorage.setItem(NAV_SECTIONS_KEY, JSON.stringify(sections));
  } catch {}
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
