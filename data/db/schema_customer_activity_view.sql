-- Customer Activity View
-- 
-- Filtered view on top of company_activity_base for customer companies only.
-- Customers are companies with lifecycle stage: customer

-- This view depends on company_activity_base, which should be created first
-- by running schema_company_activity_base_view.sql

-- Drop the view first to avoid column order conflicts
DROP VIEW IF EXISTS customer_activity;

CREATE VIEW customer_activity AS
SELECT 
  hubspot_company_id,
  company_name,
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
FROM company_activity_base
WHERE lifecyclestage = 'customer';
