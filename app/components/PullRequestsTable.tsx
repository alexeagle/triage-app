"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { faExternalLink, faFilter } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { PullRequestRow } from "@/lib/queries";
import TimeAgo from "./TimeAgo";
import GitHubUser from "./GitHubUser";
import { CompanyClassification } from "@/lib/companyClassificationTypes";

interface PullRequestsTableProps {
  pullRequests: PullRequestRow[];
  repoFullName: string;
  defaultTimeFilter?: "all" | "day" | "week" | "month" | "year";
  maintainerRepoIds?: number[]; // Array of repo github_ids where user is a maintainer
}

export default function PullRequestsTable({
  pullRequests,
  repoFullName,
  defaultTimeFilter = "all",
  maintainerRepoIds = [],
}: PullRequestsTableProps) {
  const { data: session } = useSession();
  const isEngineeringMember =
    (session?.user as { isEngineeringMember?: boolean })?.isEngineeringMember ??
    false;

  const [draftFilter, setDraftFilter] = useState<"all" | "draft" | "not draft">(
    "all",
  );
  const [authorFilter, setAuthorFilter] = useState<
    "all" | "not me" | "only me" | "is maintainer"
  >("all");
  const [timeFilter, setTimeFilter] = useState<
    "all" | "day" | "week" | "month" | "year"
  >(defaultTimeFilter);
  const [turnFilter, setTurnFilter] = useState<"all" | "maintainer" | "author">(
    "maintainer",
  );
  const [repoFilter, setRepoFilter] = useState<"all" | "I'm a maintainer">(
    "I'm a maintainer",
  );

  // Filter pull requests
  const filteredPRs = pullRequests.filter((pr) => {
    // Apply draft filter
    if (draftFilter === "draft") {
      if (!pr.draft) {
        return false;
      }
    }
    if (draftFilter === "not draft") {
      if (pr.draft) {
        return false;
      }
    }

    // Apply author filter
    const userLogin = (session?.user as { login?: string })?.login;
    if (authorFilter === "only me") {
      if (pr.author_login !== userLogin) {
        return false;
      }
    }
    if (authorFilter === "not me") {
      if (pr.author_login === userLogin) {
        return false;
      }
    }
    if (authorFilter === "is maintainer") {
      if (!pr.author_is_maintainer) {
        return false;
      }
    }

    // Apply time filter
    if (timeFilter !== "all") {
      const now = new Date();
      const updatedAt = new Date(pr.updated_at);
      let cutoffDate: Date;

      switch (timeFilter) {
        case "day":
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "week":
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "year":
          cutoffDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          return true;
      }

      if (updatedAt < cutoffDate) {
        return false;
      }
    }

    // Apply turn filter
    if (turnFilter !== "all") {
      // If PR doesn't have turn info (null), treat as maintainer's turn
      const prTurn = pr.turn ?? "maintainer";
      if (prTurn !== turnFilter) {
        return false;
      }
    }

    // Apply repo filter
    if (repoFilter === "I'm a maintainer") {
      if (!maintainerRepoIds.includes(pr.repo_github_id)) {
        return false;
      }
    }

    return true;
  });

  // Check if we should show the repo column (when PRs come from multiple repos)
  const showRepoColumn = pullRequests.some((pr) => pr.repo_full_name);

  return (
    <div className="space-y-4">
      {/* Filtering */}
      <div className="flex items-center justify-between bg-blue-100 p-2 rounded-lg">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} className="mr-2" />
          <label className="flex items-center gap-1">
            Draft:
            <select
              value={draftFilter}
              onChange={(e) =>
                setDraftFilter(e.target.value as "all" | "draft" | "not draft")
              }
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="all">all</option>
              <option value="draft">draft</option>
              <option value="not draft">not draft</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Author:
            <select
              value={authorFilter}
              onChange={(e) =>
                setAuthorFilter(
                  e.target.value as
                    | "all"
                    | "not me"
                    | "only me"
                    | "is maintainer",
                )
              }
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="all">all</option>
              <option value="not me">not me</option>
              <option value="only me">only me</option>
              <option value="is maintainer">is maintainer</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Updated:
            <select
              value={timeFilter}
              onChange={(e) => {
                const value = e.target.value;
                if (
                  value === "all" ||
                  value === "day" ||
                  value === "week" ||
                  value === "month" ||
                  value === "year"
                ) {
                  setTimeFilter(value);
                }
              }}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="all">all</option>
              <option value="day">last 24 hours</option>
              <option value="week">last 7 days</option>
              <option value="month">last 30 days</option>
              <option value="year">last 12 months</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Turn:
            <select
              value={turnFilter}
              onChange={(e) =>
                setTurnFilter(e.target.value as "all" | "maintainer" | "author")
              }
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="all">all</option>
              <option value="maintainer">maintainer</option>
              <option value="author">author</option>
            </select>
          </label>
          {maintainerRepoIds.length > 0 && (
            <label className="flex items-center gap-1">
              Repo:
              <select
                value={repoFilter}
                onChange={(e) =>
                  setRepoFilter(e.target.value as "all" | "I'm a maintainer")
                }
                className="px-2 py-1 text-sm border rounded"
              >
                <option value="all">all</option>
                <option value="I'm a maintainer">I'm a maintainer</option>
              </select>
            </label>
          )}
        </div>
      </div>
      {/* Table */}
      <div className="border rounded-lg overflow-hidden w-full">
        <table className="min-w-full w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Title
              </th>
              {showRepoColumn && (
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                  Repo
                </th>
              )}
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                State
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Author
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Labels
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPRs.map((pr) => (
              <tr key={pr.id}>
                <td className="px-4 py-2 text-sm">
                  <Link
                    className="text-blue-600 hover:underline"
                    href={`https://github.com/${pr.repo_full_name || repoFullName}/pull/${pr.number}`}
                    target="_blank"
                  >
                    #{pr.number} {pr.title}
                    {pr.draft && (
                      <span className="ml-2 text-xs text-gray-500">
                        (Draft)
                      </span>
                    )}
                    <FontAwesomeIcon icon={faExternalLink} className="ml-2" />
                  </Link>
                </td>
                {showRepoColumn && (
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {pr.repo_full_name || "N/A"}
                  </td>
                )}
                <td className="px-4 py-2 text-sm text-gray-600">
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                      pr.state === "open"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {pr.state}
                  </span>
                  {pr.merged && (
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                      Merged
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  <GitHubUser
                    login={pr.author_login}
                    avatarUrl={pr.author_avatar_url}
                    size="md"
                    isMaintainer={pr.author_is_maintainer ?? false}
                    bio={pr.author_bio ?? null}
                    company={pr.author_company ?? null}
                    companyClassification={
                      pr.author_company_classification as CompanyClassification | null
                    }
                    githubUserId={pr.author_github_id ?? null}
                    isEngineeringMember={isEngineeringMember}
                  />
                </td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const labels = pr.labels as Array<{
                        name: string;
                        color?: string;
                      }> | null;
                      if (
                        !labels ||
                        !Array.isArray(labels) ||
                        labels.length === 0
                      ) {
                        return <span className="text-gray-400 text-xs">—</span>;
                      }
                      return labels.map((label, idx) => {
                        const colorHex = label.color || "6b7280";
                        const bgColor = `#${colorHex}`;
                        // Determine text color based on background brightness
                        const rgb = parseInt(colorHex, 16);
                        const r = (rgb >> 16) & 0xff;
                        const g = (rgb >> 8) & 0xff;
                        const b = rgb & 0xff;
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        const textColor =
                          brightness > 128 ? "#000000" : "#ffffff";

                        return (
                          <span
                            key={idx}
                            className="px-2 py-0.5 text-xs font-medium rounded-full inline-block"
                            style={{
                              backgroundColor: bgColor,
                              color: textColor,
                            }}
                          >
                            {label.name}
                          </span>
                        );
                      });
                    })()}
                  </div>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  <TimeAgo dateString={pr.updated_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
