import { redirect } from "next/navigation";
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
  PAGE_SIZE,
} from "../lib/queries";
import PullRequestsTable from "./components/PullRequestsTable";
import PRCountBarChartWrapper from "./components/PRCountBarChartWrapper";
import InfoTooltip from "./components/InfoTooltip";
import { faBuilding } from "@fortawesome/free-solid-svg-icons";
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
  ] = await Promise.all([
    getOrgs(),
    getRepoCountsByOrg(),
    getNonBotPullRequests(),
    getTopReposByOpenPRs(20, stallInterval),
    getTotalOpenPRs(),
    getTotalOpenIssues(),
    getTotalRepoCount(),
    getStalledWorkCounts(stallInterval),
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
    <div className="container mx-auto px-4 py-8 max-w-full">
      <ul className="space-y-2 mb-12">
        {orgs.map((org) => {
          const repoCount = repoCountMap.get(org) ?? 0;
          return (
            <li key={org} className="pb-2">
              <FontAwesomeIcon icon={faBuilding} className="w-4 h-4 mr-2" />
              <Link
                href={`/${org}`}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-lg"
              >
                {org}
              </Link>
              <span className="text-sm text-gray-600">
                {" "}
                ({repoCount} repo{repoCount !== 1 ? "s" : ""})
              </span>
            </li>
          );
        })}
      </ul>

      <h2 className="text-2xl font-semibold mb-4 flex items-center">
        Human-authored PRs/Issues waiting on Maintainer (Top 20 repos)
        <InfoTooltip
          content={
            <div className="space-y-2">
              <div>
                <strong className="text-white">Maintainers:</strong>
                <p className="text-gray-300 text-xs mt-1">
                  Identified from three sources: (1) GitHub Collaborators API
                  (admin/maintain/write permissions), (2) CODEOWNERS files, and
                  (3) .bcr/metadata.template.json files. Users are marked as
                  maintainers when detected from any of these sources.
                </p>
              </div>
              <div>
                <strong className="text-white">Whose Turn:</strong>
                <p className="text-gray-300 text-xs mt-1">
                  Determined by comment history: If no maintainer has commented,
                  it's the maintainer's turn. If the last comment was by a
                  maintainer, it's the author's turn. This chart only shows
                  items where it's the maintainer's turn to respond.
                </p>
              </div>
              <div>
                <strong className="text-white">Human-authored:</strong>
                <p className="text-gray-300 text-xs mt-1">
                  Excludes any PRs or issues where the author's login contains
                  "bot" (case-insensitive). This filters out automated accounts
                  and GitHub Actions bots.
                </p>
              </div>
              <div>
                <strong className="text-white">Stalled:</strong>
                <p className="text-gray-300 text-xs mt-1">
                  An item is marked as "stalled" when two conditions are met:
                  (1) It's the maintainer's turn to respond, and (2) The last
                  maintainer action (or the item's creation date if no
                  maintainer has commented) occurred more than 14 days ago. This
                  highlights work that has been waiting on maintainers for an
                  extended period and may need attention.
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
          otherRepoCount={Math.max(0, totalRepoCount - topReposByPRs.length)}
          showOther={otherPRCount > 0 || otherIssueCount > 0}
          stallInterval={stallInterval}
        />
      </div>

      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Pull Requests (Non-Bot Authors)
        </h2>
        {nonBotPRs.length === 0 ? (
          <p className="text-gray-600 text-sm">No pull requests found.</p>
        ) : (
          <PullRequestsTable
            pullRequests={nonBotPRs}
            repoFullName=""
            page={1}
            totalPages={Math.ceil(nonBotPRs.length / PAGE_SIZE)}
            defaultTimeFilter="day"
          />
        )}
      </section>
    </div>
  );
}
