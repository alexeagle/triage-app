/**
 * Company Classification
 *
 * Classifies companies using HubSpot data based on company names.
 * Uses exact matching with normalized names to avoid ambiguous matches.
 */

import { query } from "./index";
import { CompanyClassification } from "../../lib/companyClassificationTypes";
import {
  normalizeCompanyNameForMatching,
  normalizeCompanyNamesForMatching,
} from "./normalizeCompanyName";

export interface HubSpotCompanyRow {
  hubspot_company_id: number;
  name: string | null;
  domain: string | null;
  lifecyclestage: string | null;
  type: string | null;
}

// Re-export for backwards compatibility
export {
  normalizeCompanyNameForMatching,
  normalizeCompanyNamesForMatching,
} from "./normalizeCompanyName";

/**
 * Looks up a company in HubSpot by normalized name.
 * Returns the company if exactly one match is found, null otherwise.
 *
 * @param companyName - Company name to look up
 * @returns HubSpot company row if exactly one match, null otherwise
 */
export async function lookupHubSpotCompany(
  companyName: string | null | undefined,
): Promise<HubSpotCompanyRow | null> {
  const normalized = await normalizeCompanyNameForMatching(companyName);
  if (!normalized) {
    return null;
  }

  // Use SQL normalization function for exact matching
  // This ensures consistency with the database view
  const result = await query<HubSpotCompanyRow>(
    `SELECT hubspot_company_id, name, domain, lifecyclestage, type
     FROM hubspot_companies
     WHERE normalize_company_name(name) = $1`,
    [normalized],
  );

  // Only return if exactly one match
  if (result.rows.length === 1) {
    return result.rows[0];
  }

  return null;
}

/**
 * Internal company names to classify as INTERNAL.
 * Add your company name(s) here.
 */
const INTERNAL_COMPANY_NAMES: string[] = [
  // Add your company name(s) here, e.g.:
  // "your company name",
  // "your company inc",
];

/**
 * Classifies a company based on its name and HubSpot data.
 *
 * Rules (in order):
 * 1. INTERNAL: company_name matches our own company name(s)
 * 2. COMPETITOR: hubspot_company.type == "Competitor"
 * 3. CUSTOMER: hubspot_company.lifecyclestage == "customer"
 * 4. PROSPECT: hubspot_company.lifecyclestage IN (
 *     "lead", "marketingqualifiedlead", "salesqualifiedlead", "opportunity"
 *   )
 * 5. OTHER: default or no HubSpot match
 *
 * @param companyName - Company name to classify
 * @param hubspotCompany - Matched HubSpot company (from lookupHubSpotCompany)
 * @returns Company classification
 */
export async function classifyCompany(
  companyName: string | null | undefined,
  hubspotCompany: HubSpotCompanyRow | null = null,
): Promise<CompanyClassification> {
  // Rule 1: INTERNAL
  if (companyName) {
    const normalized = await normalizeCompanyNameForMatching(companyName);
    if (normalized) {
      const internalNormalized = await normalizeCompanyNamesForMatching(
        INTERNAL_COMPANY_NAMES,
      );
      for (const internalName of INTERNAL_COMPANY_NAMES) {
        const normalizedInternal = internalNormalized.get(internalName);
        if (normalizedInternal && normalized === normalizedInternal) {
          return CompanyClassification.INTERNAL;
        }
      }
    }
  }

  // If no HubSpot match, return OTHER
  if (!hubspotCompany) {
    return CompanyClassification.OTHER;
  }

  // Rule 2: COMPETITOR
  if (hubspotCompany.type?.toLowerCase() === "competitor") {
    return CompanyClassification.COMPETITOR;
  }

  // Rule 3: CUSTOMER
  if (hubspotCompany.lifecyclestage?.toLowerCase() === "customer") {
    return CompanyClassification.CUSTOMER;
  }

  // Rule 4: PROSPECT
  const prospectStages = [
    "lead",
    "marketingqualifiedlead",
    "salesqualifiedlead",
    "opportunity",
  ];
  if (
    hubspotCompany.lifecyclestage &&
    prospectStages.includes(hubspotCompany.lifecyclestage.toLowerCase())
  ) {
    return CompanyClassification.PROSPECT;
  }

  // Rule 5: OTHER (default)
  return CompanyClassification.OTHER;
}

/**
 * Convenience function that looks up and classifies a company in one call.
 *
 * @param companyName - Company name to classify
 * @returns Company classification
 */
export async function classifyCompanyByName(
  companyName: string | null | undefined,
): Promise<CompanyClassification> {
  const hubspotCompany = await lookupHubSpotCompany(companyName);
  return classifyCompany(companyName, hubspotCompany);
}
