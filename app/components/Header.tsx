"use client";
import { useSession } from "next-auth/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";

export default function Header() {
  const { data: session } = useSession();

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
        <i className="text-sm text-gray-600">
          It's like{" "}
          <a
            href="https://dashboard.bazel.build/"
            target="_blank"
            rel="noopener noreferrer"
          >
            dashboard.bazel.build
          </a>{" "}
          but includes other orgs
        </i>
      </div>
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          <img src={avatarUrl} alt={login} className="w-8 h-8 rounded-full" />
        ) : (
          <FontAwesomeIcon icon={faUser} className="w-8 h-8" />
        )}
        <span>{login}</span>
      </div>
    </header>
  );
}
