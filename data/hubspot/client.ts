/**
 * HubSpot API Client
 *
 * Provides a wrapper around the HubSpot CRM API for searching companies.
 */

interface HubSpotCompany {
  id: string;
  properties: {
    name?: string;
    domain?: string;
    /**
     * Lifecycle stage internal name/ID.
     * - Default stages: text values (e.g., "subscriber", "marketingqualifiedlead")
     * - Custom stages: numeric values (e.g., "12345")
     * Values are internal IDs, not display labels.
     */
    lifecyclestage?: string;
    type?: string;
  };
}

interface HubSpotSearchResponse {
  results: HubSpotCompany[];
  total?: number;
}

export class HubSpotAPI {
  private baseUrl = "https://api.hubapi.com";
  private apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.HUBSPOT_API_TOKEN || "";
    if (!this.apiToken) {
      throw new Error("HUBSPOT_API_TOKEN environment variable is required");
    }
  }

  /**
   * Searches for companies by domain.
   *
   * @param domain - Company domain (e.g., "example.com")
   * @returns Array of matching companies
   * @throws Error if API call fails
   */
  async searchCompaniesByDomain(domain: string): Promise<HubSpotCompany[]> {
    const url = `${this.baseUrl}/crm/v3/objects/companies/search`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "domain",
                operator: "EQ",
                value: domain,
              },
            ],
          },
        ],
        properties: ["name", "domain", "lifecyclestage", "type"],
        limit: 10, // Limit to single page
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HubSpot API error: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as HubSpotSearchResponse;
    return data.results || [];
  }

  /**
   * Searches for companies by name.
   *
   * @param name - Company name
   * @returns Array of matching companies
   * @throws Error if API call fails
   */
  async searchCompaniesByName(name: string): Promise<HubSpotCompany[]> {
    const url = `${this.baseUrl}/crm/v3/objects/companies/search`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "name",
                operator: "EQ",
                value: name,
              },
            ],
          },
        ],
        properties: ["name", "domain", "lifecyclestage", "type"],
        limit: 10, // Limit to single page
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HubSpot API error: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as HubSpotSearchResponse;
    return data.results || [];
  }
}

