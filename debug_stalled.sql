-- Diagnostic query to check stalled PRs and Issues
-- Run this in PostgreSQL to debug stalled counts
-- Replace '14 days' with your desired stall_interval throughout

-- First, check what's in issue_turns view for PRs and Issues
SELECT 
  'Sample PRs from issue_turns' as section,
  pr.github_id,
  r.full_name as repo,
  pr.number,
  it.turn,
  it.last_maintainer_action_at,
  (it.turn = 'maintainer' AND it.last_maintainer_action_at < NOW() - '14 days'::interval) as is_stalled,
  NOW() - it.last_maintainer_action_at as age
FROM pull_requests pr
INNER JOIN repos r ON pr.repo_github_id = r.github_id
LEFT JOIN issue_turns it ON pr.github_id = it.issue_github_id
WHERE pr.state = 'open'
  AND LOWER(pr.author_login) NOT LIKE '%bot%'
  AND (it.turn IS NULL OR it.turn != 'author')
LIMIT 10;

-- Summary counts matching the query logic
SELECT 
  'PRs' as type,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    AND NOT (it_pr.turn = 'maintainer' AND it_pr.last_maintainer_action_at < NOW() - '14 days'::interval)
    THEN pr.id 
  END)::int as active,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    AND (it_pr.turn = 'maintainer' AND it_pr.last_maintainer_action_at < NOW() - '14 days'::interval)
    THEN pr.id 
  END)::int as stalled,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    THEN pr.id 
  END)::int as total
FROM pull_requests pr
LEFT JOIN issue_turns it_pr ON pr.github_id = it_pr.issue_github_id
UNION ALL
SELECT 
  'Issues' as type,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    AND NOT (it_i.turn = 'maintainer' AND it_i.last_maintainer_action_at < NOW() - '14 days'::interval)
    THEN i.id 
  END)::int as active,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    AND (it_i.turn = 'maintainer' AND it_i.last_maintainer_action_at < NOW() - '14 days'::interval)
    THEN i.id 
  END)::int as stalled,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    THEN i.id 
  END)::int as total
FROM issues i
LEFT JOIN issue_turns it_i ON i.github_id = it_i.issue_github_id;

-- Detailed breakdown by repo (top 10 repos) - matches getTopReposByOpenPRs logic
SELECT 
  r.full_name,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    THEN pr.id 
  END)::int as open_prs_count,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    AND it_pr.turn = 'maintainer'
    AND it_pr.last_maintainer_action_at < NOW() - '14 days'::interval
    THEN pr.id 
  END)::int as stalled_prs_count,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    THEN i.id 
  END)::int as open_issues_count,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    AND it_i.turn = 'maintainer'
    AND it_i.last_maintainer_action_at < NOW() - '14 days'::interval
    THEN i.id 
  END)::int as stalled_issues_count,
  -- Debug: show turn status breakdown
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND it_pr.turn = 'maintainer'
    THEN pr.id 
  END)::int as prs_with_turn_maintainer,
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND it_pr.turn IS NULL
    THEN pr.id 
  END)::int as prs_with_turn_null,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND it_i.turn = 'maintainer'
    THEN i.id 
  END)::int as issues_with_turn_maintainer,
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND it_i.turn IS NULL
    THEN i.id 
  END)::int as issues_with_turn_null
FROM repos r
LEFT JOIN pull_requests pr ON r.github_id = pr.repo_github_id
LEFT JOIN issue_turns it_pr ON pr.github_id = it_pr.issue_github_id
LEFT JOIN issues i ON r.github_id = i.repo_github_id
LEFT JOIN issue_turns it_i ON i.github_id = it_i.issue_github_id
GROUP BY r.github_id, r.full_name
HAVING 
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    THEN pr.id 
  END) > 0
  OR COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    THEN i.id 
  END) > 0
ORDER BY (
  COUNT(DISTINCT CASE 
    WHEN pr.state = 'open' 
    AND LOWER(pr.author_login) NOT LIKE '%bot%'
    AND (it_pr.turn IS NULL OR it_pr.turn != 'author')
    THEN pr.id 
  END) +
  COUNT(DISTINCT CASE 
    WHEN i.state = 'open' 
    AND LOWER(i.author_login) NOT LIKE '%bot%'
    AND (it_i.turn IS NULL OR it_i.turn != 'author')
    THEN i.id 
  END)
) DESC
LIMIT 10;
