-- Users Table Schema
-- 
-- Stores GitHub user information from NextAuth OAuth flow.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    github_id BIGINT NOT NULL UNIQUE,
    login TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index on github_id for fast lookups (already unique, but explicit index helps)
CREATE INDEX idx_users_github_id ON users(github_id);

-- Index on login for lookups by username
CREATE INDEX idx_users_login ON users(login);

