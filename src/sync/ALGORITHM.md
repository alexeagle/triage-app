# GitHub → Postgres Issues Sync Algorithm

## Overview

This document describes the algorithm for synchronizing GitHub issues from all repositories in an organization to a Neon Postgres database. The sync supports both full backfill (initial sync) and incremental updates (only changed data).

---

## 1. Authentication Flow

### 1.1 GitHub App Authentication

**Purpose**: Authenticate as the GitHub App to obtain installation tokens.

**Steps**:
1. Read `APP_ID` and `PRIVATE_KEY` from environment variables
2. Generate a JWT token:
   - Use the private key to sign a JWT
   - Set `iss` (issuer) to `APP_ID`
   - Set `exp` (expiration) to current time + 10 minutes (GitHub allows max 10 minutes)
   - Set `iat` (issued at) to current time
3. The JWT is used to authenticate as the GitHub App itself

**Pseudocode**:
```
FUNCTION githubAppAuth():
    appId = READ_ENV("APP_ID")
    privateKey = READ_ENV("PRIVATE_KEY")
    
    jwtPayload = {
        iss: appId,
        exp: NOW() + 10 minutes,
        iat: NOW()
    }
    
    jwtToken = SIGN_JWT(jwtPayload, privateKey, algorithm="RS256")
    RETURN jwtToken
END FUNCTION
```

### 1.2 Installation Authentication

**Purpose**: Get an installation access token that can be used for API calls.

**Steps**:
1. Use the JWT from `githubAppAuth()` to authenticate
2. Read `INSTALLATION_ID` from environment variables
3. Make POST request to `https://api.github.com/app/installations/{INSTALLATION_ID}/access_tokens`
4. Include JWT in `Authorization: Bearer {jwt}` header
5. GitHub returns an installation access token with expiration time
6. Cache the token until it expires (typically 1 hour)

**Pseudocode**:
```
FUNCTION githubInstallationAuth():
    jwt = githubAppAuth()
    installationId = READ_ENV("INSTALLATION_ID")
    
    response = HTTP_POST(
        "https://api.github.com/app/installations/{installationId}/access_tokens",
        headers: {
            "Authorization": "Bearer {jwt}",
            "Accept": "application/vnd.github+json"
        }
    )
    
    installationToken = response.token
    expiresAt = response.expires_at
    
    RETURN {
        token: installationToken,
        expiresAt: expiresAt
    }
END FUNCTION
```

---

## 2. GitHub REST Client with Rate Limiting

### 2.1 Rate Limit Handling

**Purpose**: Automatically handle GitHub API rate limits and retries.

**Rate Limit Headers**:
- `X-RateLimit-Limit`: Total requests allowed per hour (typically 5000 for installations)
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when rate limit resets
- `X-RateLimit-Used`: Requests used in current window

**Retry Strategy**:
1. On 429 (Too Many Requests):
   - Read `X-RateLimit-Reset` header
   - Calculate sleep duration: `resetTime - currentTime + buffer`
   - Sleep until rate limit resets
   - Retry the request
2. On 5xx server errors:
   - Use exponential backoff: `2^attempt * baseDelay`
   - Max retries: 3-5 attempts
   - Base delay: 1-2 seconds
3. On network errors:
   - Retry with exponential backoff
   - Max retries: 3 attempts

**Pseudocode**:
```
FUNCTION requestWithRetry(endpoint, options):
    maxRetries = 5
    baseDelay = 1 second
    
    FOR attempt = 1 TO maxRetries:
        response = HTTP_GET(endpoint, headers: options.headers)
        
        IF response.status == 200:
            RETURN response.data
        
        ELSE IF response.status == 429:
            resetTime = PARSE_INT(response.headers["X-RateLimit-Reset"])
            currentTime = NOW()
            sleepDuration = resetTime - currentTime + 60 seconds (buffer)
            
            LOG("Rate limit hit. Sleeping until {resetTime}")
            SLEEP(sleepDuration)
            CONTINUE (retry)
        
        ELSE IF response.status >= 500:
            IF attempt < maxRetries:
                backoffDelay = (2 ^ attempt) * baseDelay
                LOG("Server error {status}. Retrying in {backoffDelay}")
                SLEEP(backoffDelay)
                CONTINUE (retry)
            ELSE:
                THROW_ERROR("Max retries exceeded")
        
        ELSE:
            THROW_ERROR("Request failed: {response.status}")
    END FOR
END FUNCTION
```

---

## 3. Listing All Repositories

### 3.1 Fetch Repositories with Pagination

**Purpose**: Get all repositories accessible to the GitHub App installation.

**API Endpoint**: `GET /installation/repositories` (lists all repos for the installation)

**Alternative**: `GET /orgs/{org}/repos` (if you know the org name)

**Pagination Strategy**:
1. GitHub uses Link headers for pagination
2. First request: `GET /installation/repositories?per_page=100`
3. Parse `Link` header for `rel="next"` URL
4. Continue fetching until no `next` link exists
5. Collect all repositories across all pages

**Pseudocode**:
```
FUNCTION fetchAllReposForInstallation(client):
    allRepos = []
    url = "https://api.github.com/installation/repositories?per_page=100"
    
    WHILE url IS NOT NULL:
        response = client.requestWithRetry(url)
        repos = response.repositories
        
        allRepos.ADD_ALL(repos)
        
        linkHeader = response.headers["Link"]
        nextUrl = EXTRACT_NEXT_URL(linkHeader)  // Parse Link: <url>; rel="next"
        url = nextUrl
        
        LOG("Fetched {repos.length} repos. Total: {allRepos.length}")
    END WHILE
    
    RETURN allRepos
END FUNCTION

FUNCTION EXTRACT_NEXT_URL(linkHeader):
    // Link header format: <url1>; rel="prev", <url2>; rel="next"
    IF linkHeader CONTAINS 'rel="next"':
        MATCH pattern: '<(.*?)>; rel="next"'
        RETURN matched_url
    ELSE:
        RETURN NULL
END FUNCTION
```

---

## 4. Fetching Issues with Pagination

### 4.1 Fetch All Issues for a Repository

**Purpose**: Get all issues (excluding pull requests) for a single repository.

**API Endpoint**: `GET /repos/{owner}/{repo}/issues`

**Important Notes**:
- This endpoint returns both issues AND pull requests
- Pull requests have a `pull_request` field (not null)
- Filter out items where `pull_request` is not null
- Use `state=all` to get both open and closed issues
- Pagination works the same as repositories

**Pseudocode**:
```
FUNCTION fetchAllIssuesForRepo(client, owner, repo):
    allIssues = []
    url = "https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100"
    
    WHILE url IS NOT NULL:
        response = client.requestWithRetry(url)
        items = response.data
        
        // Filter out pull requests
        issues = FILTER items WHERE item.pull_request IS NULL
        
        allIssues.ADD_ALL(issues)
        
        linkHeader = response.headers["Link"]
        nextUrl = EXTRACT_NEXT_URL(linkHeader)
        url = nextUrl
        
        LOG("Fetched {issues.length} issues from {owner}/{repo}. Total: {allIssues.length}")
    END WHILE
    
    RETURN allIssues
END FUNCTION
```

---

## 5. Upsert Strategy for Postgres

### 5.1 Upsert Logic

**Purpose**: Insert new issues or update existing ones based on `github_id`.

**Strategy**: Use PostgreSQL `ON CONFLICT` clause with `github_id` as the unique key.

**Fields to Update**:
- Always update: `title`, `body`, `state`, `updated_at`, `closed_at`, `labels`, `assignees`
- Only update `synced_at` on successful sync
- Never update: `github_id`, `repo_github_id`, `number`, `created_at`, `author_login` (these are immutable)

**Pseudocode**:
```
FUNCTION upsertIssue(db, issue, repoGithubId):
    sql = """
        INSERT INTO issues (
            github_id, repo_github_id, number, title, body, state,
            created_at, updated_at, closed_at, labels, assignees, author_login, synced_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
        )
        ON CONFLICT (github_id)
        DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            state = EXCLUDED.state,
            updated_at = EXCLUDED.updated_at,
            closed_at = EXCLUDED.closed_at,
            labels = EXCLUDED.labels,
            assignees = EXCLUDED.assignees,
            synced_at = NOW()
    """
    
    params = [
        issue.id,                    // github_id
        repoGithubId,                // repo_github_id
        issue.number,
        issue.title,
        issue.body,
        issue.state,
        issue.created_at,
        issue.updated_at,
        issue.closed_at,
        JSON.stringify(issue.labels),    // Convert to JSONB
        JSON.stringify(issue.assignees), // Convert to JSONB
        issue.user.login              // author_login
    ]
    
    db.execute(sql, params)
END FUNCTION
```

### 5.2 Batch Upsert for Performance

**Purpose**: Upsert multiple issues in a single transaction for better performance.

**Pseudocode**:
```
FUNCTION upsertIssuesBatch(db, issues, repoGithubId):
    BEGIN_TRANSACTION(db)
    
    TRY:
        FOR EACH issue IN issues:
            upsertIssue(db, issue, repoGithubId)
        END FOR
        
        COMMIT_TRANSACTION(db)
        LOG("Upserted {issues.length} issues for repo {repoGithubId}")
    CATCH error:
        ROLLBACK_TRANSACTION(db)
        THROW_ERROR("Failed to upsert issues: {error}")
    END TRY
END FUNCTION
```

---

## 6. Change Detection (Incremental Sync)

### 6.1 Last Sync Tracking

**Purpose**: Track when each repository was last synced to enable incremental updates.

**Strategy**: Store `last_synced_at` timestamp per repository.

**Option 1**: Add column to `repos` table
```
ALTER TABLE repos ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE;
```

**Option 2**: Use `MAX(updated_at)` from issues table (simpler, but less accurate)

### 6.2 Incremental Sync Logic

**Purpose**: Only fetch issues that have changed since last sync.

**API Parameter**: `?since={iso_timestamp}` - GitHub returns issues updated after this time

**Pseudocode**:
```
FUNCTION getLastSyncTime(db, repoGithubId):
    sql = "SELECT last_synced_at FROM repos WHERE github_id = $1"
    result = db.query(sql, [repoGithubId])
    
    IF result IS NULL OR result.last_synced_at IS NULL:
        RETURN NULL  // Never synced before
    ELSE:
        RETURN result.last_synced_at
END FUNCTION

FUNCTION fetchIssuesIncremental(client, owner, repo, sinceTimestamp):
    baseUrl = "https://api.github.com/repos/{owner}/{repo}/issues?state=all&per_page=100"
    
    IF sinceTimestamp IS NOT NULL:
        // Convert to ISO 8601 format
        sinceParam = FORMAT_ISO8601(sinceTimestamp)
        url = baseUrl + "&since=" + sinceParam
    ELSE:
        url = baseUrl
    
    RETURN fetchAllIssuesForRepo(client, owner, repo, url)
END FUNCTION

FUNCTION updateLastSyncTime(db, repoGithubId):
    sql = "UPDATE repos SET last_synced_at = NOW() WHERE github_id = $1"
    db.execute(sql, [repoGithubId])
END FUNCTION
```

---

## 7. Full Backfill vs Incremental Sync

### 7.1 Sync Mode Detection

**Purpose**: Determine whether to do a full backfill or incremental sync.

**Strategy**:
- **Full Backfill**: If `last_synced_at` is NULL or if explicitly requested
- **Incremental Sync**: If `last_synced_at` exists and is recent

**Pseudocode**:
```
FUNCTION shouldDoFullBackfill(db, repoGithubId, forceFullSync):
    IF forceFullSync:
        RETURN true
    
    lastSync = getLastSyncTime(db, repoGithubId)
    
    IF lastSync IS NULL:
        RETURN true  // Never synced before
    
    // Optional: Force full sync if last sync was too long ago (e.g., > 30 days)
    daysSinceSync = (NOW() - lastSync) / 1 day
    IF daysSinceSync > 30:
        RETURN true
    
    RETURN false
END FUNCTION
```

### 7.2 Sync Execution Flow

**Pseudocode**:
```
FUNCTION syncRepoIssues(client, db, repo, forceFullSync):
    repoGithubId = repo.id
    owner = repo.owner.login
    repoName = repo.name
    
    isFullBackfill = shouldDoFullBackfill(db, repoGithubId, forceFullSync)
    
    IF isFullBackfill:
        LOG("Starting FULL BACKFILL for {owner}/{repoName}")
        issues = fetchAllIssuesForRepo(client, owner, repoName)
    ELSE:
        lastSync = getLastSyncTime(db, repoGithubId)
        LOG("Starting INCREMENTAL SYNC for {owner}/{repoName} (since {lastSync})")
        issues = fetchIssuesIncremental(client, owner, repoName, lastSync)
    END IF
    
    IF issues.length > 0:
        upsertIssuesBatch(db, issues, repoGithubId)
        LOG("Synced {issues.length} issues for {owner}/{repoName}")
    ELSE:
        LOG("No issues to sync for {owner}/{repoName}")
    END IF
    
    updateLastSyncTime(db, repoGithubId)
END FUNCTION
```

---

## 8. Main Sync Orchestration

### 8.1 Complete Sync Algorithm

**Purpose**: Orchestrate the entire sync process for all repositories.

**Pseudocode**:
```
FUNCTION syncAllIssues(orgName, forceFullSync = false):
    // 1. Authenticate
    authResult = githubInstallationAuth()
    client = NEW GitHubClient(authResult.token)
    
    // 2. Connect to database
    db = getDbConnection()
    
    // 3. Fetch all repositories
    LOG("Fetching all repositories for installation...")
    repos = fetchAllReposForInstallation(client)
    LOG("Found {repos.length} repositories")
    
    // 4. Initialize statistics
    stats = {
        reposProcessed: 0,
        reposSkipped: 0,
        issuesSynced: 0,
        errors: []
    }
    
    // 5. Sync each repository
    FOR EACH repo IN repos:
        TRY:
            LOG("Processing repo {repo.full_name} ({stats.reposProcessed + 1}/{repos.length})")
            
            // Upsert repo metadata first
            upsertRepo(db, repo)
            
            // Sync issues
            issues = syncRepoIssues(client, db, repo, forceFullSync)
            stats.issuesSynced += issues.length
            stats.reposProcessed += 1
            
        CATCH error:
            stats.reposSkipped += 1
            stats.errors.ADD({
                repo: repo.full_name,
                error: error.message
            })
            LOG_ERROR("Failed to sync {repo.full_name}: {error.message}")
            // Continue with next repo
        END TRY
    END FOR
    
    // 6. Log summary
    LOG("Sync complete!")
    LOG("Repos processed: {stats.reposProcessed}")
    LOG("Repos skipped: {stats.reposSkipped}")
    LOG("Total issues synced: {stats.issuesSynced}")
    IF stats.errors.length > 0:
        LOG("Errors: {stats.errors.length}")
        FOR EACH error IN stats.errors:
            LOG("  - {error.repo}: {error.error}")
        END FOR
    END IF
    
    RETURN stats
END FUNCTION
```

### 8.2 Upsert Repository Metadata

**Purpose**: Store or update repository information in the database.

**Pseudocode**:
```
FUNCTION upsertRepo(db, repo):
    sql = """
        INSERT INTO repos (
            github_id, name, full_name, private, archived,
            pushed_at, updated_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
        )
        ON CONFLICT (github_id)
        DO UPDATE SET
            name = EXCLUDED.name,
            full_name = EXCLUDED.full_name,
            private = EXCLUDED.private,
            archived = EXCLUDED.archived,
            pushed_at = EXCLUDED.pushed_at,
            updated_at = EXCLUDED.updated_at
    """
    
    params = [
        repo.id,
        repo.name,
        repo.full_name,
        repo.private,
        repo.archived,
        repo.pushed_at,
        repo.updated_at
    ]
    
    db.execute(sql, params)
END FUNCTION
```

---

## 9. Logging Strategy

### 9.1 Log Levels and Messages

**Purpose**: Provide visibility into sync progress and issues.

**Log Levels**:
- **INFO**: Normal progress (repos fetched, issues synced, etc.)
- **WARN**: Rate limit warnings, retries
- **ERROR**: Failed requests, database errors, sync failures

**Key Log Points**:
1. Authentication success/failure
2. Repository count discovered
3. Per-repo progress: "Processing repo X (N/M)"
4. Issues fetched per repo
5. Rate limit hits and sleep duration
6. Retry attempts
7. Batch upsert results
8. Final summary statistics
9. Errors with context (repo name, error message)

**Pseudocode**:
```
FUNCTION LOG(message, level = "INFO"):
    timestamp = FORMAT_TIMESTAMP(NOW())
    output = "[{timestamp}] [{level}] {message}"
    PRINT(output)
    
    // Optionally write to file or logging service
END FUNCTION

FUNCTION LOG_ERROR(message, error):
    LOG("ERROR: {message}: {error.message}", level="ERROR")
    IF error.stack:
        LOG(error.stack, level="ERROR")
END FUNCTION
```

---

## 10. Error Handling and Resilience

### 10.1 Per-Repo Error Isolation

**Purpose**: Ensure one failing repo doesn't stop the entire sync.

**Strategy**: Wrap each repo sync in try-catch, log error, continue to next repo.

### 10.2 Database Transaction Safety

**Purpose**: Ensure data consistency even if sync is interrupted.

**Strategy**:
- Use transactions for batch upserts
- Commit after each repo is fully synced
- If sync fails mid-repo, rollback that repo's changes
- Other repos' data remains intact

### 10.3 Partial Sync Recovery

**Purpose**: Resume sync from where it left off if interrupted.

**Strategy**:
- Update `last_synced_at` only after successful sync
- If sync fails, `last_synced_at` remains at previous value
- Next sync will retry from last successful point

---

## 11. Performance Considerations

### 11.1 Batch Sizes

- **Repositories**: Fetch 100 per page (GitHub max)
- **Issues**: Fetch 100 per page (GitHub max)
- **Database Upserts**: Batch 50-100 issues per transaction

### 11.2 Rate Limit Optimization

- **Sequential Processing**: Process repos one at a time to avoid hitting rate limits
- **Token Caching**: Cache installation token until expiration
- **Sleep Between Requests**: Optional small delay (100-200ms) to stay under rate limits

### 11.3 Database Optimization

- Use connection pooling
- Batch upserts in transactions
- Indexes on `github_id`, `repo_github_id`, `updated_at` (already in schema)

---

## Summary

The sync process follows this high-level flow:

1. **Authenticate** → Get installation access token
2. **List Repos** → Fetch all repositories with pagination
3. **For Each Repo**:
   - Determine sync mode (full vs incremental)
   - Fetch issues (with pagination and filtering)
   - Upsert issues to database
   - Update last sync timestamp
4. **Handle Errors** → Log and continue, don't fail entire sync
5. **Rate Limiting** → Automatic retry with exponential backoff
6. **Logging** → Progress updates and error reporting

This algorithm ensures reliable, efficient synchronization while respecting GitHub API limits and maintaining data consistency.

