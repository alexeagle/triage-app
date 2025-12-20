"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getActiveSnoozes, snoozeItem } from "../../lib/snooze";
import NextWorkItemCard from "./NextWorkItemCard";
import type { NextWorkItemRow } from "../../lib/queries";

interface WorkPreferences {
  prefer_known_customers: boolean;
  prefer_recent_activity: boolean;
  prefer_waiting_on_me: boolean;
  prefer_quick_wins: boolean;
}

interface NextWorkItemSectionProps {
  isAspectBuildMember?: boolean;
}

export default function NextWorkItemSection({
  isAspectBuildMember = false,
}: NextWorkItemSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextWorkItem, setNextWorkItem] = useState<NextWorkItemRow | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<WorkPreferences>({
    prefer_known_customers: false,
    prefer_recent_activity: true,
    prefer_waiting_on_me: true,
    prefer_quick_wins: true,
  });
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);

  // Fetch the next work item, excluding snoozed items
  const fetchNextWorkItem = async () => {
    setIsLoading(true);
    try {
      // Get active snoozes from localStorage
      const activeSnoozes = getActiveSnoozes();
      const snoozedItems = activeSnoozes.map((snooze) => ({
        type: snooze.type,
        id: snooze.id,
      }));

      // Build query parameter
      const params = new URLSearchParams();
      if (snoozedItems.length > 0) {
        params.set("snoozedItems", JSON.stringify(snoozedItems));
      }

      const response = await fetch(`/api/next-work-item?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch next work item");
      }

      const data = await response.json();
      setNextWorkItem(data.item);
    } catch (error) {
      console.error("Error fetching next work item:", error);
      setNextWorkItem(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch preferences on mount
  const fetchPreferences = async () => {
    setIsLoadingPreferences(true);
    try {
      const response = await fetch("/api/user/preferences");
      if (!response.ok) {
        throw new Error("Failed to fetch preferences");
      }
      const data = await response.json();
      setPreferences({
        prefer_known_customers: data.prefer_known_customers ?? false,
        prefer_recent_activity: data.prefer_recent_activity ?? true,
        prefer_waiting_on_me: data.prefer_waiting_on_me ?? true,
        prefer_quick_wins: data.prefer_quick_wins ?? true,
      });
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setIsLoadingPreferences(false);
    }
  };

  // Update a single preference
  const updatePreference = async (
    key: keyof WorkPreferences,
    value: boolean,
  ) => {
    // Optimistically update UI
    setPreferences((prev) => ({ ...prev, [key]: value }));

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preference");
      }

      const data = await response.json();
      // Update with server response to ensure consistency
      setPreferences({
        prefer_known_customers: data.prefer_known_customers ?? false,
        prefer_recent_activity: data.prefer_recent_activity ?? true,
        prefer_waiting_on_me: data.prefer_waiting_on_me ?? true,
        prefer_quick_wins: data.prefer_quick_wins ?? true,
      });
    } catch (error) {
      console.error("Error updating preference:", error);
      // Revert on error
      setPreferences((prev) => ({ ...prev, [key]: !value }));
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchPreferences();
    fetchNextWorkItem();
  }, []);

  const handleSnooze = async (item: NextWorkItemRow) => {
    // Snooze the item for 7 days
    if (!item.github_id) {
      console.error("Cannot snooze item: missing github_id");
      return;
    }
    snoozeItem(item.item_type, item.github_id, 7);

    // Immediately fetch the next recommendation
    await fetchNextWorkItem();

    // Refresh the page to update server components
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">
        What should I work on next?
      </h2>

      {/* Preference toggles */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isAspectBuildMember && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.prefer_known_customers}
                onChange={(e) =>
                  updatePreference("prefer_known_customers", e.target.checked)
                }
                disabled={isLoadingPreferences}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Prefer known customers
              </span>
            </label>
          )}

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.prefer_recent_activity}
              onChange={(e) =>
                updatePreference("prefer_recent_activity", e.target.checked)
              }
              disabled={isLoadingPreferences}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Prefer recent activity</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.prefer_waiting_on_me}
              onChange={(e) =>
                updatePreference("prefer_waiting_on_me", e.target.checked)
              }
              disabled={isLoadingPreferences}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Prefer items waiting on me
            </span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.prefer_quick_wins}
              onChange={(e) =>
                updatePreference("prefer_quick_wins", e.target.checked)
              }
              disabled={isLoadingPreferences}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Look for quick wins</span>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">Loading recommendation...</p>
        </div>
      ) : nextWorkItem ? (
        <NextWorkItemCard
          item={nextWorkItem}
          onSnooze={() => handleSnooze(nextWorkItem)}
          isPending={isPending}
        />
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-gray-600">Nothing urgent right now.</p>
        </div>
      )}
    </div>
  );
}
