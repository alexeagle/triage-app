-- Repo Stars Schema Extension
-- 
-- This schema extends the existing GitHub sync schema to support repository stars.
-- Models personal interest/starring as a many-to-many relationship between GitHub users and repositories.
-- This represents personal user preferences, not ownership or maintainership.

-- Repo Stars table
-- Stores which repositories a GitHub user has starred
CREATE TABLE repo_stars (
    id SERIAL PRIMARY KEY,
    user_github_id BIGINT NOT NULL REFERENCES github_users(github_id) ON DELETE CASCADE,
    repo_github_id BIGINT NOT NULL REFERENCES repos(github_id) ON DELETE CASCADE,
    starred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unique constraint to ensure one star record per user/repo combination
-- This prevents duplicates - each user can only star a repository once
CREATE UNIQUE INDEX idx_repo_stars_unique ON repo_stars(user_github_id, repo_github_id);

-- Indexes for common query patterns
-- Efficiently query "which repos has this user starred?"
CREATE INDEX idx_repo_stars_user_github_id ON repo_stars(user_github_id);

-- Efficiently query "which users have starred this repo?"
CREATE INDEX idx_repo_stars_repo_github_id ON repo_stars(repo_github_id);

-- Index on starred_at for chronological queries and sorting
CREATE INDEX idx_repo_stars_starred_at ON repo_stars(starred_at);

-- Reversible migration: To drop this schema, run:
-- DROP INDEX IF EXISTS idx_repo_stars_starred_at;
-- DROP INDEX IF EXISTS idx_repo_stars_repo_github_id;
-- DROP INDEX IF EXISTS idx_repo_stars_user_github_id;
-- DROP INDEX IF EXISTS idx_repo_stars_unique;
-- DROP TABLE IF EXISTS repo_stars;
