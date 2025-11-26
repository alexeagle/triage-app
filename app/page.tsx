import { getServerSession } from "next-auth";
import { authOptions } from "../lib/authConfig";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {session ? (
        <a
          href="/repos"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FontAwesomeIcon icon={faGithub} />
          GitHub Repositories Listing
        </a>
      ) : (
        <>
          <p className="text-gray-600 mb-6">Please log in to continue.</p>
          <a
            href="/api/auth/signin"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign in with GitHub
          </a>
        </>
      )}
    </div>
  );
}
