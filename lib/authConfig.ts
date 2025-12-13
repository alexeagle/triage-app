/**
 * NextAuth Configuration
 *
 * Centralized NextAuth configuration to avoid circular dependencies.
 */

import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { upsertUser } from "./auth";
import { syncStarredRepos } from "./syncStarredRepos";

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

        // Trigger starred repos sync asynchronously (non-blocking)
        // Only sync if we have an access token
        if (account.access_token) {
          // Fire and forget - don't await, don't block login flow
          syncStarredRepos(
            githubProfile.id,
            githubProfile.login,
            account.access_token,
          ).catch((error: unknown) => {
            // Log error but don't throw - login should succeed even if sync fails
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[authConfig] Failed to sync starred repos for user ${githubProfile.login}:`,
              errorMessage,
            );
          });
        }
      }
    },
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store user info in JWT: github_id, login, and avatar_url
      // This runs on sign-in (when profile is available) and on subsequent requests
      if (account && profile && account.provider === "github") {
        const githubProfile = profile as {
          id: number;
          login: string;
          name?: string;
          avatar_url?: string;
        };
        token.github_id = githubProfile.id;
        token.login = githubProfile.login;
        token.avatar_url = githubProfile.avatar_url;
        token.accessToken = account.access_token;
      }
      // Preserve avatar_url from existing token if profile is not available (subsequent requests)
      return token;
    },
    async session({ session, token }) {
      // Add user info to session
      if (session.user && token.github_id && token.login) {
        (
          session.user as {
            github_id?: number;
            login?: string;
            avatar_url?: string;
            image?: string;
          }
        ).github_id = token.github_id as number;
        (
          session.user as {
            github_id?: number;
            login?: string;
            avatar_url?: string;
            image?: string;
          }
        ).login = token.login as string;
        // Set both avatar_url and image for compatibility
        const avatarUrl = token.avatar_url as string | undefined;
        if (avatarUrl) {
          (session.user as { avatar_url?: string; image?: string }).avatar_url =
            avatarUrl;
          (session.user as { avatar_url?: string; image?: string }).image =
            avatarUrl;
        }
        // @ts-ignore - Add access token to session if needed
        session.accessToken = token.accessToken;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}`;
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
