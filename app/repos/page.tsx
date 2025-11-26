import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "../../lib/auth.js";
import { getRepos } from "../../lib/queries.js";

export default async function ReposPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const repos = await getRepos();

  return (
    <div>
      <h1>Repositories</h1>
      <ul>
        {repos.map((repo) => (
          <li key={repo.id}>
            <Link href={`/repos/${repo.name}`}>{repo.name}</Link>
            {repo.updated_at && (
              <span>
                {" "}
                (updated: {new Date(repo.updated_at).toLocaleDateString()})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
