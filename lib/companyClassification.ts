/**
 * Company Classification Helpers
 *
 * Server-side helpers for classifying companies in queries and components.
 */

import { classifyCompanyByName } from "../data/db/classifyCompany";
import { CompanyClassification } from "./companyClassificationTypes";

/**
 * Classifies a company name and returns the classification.
 * This is a server-side function that performs database lookups.
 *
 * @param companyName - Company name to classify
 * @returns Company classification
 */
export async function getCompanyClassification(
  companyName: string | null | undefined,
): Promise<CompanyClassification> {
  if (!companyName) {
    return CompanyClassification.OTHER;
  }
  return classifyCompanyByName(companyName);
}

/**
 * Classifies multiple company names in batch.
 * More efficient than calling getCompanyClassification multiple times.
 *
 * @param companyNames - Array of company names to classify
 * @returns Map of company name to classification
 */
export async function getCompanyClassifications(
  companyNames: (string | null | undefined)[],
): Promise<Map<string | null, CompanyClassification>> {
  const classifications = new Map<string | null, CompanyClassification>();
  const uniqueNames = Array.from(
    new Set(companyNames.filter((n) => n != null)),
  ) as string[];

  // Classify each unique company name
  const promises = uniqueNames.map(async (name) => {
    const classification = await classifyCompanyByName(name);
    classifications.set(name, classification);
  });

  await Promise.all(promises);

  // Set OTHER for null/undefined names
  classifications.set(null, CompanyClassification.OTHER);

  return classifications;
}
