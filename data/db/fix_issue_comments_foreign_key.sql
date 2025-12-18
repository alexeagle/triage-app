-- Fix issue_comments foreign key constraint to support both issues and PRs
-- 
-- The original constraint only referenced issues(github_id), but PRs are stored
-- in pull_requests table. Since PostgreSQL doesn't support foreign keys that
-- reference multiple tables, we drop the constraint and rely on application-level
-- validation.

-- Drop the existing foreign key constraint
ALTER TABLE issue_comments
  DROP CONSTRAINT IF EXISTS issue_comments_issue_github_id_fkey;

-- Note: We could add a CHECK constraint with a function to validate that
-- issue_github_id exists in either issues or pull_requests, but for now
-- we rely on application-level validation since the sync process ensures
-- comments are only created for valid issues/PRs.

