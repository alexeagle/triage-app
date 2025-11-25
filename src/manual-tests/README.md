# Manual Testing Harness

This directory contains manual test scripts for the GitHub client layer. These scripts allow you to verify that GitHub App authentication and API calls are working correctly before integrating with the database sync layer.

## Prerequisites

### Required Environment Variables

Before running any test scripts, you must set the following environment variables:

- **`APP_ID`**: Your GitHub App ID (numeric)
- **`PRIVATE_KEY`**: Your GitHub App private key in PEM format (including headers)
- **`INSTALLATION_ID`**: Your GitHub App installation ID (numeric)

### Setting Environment Variables

You can set these in several ways:

1. **Using a `.env` file** (recommended for local development):
   ```bash
   export APP_ID="123456"
   export PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   export INSTALLATION_ID="789012"
   ```

2. **Using direnv** (if you have `.envrc` configured):
   ```bash
   direnv allow
   ```

3. **Inline with the command**:
   ```bash
   APP_ID="123456" PRIVATE_KEY="..." INSTALLATION_ID="789012" tsx src/manual-tests/listRepos.ts
   ```

4. **Using npm/pnpm scripts**:
   ```bash
   pnpm test:repos
   pnpm test:issues bazel-contrib/bazel-lib
   pnpm test:prs bazel-contrib/bazel-lib
   ```

## Test Scripts

### `listRepos.ts` - Test Repository Fetching

Tests fetching all repositories from a GitHub organization.

**Usage:**
```bash
# Using tsx (recommended - handles ESM natively)
tsx src/manual-tests/listRepos.ts

# Or using the npm script
pnpm test:repos
```

**What it does:**
- Authenticates with GitHub App
- Fetches all repositories from the `bazel-contrib` organization
- Prints repository names, GitHub IDs, and metadata
- Validates authentication and API access

**Expected output:**
```
Testing GitHub App authentication and repository fetching...

🔐 Authenticating with GitHub App...
📦 Fetching repositories for organization: bazel-contrib

✅ Successfully fetched 25 repositories:

1. bazel-contrib/bazel-lib
   GitHub ID: 123456789
   Private: No
   Archived: No
   Updated: 2024-01-15T10:30:00Z
...
```

### `listIssues.ts` - Test Issue Fetching

Tests fetching issues from a specific repository.

**Usage:**
```bash
ts-node src/manual-tests/listIssues.ts <repo>
```

**Examples:**
```bash
# Using full name (owner/repo)
tsx src/manual-tests/listIssues.ts bazel-contrib/bazel-lib

# Using just repo name (assumes bazel-contrib org)
tsx src/manual-tests/listIssues.ts bazel-lib

# Or using the npm script
pnpm test:issues bazel-contrib/bazel-lib
```

**What it does:**
- Authenticates with GitHub App
- Looks up the specified repository
- Fetches all issues using the async generator (with pagination)
- Prints issue number, title, state, author, and updated timestamp
- Filters out pull requests automatically

**Expected output:**
```
Testing GitHub issue fetching...

🔐 Authenticating with GitHub App...
🔍 Looking up repository: bazel-lib...
✅ Found repository: bazel-contrib/bazel-lib

📋 Fetching issues for bazel-contrib/bazel-lib...

Batch 1 (page 1): 50 issues
  #123: Fix bug in dependency resolution
    State: open
    Author: alice
    Updated: 2024-01-15T10:30:00Z
    Labels: bug, high-priority
...

✅ Successfully fetched 150 issues across 3 batch(es)
✨ Test completed successfully!
```

### `listPullRequests.ts` - Test Pull Request Fetching

Tests fetching pull requests from a specific repository.

**Usage:**
```bash
tsx src/manual-tests/listPullRequests.ts <repo>
# or: pnpm test:prs <repo>
```

**Examples:**
```bash
# Using full name (owner/repo)
tsx src/manual-tests/listPullRequests.ts bazel-contrib/bazel-lib

# Using just repo name (assumes alexeagle org)
tsx src/manual-tests/listPullRequests.ts bazel-lib

# Or using the npm script
pnpm test:prs bazel-contrib/bazel-lib
```

**What it does:**
- Authenticates with GitHub App
- Looks up the specified repository
- Fetches all pull requests using the async generator (with pagination)
- Prints PR number, title, state, draft status, merge status, and metadata
- Tests detailed fetching: file stats and reviews for a few PRs
- Shows file statistics (additions, deletions, changed files)
- Shows review information (reviewer, state, submitted date)

**Expected output:**
```
Testing GitHub pull request fetching...

🔐 Authenticating with GitHub App...
🔍 Looking up repository: bazel-lib...
✅ Found repository: bazel-contrib/bazel-lib

📋 Fetching pull requests for bazel-contrib/bazel-lib...

Batch 1 (page 1): 25 pull requests
  #456: Add new feature
    State: open
    Draft: No
    Merged: No
    Author: bob
    Created: 2024-01-15T10:30:00Z
    Updated: 2024-01-16T14:20:00Z
    Labels: enhancement
    File stats: +150 -50 (12 files)

✅ Successfully fetched 25 pull requests across 1 batch(es)

🔍 Testing detailed PR fetching for 3 PR(s)...

Testing PR #456: Add new feature
  📊 File stats: +150 -50 (12 files)
  👥 Reviews (2):
    - alice: APPROVED (2024-01-16T12:00:00Z)
    - charlie: CHANGES_REQUESTED (2024-01-16T13:00:00Z)

✨ Test completed successfully!
```

## Common Failure Cases

### Missing Environment Variables

**Error:**
```
❌ Missing required environment variables:
   - APP_ID
   - PRIVATE_KEY
   - INSTALLATION_ID
```

**Solution:** Set all required environment variables before running the script.

### Invalid APP_ID or PRIVATE_KEY

**Error:**
```
❌ Authentication Error: Invalid APP_ID or PRIVATE_KEY
   - Check that APP_ID is a valid number
   - Check that PRIVATE_KEY is a valid PEM-formatted private key
```

**Common causes:**
- APP_ID is not a number
- PRIVATE_KEY is missing or malformed
- PRIVATE_KEY doesn't include the full PEM headers/footers
- PRIVATE_KEY has incorrect line breaks (should use `\n` in environment variable)

**Solution:**
- Verify APP_ID is numeric
- Ensure PRIVATE_KEY includes `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`
- If setting in a file, preserve the exact formatting including newlines

### Invalid INSTALLATION_ID

**Error:**
```
❌ Installation Error: Invalid INSTALLATION_ID
   - Check that INSTALLATION_ID matches your GitHub App installation
   - Verify the installation has access to the organization
```

**Common causes:**
- INSTALLATION_ID doesn't exist
- Installation doesn't have access to the target organization
- Installation was deleted or suspended

**Solution:**
- Verify the installation ID in your GitHub App settings
- Ensure the installation is installed on the target organization
- Check that the installation has the necessary permissions

### Organization Not Found or Not Accessible

**Error:**
```
❌ Organization Error: Organization not found or not accessible
   - Verify the organization name is correct
   - Ensure the GitHub App installation has access to this organization
```

**Common causes:**
- Organization name is misspelled
- GitHub App installation doesn't have access to the organization
- Organization is private and installation lacks permissions

**Solution:**
- Verify the organization name is correct
- Check GitHub App installation settings to ensure it's installed on the organization
- Verify the installation has `Read` access to repositories

### Repository Not Found

**Error:**
```
❌ Repository Error: Repository not found
   - Check the repository name is correct
   - Verify the repository exists and is accessible to the GitHub App
```

**Common causes:**
- Repository name is misspelled
- Repository doesn't exist in the organization
- Repository is private and installation lacks access
- Repository is in a different organization

**Solution:**
- Verify the repository name and organization
- Check that the repository exists and is accessible
- Ensure the GitHub App installation has access to the repository

### Rate Limit Exceeded

**Error:**
```
❌ Rate Limit Error: GitHub API rate limit exceeded
   - Wait a few minutes and try again
```

**Common causes:**
- Too many API requests in a short time
- Running tests multiple times quickly
- Other processes using the same GitHub App credentials

**Solution:**
- Wait a few minutes for the rate limit to reset
- Check rate limit status: the scripts will automatically wait if they hit a rate limit
- Consider using a different GitHub App for testing if needed

## Next Steps

Once these manual tests pass, you can:

1. **Integrate with the database layer** - The sync worker will use these same GitHub client functions
2. **Add more test cases** - Test edge cases, large datasets, error scenarios
3. **Performance testing** - Measure sync times for large organizations
4. **Incremental sync testing** - Test the `since` parameter for fetching only updated issues

## Troubleshooting Tips

1. **Check GitHub App settings**: Verify your App ID, installation ID, and permissions in the GitHub App settings page
2. **Verify private key format**: The private key must be in PEM format with proper headers
3. **Test with a small org first**: Start with an organization that has few repositories to verify everything works
4. **Check API rate limits**: GitHub Apps have higher rate limits (5000 requests/hour), but be mindful of usage
5. **Review error messages**: The scripts provide detailed error messages to help diagnose issues

## Notes

- These scripts only test the GitHub client layer, not the database sync functionality
- Pull requests are automatically filtered out (only issues are returned)
- The scripts use the same authentication and API client code that the sync worker will use
- All API calls include automatic retry logic and rate limit handling

