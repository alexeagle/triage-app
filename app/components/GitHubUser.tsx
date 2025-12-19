import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faInfoCircle,
  faBuilding,
} from "@fortawesome/free-solid-svg-icons";
import Link from "next/link";
import { CompanyClassification } from "@/lib/companyClassificationTypes";

interface GitHubUserProps {
  login: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showLink?: boolean;
  className?: string;
  isMaintainer?: boolean | null;
  bio?: string | null;
  company?: string | null;
  companyClassification?: CompanyClassification | null;
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
  companyClassification,
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
  const isAspectBuild = company?.toLowerCase() === "aspect build";
  const isCustomer = companyClassification === CompanyClassification.CUSTOMER;
  const isProspect = companyClassification === CompanyClassification.PROSPECT;

  // Check if we have a company badge (Aspect Build logo, C, or P)
  const hasCompanyBadge = isAspectBuild || isCustomer || isProspect;

  // Show info circle only if there's no company badge but we have bio or company info
  const showInfoCircle = !hasCompanyBadge && (hasBio || hasCompany);

  const renderTooltip = () => (
    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
      <div className="space-y-1">
        {hasCompany && (
          <div className="font-semibold text-gray-300 flex items-center gap-1.5">
            <FontAwesomeIcon icon={faBuilding} className="w-3 h-3" />
            {company}
          </div>
        )}
        {hasBio && <div className="whitespace-pre-wrap break-words">{bio}</div>}
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-full border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  );

  const renderCompanyBadge = () => {
    // Special case: Aspect Build logo
    if (isAspectBuild) {
      return (
        <div className="relative inline-block group">
          <img
            src="/aspect-logo-white.png"
            alt="Aspect Build"
            className="w-5 h-5 cursor-help"
          />
          {renderTooltip()}
        </div>
      );
    }

    if (isCustomer) {
      return (
        <div className="relative inline-block group">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-800 text-xs font-semibold cursor-help">
            C
          </span>
          {renderTooltip()}
        </div>
      );
    }

    if (isProspect) {
      return (
        <div className="relative inline-block group">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-blue-500 text-blue-700 bg-white text-xs font-semibold cursor-help">
            P
          </span>
          {renderTooltip()}
        </div>
      );
    }

    return null;
  };

  const loginElement = (
    <div className="flex items-center gap-1.5">
      <span className={isMaintainer ? "font-bold" : ""}>{login}</span>
      {renderCompanyBadge()}
      {showInfoCircle && (
        <div className="relative inline-block group">
          <FontAwesomeIcon
            icon={faInfoCircle}
            className={`${bioIconSize} text-blue-500 cursor-help`}
          />
          {renderTooltip()}
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
    const linkClassName = isCustomer
      ? "text-green-600 hover:underline"
      : "text-blue-600 hover:underline";
    return (
      <Link
        href={`https://github.com/${login}`}
        className={linkClassName}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </Link>
    );
  }

  return content;
}
