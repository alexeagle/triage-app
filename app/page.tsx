import { getServerSession } from "next-auth";
import { authOptions } from "../lib/authConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import IssuesTable from "./components/IssuesTable";

export default async function HomePage({ searchParams }: { searchParams: {} }) {
  const session = await getServerSession(authOptions);
  if (!session) {
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-full">
      <ol>
        <li></li>
      </ol>

      <a
        href="/repos"
        className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        <FontAwesomeIcon icon={faGithub} />
        GitHub Repositories Listing
      </a>
    </div>
  );
}
