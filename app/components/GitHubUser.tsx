import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

interface GitHubUserProps {
  login: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showLink?: boolean;
  className?: string;
  isMaintainer?: boolean | null;
}

const sizeClasses = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export default function GitHubUser({
  login,
  avatarUrl,
  size = "md",
  showLink = false,
  className = "",
  isMaintainer = false,
}: GitHubUserProps) {
  const avatarSize = sizeClasses[size];
  const iconSize =
    size === "sm" ? "w-5 h-5" : size === "md" ? "w-6 h-6" : "w-8 h-8";

  const avatarElement = avatarUrl ? (
    <img src={avatarUrl} alt={login} className={`${avatarSize} rounded-full`} />
  ) : (
    <FontAwesomeIcon icon={faUser} className={`${iconSize} text-gray-400`} />
  );

  const loginElement = (
    <span className={isMaintainer ? "font-bold" : ""}>{login}</span>
  );

  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      {avatarElement}
      {loginElement}
    </div>
  );

  if (showLink) {
    return (
      <Link
        href={`https://github.com/${login}`}
        className="text-blue-600 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </Link>
    );
  }

  return content;
}
