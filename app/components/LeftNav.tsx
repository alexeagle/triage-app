"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faChartBar,
  faList,
  faFolderOpen,
  faBuilding,
  faDatabase,
  faCircleNotch,
  faUserTie,
} from "@fortawesome/free-solid-svg-icons";

interface LeftNavProps {
  orgs?: string[];
  repoCountsByOrg?: Array<{ org: string; count: number }>;
}

export default function LeftNav({
  orgs = [],
  repoCountsByOrg = [],
}: LeftNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Initialize from database, default to false
  const [starredOnly, setStarredOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Create a map for quick lookup of repo counts by org
  const repoCountMap = new Map(
    repoCountsByOrg.map((item) => [item.org, item.count]),
  );

  // Load preference from database on mount
  useEffect(() => {
    if (!session) {
      setIsLoading(false);
      return;
    }

    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((data) => {
        if (data.starred_only !== undefined) {
          setStarredOnly(data.starred_only);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error loading preferences:", error);
        setIsLoading(false);
      });
  }, [session]);

  const handleToggle = async () => {
    const newValue = !starredOnly;
    setStarredOnly(newValue);

    try {
      const response = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ starred_only: newValue }),
      });

      if (!response.ok) {
        // Revert on error
        setStarredOnly(starredOnly);
        console.error("Failed to update preference");
        return;
      }

      // Refresh the page data (server components will re-fetch with new filter)
      // The API route uses revalidatePath to invalidate the cache
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      // Revert on error
      setStarredOnly(starredOnly);
      console.error("Error updating preference:", error);
    }
  };

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: faHome,
    },
  ];

  const isAspectBuildMember =
    (session?.user as { isEngineeringMember?: boolean })?.isEngineeringMember ??
    false;

  const reportItems = [
    {
      href: "/reports/maintainer-turn",
      label: "Human-authored PRs/Issues waiting on Maintainer; all repos",
      icon: faChartBar,
    },
    {
      href: "/reports/my-repos",
      label: "Count of open issues/PRs in repos I maintain",
      icon: faList,
    },
    ...(isAspectBuildMember
      ? [
          {
            href: "/prospecting",
            label: "Prospect Activity",
            icon: faUserTie,
          },
          {
            href: "/customers",
            label: "Customer Activity",
            icon: faUserTie,
          },
        ]
      : []),
  ];

  return (
    <nav className="hidden md:block w-64 bg-gray-50 border-r border-gray-200 min-h-screen p-4">
      <div className="space-y-6">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`}
                />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {session && (
          <div className="px-3 py-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-700">Starred Only</span>
              <button
                type="button"
                role="switch"
                aria-checked={starredOnly}
                onClick={handleToggle}
                disabled={isPending || isLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                  starredOnly ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                {isPending || isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faCircleNotch}
                      className="w-4 h-4 text-gray-900 animate-spin"
                    />
                  </div>
                ) : (
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      starredOnly ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                )}
              </button>
            </label>
          </div>
        )}

        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Reports
          </div>
          <div className="space-y-1 mt-1">
            {reportItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={item.icon}
                    className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`}
                  />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FontAwesomeIcon icon={faDatabase} className="w-3 h-3" />
            Browse By Org
          </div>
          {orgs.length > 0 ? (
            <div className="space-y-1 mt-1">
              {orgs.map((org) => {
                const repoCount = repoCountMap.get(org) ?? 0;
                const isActive =
                  pathname === `/${org}` || pathname.startsWith(`/${org}/`);
                return (
                  <Link
                    key={org}
                    href={`/${org}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-100 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={faBuilding}
                      className={`w-4 h-4 ${isActive ? "text-blue-600" : "text-gray-500"}`}
                    />
                    <span className="text-sm flex-1">{org}</span>
                    <span className="text-xs text-gray-500">({repoCount})</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-2 mt-1 text-sm text-gray-500">
              {starredOnly
                ? "No starred organizations found. Make sure your starred repos have been synced."
                : "No organizations found"}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
