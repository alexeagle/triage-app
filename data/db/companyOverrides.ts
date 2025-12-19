/**
 * Company Overrides Database Operations
 *
 * Manages manual overrides for company attribution per GitHub user.
 */

import { query } from "./index";

export interface CompanyOverrideInput {
  github_user_id: number;
  override_company_name?: string | null;
  override_source?: "manual" | "github" | "commonroom" | null;
}

export interface CompanyOverrideRow {
  github_user_id: number;
  override_company_name: string | null;
  override_source: "manual" | "github" | "commonroom" | null;
  updated_at: string;
}

/**
 * Upserts a company override for a GitHub user.
 *
 * @param override - Company override data
 */
export async function upsertCompanyOverride(
  override: CompanyOverrideInput,
): Promise<void> {
  await query(
    `INSERT INTO company_overrides (
      github_user_id, override_company_name, override_source, updated_at
    ) VALUES ($1, $2, $3, NOW())
    ON CONFLICT (github_user_id)
    DO UPDATE SET
      override_company_name = EXCLUDED.override_company_name,
      override_source = EXCLUDED.override_source,
      updated_at = NOW()`,
    [
      override.github_user_id,
      override.override_company_name ?? null,
      override.override_source ?? null,
    ],
  );
}

/**
 * Gets the company override for a GitHub user.
 *
 * @param githubUserId - GitHub user ID
 * @returns Company override row if exists, null otherwise
 */
export async function getCompanyOverride(
  githubUserId: number,
): Promise<CompanyOverrideRow | null> {
  const result = await query<CompanyOverrideRow>(
    `SELECT github_user_id, override_company_name, override_source, updated_at
     FROM company_overrides
     WHERE github_user_id = $1`,
    [githubUserId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Deletes a company override for a GitHub user.
 *
 * @param githubUserId - GitHub user ID
 */
export async function deleteCompanyOverride(
  githubUserId: number,
): Promise<void> {
  await query(`DELETE FROM company_overrides WHERE github_user_id = $1`, [
    githubUserId,
  ]);
}
