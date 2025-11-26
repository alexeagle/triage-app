import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authConfig";

interface RepoPageProps {
  params: {
    org: string;
    repo: string;
  };
}

export default async function RepoPage({ params }: RepoPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const repoName = params.org + "/" + params.repo;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-4">Repository: {repoName}</h1>
      <p className="text-gray-600">
        Repository details will be displayed here.
      </p>
      {/* TODO: Fetch and display repository details, issues, PRs */}
    </div>
  );
}
