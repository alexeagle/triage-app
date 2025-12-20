-- Add is_aspect_build_member column to users table
-- 
-- This allows manual override of Aspect Build membership status for users
-- who should have access but aren't public members of the GitHub org.
-- Once set to true, this value will be preserved even if GitHub org checks fail.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_aspect_build_member BOOLEAN NOT NULL DEFAULT false;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_is_aspect_build_member ON users(is_aspect_build_member);

-- Comment for documentation
COMMENT ON COLUMN users.is_aspect_build_member IS 'Manual override flag for Aspect Build membership. If true, user is treated as a member regardless of GitHub org membership status. Once set to true, this value is preserved and not overwritten by GitHub org checks.';
