import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth";
import { getOrgs } from "../../lib/queries";

export default async function ReposPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const orgs = await getOrgs();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Organizations</h1>
      <ul className="space-y-2">
        {orgs.map((org) => (
          <li
            key={org}
            className="border-b border-gray-200 pb-2 last:border-b-0"
          >
            <Link
              href={`/repos/${org}`}
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-lg"
            >
              {org}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
