-- Company Overrides Table
-- 
-- Allows manual override of company attribution per GitHub user.
-- Overrides take precedence over automatic attribution from GitHub profiles and Common Room.

CREATE TABLE IF NOT EXISTS company_overrides (
    github_user_id BIGINT PRIMARY KEY REFERENCES github_users(github_id) ON DELETE CASCADE,
    override_company_name TEXT,
    override_source TEXT CHECK (override_source IN ('manual', 'github', 'commonroom')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_company_overrides_github_user_id ON company_overrides(github_user_id);
