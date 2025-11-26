/**
 * NextAuth Configuration
 *
 * Centralized NextAuth configuration to avoid circular dependencies.
 */

import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { upsertUser } from "./auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  events: {
    async signIn({ user, account, profile }) {
      // Upsert user into database on sign in
      if (profile && account?.provider === "github") {
        await upsertUser({
          id: profile.id as number,
          login: profile.login as string,
          name: profile.name as string | undefined,
          avatar_url: profile.avatar_url as string | undefined,
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store minimal user info in JWT: github_id and login
      if (account && profile) {
        token.github_id = profile.id as number;
        token.login = profile.login as string;
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Add minimal user info to session
      if (session.user) {
        session.user.github_id = token.github_id as number;
        session.user.login = token.login as string;
        // @ts-ignore - Add access token to session if needed
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
