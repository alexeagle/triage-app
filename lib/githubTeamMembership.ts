/**
 * GitHub Organization Membership Check
 *
 * Checks if a user is a public member of a GitHub organization.
 */

/**
 * Checks if a GitHub user is a public member of an organization.
 * This endpoint works without authentication for public memberships.
 *
 * @param username - GitHub username
 * @param org - GitHub organization name
 * @param accessToken - Optional GitHub OAuth access token (not required for public memberships)
 * @returns true if user is a public member, false otherwise
 */
export async function isOrgMember(
  username: string,
  org: string,
  accessToken?: string,
): Promise<boolean> {
  try {
    const url = `https://api.github.com/orgs/${encodeURIComponent(org)}/members/${encodeURIComponent(username)}`;
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "triage-app",
    };

    // Add auth header if token is provided (allows checking private memberships too)
    if (accessToken) {
      headers.Authorization = `token ${accessToken}`;
    }

    const response = await fetch(url, { headers });

    // 204 means user is a public member
    if (response.status === 204) {
      console.log(
        `[isOrgMember] User ${username} is a public member of ${org}`,
      );
      return true;
    }

    // 404 means user is not a public member
    if (response.status === 404) {
      console.log(
        `[isOrgMember] User ${username} is not a public member of ${org} (404)`,
      );
      return false;
    }

    // 302 redirect means user is a private member (requires auth)
    if (response.status === 302) {
      if (accessToken) {
        // If we have a token, follow the redirect to check private membership
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl) {
          const redirectResponse = await fetch(redirectUrl, { headers });
          if (redirectResponse.status === 204) {
            console.log(
              `[isOrgMember] User ${username} is a private member of ${org}`,
            );
            return true;
          }
        }
      }
      console.log(
        `[isOrgMember] User ${username} might be a private member of ${org} (302), but no token provided`,
      );
      return false;
    }

    // Other status codes - log and return false
    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      console.error(
        `[isOrgMember] Unexpected status ${response.status} for ${username} in ${org}. Error: ${errorText}`,
      );
      return false;
    }

    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[isOrgMember] Error checking org membership for ${username} in ${org}:`,
      errorMessage,
    );
    return false;
  }
}

/**
 * Checks if a user is a member of the aspect-build organization.
 * Convenience function for the specific org we care about.
 *
 * @param username - GitHub username
 * @param accessToken - Optional GitHub OAuth access token
 * @returns true if user is a member, false otherwise
 */
export async function isAspectBuildMember(
  username: string,
  accessToken?: string,
): Promise<boolean> {
  return isOrgMember(username, "aspect-build", accessToken);
}
