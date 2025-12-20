import Link from "next/link";
import { getCurrentUser } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { getReposByMaintainer } from "../../../lib/queries";

export default async function MyReposReportPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const maintainerRepos = await getReposByMaintainer(user.github_id);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Open issues/PRs in repos I maintain
        </h1>
      </div>

      {maintainerRepos.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">
            You don't maintain any repositories yet.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            {maintainerRepos.length} Repositories You Maintain
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
                const repoTotal = repo.open_prs_count + repo.open_issues_count;
                const prWidthPercent =
                  maxTotal > 0 ? (repo.open_prs_count / maxTotal) * 100 : 0;
                const issueWidthPercent =
                  maxTotal > 0 ? (repo.open_issues_count / maxTotal) * 100 : 0;

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
    </div>
  );
}
