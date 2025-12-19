/**
 * Backfill HubSpot Companies
 *
 * Syncs company data from Common Room and GitHub profiles to HubSpot.
 * For each unique company found, attempts to find and sync it in HubSpot.
 * Handles rate limiting and is safe to re-run (idempotent).
 */

import { Pool } from "pg";
import { syncHubSpotCompany } from "../hubspot/syncCompany.js";

interface CompanyRow {
  company_name: string | null;
  company_domain: string | null;
  source: "commonroom" | "github";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const hubspotToken = process.env.HUBSPOT_API_TOKEN;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  if (!hubspotToken) {
    console.error("❌ HUBSPOT_API_TOKEN environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Query unique companies from both Common Room and GitHub profiles
    // Prefer Common Room over GitHub for the same company name
    const companiesResult = await pool.query<CompanyRow>(
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

    const companies = companiesResult.rows;
    console.log(`📋 Found ${companies.length} unique companies to sync\n`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      const progress = `[${i + 1}/${companies.length}]`;
      const displayName =
        company.company_domain || company.company_name || "unknown";

      try {
        const success = await syncHubSpotCompany(
          company.company_domain ?? null,
          company.company_name ?? null,
          hubspotToken,
        );

        if (success) {
          console.log(
            `${progress} ✅ Synced ${displayName} (from ${company.source})`,
          );
          synced++;
        } else {
          console.log(
            `${progress} ⏭️  Skipped ${displayName} (from ${company.source}) - not found in HubSpot or multiple matches`,
          );
          skipped++;
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
        errors++;

        // On API errors, wait a bit longer before continuing
        await sleep(1000);
      }
    }

    console.log(`\n✨ Backfill completed!`);
    console.log(`   ✅ Synced: ${synced}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
