import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "../lib/authConfig";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/repos");
  }

  return (
    <div>
      <h1>Triage App</h1>
      <p>Please log in to continue.</p>
      <a href="/api/auth/signin">Sign in with GitHub</a>
    </div>
  );
}
