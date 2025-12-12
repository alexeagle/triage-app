"use client";

import Link from "next/link";

export interface RepoWithPRCount {
  github_id: number;
  full_name: string;
  name: string;
  open_prs_count: number;
  open_issues_count: number;
  stalled_prs_count?: number;
  stalled_issues_count?: number;
}

interface PRCountBarChartProps {
  repos: RepoWithPRCount[];
  otherPRCount?: number;
  otherIssueCount?: number;
  otherStalledPRCount?: number;
  otherStalledIssueCount?: number;
  otherRepoCount?: number;
  showOther?: boolean;
  stallInterval?: string;
  onSegmentClick?: (type: "pr" | "issue", stalled: boolean) => void;
}

export default function PRCountBarChart({
  repos,
  otherPRCount = 0,
  otherIssueCount = 0,
  otherStalledPRCount = 0,
  otherStalledIssueCount = 0,
  otherRepoCount = 0,
  showOther = false,
  stallInterval = "14 days",
  onSegmentClick,
}: PRCountBarChartProps) {
  if (repos.length === 0 && otherPRCount === 0 && otherIssueCount === 0) {
    return (
      <div className="text-gray-600 text-sm">
        No repositories with open PRs or issues found.
      </div>
    );
  }

  // Calculate active counts (total - stalled)
  const reposWithActive = repos.map((r) => ({
    ...r,
    active_prs_count: r.open_prs_count - (r.stalled_prs_count || 0),
    active_issues_count: r.open_issues_count - (r.stalled_issues_count || 0),
  }));

  const otherActivePRCount = otherPRCount - otherStalledPRCount;
  const otherActiveIssueCount = otherIssueCount - otherStalledIssueCount;

  // Find max total (all four segments) for scaling
  const maxTotal = Math.max(
    ...reposWithActive.map(
      (r) =>
        r.active_prs_count +
        (r.stalled_prs_count || 0) +
        r.active_issues_count +
        (r.stalled_issues_count || 0),
    ),
    otherActivePRCount +
      otherStalledPRCount +
      otherActiveIssueCount +
      otherStalledIssueCount,
  );

  // Calculate totals for percentage display
  const totalPRs =
    repos.reduce((sum, r) => sum + r.open_prs_count, 0) + otherPRCount;
  const totalIssues =
    repos.reduce((sum, r) => sum + r.open_issues_count, 0) + otherIssueCount;
  const grandTotal = totalPRs + totalIssues;

  return (
    <div className="space-y-3">
      {reposWithActive.map((repo) => {
        const repoTotal =
          repo.active_prs_count +
          (repo.stalled_prs_count || 0) +
          repo.active_issues_count +
          (repo.stalled_issues_count || 0);
        const percentOfTotal =
          grandTotal > 0 ? ((repoTotal / grandTotal) * 100).toFixed(1) : "0";

        // Calculate width percentages for each of the four horizontal segments
        const activePRWidthPercent =
          maxTotal > 0 ? (repo.active_prs_count / maxTotal) * 100 : 0;
        const stalledPRWidthPercent =
          maxTotal > 0 ? ((repo.stalled_prs_count || 0) / maxTotal) * 100 : 0;
        const activeIssueWidthPercent =
          maxTotal > 0 ? (repo.active_issues_count / maxTotal) * 100 : 0;
        const stalledIssueWidthPercent =
          maxTotal > 0
            ? ((repo.stalled_issues_count || 0) / maxTotal) * 100
            : 0;

        return (
          <div key={repo.github_id} className="group">
            <div className="flex items-center gap-3 mb-1">
              <Link
                href={`/${repo.full_name.split("/")[0]}/${repo.name}`}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm min-w-0 flex-shrink-0"
                style={{ width: "300px" }}
              >
                {repo.full_name}
              </Link>
              <div className="flex-1 relative h-6 flex gap-0.5">
                {/* Four horizontal segments: Active PRs, Stalled PRs, Active Issues, Stalled Issues */}
                {/* Active PRs */}
                {repo.active_prs_count > 0 && (
                  <div
                    className="bg-blue-500 transition-all hover:bg-blue-600 relative cursor-pointer rounded-l"
                    style={{ width: `${activePRWidthPercent}%` }}
                    onClick={() => onSegmentClick?.("pr", false)}
                    title={`${repo.active_prs_count} active PRs`}
                  >
                    {activePRWidthPercent > 5 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                        {repo.active_prs_count}
                      </div>
                    )}
                  </div>
                )}
                {/* Stalled PRs */}
                {(repo.stalled_prs_count || 0) > 0 && (
                  <div
                    className="bg-blue-700 transition-all hover:bg-blue-800 relative cursor-pointer"
                    style={{ width: `${stalledPRWidthPercent}%` }}
                    onClick={() => onSegmentClick?.("pr", true)}
                    title={`${repo.stalled_prs_count} stalled PRs — waiting on maintainers for more than ${stallInterval}`}
                  >
                    {stalledPRWidthPercent > 5 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                        {repo.stalled_prs_count}
                      </div>
                    )}
                  </div>
                )}
                {/* Active Issues */}
                {repo.active_issues_count > 0 && (
                  <div
                    className="bg-orange-500 transition-all hover:bg-orange-600 relative cursor-pointer"
                    style={{ width: `${activeIssueWidthPercent}%` }}
                    onClick={() => onSegmentClick?.("issue", false)}
                    title={`${repo.active_issues_count} active issues`}
                  >
                    {activeIssueWidthPercent > 5 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                        {repo.active_issues_count}
                      </div>
                    )}
                  </div>
                )}
                {/* Stalled Issues */}
                {(repo.stalled_issues_count || 0) > 0 && (
                  <div
                    className="bg-orange-700 transition-all hover:bg-orange-800 relative cursor-pointer rounded-r"
                    style={{ width: `${stalledIssueWidthPercent}%` }}
                    onClick={() => onSegmentClick?.("issue", true)}
                    title={`${repo.stalled_issues_count} stalled issues — waiting on maintainers for more than ${stallInterval}`}
                  >
                    {stalledIssueWidthPercent > 5 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                        {repo.stalled_issues_count}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div
                className="text-xs text-gray-500 min-w-0 flex-shrink-0"
                style={{ width: "80px" }}
              >
                {percentOfTotal}%
              </div>
            </div>
          </div>
        );
      })}

      {showOther && (otherPRCount > 0 || otherIssueCount > 0) && (
        <div className="group pt-2 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-gray-600 font-medium text-sm min-w-0 flex-shrink-0"
              style={{ width: "300px" }}
            >
              Other {`${otherRepoCount}`} repositories
            </span>
            <div className="flex-1 relative h-6 flex gap-0.5">
              {/* Four horizontal segments: Active PRs, Stalled PRs, Active Issues, Stalled Issues */}
              {(() => {
                const otherTotal =
                  otherActivePRCount +
                  otherStalledPRCount +
                  otherActiveIssueCount +
                  otherStalledIssueCount;
                const otherActivePRWidthPercent =
                  maxTotal > 0 ? (otherActivePRCount / maxTotal) * 100 : 0;
                const otherStalledPRWidthPercent =
                  maxTotal > 0 ? (otherStalledPRCount / maxTotal) * 100 : 0;
                const otherActiveIssueWidthPercent =
                  maxTotal > 0 ? (otherActiveIssueCount / maxTotal) * 100 : 0;
                const otherStalledIssueWidthPercent =
                  maxTotal > 0 ? (otherStalledIssueCount / maxTotal) * 100 : 0;

                return (
                  <>
                    {/* Active PRs */}
                    {otherActivePRCount > 0 && (
                      <div
                        className="bg-gray-400 transition-all hover:bg-gray-500 relative cursor-pointer rounded-l"
                        style={{ width: `${otherActivePRWidthPercent}%` }}
                        onClick={() => onSegmentClick?.("pr", false)}
                        title={`${otherActivePRCount} active PRs`}
                      >
                        {otherActivePRWidthPercent > 5 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                            {otherActivePRCount}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Stalled PRs */}
                    {otherStalledPRCount > 0 && (
                      <div
                        className="bg-gray-600 transition-all hover:bg-gray-700 relative cursor-pointer"
                        style={{ width: `${otherStalledPRWidthPercent}%` }}
                        onClick={() => onSegmentClick?.("pr", true)}
                        title={`${otherStalledPRCount} stalled PRs — waiting on maintainers for more than ${stallInterval}`}
                      >
                        {otherStalledPRWidthPercent > 5 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                            {otherStalledPRCount}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Active Issues */}
                    {otherActiveIssueCount > 0 && (
                      <div
                        className="bg-gray-500 transition-all hover:bg-gray-600 relative cursor-pointer"
                        style={{ width: `${otherActiveIssueWidthPercent}%` }}
                        onClick={() => onSegmentClick?.("issue", false)}
                        title={`${otherActiveIssueCount} active issues`}
                      >
                        {otherActiveIssueWidthPercent > 5 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                            {otherActiveIssueCount}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Stalled Issues */}
                    {otherStalledIssueCount > 0 && (
                      <div
                        className="bg-gray-700 transition-all hover:bg-gray-800 relative cursor-pointer rounded-r"
                        style={{ width: `${otherStalledIssueWidthPercent}%` }}
                        onClick={() => onSegmentClick?.("issue", true)}
                        title={`${otherStalledIssueCount} stalled issues — waiting on maintainers for more than ${stallInterval}`}
                      >
                        {otherStalledIssueWidthPercent > 5 && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                            {otherStalledIssueCount}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div
              className="text-xs text-gray-500 min-w-0 flex-shrink-0"
              style={{ width: "80px" }}
            >
              {grandTotal > 0
                ? (
                    ((otherActivePRCount +
                      otherStalledPRCount +
                      otherActiveIssueCount +
                      otherStalledIssueCount) /
                      grandTotal) *
                    100
                  ).toFixed(1)
                : "0"}
              %
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
