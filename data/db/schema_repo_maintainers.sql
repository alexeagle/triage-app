-- Repo Maintainers Schema Extension
-- 
-- This schema extends the existing GitHub sync schema to support maintainership tracking.
-- Models maintainership as a many-to-many relationship between repositories and GitHub users.
-- Supports multiple sources of maintainership data (GitHub permissions, BCR metadata, CODEOWNERS, manual entry)
-- with confidence scoring to track the reliability of each assertion.

-- Repo Maintainers table
-- Stores maintainership relationships between repositories and GitHub users
CREATE TABLE repo_maintainers (
    id SERIAL PRIMARY KEY,
    repo_github_id BIGINT NOT NULL REFERENCES repos(github_id) ON DELETE CASCADE,
    github_user_id BIGINT NOT NULL REFERENCES github_users(github_id) ON DELETE CASCADE,
    source TEXT NOT NULL,  -- Source of the maintainership assertion: "github-permissions", "bcr-metadata", "codeowners", "manual"
    confidence INTEGER NOT NULL DEFAULT 100,  -- Confidence level (0-100) in this maintainership assertion
    first_detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),  -- When this maintainership was first detected
    last_confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()  -- When this maintainership was last confirmed/updated
);

-- Unique constraint to ensure one maintainership record per repo/user/source combination
-- This prevents duplicates when syncing the same maintainership from multiple sources
CREATE UNIQUE INDEX idx_repo_maintainers_unique ON repo_maintainers(repo_github_id, github_user_id, source);

-- Indexes for common query patterns
-- Efficiently query "which repos does this user maintain?"
CREATE INDEX idx_repo_maintainers_github_user_id ON repo_maintainers(github_user_id);

-- Efficiently query "who maintains this repo?"
CREATE INDEX idx_repo_maintainers_repo_github_id ON repo_maintainers(repo_github_id);

-- Index on source for filtering by data source
CREATE INDEX idx_repo_maintainers_source ON repo_maintainers(source);

-- Index on confidence for filtering by confidence level
CREATE INDEX idx_repo_maintainers_confidence ON repo_maintainers(confidence);
