import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authConfig";
import {
  getReposByOrg,
  getRepoIssues,
  getRepoPullRequests,
  getRepoMaintainers,
  MaintainerRow,
} from "../../../lib/queries";
import IssuesTable from "../../components/IssuesTable";
import PullRequestsTable from "../../components/PullRequestsTable";
import GitHubUser from "../../components/GitHubUser";
import { CompanyClassification } from "../../../lib/companyClassificationTypes";

interface RepoPageProps {
  params: {
    org: string;
    repo: string;
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const repoFullName = `${params.org}/${params.repo}`;
  const repos = await getReposByOrg(params.org);
  const repo = repos.find((r) => r.full_name === repoFullName);

  if (!repo) {
    notFound();
  }

  const [issues, pullRequests, maintainers] = await Promise.all([
    getRepoIssues(repo.github_id),
    getRepoPullRequests(repo.github_id),
    getRepoMaintainers(repo.github_id),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 w-full">
      <div className="mb-6">
        <Link
          href={`/${params.org}`}
          className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
        >
          ← Back to {params.org}
        </Link>
        <h1 className="text-3xl font-bold mt-2">
          Repository: {repo.full_name}
        </h1>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Repository Details</h2>
        <div className="rounded border border-gray-200 p-4 text-sm text-gray-700 space-y-1">
          <p>
            Visibility: {repo.private ? "Private" : "Public"} • Archived:
            {repo.archived ? "Yes" : "No"}
          </p>
          {repo.updated_at && (
            <p>Last Updated: {new Date(repo.updated_at).toLocaleString()}</p>
          )}
          {repo.pushed_at && (
            <p>Last Push: {new Date(repo.pushed_at).toLocaleString()}</p>
          )}
          <p>Created: {new Date(repo.created_at).toLocaleString()}</p>
          <p>
            <Link
              href={`https://github.com/${repo.full_name}`}
              className="text-blue-600 hover:underline"
              target="_blank"
            >
              View on GitHub
            </Link>
          </p>
          {maintainers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <p className="font-semibold mb-2">Maintainers:</p>
              <ul className="space-y-1">
                {maintainers.map((maintainer: MaintainerRow) => (
                  <li
                    key={`${maintainer.github_user_id}-${maintainer.source}`}
                    className="flex items-center gap-2"
                  >
                    <GitHubUser
                      login={maintainer.login}
                      avatarUrl={maintainer.avatar_url}
                      size="sm"
                      isMaintainer={true}
                      bio={maintainer.bio ?? null}
                      company={maintainer.company ?? null}
                      companyClassification={
                        maintainer.company_classification as CompanyClassification | null
                      }
                      githubUserId={maintainer.github_user_id}
                    />
                    <span className="text-gray-500 text-xs">
                      ({maintainer.source}, {maintainer.confidence}% confidence)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Pull Requests</h2>
        {pullRequests.length === 0 ? (
          <p className="text-gray-600 text-sm">No pull requests found.</p>
        ) : (
          <PullRequestsTable
            pullRequests={pullRequests}
            repoFullName={repo.full_name}
          />
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Issues</h2>
        {issues.length === 0 ? (
          <p className="text-gray-600 text-sm">No issues found.</p>
        ) : (
          <IssuesTable
            issues={issues.map((issue) => ({
              ...issue,
              repo_full_name: repo.full_name,
            }))}
          />
        )}
      </section>
    </div>
  );
}
