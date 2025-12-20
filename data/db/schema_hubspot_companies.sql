-- HubSpot Companies Table
-- 
-- Stores minimal company data synced from HubSpot.
-- Used for company classification (lifecyclestage, type).
--
-- Note on lifecyclestage:
-- - Values are internal names/IDs (not display labels)
-- - Default stages: text values (e.g., "subscriber", "marketingqualifiedlead")
-- - Custom stages: numeric values (e.g., "12345")
-- - Internal IDs can be found in HubSpot lifecycle stage settings or via API

CREATE TABLE IF NOT EXISTS hubspot_companies (
    hubspot_company_id BIGINT PRIMARY KEY,
    name TEXT,
    domain TEXT,
    lifecyclestage TEXT, -- Internal name/ID (text for default, numeric for custom)
    type TEXT,
    last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on domain for lookups
CREATE INDEX IF NOT EXISTS idx_hubspot_companies_domain ON hubspot_companies(domain);

-- Index on name for lookups
CREATE INDEX IF NOT EXISTS idx_hubspot_companies_name ON hubspot_companies(name);

