import { getCurrentUser } from "../lib/auth";
import NextWorkItemSection from "./components/NextWorkItemSection";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-full">
        <p className="text-gray-600 mb-6">
          Hey there! I gotta ask you to log in so the app can show filters
          specific to your user.
        </p>
        <a
          href="/api/auth/signin"
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Grant read-only access to GitHub Email addresses and profile
          information
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-full">
      {/* What should I work on next? - Always visible */}
      <NextWorkItemSection />
    </div>
  );
}
