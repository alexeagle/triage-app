-- Issue Reactions Schema Extension
-- 
-- This schema extends the existing GitHub sync schema to support issue reactions.
-- Stores reactions (e.g., +1, heart, hooray, eyes) that users have added to issues.

-- Issue Reactions table
-- Stores all reactions on issues from all repositories
CREATE TABLE issue_reactions (
    id SERIAL PRIMARY KEY,
    issue_github_id BIGINT NOT NULL REFERENCES issues(github_id) ON DELETE CASCADE,
    user_github_id BIGINT NOT NULL,
    content TEXT NOT NULL,  -- e.g. "+1", "heart", "hooray", "eyes"
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint to ensure one reaction per user/content combination per issue
-- This prevents duplicates when syncing the same reaction multiple times
CREATE UNIQUE INDEX idx_issue_reactions_unique ON issue_reactions(issue_github_id, user_github_id, content);

-- Indexes for common query patterns
CREATE INDEX idx_issue_reactions_issue_github_id ON issue_reactions(issue_github_id);
CREATE INDEX idx_issue_reactions_content ON issue_reactions(content);
CREATE INDEX idx_issue_reactions_user_github_id ON issue_reactions(user_github_id);
CREATE INDEX idx_issue_reactions_synced_at ON issue_reactions(synced_at);
