/**
 * Snooze Management Utilities
 *
 * Manages snoozed work items in localStorage.
 * Allows users to temporarily defer recommendations without permanent dismissal.
 */

const SNOOZE_STORAGE_KEY = "next_work_item_snooze";

interface SnoozedItem {
  type: "issue" | "pr";
  id: number; // item_github_id
  snoozed_until: string; // ISO timestamp
}

interface SnoozeData {
  version: number;
  items: SnoozedItem[];
}

const CURRENT_VERSION = 1;

/**
 * Gets all snoozed items from localStorage, filtering out expired ones.
 * Returns only active snoozes (where snoozed_until >= now).
 */
export function getActiveSnoozes(): SnoozedItem[] {
  if (typeof window === "undefined") {
    return []; // Server-side: return empty array
  }

  try {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const data: SnoozeData = JSON.parse(stored);

    // Filter out expired snoozes
    const now = new Date();
    const activeSnoozes = data.items.filter((item) => {
      const snoozedUntil = new Date(item.snoozed_until);
      return snoozedUntil >= now;
    });

    // If we filtered out some items, update localStorage
    if (activeSnoozes.length !== data.items.length) {
      const updatedData: SnoozeData = {
        version: CURRENT_VERSION,
        items: activeSnoozes,
      };
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(updatedData));
    }

    return activeSnoozes;
  } catch (error) {
    console.error("Error reading snoozes from localStorage:", error);
    return [];
  }
}

/**
 * Snoozes an item for 7 days.
 * Adds or updates the snooze entry in localStorage.
 */
export function snoozeItem(
  itemType: "issue" | "pr",
  itemGithubId: number,
  days: number = 7,
): void {
  if (typeof window === "undefined") {
    return; // Server-side: no-op
  }

  try {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    let data: SnoozeData = stored
      ? JSON.parse(stored)
      : { version: CURRENT_VERSION, items: [] };

    // Calculate snoozed_until timestamp
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);

    // Remove existing snooze for this item (if any)
    data.items = data.items.filter(
      (item) => !(item.type === itemType && item.id === itemGithubId),
    );

    // Add new snooze entry
    data.items.push({
      type: itemType,
      id: itemGithubId,
      snoozed_until: snoozedUntil.toISOString(),
    });

    // Update version
    data.version = CURRENT_VERSION;

    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving snooze to localStorage:", error);
  }
}

/**
 * Checks if an item is currently snoozed.
 */
export function isItemSnoozed(
  itemType: "issue" | "pr",
  itemGithubId: number,
): boolean {
  const activeSnoozes = getActiveSnoozes();
  return activeSnoozes.some(
    (item) => item.type === itemType && item.id === itemGithubId,
  );
}

/**
 * Clears all snoozes (for testing/debugging).
 */
export function clearAllSnoozes(): void {
  if (typeof window === "undefined") {
    return; // Server-side: no-op
  }
  localStorage.removeItem(SNOOZE_STORAGE_KEY);
}
