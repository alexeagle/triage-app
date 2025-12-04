import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import {
  getReposByOrg,
  getRepoStats,
  type RepoRow,
} from "../../lib/queries";

interface OrgPageProps {
  params: {
    org: string;
  };
}

export default async function OrgPage({ params }: OrgPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const [repos, stats] = await Promise.all([
    getReposByOrg(params.org),
    getRepoStats(),
  ]);

  // Create a map of stats by repo_github_id for quick lookup
  const statsMap = new Map(stats.map((stat) => [stat.repo_github_id, stat]));

  // Merge stats into repos
  const reposWithStats: (RepoRow & {
    open_issues_count: number;
    open_prs_count: number;
  })[] = repos
    .map((repo) => {
      const stat = statsMap.get(repo.github_id);
      return {
        ...repo,
        open_issues_count: stat?.open_issues_count ?? 0,
        open_prs_count: stat?.open_prs_count ?? 0,
      };
    })
    .filter((repo) => repo.open_issues_count > 0 || repo.open_prs_count > 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/"
          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
        >
          ← Back to Organizations
        </Link>
        <h1 className="text-3xl font-bold mt-2">
          Repositories in {params.org} with open issues or PRs
        </h1>
      </div>
      <ul className="space-y-2">
        {reposWithStats.map((repo) => {
          const repoName = repo.full_name.split("/")[1];
          return (
            <li
              key={repo.id}
              className="border-b border-gray-200 pb-2 last:border-b-0"
            >
              <Link
                href={`/${params.org}/${repoName}`}
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {repo.full_name}
              </Link>
              <span className="text-gray-500 text-sm ml-2">
                {repo.open_issues_count} open issues, {repo.open_prs_count} open
                PRs
              </span>
              {repo.updated_at && (
                <span className="text-gray-500 text-sm ml-2">
                  (updated: {new Date(repo.updated_at).toLocaleDateString()})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
