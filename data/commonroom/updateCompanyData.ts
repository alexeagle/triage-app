/**
 * Common Room Company Data Update
 *
 * Updates commonroom_member_metadata table with company information from Common Room.
 */

import { CommonRoomAPI } from "./client.js";
import { extractCompanyData, CompanyData } from "./companyData.js";
import { upsertCommonRoomMemberMetadata } from "../db/commonroomMemberMetadata.js";

/**
 * Updates Common Room member metadata for a GitHub user.
 *
 * @param githubLogin - GitHub username (login)
 * @param member - Common Room member object
 */
export async function updateCommonRoomMemberMetadata(
  githubLogin: string,
  member: Awaited<ReturnType<CommonRoomAPI["getMemberByGitHubHandle"]>>,
): Promise<void> {
  if (!member) {
    return;
  }

  const companyData = extractCompanyData(member);
  await upsertCommonRoomMemberMetadata({
    github_login: githubLogin,
    company_name: companyData.companyName,
    company_domain: companyData.companyDomain,
    full_name: member.fullName ?? null,
  });
}

/**
 * Fetches company data from Common Room and updates the commonroom_member_metadata table.
 * Handles all edge cases:
 * - No Common Room match → returns null (no update)
 * - Multiple matches → picks exact GitHub handle match
 * - API errors → logs and throws
 *
 * @param githubLogin - GitHub username (login)
 * @param apiToken - Optional Common Room API token (uses env var if not provided)
 * @returns Company data if found and updated, null otherwise
 */
export async function fetchAndUpdateCommonRoomMetadata(
  githubLogin: string,
  apiToken?: string,
): Promise<CompanyData | null> {
  try {
    const api = new CommonRoomAPI(apiToken);
    const member = await api.getMemberByGitHubHandle(githubLogin);

    if (!member) {
      // No match found in Common Room
      return null;
    }

    const companyData = extractCompanyData(member);

    // Update metadata table regardless of whether company_name exists
    // This allows us to track that we checked Common Room
    await updateCommonRoomMemberMetadata(githubLogin, member);

    return companyData;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[CommonRoom] Error fetching/updating metadata for ${githubLogin}:`,
      errorMessage,
    );
    // Re-throw to allow caller to handle
    throw error;
  }
}
