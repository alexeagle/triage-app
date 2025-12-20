import { getCurrentUser } from "../../../lib/auth";
import { redirect } from "next/navigation";
import {
  getTopReposByOpenPRs,
  getTotalOpenPRs,
  getTotalOpenIssues,
  getTotalRepoCount,
  getStalledWorkCounts,
} from "../../../lib/queries";
import PRCountBarChartWrapper from "../../components/PRCountBarChartWrapper";
import InfoTooltip from "../../components/InfoTooltip";

export default async function MaintainerTurnReportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  // Read starredOnly preference from database
  const starredOnly = user.starred_only ?? false;
  const userGithubId = starredOnly ? user.github_id : null;

  const stallInterval = "14 days";

  const [
    topReposByPRs,
    totalOpenPRs,
    totalOpenIssues,
    totalRepoCount,
    stalledCounts,
  ] = await Promise.all([
    getTopReposByOpenPRs(20, stallInterval, userGithubId),
    getTotalOpenPRs(userGithubId),
    getTotalOpenIssues(userGithubId),
    getTotalRepoCount(userGithubId),
    getStalledWorkCounts(stallInterval, userGithubId),
  ]);

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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          Human-authored PRs/Issues waiting on Maintainer
          <InfoTooltip
            content={
              <div className="space-y-2">
                <div>
                  <strong className="text-white">Maintainers:</strong>
                  <p className="text-gray-300 text-xs mt-1">
                    Identified from three sources: (1) GitHub Collaborators API
                    (admin/maintain/write permissions), (2) CODEOWNERS files,
                    and (3) .bcr/metadata.template.json files. Users are marked
                    as maintainers when detected from any of these sources.
                  </p>
                </div>
                <div>
                  <strong className="text-white">Whose Turn:</strong>
                  <p className="text-gray-300 text-xs mt-1">
                    Determined by comment history: If no maintainer has
                    commented, it's the maintainer's turn. If the last comment
                    was by a maintainer, it's the author's turn. This chart only
                    shows items where it's the maintainer's turn to respond.
                  </p>
                </div>
                <div>
                  <strong className="text-white">Human-authored:</strong>
                  <p className="text-gray-300 text-xs mt-1">
                    Excludes any PRs or issues where the author's login contains
                    "bot" (case-insensitive). This filters out automated
                    accounts and GitHub Actions bots.
                  </p>
                </div>
                <div>
                  <strong className="text-white">Stalled:</strong>
                  <p className="text-gray-300 text-xs mt-1">
                    An item is marked as "stalled" when two conditions are met:
                    (1) It's the maintainer's turn to respond, and (2) The last
                    maintainer action (or the item's creation date if no
                    maintainer has commented) occurred more than 14 days ago.
                    This highlights work that has been waiting on maintainers
                    for an extended period and may need attention.
                  </p>
                </div>
              </div>
            }
          />
        </h1>
        <h2 className="text-lg text-gray-600">
          (Top 20 of {starredOnly ? "Starred" : "All"} repos)
        </h2>
      </div>

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
    </div>
  );
}
