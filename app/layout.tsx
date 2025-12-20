import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Providers from "./components/Providers";
import LeftNav from "./components/LeftNav";
import { getCurrentUser } from "../lib/auth";
import { getOrgs, getRepoCountsByOrg } from "../lib/queries";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bazel Triage App",
  description: "Bazel issue and PR triage application",
  icons: {
    icon: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch orgs data for the left nav
  const user = await getCurrentUser();
  const starredOnly = user?.starred_only ?? false;
  const [orgs, repoCountsByOrg] = await Promise.all([
    getOrgs(starredOnly ? (user?.github_id ?? null) : null),
    getRepoCountsByOrg(starredOnly ? (user?.github_id ?? null) : null),
  ]);

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <Header />
          <div className="flex">
            <LeftNav orgs={orgs} repoCountsByOrg={repoCountsByOrg} />
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
