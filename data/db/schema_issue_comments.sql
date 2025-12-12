-- Issue Comments Schema Extension
-- 
-- This schema extends the existing GitHub sync schema to support issue comments.
-- Stores comments on issues (and PRs via the issues endpoint).

-- Issue Comments table
-- Stores all comments on issues from all repositories
CREATE TABLE issue_comments (
    id SERIAL PRIMARY KEY,
    issue_github_id BIGINT NOT NULL REFERENCES issues(github_id) ON DELETE CASCADE,
    comment_github_id BIGINT NOT NULL UNIQUE,
    author_login TEXT NOT NULL,
    body TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_issue_comments_issue_github_id ON issue_comments(issue_github_id);
CREATE INDEX idx_issue_comments_author_login ON issue_comments(author_login);
CREATE INDEX idx_issue_comments_created_at ON issue_comments(created_at);
