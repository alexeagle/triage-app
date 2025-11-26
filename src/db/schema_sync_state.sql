-- Sync State Schema
-- 
-- This schema tracks incremental sync state for repositories.
-- Used to determine which repositories need full sync vs incremental sync.

-- Sync State table
-- Tracks the last sync timestamp for issues and pull requests per repository
CREATE TABLE sync_state (
    repo_github_id BIGINT PRIMARY KEY REFERENCES repos(github_id) ON DELETE CASCADE,
    last_issue_sync TIMESTAMP WITH TIME ZONE,
    last_pr_sync TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    
    -- TODO: Add fields for future expansion:
    -- - webhook_last_seen TIMESTAMP WITH TIME ZONE (last webhook event processed)
    -- - backfill_complete BOOLEAN (whether initial full sync is complete)
    -- - issues_synced_count INTEGER (total issues synced for this repo)
    -- - prs_synced_count INTEGER (total PRs synced for this repo)
    -- - last_sync_duration_seconds INTEGER (how long the last sync took)
    -- - sync_error_count INTEGER (number of errors encountered)
    -- - last_sync_error TEXT (most recent error message)
    -- - sync_status TEXT (pending, in_progress, completed, failed)
    -- - next_sync_scheduled_at TIMESTAMP WITH TIME ZONE (when next sync should run)
);

-- Index on updated_at for querying recently synced repos
CREATE INDEX idx_sync_state_updated_at ON sync_state(updated_at);

-- Index on last_issue_sync for finding repos that need issue sync
CREATE INDEX idx_sync_state_last_issue_sync ON sync_state(last_issue_sync);

-- Index on last_pr_sync for finding repos that need PR sync
CREATE INDEX idx_sync_state_last_pr_sync ON sync_state(last_pr_sync);

-- Composite index for finding repos that need both syncs
CREATE INDEX idx_sync_state_sync_status ON sync_state(last_issue_sync, last_pr_sync);

