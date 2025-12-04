import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authConfig";
import {
  getReposByOrg,
  getRepoIssues,
  getRepoPullRequests,
  IssueRow,
  PAGE_SIZE,
} from "../../../../lib/queries";
import IssuesTable from "../../../components/IssuesTable";

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

  const [issues, pullRequests] = await Promise.all([
    getRepoIssues(repo.github_id),
    getRepoPullRequests(repo.github_id),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 w-full">
      <div className="mb-6">
        <Link
          href={`/repos/${params.org}`}
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
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Pull Requests</h2>
        {pullRequests.length === 0 ? (
          <p className="text-gray-600 text-sm">No pull requests found.</p>
        ) : (
          <ul className="space-y-3">
            {pullRequests.map((pr) => (
              <li
                key={pr.id}
                className="border-b border-gray-200 pb-3 last:border-b-0"
              >
                <Link
                  href={`https://github.com/${repo.full_name}/pull/${pr.number}`}
                  className="text-blue-600 hover:underline font-medium"
                  target="_blank"
                >
                  #{pr.number} {pr.title}
                </Link>
                <div className="text-sm text-gray-600">
                  State: {pr.state}
                  {pr.draft ? " • Draft" : ""} • Updated:{" "}
                  {new Date(pr.updated_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Issues</h2>
        {issues.length === 0 ? (
          <p className="text-gray-600 text-sm">No issues found.</p>
        ) : (
          <IssuesTable
            issues={issues.map(
              (issue): IssueRow => ({
                ...issue,
                repo_full_name: repo.full_name,
              }),
            )}
            page={1}
            totalPages={Math.ceil(issues.length / PAGE_SIZE)}
          />
        )}
      </section>
    </div>
  );
}
