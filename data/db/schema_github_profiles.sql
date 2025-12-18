-- GitHub Profile Table
-- 
-- Stores metadata fetched from GitHub user profiles.
-- Separate from github_users to allow multiple data sources.

CREATE TABLE IF NOT EXISTS github_profiles (
    github_id BIGINT PRIMARY KEY,
    company TEXT,
    bio TEXT,
    blog TEXT,
    location TEXT,
    twitter TEXT,
    name TEXT,
    last_fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (github_id) REFERENCES github_users(github_id) ON DELETE CASCADE
);
