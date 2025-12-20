"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

interface UserInteractionDetail {
  item_github_id: number;
  item_type: "issue" | "pr";
  item_number: number;
  title: string;
  repo_full_name: string;
  repo_github_id: number;
  interaction_types: Array<"author" | "comment" | "reaction" | "review">;
  interaction_date: string;
  is_author: boolean;
  github_url: string;
}

interface UserInteractionsModalProps {
  userLogin: string;
  userGithubId: number;
  companyName: string;
  interactionCount: number;
  onClose: () => void;
}

export default function UserInteractionsModal({
  userLogin,
  userGithubId,
  companyName,
  interactionCount,
  onClose,
}: UserInteractionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState<UserInteractionDetail[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInteractions() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/user-interactions?userGithubId=${userGithubId}&companyName=${encodeURIComponent(companyName)}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch interactions");
        }

        const data = await response.json();
        setInteractions(data.interactions || []);
      } catch (err) {
        console.error("Error fetching interactions:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load interactions",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchInteractions();
  }, [userGithubId, companyName]);

  const getInteractionTypeLabel = (
    type: "author" | "comment" | "reaction" | "review",
  ) => {
    switch (type) {
      case "author":
        return "Authored";
      case "comment":
        return "Commented";
      case "reaction":
        return "Reacted";
      case "review":
        return "Reviewed";
      default:
        return type;
    }
  };

  const formatInteractionTypes = (
    types: Array<"author" | "comment" | "reaction" | "review">,
  ) => {
    return types.map(getInteractionTypeLabel).join(", ");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">
              Interactions for {userLogin}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {companyName} • {interactionCount} total interaction
              {interactionCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-600">Loading interactions...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : interactions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No interactions found</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {interactions.map((interaction) => (
                <li
                  key={interaction.item_github_id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                            interaction.item_type === "pr"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {interaction.item_type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatInteractionTypes(
                            interaction.interaction_types,
                          )}
                        </span>
                        {interaction.is_author && (
                          <span className="text-xs font-medium text-gray-700 bg-gray-200 px-2 py-0.5 rounded">
                            Author
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">
                        {interaction.title}
                      </h3>
                      <p className="text-sm text-gray-600 font-mono">
                        {interaction.repo_full_name}#{interaction.item_number}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(interaction.interaction_date)}
                      </p>
                    </div>
                    <Link
                      href={interaction.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-blue-600 hover:text-blue-800 transition-colors"
                      title="View on GitHub"
                    >
                      <FontAwesomeIcon
                        icon={faExternalLinkAlt}
                        className="w-4 h-4"
                      />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
