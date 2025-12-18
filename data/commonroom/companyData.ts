/**
 * Common Room Company Data Extraction
 *
 * Extracts company information from Common Room member data.
 */

import { CommonRoomAPI } from "./client.js";

export interface CompanyData {
  companyName: string | null;
  companyDomain: string | null;
}

/**
 * Extracts company information from a Common Room member.
 * Maps Common Room fields to our company data structure.
 *
 * @param member - Common Room member object
 * @returns Company data (name and domain)
 */
export function extractCompanyData(
  member: Awaited<ReturnType<CommonRoomAPI["getMemberByGitHubHandle"]>>,
): CompanyData {
  if (!member) {
    return {
      companyName: null,
      companyDomain: null,
    };
  }

  // Common Room API returns 'organization' field for company name
  // We don't have companyDomain in the basic member response, so it will be null
  return {
    companyName: member.organization || null,
    companyDomain: null, // Not available in the /members endpoint response
  };
}
