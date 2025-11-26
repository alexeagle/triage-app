/**
 * NextAuth Configuration
 *
 * Centralized NextAuth configuration to avoid circular dependencies.
 */

import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { upsertUser } from "./auth";

export const authOptions: NextAuthOptions = {
  debug: true,
  secret: process.env.NEXTAUTH_SECRET!,
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id,
          login: profile.login ?? profile.name ?? `user-${profile.id}`,
          name: profile.name,
          avatar_url: profile.avatar_url,
          email: profile.email,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  events: {
    async signIn({ user, account, profile }) {
      // Upsert user into database on sign in
      if (profile && account?.provider === "github") {
        const githubProfile = profile as {
          id: number;
          login: string;
          name?: string;
          avatar_url?: string;
        };
        await upsertUser({
          id: githubProfile.id,
          login: githubProfile.login,
          name: githubProfile.name,
          avatar_url: githubProfile.avatar_url,
        });
      }
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store minimal user info in JWT: github_id and login
      if (account && profile && account.provider === "github") {
        const githubProfile = profile as {
          id: number;
          login: string;
          name?: string;
          avatar_url?: string;
        };
        token.github_id = githubProfile.id;
        token.login = githubProfile.login;
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Add minimal user info to session
      if (session.user && token.github_id && token.login) {
        (session.user as { github_id?: number; login?: string }).github_id =
          token.github_id as number;
        (session.user as { github_id?: number; login?: string }).login =
          token.login as string;
        // @ts-ignore - Add access token to session if needed
        session.accessToken = token.accessToken;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // After sign-in, redirect to /repos
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/repos`;
      }
      // Allow relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return baseUrl;
    },
  },
};
