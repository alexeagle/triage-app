import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../lib/auth";
import { getOrgs, getNonBotPullRequests, PAGE_SIZE } from "../lib/queries";
import PullRequestsTable from "./components/PullRequestsTable";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <p className="text-gray-600 mb-6">Please log in to continue.</p>
        <a
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign in with GitHub
        </a>
      </div>
    );
  }

  const [orgs, nonBotPRs] = await Promise.all([
    getOrgs(),
    getNonBotPullRequests(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-full">
      <h1 className="text-3xl font-bold mb-6">Organizations</h1>
      <ul className="space-y-2 mb-12">
        {orgs.map((org) => (
          <li
            key={org}
            className="border-b border-gray-200 pb-2 last:border-b-0"
          >
            <Link
              href={`/${org}`}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-lg"
            >
              {org}
            </Link>
          </li>
        ))}
      </ul>

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
          />
        )}
      </section>
    </div>
  );
}
