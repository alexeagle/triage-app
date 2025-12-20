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
  prefer_known_customers: boolean;
  prefer_recent_activity: boolean;
  prefer_waiting_on_me: boolean;
  prefer_quick_wins: boolean;
  is_aspect_build_member: boolean;
}

interface GitHubProfile {
  id: number;
  login: string;
  name?: string;
  avatar_url?: string;
}

/**
 * Upserts a user into the database from GitHub OAuth profile.
 * Preserves is_aspect_build_member if it's already true (doesn't overwrite).
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
       avatar_url = EXCLUDED.avatar_url,
       -- Preserve is_aspect_build_member if it's already true
       is_aspect_build_member = COALESCE(users.is_aspect_build_member, false)`,
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
    `SELECT id, github_id, login, name, avatar_url, created_at, 
            COALESCE(starred_only, false) as starred_only,
            COALESCE(prefer_known_customers, false) as prefer_known_customers,
            COALESCE(prefer_recent_activity, true) as prefer_recent_activity,
            COALESCE(prefer_waiting_on_me, true) as prefer_waiting_on_me,
            COALESCE(prefer_quick_wins, true) as prefer_quick_wins,
            COALESCE(is_aspect_build_member, false) as is_aspect_build_member
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
 * First checks the database override (is_aspect_build_member), then falls back
 * to the session/JWT value from GitHub org membership check.
 *
 * @returns true if user is a member, false otherwise
 */
export async function isCurrentUserEngineeringMember(): Promise<boolean> {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return false;
  }

  // Get github_id from session
  const githubId = (session.user as { github_id?: number }).github_id;
  if (!githubId) {
    return false;
  }

  // First check database override - if set to true, always return true
  const userResults = await query<{ is_aspect_build_member: boolean }>(
    `SELECT COALESCE(is_aspect_build_member, false) as is_aspect_build_member
     FROM users
     WHERE github_id = $1`,
    [githubId],
  );

  if (userResults.length > 0 && userResults[0].is_aspect_build_member) {
    return true;
  }

  // Fall back to session/JWT value from GitHub org check
  const isAspectBuildMember = (
    session.user as { isEngineeringMember?: boolean }
  ).isEngineeringMember;

  return isAspectBuildMember ?? false;
}
