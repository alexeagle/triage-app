/**
 * User Preferences Utilities
 *
 * Provides utilities for reading and writing user preferences.
 * Uses localStorage for client-side persistence (user-specific, not shareable).
 */

import { useState, useEffect, useCallback } from "react";

const USER_PREFERENCES_KEY = "triage-app:userPreferences";

interface UserPreferences {
  starredOnly?: boolean;
}

/**
 * Gets all user preferences from localStorage.
 * Returns default preferences if none exist.
 */
function getUserPreferences(): UserPreferences {
  if (typeof window === "undefined") {
    return {}; // Server-side: return empty object
  }
  try {
    const stored = localStorage.getItem(USER_PREFERENCES_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {}; // If localStorage is unavailable or invalid, return empty object
  }
}

/**
 * Sets user preferences in localStorage.
 * Merges with existing preferences.
 */
function setUserPreferences(prefs: Partial<UserPreferences>): void {
  if (typeof window === "undefined") {
    return; // Server-side: no-op
  }
  try {
    const current = getUserPreferences();
    const updated = { ...current, ...prefs };
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(updated));
  } catch {
    // If localStorage is unavailable, silently fail
  }
}

/**
 * Reads the "starredOnly" filter from user preferences.
 * Returns true if the preference is set to true, false otherwise.
 * Safe to call on server (returns false).
 *
 * @returns true if starredOnly filter is enabled, false otherwise
 */
export function getStarredOnlyFilter(): boolean {
  const prefs = getUserPreferences();
  return prefs.starredOnly === true;
}

/**
 * Sets the "starredOnly" filter preference in user preferences.
 * Only works on client-side.
 *
 * @param starredOnly - Whether to enable the starredOnly filter
 */
export function setStarredOnlyFilter(starredOnly: boolean): void {
  setUserPreferences({ starredOnly });
}

/**
 * React hook for accessing the starredOnly filter.
 * Automatically syncs with localStorage and listens for changes.
 *
 * @returns [starredOnly, setStarredOnly] tuple
 */
export function useStarredOnlyFilter(): [boolean, (value: boolean) => void] {
  if (typeof window === "undefined") {
    // Server-side: return default values
    return [false, () => {}];
  }

  const [starredOnly, setStarredOnlyState] = useState(() =>
    getStarredOnlyFilter(),
  );

  useEffect(() => {
    // Load from localStorage on mount
    setStarredOnlyState(getStarredOnlyFilter());

    // Listen for changes from other components
    const handleChange = (event: CustomEvent) => {
      setStarredOnlyState(event.detail);
    };

    window.addEventListener(
      "starredOnlyChanged",
      handleChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "starredOnlyChanged",
        handleChange as EventListener,
      );
    };
  }, []);

  const setStarredOnly = useCallback((value: boolean) => {
    setStarredOnlyState(value);
    setStarredOnlyFilter(value);
    window.dispatchEvent(
      new CustomEvent("starredOnlyChanged", { detail: value }),
    );
  }, []);

  return [starredOnly, setStarredOnly];
}
