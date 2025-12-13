import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getCurrentUser } from "../lib/auth";
import {
  getOrgs,
  getNonBotPullRequests,
  getTopReposByOpenPRs,
  getTotalOpenPRs,
  getTotalOpenIssues,
  getTotalRepoCount,
  getRepoCountsByOrg,
  getStalledWorkCounts,
  getReposByMaintainer,
} from "../lib/queries";
import PullRequestsTable from "./components/PullRequestsTable";
import PRCountBarChartWrapper from "./components/PRCountBarChartWrapper";
import InfoTooltip from "./components/InfoTooltip";
import NextWorkItemSection from "./components/NextWorkItemSection";
import { faBuilding, faDatabase } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <p className="text-gray-600 mb-6">
          Hey there! I gotta ask you to log in so the app can show filters
          specific to your user.
        </p>
        <a
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Grant read-only access to GitHub Email addresses and profile
          information
        </a>
      </div>
    );
  }

  // Read starredOnly preference from database
  const starredOnly = user.starred_only ?? false;
  const userGithubId = starredOnly ? user.github_id : null;

  const stallInterval = "14 days";

  const [
    orgs,
    repoCountsByOrg,
    nonBotPRs,
    topReposByPRs,
    totalOpenPRs,
    totalOpenIssues,
    totalRepoCount,
    stalledCounts,
    maintainerRepos,
  ] = await Promise.all([
    getOrgs(userGithubId),
    getRepoCountsByOrg(userGithubId),
    getNonBotPullRequests(userGithubId),
    getTopReposByOpenPRs(20, stallInterval, userGithubId),
    getTotalOpenPRs(userGithubId),
    getTotalOpenIssues(userGithubId),
    getTotalRepoCount(userGithubId),
    getStalledWorkCounts(stallInterval, userGithubId),
    getReposByMaintainer(user.github_id),
  ]);

  // Create a map for quick lookup of repo counts by org
  const repoCountMap = new Map(
    repoCountsByOrg.map((item) => [item.org, item.count]),
  );

  // Calculate "other" counts (PRs and issues in repos outside top 20)
  const top20PRCount = topReposByPRs.reduce(
    (sum, repo) => sum + repo.open_prs_count,
    0,
  );
  const top20IssueCount = topReposByPRs.reduce(
    (sum, repo) => sum + repo.open_issues_count,
    0,
  );
  const top20StalledPRCount = topReposByPRs.reduce(
    (sum, repo) => sum + (repo.stalled_prs_count || 0),
    0,
  );
  const top20StalledIssueCount = topReposByPRs.reduce(
    (sum, repo) => sum + (repo.stalled_issues_count || 0),
    0,
  );
  const otherPRCount = totalOpenPRs - top20PRCount;
  const otherIssueCount = totalOpenIssues - top20IssueCount;
  const otherStalledPRCount = stalledCounts.prs.stalled - top20StalledPRCount;
  const otherStalledIssueCount =
    stalledCounts.issues.stalled - top20StalledIssueCount;

  return (
    <>
      {/* Nav - hidden on mobile */}
      <nav className="hidden md:block bg-gray-50 border-b border-gray-200 py-2 m-0">
        <div className="container mx-auto px-4 max-w-full">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-600">
              <FontAwesomeIcon icon={faDatabase} className="w-4 h-4" />
              <span className="text-sm font-medium">Browse By Org:</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {orgs.map((org) => {
                const repoCount = repoCountMap.get(org) ?? 0;
                return (
                  <Link
                    key={org}
                    href={`/${org}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline text-sm font-medium whitespace-nowrap"
                  >
                    <FontAwesomeIcon
                      icon={faBuilding}
                      className="w-3 h-3 mr-1.5"
                    />
                    {org}
                    <span className="text-gray-500 ml-1">({repoCount})</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-8 max-w-full">
        {/* What should I work on next? - Always visible */}
        <NextWorkItemSection />

        {/* Desktop-only content - hidden on mobile */}
        <div className="hidden md:block">
          {maintainerRepos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">
                {maintainerRepos.length} Repositories You Maintain (thank you!)
              </h2>
              <ul className="space-y-1">
                {(() => {
                  // Calculate max total for scaling
                  const maxTotal = Math.max(
                    ...maintainerRepos.map(
                      (r) => r.open_prs_count + r.open_issues_count,
                    ),
                    1, // Avoid division by zero
                  );

                  return maintainerRepos.map((repo) => {
                    const [org, repoName] = repo.full_name.split("/");
                    const repoTotal =
                      repo.open_prs_count + repo.open_issues_count;
                    const prWidthPercent =
                      maxTotal > 0 ? (repo.open_prs_count / maxTotal) * 100 : 0;
                    const issueWidthPercent =
                      maxTotal > 0
                        ? (repo.open_issues_count / maxTotal) * 100
                        : 0;

                    return (
                      <li
                        key={repo.github_id}
                        className="relative py-1 px-3 rounded border border-gray-200 hover:border-gray-300 transition-colors"
                      >
                        {/* Bar chart background */}
                        <div className="absolute inset-0 flex gap-0.5 rounded overflow-hidden opacity-20">
                          {repo.open_prs_count > 0 && (
                            <div
                              className="bg-blue-500"
                              style={{ width: `${prWidthPercent}%` }}
                            />
                          )}
                          {repo.open_issues_count > 0 && (
                            <div
                              className="bg-orange-500"
                              style={{ width: `${issueWidthPercent}%` }}
                            />
                          )}
                        </div>
                        {/* Content on top */}
                        <div className="relative z-10 flex items-center gap-3">
                          <Link
                            href={`/${org}/${repoName}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex-shrink-0"
                          >
                            {repo.full_name}
                          </Link>
                          <span className="text-gray-500 text-sm">
                            {repo.open_issues_count} open issues,{" "}
                            {repo.open_prs_count} open PRs
                          </span>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          )}
          <hr />
          <h2 className="text-2xl font-semibold mb-8 mt-8">
            Pull Requests (Non-Bot Authors)
          </h2>
          {nonBotPRs.length === 0 ? (
            <p className="text-gray-600 text-sm">No pull requests found.</p>
          ) : (
            <PullRequestsTable
              pullRequests={nonBotPRs}
              repoFullName=""
              defaultTimeFilter="day"
              maintainerRepoIds={maintainerRepos.map((r) => r.github_id)}
            />
          )}
          <hr />

          <h2 className="text-2xl font-semibold mb-8 flex items-center mt-8">
            Human-authored PRs/Issues waiting on Maintainer (Top 20 repos)
            <InfoTooltip
              content={
                <div className="space-y-2">
                  <div>
                    <strong className="text-white">Maintainers:</strong>
                    <p className="text-gray-300 text-xs mt-1">
                      Identified from three sources: (1) GitHub Collaborators
                      API (admin/maintain/write permissions), (2) CODEOWNERS
                      files, and (3) .bcr/metadata.template.json files. Users
                      are marked as maintainers when detected from any of these
                      sources.
                    </p>
                  </div>
                  <div>
                    <strong className="text-white">Whose Turn:</strong>
                    <p className="text-gray-300 text-xs mt-1">
                      Determined by comment history: If no maintainer has
                      commented, it's the maintainer's turn. If the last comment
                      was by a maintainer, it's the author's turn. This chart
                      only shows items where it's the maintainer's turn to
                      respond.
                    </p>
                  </div>
                  <div>
                    <strong className="text-white">Human-authored:</strong>
                    <p className="text-gray-300 text-xs mt-1">
                      Excludes any PRs or issues where the author's login
                      contains "bot" (case-insensitive). This filters out
                      automated accounts and GitHub Actions bots.
                    </p>
                  </div>
                  <div>
                    <strong className="text-white">Stalled:</strong>
                    <p className="text-gray-300 text-xs mt-1">
                      An item is marked as "stalled" when two conditions are
                      met: (1) It's the maintainer's turn to respond, and (2)
                      The last maintainer action (or the item's creation date if
                      no maintainer has commented) occurred more than 14 days
                      ago. This highlights work that has been waiting on
                      maintainers for an extended period and may need attention.
                    </p>
                  </div>
                </div>
              }
            />
          </h2>
          <div className="mb-4 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2 mr-4">
              <span className="inline-block w-4 h-4 bg-blue-500 rounded"></span>
              PRs (active)
            </span>
            <span className="inline-flex items-center gap-2 mr-4">
              <span className="inline-block w-4 h-4 bg-blue-700 rounded"></span>
              PRs (stalled)
            </span>
            <span className="inline-flex items-center gap-2 mr-4">
              <span className="inline-block w-4 h-4 bg-orange-500 rounded"></span>
              Issues (active)
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-4 h-4 bg-orange-700 rounded"></span>
              Issues (stalled)
            </span>
          </div>
          <div className="mb-12">
            <PRCountBarChartWrapper
              repos={topReposByPRs}
              otherPRCount={otherPRCount}
              otherIssueCount={otherIssueCount}
              otherStalledPRCount={otherStalledPRCount}
              otherStalledIssueCount={otherStalledIssueCount}
              otherRepoCount={Math.max(
                0,
                totalRepoCount - topReposByPRs.length,
              )}
              showOther={otherPRCount > 0 || otherIssueCount > 0}
              stallInterval={stallInterval}
            />
          </div>
        </div>
      </div>
    </>
  );
}
