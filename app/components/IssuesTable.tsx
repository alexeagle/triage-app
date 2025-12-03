"use client";

import { faExternalLink } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IssueByAuthorRow } from "@/lib/queries";

interface IssuesTableProps {
  issues: IssueByAuthorRow[];
  page: number;
  totalPages: number;
}

export default function IssuesTable({
  issues,
  page,
  totalPages,
}: IssuesTableProps) {
  const router = useRouter();

  const go = (p: number) => {
    router.push(`?page=${p}`);
  };

  return (
    <div className="space-y-4">
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
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {issues.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 text-sm">
                  <Link
                    className="text-blue-600 hover:underline"
                    href={`https://github.com/${i.repo_full_name}/issues/${i.id}`}
                    target="_blank"
                  >
                    {i.title}
                    <FontAwesomeIcon icon={faExternalLink} className="ml-2" />
                  </Link>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {i.repo_full_name}
                </td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {new Date(i.updated_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
        >
          Previous
        </button>

        <div className="flex items-center gap-2">
          {(() => {
            const maxButtons = 10;
            const pages: (number | "ellipsis")[] = [];

            if (totalPages <= maxButtons) {
              // Show all pages if total is 10 or less
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              // Always show first page
              pages.push(1);

              // Calculate range around current page
              let start = Math.max(2, page - 2);
              let end = Math.min(totalPages - 1, page + 2);

              // Adjust range to show at least 5 pages in the middle if possible
              if (end - start < 4) {
                if (start === 2) {
                  end = Math.min(totalPages - 1, start + 4);
                } else if (end === totalPages - 1) {
                  start = Math.max(2, end - 4);
                }
              }

              // Add ellipsis before middle section if needed
              if (start > 2) {
                pages.push("ellipsis");
              }

              // Add middle pages
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }

              // Add ellipsis after middle section if needed
              if (end < totalPages - 1) {
                pages.push("ellipsis");
              }

              // Always show last page
              pages.push(totalPages);
            }

            return pages.map((p, idx) => {
              if (p === "ellipsis") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-sm text-gray-500"
                  >
                    ...
                  </span>
                );
              }
              const active = p === page;
              return (
                <button
                  key={p}
                  onClick={() => go(p)}
                  className={`px-2 py-1 text-sm border rounded transition ${
                    active ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              );
            });
          })()}
        </div>

        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
