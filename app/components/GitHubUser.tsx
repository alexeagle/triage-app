import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faInfoCircle,
  faBuilding,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";

interface GitHubUserProps {
  login: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showLink?: boolean;
  className?: string;
  isMaintainer?: boolean | null;
  bio?: string | null;
  company?: string | null;
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
  showLink = true,
  className = "",
  isMaintainer = false,
  bio,
  company,
}: GitHubUserProps) {
  const avatarSize = sizeClasses[size];
  const iconSize =
    size === "sm" ? "w-5 h-5" : size === "md" ? "w-6 h-6" : "w-8 h-8";
  const bioIconSize =
    size === "sm" ? "w-3 h-3" : size === "md" ? "w-4 h-4" : "w-5 h-5";

  const avatarElement = avatarUrl ? (
    <img src={avatarUrl} alt={login} className={`${avatarSize} rounded-full`} />
  ) : (
    <FontAwesomeIcon icon={faUser} className={`${iconSize} text-gray-400`} />
  );

  const hasBio = bio && bio.trim().length > 0;
  const hasCompany = company && company.trim().length > 0;
  const showTooltip = hasBio || hasCompany;

  const loginElement = (
    <div className="flex items-center gap-1.5">
      <span className={isMaintainer ? "font-bold" : ""}>{login}</span>
      {showTooltip && (
        <div className="relative inline-block group">
          <FontAwesomeIcon
            icon={faInfoCircle}
            className={`${bioIconSize} text-blue-500 cursor-help`}
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
            <div className="space-y-1">
              {hasCompany && (
                <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faBuilding} className="w-3 h-3" />
                  {company}
                </div>
              )}
              {hasBio && (
                <div className="whitespace-pre-wrap break-words">{bio}</div>
              )}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
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
