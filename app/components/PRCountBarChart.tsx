"use client";

import Link from "next/link";

export interface RepoWithPRCount {
  github_id: number;
  full_name: string;
  name: string;
  open_prs_count: number;
  open_issues_count: number;
}

interface PRCountBarChartProps {
  repos: RepoWithPRCount[];
  otherPRCount?: number;
  otherIssueCount?: number;
  otherRepoCount?: number;
  showOther?: boolean;
}

export default function PRCountBarChart({
  repos,
  otherPRCount = 0,
  otherIssueCount = 0,
  otherRepoCount = 0,
  showOther = false,
}: PRCountBarChartProps) {
  if (repos.length === 0 && otherPRCount === 0 && otherIssueCount === 0) {
    return (
      <div className="text-gray-600 text-sm">
        No repositories with open PRs or issues found.
      </div>
    );
  }

  // Find max total (PRs + issues) for scaling
  const maxTotal = Math.max(
    ...repos.map((r) => r.open_prs_count + r.open_issues_count),
    otherPRCount + otherIssueCount,
  );

  // Calculate totals for percentage display
  const totalPRs =
    repos.reduce((sum, r) => sum + r.open_prs_count, 0) + otherPRCount;
  const totalIssues =
    repos.reduce((sum, r) => sum + r.open_issues_count, 0) + otherIssueCount;
  const grandTotal = totalPRs + totalIssues;

  return (
    <div className="space-y-3">
      {repos.map((repo) => {
        const repoTotal = repo.open_prs_count + repo.open_issues_count;
        const prPercentage = (repo.open_prs_count / maxTotal) * 100;
        const issuePercentage = (repo.open_issues_count / maxTotal) * 100;
        const totalPercentage = (repoTotal / maxTotal) * 100;
        const percentOfTotal =
          grandTotal > 0 ? ((repoTotal / grandTotal) * 100).toFixed(1) : "0";

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
                {/* Side-by-side bars: PRs on left, Issues on right */}
                {repo.open_prs_count > 0 && (
                  <div
                    className="bg-blue-500 rounded-l transition-all group-hover:bg-blue-600 relative"
                    style={{ width: `${prPercentage}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                      {repo.open_prs_count}
                    </div>
                  </div>
                )}
                {repo.open_issues_count > 0 && (
                  <div
                    className="bg-orange-500 rounded-r transition-all group-hover:bg-orange-600 relative"
                    style={{ width: `${issuePercentage}%` }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                      {repo.open_issues_count}
                    </div>
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
              {/* Side-by-side bars for "Other": PRs on left, Issues on right */}
              {otherPRCount > 0 && (
                <div
                  className="bg-gray-400 rounded-l transition-all group-hover:bg-gray-500 relative"
                  style={{
                    width: `${otherPRCount + otherIssueCount > 0 ? (otherPRCount / maxTotal) * 100 : 0}%`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                    {otherPRCount}
                  </div>
                </div>
              )}
              {otherIssueCount > 0 && (
                <div
                  className="bg-gray-500 rounded-r transition-all group-hover:bg-gray-600 relative"
                  style={{
                    width: `${otherPRCount + otherIssueCount > 0 ? (otherIssueCount / maxTotal) * 100 : 0}%`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                    {otherIssueCount}
                  </div>
                </div>
              )}
            </div>
            <div
              className="text-xs text-gray-500 min-w-0 flex-shrink-0"
              style={{ width: "80px" }}
            >
              {grandTotal > 0
                ? (
                    ((otherPRCount + otherIssueCount) / grandTotal) *
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
