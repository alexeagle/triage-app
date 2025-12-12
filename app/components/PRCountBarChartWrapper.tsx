"use client";

import { useState } from "react";
import PRCountBarChart, { RepoWithPRCount } from "./PRCountBarChart";

interface PRCountBarChartWrapperProps {
  repos: RepoWithPRCount[];
  otherPRCount: number;
  otherIssueCount: number;
  otherStalledPRCount: number;
  otherStalledIssueCount: number;
  otherRepoCount: number;
  showOther: boolean;
  stallInterval: string;
}

export default function PRCountBarChartWrapper({
  repos,
  otherPRCount,
  otherIssueCount,
  otherStalledPRCount,
  otherStalledIssueCount,
  otherRepoCount,
  showOther,
  stallInterval,
}: PRCountBarChartWrapperProps) {
  const [filterType, setFilterType] = useState<"pr" | "issue" | null>(null);
  const [filterStalled, setFilterStalled] = useState<boolean | null>(null);

  const handleSegmentClick = (type: "pr" | "issue", stalled: boolean) => {
    // TODO: Implement filtering logic
    setFilterType(type);
    setFilterStalled(stalled);
    console.log(`Filter: ${type}, stalled: ${stalled}`);
  };

  return (
    <PRCountBarChart
      repos={repos}
      otherPRCount={otherPRCount}
      otherIssueCount={otherIssueCount}
      otherStalledPRCount={otherStalledPRCount}
      otherStalledIssueCount={otherStalledIssueCount}
      otherRepoCount={otherRepoCount}
      showOther={showOther}
      stallInterval={stallInterval}
      onSegmentClick={handleSegmentClick}
    />
  );
}
