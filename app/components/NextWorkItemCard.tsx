"use client";

import { useState } from "react";
import type { NextWorkItemRow } from "../../lib/queries";

interface NextWorkItemCardProps {
  item: NextWorkItemRow;
  onSnooze?: () => void;
  isPending?: boolean;
}

interface AISummary {
  summary: {
    core_issue: string;
    current_state: string;
    last_meaningful_update_days_ago: number;
    involved_users: {
      maintainers: string[];
      contributors: string[];
    };
  };
  signals: {
    needs_info: boolean;
    likely_stale: boolean;
    blocked: boolean;
  };
  suggested_next_steps: Array<{
    type: string;
    confidence: number;
  }>;
}

function formatDaysAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "today";
  } else if (diffDays === 1) {
    return "1 day ago";
  } else {
    return `${diffDays} days ago`;
  }
}

export default function NextWorkItemCard({
  item,
  onSnooze,
  isPending = false,
}: NextWorkItemCardProps) {
  const [isAISummaryExpanded, setIsAISummaryExpanded] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [isLoadingAISummary, setIsLoadingAISummary] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState(false);

  const githubUrl = `https://github.com/${item.repo_full_name}/${item.item_type === "pr" ? "pull" : "issues"}/${item.number}`;

  // Generate "why" text
  let whyText = "";
  const hasInteracted = item.last_interaction_at !== null;

  if (item.stalled && item.turn === "maintainer") {
    const daysAgo = formatDaysAgo(item.updated_at);
    whyText = `Waiting on maintainers since ${daysAgo}`;
    if (hasInteracted) {
      const interactionDaysAgo = formatDaysAgo(item.last_interaction_at!);
      whyText += ` • You interacted ${interactionDaysAgo}`;
    }
  } else if (item.turn === "maintainer") {
    whyText = "Waiting on maintainer response";
    if (hasInteracted) {
      const interactionDaysAgo = formatDaysAgo(item.last_interaction_at!);
      whyText += ` • You interacted ${interactionDaysAgo}`;
    }
  } else {
    whyText = "Assigned to you";
    if (hasInteracted) {
      const interactionDaysAgo = formatDaysAgo(item.last_interaction_at!);
      whyText += ` • You interacted ${interactionDaysAgo}`;
    }
  }

  const handleAISummaryToggle = async () => {
    if (isAISummaryExpanded) {
      setIsAISummaryExpanded(false);
      return;
    }

    setIsAISummaryExpanded(true);

    // Only fetch if we don't already have the summary
    if (aiSummary !== null) {
      return;
    }

    setIsLoadingAISummary(true);
    setAiSummaryError(false);

    try {
      const response = await fetch("/api/ai/next-work-item-summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ workItemId: String(item.github_id) }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch AI summary");
      }

      const data = await response.json();
      setAiSummary(data);
    } catch (error) {
      console.error("Error fetching AI summary:", error);
      setAiSummaryError(true);
    } finally {
      setIsLoadingAISummary(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              {item.item_type === "pr" ? "PR" : "Issue"}
            </span>
            {item.stalled && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                Stalled
              </span>
            )}
          </div>
          <h3 className="text-gray-900 font-medium mb-2 line-clamp-2">
            {item.repo_full_name}#{item.number} {item.title}
          </h3>
          <p className="text-sm text-gray-600">{whyText}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleAISummaryToggle}
          className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900"
        >
          <span className="font-medium">AI summary</span>
          <span className="text-gray-500">
            {isAISummaryExpanded ? "−" : "+"}
          </span>
        </button>
        {isAISummaryExpanded && (
          <div className="mt-3 text-sm text-gray-600">
            {isLoadingAISummary && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></span>
                <span>Loading summary...</span>
              </div>
            )}
            {aiSummaryError && (
              <p className="text-gray-500">AI summary unavailable</p>
            )}
            {!isLoadingAISummary && !aiSummaryError && aiSummary && (
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">
                    Core issue:{" "}
                  </span>
                  <span>{aiSummary.summary.core_issue}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Current state:{" "}
                  </span>
                  <span>{aiSummary.summary.current_state}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Maintainers:{" "}
                  </span>
                  <span>
                    {aiSummary.summary.involved_users.maintainers.length > 0
                      ? aiSummary.summary.involved_users.maintainers.join(", ")
                      : "None"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Contributors:{" "}
                  </span>
                  <span>
                    {aiSummary.summary.involved_users.contributors.length > 0
                      ? aiSummary.summary.involved_users.contributors.join(", ")
                      : "None"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Last meaningful update:{" "}
                  </span>
                  <span>
                    {aiSummary.summary.last_meaningful_update_days_ago === 0
                      ? "today"
                      : aiSummary.summary.last_meaningful_update_days_ago === 1
                        ? "1 day ago"
                        : `${aiSummary.summary.last_meaningful_update_days_ago} days ago`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-3 items-center mt-4">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex-1 md:flex-initial"
        >
          Open on GitHub
        </a>
        {onSnooze && (
          <button
            type="button"
            onClick={onSnooze}
            disabled={isPending}
            className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Hide this suggestion for 7 days"
          >
            Snooze for 7 days
          </button>
        )}
      </div>
    </div>
  );
}
