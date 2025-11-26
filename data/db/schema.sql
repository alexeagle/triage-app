-- GitHub Org → Neon Postgres Sync Schema
-- 
-- This schema stores repositories and issues synced from GitHub.
-- Designed for Neon Postgres with standard PostgreSQL features.

-- Repositories table
-- Stores metadata for all repositories in the organization
CREATE TABLE repos (
    id SERIAL PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    full_name VARCHAR(512) NOT NULL,
    private BOOLEAN NOT NULL DEFAULT false,
    archived BOOLEAN NOT NULL DEFAULT false,
    pushed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    
    -- TODO: Add fields for AI processing:
    -- - embedding vector for semantic search
    -- - summary text
    -- - categorization metadata
    -- - triage status
    -- - priority score
);

-- Issues table
-- Stores all issues from all repositories
CREATE TABLE issues (
    id SERIAL PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    repo_github_id BIGINT NOT NULL REFERENCES repos(github_id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
    author_login VARCHAR(255) NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    
    -- TODO: Add fields for AI processing:
    -- - embedding vector for semantic search
    -- - summary text
    -- - categorization (bug, feature, question, etc.)
    -- - priority score
    -- - triage status
    -- - suggested assignee
    -- - related issues
    -- - sentiment analysis
);

-- Compound unique index to ensure one issue per repo/number combination
-- This prevents duplicates when syncing the same issue multiple times
CREATE UNIQUE INDEX idx_issues_repo_number ON issues(repo_github_id, number);

-- Indexes for common query patterns
CREATE INDEX idx_repos_github_id ON repos(github_id);
CREATE INDEX idx_repos_updated_at ON repos(updated_at);
CREATE INDEX idx_issues_github_id ON issues(github_id);
CREATE INDEX idx_issues_repo_github_id ON issues(repo_github_id);
CREATE INDEX idx_issues_state ON issues(state);
CREATE INDEX idx_issues_created_at ON issues(created_at);
CREATE INDEX idx_issues_updated_at ON issues(updated_at);
CREATE INDEX idx_issues_author_login ON issues(author_login);
CREATE INDEX idx_issues_synced_at ON issues(synced_at);

-- GIN indexes for JSONB fields to enable efficient querying
CREATE INDEX idx_issues_labels ON issues USING GIN(labels);
CREATE INDEX idx_issues_assignees ON issues USING GIN(assignees);

