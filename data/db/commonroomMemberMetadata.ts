/**
 * Common Room Member Metadata Database Operations
 *
 * Stores metadata fetched from Common Room API.
 */

import { query } from "./index.js";

export interface CommonRoomMemberMetadataInput {
  github_login: string;
  company_name?: string | null;
  company_domain?: string | null;
  full_name?: string | null;
}

/**
 * Upserts Common Room member metadata into the commonroom_member_metadata table.
 *
 * @param metadata - Common Room member metadata
 */
export async function upsertCommonRoomMemberMetadata(
  metadata: CommonRoomMemberMetadataInput,
): Promise<void> {
  await query(
    `INSERT INTO commonroom_member_metadata (
      github_login, company_name, company_domain, full_name, last_fetched_at
    ) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (github_login)
    DO UPDATE SET
      company_name = EXCLUDED.company_name,
      company_domain = EXCLUDED.company_domain,
      full_name = EXCLUDED.full_name,
      last_fetched_at = NOW()`,
    [
      metadata.github_login,
      metadata.company_name ?? null,
      metadata.company_domain ?? null,
      metadata.full_name ?? null,
    ],
  );
}
