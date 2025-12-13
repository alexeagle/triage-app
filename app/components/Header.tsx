"use client";
import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { getStarredOnlyFilter, setStarredOnlyFilter } from "../../lib/filters";
import GitHubUser from "./GitHubUser";

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Initialize from localStorage, default to false
  const [starredOnly, setStarredOnly] = useState(false);

  // Load preference from localStorage on mount and sync to cookie
  useEffect(() => {
    const value = getStarredOnlyFilter();
    setStarredOnly(value);
    // Sync to cookie so server components can read it
    document.cookie = `starredOnly=${value ? "true" : "false"}; path=/; max-age=31536000`; // 1 year
  }, []);

  const handleToggle = () => {
    const newValue = !starredOnly;
    setStarredOnly(newValue);
    setStarredOnlyFilter(newValue);
    // Sync to cookie so server components can read it
    document.cookie = `starredOnly=${newValue ? "true" : "false"}; path=/; max-age=31536000`; // 1 year
    // Trigger a custom event so other components can react to the change
    window.dispatchEvent(
      new CustomEvent("starredOnlyChanged", { detail: newValue }),
    );
    // Refresh the page data (server components will re-fetch with new filter)
    startTransition(() => {
      router.refresh();
    });
  };

  if (!session) {
    return <header className="p-4 border-b border-gray-200"></header>;
  }

  const user = session.user;
  const avatarUrl =
    (user as { avatar_url?: string })?.avatar_url || user?.image;
  const login = (user as { login?: string })?.login || user?.name || "User";

  return (
    <header className="p-4 border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Triage App" className="w-8 h-8" />
        <span className="font-semibold">Alex's Triage App</span>
        <i className="text-sm text-gray-600 text-center">
          &ldquo;It's like{" "}
          <a
            href="https://dashboard.bazel.build/"
            target="_blank"
            rel="noopener noreferrer"
          >
            dashboard.bazel.build
          </a>
          <br />
          but includes other orgs&rdquo;
        </i>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm text-gray-700">Starred Only</span>
          <button
            type="button"
            role="switch"
            aria-checked={starredOnly}
            onClick={handleToggle}
            disabled={isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
              starredOnly ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            {isPending ? (
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
        <GitHubUser
          login={login}
          avatarUrl={avatarUrl}
          size="lg"
          isMaintainer={false}
        />
      </div>
    </header>
  );
}
