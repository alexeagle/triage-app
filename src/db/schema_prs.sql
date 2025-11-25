-- Pull Request Schema Extension
-- 
-- This schema extends the existing GitHub sync schema to support pull requests.
-- Does not modify existing issues or repos tables.

-- Pull Requests table
-- Stores metadata for all pull requests from all repositories
CREATE TABLE pull_requests (
    id SERIAL PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    repo_github_id BIGINT NOT NULL REFERENCES repos(github_id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state VARCHAR(20) NOT NULL CHECK (state IN ('open', 'closed')),
    draft BOOLEAN NOT NULL DEFAULT false,
    author_login VARCHAR(255) NOT NULL,
    assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    additions INTEGER,
    deletions INTEGER,
    changed_files INTEGER,
    merged BOOLEAN NOT NULL DEFAULT false,
    merged_at TIMESTAMP WITH TIME ZONE,
    merge_commit_sha VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    
    -- TODO: Add fields for future expansion:
    -- - base_ref (target branch)
    -- - head_ref (source branch)
    -- - base_sha (commit SHA of base branch)
    -- - head_sha (commit SHA of head branch)
    -- - requested_reviewers JSONB (users/teams requested for review)
    -- - requested_teams JSONB
    -- - milestone JSONB
    -- - mergeable BOOLEAN (whether PR can be merged)
    -- - mergeable_state TEXT (clean, dirty, unstable, etc.)
    -- - rebaseable BOOLEAN
    -- - review_comment_count INTEGER
    -- - comments_count INTEGER
    -- - commits_count INTEGER
    -- - review_decision TEXT (approved, changes_requested, review_required)
    -- - auto_merge_enabled BOOLEAN
    -- - auto_merge_at TIMESTAMP WITH TIME ZONE
);

-- Compound unique index to ensure one PR per repo/number combination
-- This prevents duplicates when syncing the same PR multiple times
CREATE UNIQUE INDEX idx_pull_requests_repo_number ON pull_requests(repo_github_id, number);

-- Indexes for common query patterns
CREATE INDEX idx_pull_requests_github_id ON pull_requests(github_id);
CREATE INDEX idx_pull_requests_repo_github_id ON pull_requests(repo_github_id);
CREATE INDEX idx_pull_requests_state ON pull_requests(state);
CREATE INDEX idx_pull_requests_merged ON pull_requests(merged);
CREATE INDEX idx_pull_requests_draft ON pull_requests(draft);
CREATE INDEX idx_pull_requests_author_login ON pull_requests(author_login);
CREATE INDEX idx_pull_requests_created_at ON pull_requests(created_at);
CREATE INDEX idx_pull_requests_updated_at ON pull_requests(updated_at);
CREATE INDEX idx_pull_requests_merged_at ON pull_requests(merged_at);
CREATE INDEX idx_pull_requests_synced_at ON pull_requests(synced_at);

-- GIN indexes for JSONB fields to enable efficient querying
CREATE INDEX idx_pull_requests_labels ON pull_requests USING GIN(labels);
CREATE INDEX idx_pull_requests_assignees ON pull_requests USING GIN(assignees);

-- Pull Request Reviews table
-- Stores review information for pull requests
CREATE TABLE pull_request_reviews (
    id SERIAL PRIMARY KEY,
    pr_github_id BIGINT NOT NULL REFERENCES pull_requests(github_id) ON DELETE CASCADE,
    reviewer_login VARCHAR(255) NOT NULL,
    state VARCHAR(50) NOT NULL CHECK (state IN ('APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING')),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    
    -- TODO: Add fields for future expansion:
    -- - review_id BIGINT (GitHub review ID)
    -- - body TEXT (review comment body)
    -- - commit_id VARCHAR(40) (commit SHA the review is for)
    -- - html_url TEXT (link to the review)
    -- - pull_request_url TEXT
    -- - author_association TEXT (OWNER, MEMBER, CONTRIBUTOR, etc.)
    -- - review_comment_count INTEGER (number of review comments)
);

-- Indexes for pull request reviews
CREATE INDEX idx_pull_request_reviews_pr_github_id ON pull_request_reviews(pr_github_id);
CREATE INDEX idx_pull_request_reviews_reviewer_login ON pull_request_reviews(reviewer_login);
CREATE INDEX idx_pull_request_reviews_state ON pull_request_reviews(state);
CREATE INDEX idx_pull_request_reviews_submitted_at ON pull_request_reviews(submitted_at);
CREATE INDEX idx_pull_request_reviews_synced_at ON pull_request_reviews(synced_at);

-- Composite index for common queries (PR + reviewer)
CREATE INDEX idx_pull_request_reviews_pr_reviewer ON pull_request_reviews(pr_github_id, reviewer_login);

-- TODO: Future tables to consider:
-- - pull_request_comments (review comments, issue comments on PRs)
-- - pull_request_commits (list of commits in a PR)
-- - pull_request_files (list of files changed in a PR)
-- - pull_request_check_runs (CI/CD check run results)
-- - pull_request_status_checks (status check results)
-- - pull_request_review_comments (inline code review comments)

