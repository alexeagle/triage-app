import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/authConfig";
import { isCurrentUserEngineeringMember } from "../../lib/auth";
import { getProspectActivity } from "../../lib/queriesCompanyActivity";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
import UserInteractionsButton from "../components/UserInteractionsButton";

export default async function ProspectActivityPage() {
  // Require authentication
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <p className="text-gray-600 mb-6">Unauthorized. Please log in.</p>
        <a
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign In
        </a>
      </div>
    );
  }

  // Require engineering team membership
  const isEngineeringMember = await isCurrentUserEngineeringMember();
  if (!isEngineeringMember) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <p className="text-gray-600 mb-6">
          Access restricted. You must be a member of the aspect-build
          organization to view this page.
        </p>
      </div>
    );
  }

  let activityData;
  try {
    activityData = await getProspectActivity();
  } catch (error) {
    console.error("Error fetching customer/prospect activity:", error);
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <h1 className="text-2xl font-bold mb-4">Prospect Activity</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Error loading activity data. Please check the server logs.
          </p>
          {error instanceof Error && (
            <p className="text-red-600 text-sm mt-2">{error.message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Prospect Activity: last 30 days
        </h1>
      </div>

      {activityData.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600">
            No activity found for prospect companies.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {activityData.map((company) => (
            <div
              key={company.hubspot_company_id}
              className="border-b border-gray-200 pb-8"
            >
              <h2 className="text-2xl font-semibold mb-4">
                {company.company_name}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Users Section */}
                <div>
                  <h3 className="text-lg font-medium mb-3 text-gray-700">
                    Users ({company.users.length})
                  </h3>
                  {company.users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No users found</p>
                  ) : (
                    <ul className="space-y-2">
                      {company.users.map((user) => (
                        <li
                          key={user.user_github_id}
                          className={`flex items-center justify-between py-2 px-3 rounded hover:bg-gray-100 ${
                            user.is_maintainer
                              ? "bg-gray-100 opacity-60"
                              : "bg-gray-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Link
                              href={`https://github.com/${user.user_login}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`hover:underline ${
                                user.is_maintainer
                                  ? "text-gray-500"
                                  : "text-blue-600"
                              }`}
                            >
                              {user.user_login}
                            </Link>
                            {user.is_maintainer && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded"
                                title="Maintainer"
                              >
                                <FontAwesomeIcon
                                  icon={faCrown}
                                  className="w-3 h-3"
                                />
                                Maintainer
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${
                                user.is_maintainer
                                  ? "text-gray-500"
                                  : "text-gray-600"
                              }`}
                            >
                              {user.interaction_count} interaction
                              {user.interaction_count !== 1 ? "s" : ""}
                            </span>
                            <UserInteractionsButton
                              userLogin={user.user_login}
                              userGithubId={user.user_github_id}
                              companyName={company.company_name}
                              interactionCount={user.interaction_count}
                              isMaintainer={user.is_maintainer}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Repositories Section */}
                <div>
                  <h3 className="text-lg font-medium mb-3 text-gray-700">
                    Repositories ({company.repositories.length})
                  </h3>
                  {company.repositories.length === 0 ? (
                    <p className="text-gray-500 text-sm">
                      No repositories found
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {company.repositories.map((repo) => (
                        <li
                          key={repo.repo_github_id}
                          className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100"
                        >
                          <span className="text-gray-800 font-mono text-sm">
                            {repo.repo_full_name ||
                              `repo-${repo.repo_github_id}`}
                          </span>
                          <span className="text-gray-600 font-medium">
                            {repo.interaction_count} interaction
                            {repo.interaction_count !== 1 ? "s" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
