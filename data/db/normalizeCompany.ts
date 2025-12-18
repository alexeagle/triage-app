/**
 * Company Name Normalization
 *
 * Normalizes company names from various sources (GitHub, Common Room, etc.)
 * to ensure consistent storage and display.
 */

/**
 * Normalizes a company name by:
 * - Trimming whitespace
 * - Removing leading @ symbols (common in GitHub profiles)
 * - Removing empty strings
 *
 * Note: Preserves original casing to match the data source exactly.
 * Case-insensitive comparisons should be done in queries using LOWER().
 *
 * @param company - Raw company name
 * @returns Normalized company name (preserving original case), or null if empty/invalid
 */
export function normalizeCompanyName(
  company: string | null | undefined,
): string | null {
  if (!company) {
    return null;
  }

  // Trim whitespace
  let normalized = company.trim();

  // Remove leading @ symbol (common in GitHub profiles)
  if (normalized.startsWith("@")) {
    normalized = normalized.substring(1).trim();
  }

  // Return null if empty after normalization
  if (normalized.length === 0) {
    return null;
  }

  // Preserve original casing - don't convert to lowercase
  return normalized;
}
