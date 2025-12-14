-- GitHub Users Table Schema
-- 
-- Stores every GitHub handle we encounter from issues, PRs, comments, reviews, etc.
-- This is a comprehensive user registry separate from the authenticated users table.

CREATE TABLE github_users (
    github_id BIGINT PRIMARY KEY,
    login TEXT NOT NULL,
    avatar_url TEXT,
    name TEXT,
    type TEXT,
    first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_maintainer BOOLEAN NOT NULL DEFAULT FALSE,
    maintainer_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    bio TEXT,
    company TEXT,
    blog TEXT,
    'location' TEXT,
    twitter TEXT;
);

-- Index on login for fast lookups by username
CREATE INDEX idx_github_users_login ON github_users(login);
