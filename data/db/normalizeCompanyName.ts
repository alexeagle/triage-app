/**
 * Company Name Normalization
 *
 * Wrapper around PostgreSQL normalize_company_name function.
 * This ensures we have a single source of truth for normalization logic.
 */

import { query } from "./index";

/**
 * Normalizes a company name using the PostgreSQL function.
 * This ensures consistency with database views and queries.
 *
 * @param companyName - Raw company name to normalize
 * @returns Normalized company name, or null if empty/invalid
 */
export async function normalizeCompanyNameForMatching(
  companyName: string | null | undefined,
): Promise<string | null> {
  if (!companyName) {
    return null;
  }

  const result = await query<{ normalized: string | null }>(
    `SELECT normalize_company_name($1) as normalized`,
    [companyName],
  );

  return result.rows[0]?.normalized ?? null;
}

/**
 * Normalizes multiple company names in batch.
 * More efficient than calling normalizeCompanyNameForMatching multiple times.
 *
 * @param companyNames - Array of company names to normalize
 * @returns Map of original name to normalized name
 */
export async function normalizeCompanyNamesForMatching(
  companyNames: (string | null | undefined)[],
): Promise<Map<string | null, string | null>> {
  const result = new Map<string | null, string | null>();

  // Filter out null/undefined and get unique names
  const uniqueNames = Array.from(
    new Set(companyNames.filter((n) => n != null)),
  ) as string[];

  if (uniqueNames.length === 0) {
    result.set(null, null);
    return result;
  }

  // Normalize all at once using unnest
  const normalized = await query<{
    original: string;
    normalized: string | null;
  }>(
    `SELECT 
      name as original,
      normalize_company_name(name) as normalized
     FROM unnest($1::text[]) as name`,
    [uniqueNames],
  );

  for (const row of normalized.rows) {
    result.set(row.original, row.normalized);
  }

  // Set null for null inputs
  result.set(null, null);

  return result;
}
