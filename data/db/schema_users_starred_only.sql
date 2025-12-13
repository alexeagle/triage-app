-- Add starred_only preference to users table
-- 
-- This allows the starredOnly filter preference to be stored in the database
-- and persist across browsers/devices for each user.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS starred_only BOOLEAN NOT NULL DEFAULT false;

-- Index for faster lookups (though github_id is already indexed)
-- This is mainly for documentation/clarity
COMMENT ON COLUMN users.starred_only IS 'User preference: filter to show only starred repositories';
