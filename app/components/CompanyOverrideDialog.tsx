"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface CompanyOverrideDialogProps {
  githubUserId: number;
  currentCompany: string | null;
  onClose: () => void;
  onSave: () => void;
}

interface OverrideData {
  override: {
    override_company_name: string | null;
    override_source: "manual" | "github" | "commonroom" | null;
  } | null;
  availableSources: {
    github: string | null;
    commonroom: string | null;
  };
}

export default function CompanyOverrideDialog({
  githubUserId,
  currentCompany,
  onClose,
  onSave,
}: CompanyOverrideDialogProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OverrideData | null>(null);
  const [selectedSource, setSelectedSource] = useState<
    "manual" | "github" | "commonroom" | null
  >(null);
  const [manualCompany, setManualCompany] = useState("");

  useEffect(() => {
    async function fetchOverride() {
      try {
        const response = await fetch(
          `/api/company-override?githubUserId=${githubUserId}`,
        );
        if (!response.ok) throw new Error("Failed to fetch");
        const result = await response.json();
        setData(result);
        setSelectedSource(result.override?.override_source || null);
        setManualCompany(result.override?.override_company_name || "");
      } catch (error) {
        console.error("Error fetching override:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOverride();
  }, [githubUserId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: {
        githubUserId: number;
        overrideCompanyName?: string | null;
        overrideSource?: string | null;
      } = {
        githubUserId,
      };

      if (selectedSource === "manual") {
        body.overrideCompanyName = manualCompany || null;
        body.overrideSource = "manual";
      } else if (
        selectedSource === "github" ||
        selectedSource === "commonroom"
      ) {
        body.overrideSource = selectedSource;
        body.overrideCompanyName = null;
      } else {
        // Clear override
        await fetch(`/api/company-override?githubUserId=${githubUserId}`, {
          method: "DELETE",
        });
        onSave();
        onClose();
        return;
      }

      const response = await fetch("/api/company-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to save");
      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving override:", error);
      alert("Failed to save company override");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const hasGithub = data.availableSources.github != null;
  const hasCommonroom = data.availableSources.commonroom != null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Change Company</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Current: {currentCompany || "None"}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Available Sources:
            </label>
            <div className="text-sm text-gray-600 space-y-1">
              {hasGithub && <div>GitHub: {data.availableSources.github}</div>}
              {hasCommonroom && (
                <div>CommonRoom: {data.availableSources.commonroom}</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Override Source:
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="source"
                  value=""
                  checked={selectedSource === null}
                  onChange={() => setSelectedSource(null)}
                  className="mr-2"
                />
                <span>Auto (CommonRoom preferred, fallback to GitHub)</span>
              </label>
              {hasGithub && (
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="source"
                    value="github"
                    checked={selectedSource === "github"}
                    onChange={() => setSelectedSource("github")}
                    className="mr-2"
                  />
                  <span>GitHub: {data.availableSources.github}</span>
                </label>
              )}
              {hasCommonroom && (
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="source"
                    value="commonroom"
                    checked={selectedSource === "commonroom"}
                    onChange={() => setSelectedSource("commonroom")}
                    className="mr-2"
                  />
                  <span>CommonRoom: {data.availableSources.commonroom}</span>
                </label>
              )}
              <label className="flex items-center">
                <input
                  type="radio"
                  name="source"
                  value="manual"
                  checked={selectedSource === "manual"}
                  onChange={() => setSelectedSource("manual")}
                  className="mr-2"
                />
                <span>Manual entry</span>
              </label>
            </div>
          </div>

          {selectedSource === "manual" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Company Name:
              </label>
              <input
                type="text"
                value={manualCompany}
                onChange={(e) => setManualCompany(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Enter company name"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
