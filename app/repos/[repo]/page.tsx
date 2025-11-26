import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authConfig.js";

interface RepoPageProps {
  params: {
    repo: string;
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const repoName = params.repo;

  return (
    <div>
      <h1>Repository: {repoName}</h1>
      <p>Repository details will be displayed here.</p>
      {/* TODO: Fetch and display repository details, issues, PRs */}
    </div>
  );
}
