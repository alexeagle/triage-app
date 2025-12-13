"use client";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { faExternalLink, faFilter } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { IssueRow } from "@/lib/queries";
import TimeAgo from "./TimeAgo";
import GitHubUser from "./GitHubUser";

interface IssuesTableProps {
  issues: IssueRow[];
}

export default function IssuesTable({ issues }: IssuesTableProps) {
  const { data: session } = useSession();

  const [typeFilter, setTypeFilter] = useState<
    "all" | "feature request" | "bug" | "other"
  >("all");
  const [reporterFilter, setReporterFilter] = useState<
    "all" | "not me" | "only me" | "is maintainer"
  >("all");
  const [timeFilter, setTimeFilter] = useState<
    "all" | "day" | "week" | "month" | "year"
  >("week");

  // Helper function to determine issue type
  const getIssueType = (
    issue: IssueRow,
  ): "feature request" | "bug" | "other" => {
    // Check title prefix for feature requests
    if (issue.title.startsWith("[FR]")) {
      return "feature request";
    }

    // Check labels
    const labels = issue.labels as Array<{ name: string }> | null;
    if (labels && Array.isArray(labels)) {
      const labelNames = labels.map((l) => l.name.toLowerCase());

      if (labelNames.some((name) => name.includes("bug"))) {
        return "bug";
      }
      if (
        labelNames.some(
          (name) => name.includes("feature") || name.includes("fr"),
        )
      ) {
        return "feature request";
      }
    }

    return "other";
  };

  // Filter issues
  const filteredIssues = issues.filter((issue) => {
    // Apply type filter
    if (typeFilter !== "all") {
      const issueType = getIssueType(issue);
      if (issueType !== typeFilter) {
        return false;
      }
    }

    // Apply reporter filter
    const userLogin = (session?.user as { login?: string })?.login;
    if (reporterFilter === "only me") {
      if (issue.author_login !== userLogin) {
        return false;
      }
    }
    if (reporterFilter === "not me") {
      if (issue.author_login === userLogin) {
        return false;
      }
    }
    if (reporterFilter === "is maintainer") {
      if (!issue.author_is_maintainer) {
        return false;
      }
    }

    // Apply time filter
    if (timeFilter !== "all") {
      const now = new Date();
      const updatedAt = new Date(issue.updated_at);
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

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filtering */}
      <div className="flex items-center justify-between bg-blue-100 p-2 rounded-lg">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon icon={faFilter} className="mr-2" />
          <label className="flex items-center gap-1">
            Type:
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as "all" | "feature request" | "bug" | "other",
                )
              }
              className="px-2 py-1 text-sm border rounded"
            >
              <option value="all">all</option>
              <option value="feature request">feature request</option>
              <option value="bug">bug</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Reporter:
            <select
              value={reporterFilter}
              onChange={(e) =>
                setReporterFilter(
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
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Repo
              </th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">
                Reporter
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
            {filteredIssues.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 text-sm">
                  <Link
                    className="text-blue-600 hover:underline"
                    href={`https://github.com/${i.repo_full_name || ""}/issues/${i.number}`}
                    target="_blank"
                  >
                    {i.title}
                    <FontAwesomeIcon icon={faExternalLink} className="ml-2" />
                  </Link>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {i.repo_full_name || "N/A"}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  <GitHubUser
                    login={i.author_login}
                    avatarUrl={i.author_avatar_url}
                    size="md"
                    isMaintainer={i.author_is_maintainer ?? false}
                  />
                </td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const labels = i.labels as Array<{
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
                  <TimeAgo dateString={i.updated_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
