/**
 * Common Room API Client
 *
 * Provides a wrapper around the Common Room API with:
 * - Bearer token authentication
 * - Basic error handling
 * - Simple request interface
 */

interface CommonRoomMember {
  fullName?: string;
  organization?: string; // Company name
  github?: string | { type: string; value: string }; // Can be string or object
  linkedin?: string;
  twitter?: string;
  email?: string;
  // Note: The API response may have more fields, but we only need these
}

/**
 * Extracts GitHub handle from a Common Room member's github field.
 * Handles both string and object formats.
 */
function extractGitHubHandle(
  github: string | { type: string; value: string } | undefined,
): string | null {
  if (!github) {
    return null;
  }
  if (typeof github === "string") {
    return github;
  }
  if (typeof github === "object" && "value" in github) {
    return github.value;
  }
  return null;
}

interface CommonRoomAPIResponse {
  data?: CommonRoomMember[];
  error?: {
    message: string;
    code?: string;
  };
}

export class CommonRoomAPI {
  private baseUrl = "https://api.commonroom.io/community/v1";
  private apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.COMMONROOM_API_TOKEN || "";
    if (!this.apiToken) {
      throw new Error("COMMONROOM_API_TOKEN environment variable is required");
    }
  }

  /**
   * Fetches a member by GitHub handle.
   * Uses the /members endpoint with github query parameter.
   *
   * @param githubHandle - GitHub username (without @)
   * @returns The matching member, or null if not found
   * @throws Error if API call fails
   */
  async getMemberByGitHubHandle(
    githubHandle: string,
  ): Promise<CommonRoomMember | null> {
    try {
      const url = `${this.baseUrl}/members?github=${encodeURIComponent(githubHandle)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        // No member found
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Common Room API error: ${response.status} ${response.statusText}. ${errorText}`,
        );
      }

      const data = (await response.json()) as
        | CommonRoomMember[]
        | CommonRoomAPIResponse;

      // Handle array response (deprecated endpoint returns array)
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return null;
        }
        // Filter to exact match on GitHub handle (case-insensitive)
        const exactMatch = data.find((member) => {
          const memberGithub = extractGitHubHandle(member.github);
          return memberGithub?.toLowerCase() === githubHandle.toLowerCase();
        });
        return exactMatch || data[0]; // Return exact match or first result
      }

      // Handle object response with data property
      if (data && typeof data === "object" && "data" in data) {
        const members = (data as CommonRoomAPIResponse).data;
        if (!members || members.length === 0) {
          return null;
        }
        const exactMatch = members.find((member) => {
          const memberGithub = extractGitHubHandle(member.github);
          return memberGithub?.toLowerCase() === githubHandle.toLowerCase();
        });
        return exactMatch || members[0];
      }

      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[CommonRoomAPI] Error fetching member for GitHub handle ${githubHandle}:`,
        errorMessage,
      );
      throw error;
    }
  }
}
