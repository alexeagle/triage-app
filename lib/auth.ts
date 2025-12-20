/**
 * Authentication Helpers
 *
 * Provides NextAuth event handlers and user management functions.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./authConfig";
import { query } from "./db";

export interface UserRow {
  id: number;
  github_id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  starred_only: boolean;
}

interface GitHubProfile {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

/**
 * Upserts a user into the database from GitHub OAuth profile.
 *
 * @param profile - GitHub profile from OAuth
 */
export async function upsertUser(profile: GitHubProfile): Promise<void> {
  await query(
    `INSERT INTO users (github_id, login, name, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id)
     DO UPDATE SET
       login = EXCLUDED.login,
       name = EXCLUDED.name,
       avatar_url = EXCLUDED.avatar_url`,
    [
      profile.id, // github_id
      profile.login,
      profile.name || null,
      profile.avatar_url || null,
    ],
  );
}

/**
 * Gets the current user from the database based on the session.
 *
 * @returns User row or null if not authenticated or user not found
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return null;
  }

  // Get github_id from session (stored in JWT)
  const githubId = (session.user as { github_id?: number }).github_id;

  if (!githubId) {
    return null;
  }

  const results = await query<UserRow>(
    `SELECT id, github_id, login, name, avatar_url, created_at, COALESCE(starred_only, false) as starred_only
     FROM users
     WHERE github_id = $1`,
    [githubId],
  );

  if (results.length === 0) {
    return null;
  }

  return results[0];
}

/**
 * Checks if the current user is a member of the aspect-build organization.
 *
 * @returns true if user is a member, false otherwise
 */
export async function isCurrentUserEngineeringMember(): Promise<boolean> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return false;
  }

  const isAspectBuildMember = (
    session.user as { isEngineeringMember?: boolean }
  ).isEngineeringMember;

  return isAspectBuildMember ?? false;
}
