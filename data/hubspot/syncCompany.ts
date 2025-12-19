/**
 * HubSpot Company Sync
 *
 * Syncs minimal company data from HubSpot API to Postgres.
 */

import { HubSpotAPI } from "./client.js";
import { upsertHubSpotCompany } from "../db/hubspotCompanies.js";

/**
 * Syncs a company from HubSpot to the database.
 * Searches by domain (preferred) or falls back to name search.
 * Only syncs if exactly one match is found.
 *
 * @param companyDomain - Company domain (e.g., "example.com")
 * @param companyName - Company name (fallback if domain is missing)
 * @param apiToken - Optional HubSpot API token (uses env var if not provided)
 * @returns True if company was synced, false otherwise
 */
export async function syncHubSpotCompany(
  companyDomain?: string | null,
  companyName?: string | null,
  apiToken?: string,
): Promise<boolean> {
  if (!companyDomain && !companyName) {
    console.log("[HubSpot] No domain or name provided, skipping company sync");
    return false;
  }

  try {
    const api = new HubSpotAPI(apiToken);
    let companies: Awaited<ReturnType<HubSpotAPI["searchCompaniesByDomain"]>>;

    // Prefer domain search, fall back to name search
    if (companyDomain) {
      companies = await api.searchCompaniesByDomain(companyDomain);
    } else if (companyName) {
      companies = await api.searchCompaniesByName(companyName);
    } else {
      return false;
    }

    // Only sync if exactly one match
    if (companies.length === 0) {
      console.log(
        `[HubSpot] No company found for domain=${companyDomain ?? "null"}, name=${companyName ?? "null"}`,
      );
      return false;
    }

    if (companies.length > 1) {
      console.log(
        `[HubSpot] Multiple companies found (${companies.length}) for domain=${companyDomain ?? "null"}, name=${companyName ?? "null"}. Skipping to avoid guessing.`,
      );
      return false;
    }

    // Exactly one match - sync it
    const company = companies[0];
    const properties = company.properties;

    await upsertHubSpotCompany({
      hubspot_company_id: parseInt(company.id, 10),
      name: properties.name ?? null,
      domain: properties.domain ?? null,
      lifecyclestage: properties.lifecyclestage ?? null,
      type: properties.type ?? null,
    });

    console.log(
      `[HubSpot] Synced company: ${properties.name ?? company.id} (domain: ${properties.domain ?? "none"})`,
    );

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[HubSpot] Error syncing company (domain=${companyDomain ?? "null"}, name=${companyName ?? "null"}):`,
      errorMessage,
    );
    // Re-throw to allow caller to handle
    throw error;
  }
}
