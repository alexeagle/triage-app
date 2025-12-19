/**
 * Incremental HubSpot Companies Sync
 *
 * Syncs company data from Common Room and GitHub profiles to HubSpot.
 * Only syncs companies that haven't been synced recently or don't exist yet.
 * Designed to be run periodically (e.g., via GitHub Actions).
 */

import { query } from "../db/index.js";
import { syncHubSpotCompany } from "../hubspot/syncCompany.js";
import { normalizeCompanyNameForMatching } from "../db/classifyCompany.js";

interface CompanyRow {
  company_name: string | null;
  company_domain: string | null;
  source: "commonroom" | "github";
}

interface HubSpotCompanyMatch {
  hubspot_company_id: number;
  name: string | null;
  last_synced_at: string;
}

export interface HubSpotSyncResult {
  companiesProcessed: number;
  companiesSynced: number;
  companiesSkipped: number;
  companiesUpdated: number;
  errors: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gets all existing HubSpot companies with normalized name mapping.
 *
 * @returns Map of normalized company names to HubSpot company data
 */
async function getExistingHubSpotCompaniesMap(): Promise<
  Map<string, HubSpotCompanyMatch>
> {
  const existingCompanies = await query<HubSpotCompanyMatch>(
    `SELECT hubspot_company_id, name, last_synced_at
     FROM hubspot_companies
     WHERE name IS NOT NULL`,
  );

  const existingMap = new Map<string, HubSpotCompanyMatch>();
  for (const company of existingCompanies.rows) {
    if (company.name) {
      const normalized = normalizeCompanyNameForMatching(company.name);
      if (normalized) {
        existingMap.set(normalized, company);
      }
    }
  }

  return existingMap;
}

/**
 * Finds companies that need syncing:
 * - Companies that don't exist in hubspot_companies yet
 * - Companies that exist but haven't been synced in the last syncInterval days
 *
 * @param syncIntervalDays - Number of days since last sync to consider stale (default: 7)
 * @returns Array of companies that need syncing
 */
async function findCompaniesToSync(
  syncIntervalDays: number = 7,
): Promise<CompanyRow[]> {
  // Get all unique companies from CommonRoom and GitHub
  const allCompanies = await query<CompanyRow>(
    `WITH all_companies AS (
       -- Common Room companies (preferred source)
       SELECT 
         company_domain,
         company_name,
         'commonroom' as source
       FROM commonroom_member_metadata
       WHERE (company_domain IS NOT NULL AND TRIM(company_domain) != '')
          OR (company_name IS NOT NULL AND TRIM(company_name) != '')
       
       UNION
       
       -- GitHub profile companies
       SELECT 
         NULL as company_domain,
         company as company_name,
         'github' as source
       FROM github_profiles
       WHERE company IS NOT NULL AND TRIM(company) != ''
     )
     SELECT DISTINCT ON (
       COALESCE(company_domain, LOWER(TRIM(company_name)))
     )
       company_domain,
       company_name,
       source
     FROM all_companies
     WHERE company_domain IS NOT NULL OR company_name IS NOT NULL
     ORDER BY COALESCE(company_domain, LOWER(TRIM(company_name))), 
              CASE WHEN source = 'commonroom' THEN 1 ELSE 2 END`,
  );

  // Get existing HubSpot companies map
  const existingMap = await getExistingHubSpotCompaniesMap();

  // Filter companies that need syncing
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - syncIntervalDays);

  const companiesToSync: CompanyRow[] = [];

  for (const company of allCompanies.rows) {
    const companyName = company.company_name;
    if (!companyName) continue;

    const normalized = normalizeCompanyNameForMatching(companyName);
    if (!normalized) continue;

    const existing = existingMap.get(normalized);
    if (!existing) {
      // Company doesn't exist in HubSpot yet - needs syncing
      companiesToSync.push(company);
    } else {
      // Company exists - check if it needs updating
      const lastSynced = new Date(existing.last_synced_at);
      if (lastSynced < cutoffDate) {
        companiesToSync.push(company);
      }
    }
  }

  return companiesToSync;
}

/**
 * Incrementally syncs HubSpot companies.
 * Only syncs companies that haven't been synced recently or don't exist yet.
 *
 * @param syncIntervalDays - Number of days since last sync to consider stale (default: 7)
 * @param apiToken - Optional HubSpot API token (uses env var if not provided)
 * @returns Sync result statistics
 */
export async function syncHubSpotCompaniesIncremental(
  syncIntervalDays: number = 7,
  apiToken?: string,
): Promise<HubSpotSyncResult> {
  const result: HubSpotSyncResult = {
    companiesProcessed: 0,
    companiesSynced: 0,
    companiesSkipped: 0,
    companiesUpdated: 0,
    errors: 0,
  };

  console.log(
    `🚀 Starting incremental HubSpot companies sync (stale threshold: ${syncIntervalDays} days)\n`,
  );

  try {
    // Find companies that need syncing
    const companiesToSync = await findCompaniesToSync(syncIntervalDays);
    result.companiesProcessed = companiesToSync.length;

    console.log(`📋 Found ${companiesToSync.length} companies to sync\n`);

    if (companiesToSync.length === 0) {
      console.log("✨ No companies need syncing at this time.\n");
      return result;
    }

    // Pre-load all existing HubSpot companies once for efficiency
    const existingMap = await getExistingHubSpotCompaniesMap();

    // Sync each company
    for (let i = 0; i < companiesToSync.length; i++) {
      const company = companiesToSync[i];
      const progress = `[${i + 1}/${companiesToSync.length}]`;
      const displayName =
        company.company_domain || company.company_name || "unknown";

      try {
        // Check if this company already exists in hubspot_companies
        const normalized = normalizeCompanyNameForMatching(
          company.company_name,
        );
        const existingMatch = normalized
          ? existingMap.get(normalized)
          : undefined;

        const isUpdate = existingMatch !== undefined;

        const success = await syncHubSpotCompany(
          company.company_domain ?? null,
          company.company_name ?? null,
          apiToken,
        );

        if (success) {
          if (isUpdate) {
            console.log(
              `${progress} ✅ Updated ${displayName} (from ${company.source})`,
            );
            result.companiesUpdated++;
          } else {
            console.log(
              `${progress} ✅ Synced ${displayName} (from ${company.source})`,
            );
            result.companiesSynced++;
          }
        } else {
          console.log(
            `${progress} ⏭️  Skipped ${displayName} (from ${company.source}) - not found in HubSpot or multiple matches`,
          );
          result.companiesSkipped++;
        }

        // Small delay to avoid hitting rate limits
        // HubSpot API rate limits are typically 100 requests per 10 seconds
        await sleep(150);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Check for rate limiting (429)
        if (
          errorMessage.includes("429") ||
          errorMessage.includes("Rate") ||
          errorMessage.includes("rate limit")
        ) {
          console.warn(
            `${progress} ⚠️  Rate limited for ${displayName}, waiting 10 seconds...`,
          );
          await sleep(10000);
          // Retry this company
          i--;
          continue;
        }

        console.error(
          `${progress} ❌ Error syncing ${displayName} (from ${company.source}): ${errorMessage}`,
        );
        result.errors++;

        // On API errors, wait a bit longer before continuing
        await sleep(1000);
      }
    }

    console.log(`\n✨ Incremental sync completed!`);
    console.log(`   📋 Processed: ${result.companiesProcessed}`);
    console.log(`   ✅ Synced (new): ${result.companiesSynced}`);
    console.log(`   🔄 Updated (existing): ${result.companiesUpdated}`);
    console.log(`   ⏭️  Skipped: ${result.companiesSkipped}`);
    console.log(`   ❌ Errors: ${result.errors}`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    throw error;
  }

  return result;
}

/**
 * Main entry point for running the incremental sync.
 * Can be called directly or from a script.
 */
async function main() {
  const syncIntervalDays = parseInt(
    process.env.HUBSPOT_SYNC_INTERVAL_DAYS || "7",
    10,
  );

  try {
    await syncHubSpotCompaniesIncremental(syncIntervalDays);
    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error in main:", error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1]?.includes("syncHubSpotCompanies")) {
  main();
}
