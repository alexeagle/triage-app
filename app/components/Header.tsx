"use client";
import { useSession } from "next-auth/react";
import GitHubUser from "./GitHubUser";

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
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Triage App" className="w-8 h-8" />
          <span className="font-semibold">Alex's Triage App</span>
        </div>
        <i className="hidden md:block text-sm text-gray-600 text-center">
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
