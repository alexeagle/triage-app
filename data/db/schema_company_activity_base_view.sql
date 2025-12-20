-- Company Activity Base View
-- 
-- This is a base view that contains all company activity data with lifecycle stage information.
-- Filtered views (prospect_activity, customer_activity) are built on top of this.

-- Helper function to normalize company names (matches TypeScript logic)
-- Note: This should already exist from schema_prospect_activity_view.sql, but we include it here
-- for completeness and to ensure it exists before creating the base view.
CREATE OR REPLACE FUNCTION normalize_company_name(input_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_name IS NULL OR TRIM(input_name) = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove leading @ symbol
  IF input_name LIKE '@%' THEN
    input_name := SUBSTRING(input_name FROM 2);
  END IF;
  
  -- Convert to lowercase and trim
  input_name := LOWER(TRIM(input_name));
  
  IF input_name = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove specific punctuation: [.,;:!?'"()[\]{}]
  input_name := REGEXP_REPLACE(input_name, '[.,;:!?''"()[\]{}]', '', 'g');
  
  -- Remove common suffixes with word boundaries
  -- Note: PostgreSQL \b is word boundary, \y is word boundary for regex
  input_name := REGEXP_REPLACE(input_name, '\yinc\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\yllc\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\yltd\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\ylimited\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\ycorp\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\ycorporation\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\yco\y', '', 'gi');
  input_name := REGEXP_REPLACE(input_name, '\ycompany\y', '', 'gi');
  
  -- Collapse whitespace
  input_name := REGEXP_REPLACE(input_name, '\s+', ' ', 'g');
  input_name := TRIM(input_name);
  
  IF input_name = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN input_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the base view first to avoid column order conflicts
DROP VIEW IF EXISTS company_activity_base;
DROP VIEW IF EXISTS prospect_activity;
DROP VIEW IF EXISTS customer_activity;

-- Base view with all company activity, including lifecycle stage
CREATE VIEW company_activity_base AS
WITH companies_with_stage AS (
  -- All HubSpot companies with their lifecycle stage
  SELECT DISTINCT
    hc.hubspot_company_id,
    hc.name as company_name,
    hc.lifecyclestage,
    normalize_company_name(hc.name) as normalized_company_name
  FROM hubspot_companies hc
),
users_with_companies AS (
  -- Get all users with their effective company names (normalized)
  SELECT DISTINCT
    gu.github_id as user_github_id,
    gu.login as user_login,
    gu.is_maintainer,
    normalize_company_name(
      CASE
        WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
        WHEN co.override_source = 'github' THEN ghm.company
        WHEN co.override_source = 'commonroom' THEN crmm.company_name
        ELSE COALESCE(
          NULLIF(TRIM(crmm.company_name), ''),
          NULLIF(TRIM(ghm.company), '')
        )
      END
    ) as normalized_company_name
  FROM github_users gu
  LEFT JOIN github_profiles ghm ON gu.github_id = ghm.github_id
  LEFT JOIN commonroom_member_metadata crmm ON gu.login = crmm.github_login
  LEFT JOIN company_overrides co ON gu.github_id = co.github_user_id
  WHERE normalize_company_name(
    CASE
      WHEN co.override_company_name IS NOT NULL THEN co.override_company_name
      WHEN co.override_source = 'github' THEN ghm.company
      WHEN co.override_source = 'commonroom' THEN crmm.company_name
      ELSE COALESCE(
        NULLIF(TRIM(crmm.company_name), ''),
        NULLIF(TRIM(ghm.company), '')
      )
    END
  ) IS NOT NULL
),
company_users AS (
  -- Match companies to GitHub users via normalized company names
  SELECT DISTINCT
    cws.hubspot_company_id,
    cws.company_name,
    cws.lifecyclestage,
    uwc.user_github_id,
    uwc.user_login,
    uwc.is_maintainer
  FROM companies_with_stage cws
  INNER JOIN users_with_companies uwc 
    ON uwc.normalized_company_name = cws.normalized_company_name
),
recent_issues AS (
  -- Issues authored by company users in last 30 days
  SELECT DISTINCT
    cu.hubspot_company_id,
    cu.company_name,
    cu.lifecyclestage,
    cu.user_github_id,
    cu.user_login,
    cu.is_maintainer,
    i.github_id as item_github_id,
    i.repo_github_id,
    i.number as item_number,
    i.title,
    i.state,
    i.created_at,
    i.updated_at,
    'issue' as item_type,
    'author' as interaction_type,
    i.created_at as interaction_date
  FROM company_users cu
  INNER JOIN issues i ON i.author_login = cu.user_login
  WHERE i.created_at >= NOW() - INTERVAL '30 days'
),
recent_prs AS (
  -- PRs authored by company users in last 30 days
  SELECT DISTINCT
    cu.hubspot_company_id,
    cu.company_name,
    cu.lifecyclestage,
    cu.user_github_id,
    cu.user_login,
    cu.is_maintainer,
    pr.github_id as item_github_id,
    pr.repo_github_id,
    pr.number as item_number,
    pr.title,
    pr.state,
    pr.created_at,
    pr.updated_at,
    'pr' as item_type,
    'author' as interaction_type,
    pr.created_at as interaction_date
  FROM company_users cu
  INNER JOIN pull_requests pr ON pr.author_login = cu.user_login
  WHERE pr.created_at >= NOW() - INTERVAL '30 days'
),
recent_comments AS (
  -- Issues/PRs where company users commented in last 30 days
  SELECT DISTINCT
    cu.hubspot_company_id,
    cu.company_name,
    cu.lifecyclestage,
    cu.user_github_id,
    cu.user_login,
    cu.is_maintainer,
    ic.issue_github_id as item_github_id,
    COALESCE(i.repo_github_id, pr.repo_github_id) as repo_github_id,
    COALESCE(i.number, pr.number) as item_number,
    COALESCE(i.title, pr.title) as title,
    COALESCE(i.state, pr.state) as state,
    COALESCE(i.created_at, pr.created_at) as created_at,
    COALESCE(i.updated_at, pr.updated_at) as updated_at,
    CASE WHEN i.github_id IS NOT NULL THEN 'issue' ELSE 'pr' END as item_type,
    'comment' as interaction_type,
    ic.created_at as interaction_date
  FROM company_users cu
  INNER JOIN issue_comments ic ON ic.author_login = cu.user_login
  LEFT JOIN issues i ON i.github_id = ic.issue_github_id
  LEFT JOIN pull_requests pr ON pr.github_id = ic.issue_github_id
  WHERE ic.created_at >= NOW() - INTERVAL '30 days'
),
recent_reactions AS (
  -- Issues where company users reacted in last 30 days
  SELECT DISTINCT
    cu.hubspot_company_id,
    cu.company_name,
    cu.lifecyclestage,
    cu.user_github_id,
    cu.user_login,
    cu.is_maintainer,
    ir.issue_github_id as item_github_id,
    i.repo_github_id,
    i.number as item_number,
    i.title,
    i.state,
    i.created_at,
    i.updated_at,
    'issue' as item_type,
    'reaction' as interaction_type,
    ir.created_at as interaction_date
  FROM company_users cu
  INNER JOIN issue_reactions ir ON ir.user_github_id = cu.user_github_id
  INNER JOIN issues i ON i.github_id = ir.issue_github_id
  WHERE ir.created_at >= NOW() - INTERVAL '30 days'
),
recent_pr_reviews AS (
  -- PRs where company users reviewed in last 30 days
  SELECT DISTINCT
    cu.hubspot_company_id,
    cu.company_name,
    cu.lifecyclestage,
    cu.user_github_id,
    cu.user_login,
    cu.is_maintainer,
    prr.pr_github_id as item_github_id,
    pr.repo_github_id,
    pr.number as item_number,
    pr.title,
    pr.state,
    pr.created_at,
    pr.updated_at,
    'pr' as item_type,
    'review' as interaction_type,
    prr.submitted_at as interaction_date
  FROM company_users cu
  INNER JOIN pull_request_reviews prr ON prr.reviewer_login = cu.user_login
  INNER JOIN pull_requests pr ON pr.github_id = prr.pr_github_id
  WHERE prr.submitted_at >= NOW() - INTERVAL '30 days'
)
-- Union all activity types
SELECT 
  hubspot_company_id,
  company_name,
  lifecyclestage,
  user_github_id,
  user_login,
  is_maintainer,
  item_github_id,
  repo_github_id,
  item_number,
  title,
  state,
  created_at,
  updated_at,
  item_type,
  interaction_type,
  interaction_date
FROM recent_issues
UNION ALL
SELECT 
  hubspot_company_id,
  company_name,
  lifecyclestage,
  user_github_id,
  user_login,
  is_maintainer,
  item_github_id,
  repo_github_id,
  item_number,
  title,
  state,
  created_at,
  updated_at,
  item_type,
  interaction_type,
  interaction_date
FROM recent_prs
UNION ALL
SELECT 
  hubspot_company_id,
  company_name,
  lifecyclestage,
  user_github_id,
  user_login,
  is_maintainer,
  item_github_id,
  repo_github_id,
  item_number,
  title,
  state,
  created_at,
  updated_at,
  item_type,
  interaction_type,
  interaction_date
FROM recent_comments
UNION ALL
SELECT 
  hubspot_company_id,
  company_name,
  lifecyclestage,
  user_github_id,
  user_login,
  is_maintainer,
  item_github_id,
  repo_github_id,
  item_number,
  title,
  state,
  created_at,
  updated_at,
  item_type,
  interaction_type,
  interaction_date
FROM recent_reactions
UNION ALL
SELECT 
  hubspot_company_id,
  company_name,
  lifecyclestage,
  user_github_id,
  user_login,
  is_maintainer,
  item_github_id,
  repo_github_id,
  item_number,
  title,
  state,
  created_at,
  updated_at,
  item_type,
  interaction_type,
  interaction_date
FROM recent_pr_reviews;

-- Indexes to support the view (on underlying tables)
-- Note: Most indexes already exist, but we add composite indexes for better query performance
-- These indexes help with the time-based filtering in the view
CREATE INDEX IF NOT EXISTS idx_issues_author_login_created_at 
  ON issues(author_login, created_at);

CREATE INDEX IF NOT EXISTS idx_pull_requests_author_login_created_at 
  ON pull_requests(author_login, created_at);

CREATE INDEX IF NOT EXISTS idx_issue_comments_author_login_created_at 
  ON issue_comments(author_login, created_at);

CREATE INDEX IF NOT EXISTS idx_issue_reactions_user_github_id_created_at 
  ON issue_reactions(user_github_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pull_request_reviews_reviewer_login_submitted_at 
  ON pull_request_reviews(reviewer_login, submitted_at);
