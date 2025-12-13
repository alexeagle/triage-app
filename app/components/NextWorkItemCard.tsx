import Link from "next/link";
import type { NextWorkItemRow } from "../../lib/queries";

interface NextWorkItemCardProps {
  item: NextWorkItemRow;
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

export default function NextWorkItemCard({ item }: NextWorkItemCardProps) {
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
          <Link
            href={`/${item.repo_full_name}/${item.item_type === "pr" ? "pull" : "issues"}/${item.number}`}
            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-lg block mb-1"
          >
            {item.repo_full_name}#{item.number}
          </Link>
          <h3 className="text-gray-900 font-medium mb-2 line-clamp-2">
            {item.title}
          </h3>
          <p className="text-sm text-gray-600">{whyText}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex-1 md:flex-initial"
        >
          Open on GitHub
        </a>
      </div>
    </div>
  );
}
