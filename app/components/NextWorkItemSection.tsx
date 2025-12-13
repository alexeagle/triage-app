"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getActiveSnoozes, snoozeItem } from "../../lib/snooze";
import NextWorkItemCard from "./NextWorkItemCard";
import type { NextWorkItemRow } from "../../lib/queries";

export default function NextWorkItemSection() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextWorkItem, setNextWorkItem] = useState<NextWorkItemRow | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

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

  // Fetch on mount
  useEffect(() => {
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
