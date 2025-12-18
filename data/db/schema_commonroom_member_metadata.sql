-- Common Room Member Metadata Table
-- 
-- Stores metadata fetched from Common Room API.
-- Separate from github_users to allow multiple data sources.

CREATE TABLE IF NOT EXISTS commonroom_member_metadata (
    github_login TEXT PRIMARY KEY,
    company_name TEXT,
    company_domain TEXT,
    full_name TEXT,
    last_fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (github_login) REFERENCES github_users(login) ON DELETE CASCADE
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_commonroom_member_metadata_login ON commonroom_member_metadata(github_login);
