/**
 * GitHub User Profile Fetching
 *
 * Fetches user profile data from GitHub API.
 * Handles rate limiting and errors gracefully.
 */

interface GitHubUserProfile {
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  twitter_username: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches GitHub user profile data from the API.
 * Handles rate limiting by sleeping until reset if needed.
 *
 * @param login - GitHub username
 * @param accessToken - GitHub access token (OAuth token or PAT)
 * @returns User profile data
 */
export async function fetchGitHubUserProfile(
  login: string,
  accessToken: string,
): Promise<GitHubUserProfile> {
  const url = `https://api.github.com/users/${encodeURIComponent(login)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "triage-app",
    },
  });

  // Handle rate limiting (403 or 429)
  if (response.status === 403 || response.status === 429) {
    const resetHeader = response.headers.get("x-ratelimit-reset");
    if (resetHeader) {
      const resetTimestamp = parseInt(resetHeader, 10) * 1000;
      const now = Date.now();
      const sleepDuration = Math.max(0, resetTimestamp - now) + 1000; // Add 1s buffer

      console.warn(
        `[fetchGitHubUserProfile] Rate limit hit for ${login}. Sleeping until ${new Date(resetTimestamp).toISOString()} (${Math.ceil(sleepDuration / 1000)}s)`,
      );
      await sleep(sleepDuration);
      // Retry the request
      return fetchGitHubUserProfile(login, accessToken);
    }
  }

  if (response.status === 404) {
    throw new Error(`User ${login} not found (404)`);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error for ${login}: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return {
    name: data.name || null,
    bio: data.bio || null,
    company: data.company || null,
    blog: data.blog || null,
    location: data.location || null,
    twitter_username: data.twitter_username || null,
  };
}

/**
 * Enriches a GitHubUserInput with profile data from GitHub API.
 * Returns the enriched user object, or the original if fetch fails.
 *
 * @param user - GitHub user input
 * @param accessToken - GitHub access token
 * @returns Enriched user with profile data
 */
export async function enrichUserWithProfile(
  user: {
    github_id: number;
    login: string;
    avatar_url?: string | null;
    name?: string | null;
    type?: string | null;
  },
  accessToken: string,
): Promise<{
  github_id: number;
  login: string;
  avatar_url?: string | null;
  name?: string | null;
  type?: string | null;
  bio?: string | null;
  company?: string | null;
  blog?: string | null;
  location?: string | null;
  twitter?: string | null;
}> {
  try {
    const profile = await fetchGitHubUserProfile(user.login, accessToken);
    return {
      ...user,
      name: profile.name ?? user.name ?? null,
      bio: profile.bio,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      twitter: profile.twitter_username,
    };
  } catch (error) {
    // Log but don't fail - return original user without profile data
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(
      `[enrichUserWithProfile] Failed to fetch profile for ${user.login}: ${errorMessage}`,
    );
    return user;
  }
}
