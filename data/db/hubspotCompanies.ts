/**
 * HubSpot Companies Database Operations
 *
 * Stores minimal company data synced from HubSpot.
 */

import { query } from "./index.js";

export interface HubSpotCompanyInput {
  hubspot_company_id: number;
  name?: string | null;
  domain?: string | null;
  lifecyclestage?: string | null;
  type?: string | null;
}

/**
 * Upserts HubSpot company data into the hubspot_companies table.
 *
 * @param company - HubSpot company data
 */
export async function upsertHubSpotCompany(
  company: HubSpotCompanyInput,
): Promise<void> {
  await query(
    `INSERT INTO hubspot_companies (
      hubspot_company_id, name, domain, lifecyclestage, type, last_synced_at
    ) VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (hubspot_company_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      domain = EXCLUDED.domain,
      lifecyclestage = EXCLUDED.lifecyclestage,
      type = EXCLUDED.type,
      last_synced_at = NOW()`,
    [
      company.hubspot_company_id,
      company.name ?? null,
      company.domain ?? null,
      company.lifecyclestage ?? null,
      company.type ?? null,
    ],
  );
}
