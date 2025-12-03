import { getServerSession } from "next-auth";
import { authOptions } from "../lib/authConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { getIssuesByAuthor, PAGE_SIZE } from "@/lib/queries";
import IssuesTable from "./components/IssuesTable";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page: string };
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    const page = Number(searchParams.page) || 1;
    const offset = (page - 1) * PAGE_SIZE;
    const { issues, total } = await getIssuesByAuthor(
      (session.user as { login?: string })?.login || "",
      offset,
    );
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const currentPage = page;
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <h2 className="text-2xl font-bold mb-4">Issues I authored</h2>
        <IssuesTable issues={issues} page={page} totalPages={totalPages} />

        <a
          href="/repos"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FontAwesomeIcon icon={faGithub} />
          GitHub Repositories Listing
        </a>
      </div>
    );
  } else {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <>
          <p className="text-gray-600 mb-6">Please log in to continue.</p>
          <a
            href="/api/auth/signin"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in with GitHub
          </a>
        </>
      </div>
    );
  }
}
