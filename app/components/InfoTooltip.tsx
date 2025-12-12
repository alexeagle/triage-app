"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";

interface InfoTooltipProps {
  content: React.ReactNode;
}

export default function InfoTooltip({ content }: InfoTooltipProps) {
  return (
    <div className="relative inline-block group ml-2">
      <FontAwesomeIcon
        icon={faCircleQuestion}
        className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help"
      />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-96 p-4 bg-gray-900 text-white text-sm rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none">
        <div className="space-y-3">{content}</div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}
