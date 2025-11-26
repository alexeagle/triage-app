# Triage App

Live at https://triage-app-sandy.vercel.app/

This document summarizes the motivation, requirements, design, and future direction of the Triage App. The goal is to give myself a quick mental refresh after stepping away from the project for a while, and to provide enough context to resume work without re-deriving everything.

---

## Motivation and Requirements

This app exists because I want a better way to work across multiple GitHub repositories than GitHub itself provides. My personal workflow involves juggling dozens of issues and pull requests across many repos, with varying levels of urgency, size, severity, ownership, and contributor behavior.

Key motivations:
- I want a fast, opinionated UI that highlights “the next most useful thing” to work on.
- I want to see repo health in a visually compressed, information-rich format.
- I want a system that understands contributor behavior (“useful engines”) and helps grow maintainers.
- I want all of this to operate off a local database cache to avoid API limits and latency.
- The app is primarily for my own use, so design choices favor my workflow over generality.

Core requirements:
- Sync all issues and PRs for an org into a Postgres (Neon) database.
- Support incremental sync without hitting rate limits.
- Authenticate users with GitHub OAuth.
- Display repos with basic activity metrics.
- Provide per-repo dashboards that surface maintenance tasks, stale work, and quick wins.
- Later: AI-assisted ranking, contributor modeling, repo visualizations, and deeper insights.

---

## Design and Tech Stack (Brief)

- Frontend: Next.js 14 (App Router), minimal UI to start.
- Auth: next-auth v4 with GitHub OAuth (separate OAuth App for prod and local).
- Database: Neon PostgreSQL, accessed via the serverless `@neondatabase/serverless` driver.
- Backend: Issues and PR sync workers (Node.js/TypeScript) authenticated via a GitHub App.
- Storage model: tables for repos, issues, pull_requests, sync_state, github_users, and review data.
- Deployment: Vercel (UI) + scheduled cron or GitHub Actions for sync jobs.
- Philosophy: simple server components for data rendering, client components only where needed.

This provides fast SSR, durable state, and predictable sync behavior with minimal dependencies.

---

## Maintenance and Operations (Very Short)

- Ensure Neon database stays below storage limits; prune closed PRs if necessary. Database is at https://console.neon.tech/app/projects/wandering-morning-49995035
- Redeploy on Vercel after changing env vars. App is at https://vercel.com/alex-eagles-projects-83025067/triage-app
- GitHub App for data operations: https://github.com/settings/apps/alex-s-issue-and-pr-triage
- GitHub App for oauth flow: https://github.com/settings/applications/3264800 
- Sync jobs run manually or on cron; restart worker if sync fails.
- Check GitHub App credentials annually (private keys can expire or be revoked).
- Add new repos to sync by installing the GitHub App into those org repositories.

---

## Future Directions (Detailed Exploration)

### 1. Repo Visualization and Health Signals
Build out the “maintenance treemap” visualization for each repo. The goal is a single image that encodes PR activity (size, staleness, reviewer blockage) on the left and issues (age, severity, ownership) on the right. This becomes the default landing page for each repo and helps quickly identify hotspots, neglected areas, and easy wins. Future extensions include interactive overlays, sparkline activity graphs, CI flakes, and ownership boundaries.

### 2. AI-Assisted Ranking and Recommendations
Introduce an AI model to rank issues and PRs based on the user’s desired work mode (“quick wins,” “bigger projects,” “review queue,” “cleanup tasks,” etc.). The heuristic model will handle coarse ranking, and the LLM reranker will refine the top N items. Later, integrate personal behavior patterns, contributor trust signals, cross-repo relationships, and semantic embeddings (e.g., “similar issues you’ve worked on before”). The goal is a personalized triage assistant.

### 3. Contributor Modeling (“Useful Engines”)
Track all GitHub users who interact with the org and classify them over time. Initially, identify maintainers from metadata files and permissions. Later, cluster users into patterns such as reliable contributors, rising maintainers, drive-by participants, helpers, ghosters, or noise generators. Use these models to decide who to mentor, who to engage more deeply, and who to deprioritize. Ultimately this should help develop and retain maintainers.

### 4. Repo Hygiene Automation
Surface tasks like unassigned issues, stale PRs, missing labels, PRs without reviews, dependency drifts, unused targets, or broken docs. Eventually automate suggestions or create one-click fixes (labeling, assigning, routing PRs to appropriate maintainers). Over time this leads to a “repo upkeep” panel for each repository.

### 5. Cross-Repo Dashboards
Enable dashboards spanning the entire org: recently updated work, PRs requiring attention, long-tail stale items, maintainer workload, and contributor pipelines. Provide daily or weekly digests summarizing the health of the ecosystem. Eventually let the system proactively identify risk trends (e.g., growing backlog in a repo, under-reviewed contributions, or noisy contributors).

### 6. Deep Integration With GitHub Reviews and CI
Pull in reviewer assignments, approval transitions, failing CI, and test flakiness. Use these signals to improve the triage suggestions and PR prioritization. In the long term, maintain a map of file ownership and risk patterns to spotlight high-leverage PRs and predict merge difficulty.

### 7. Productivity Tools for My Workflow
Add keyboard shortcuts, bulk triage operations, reminder systems, saved filters, rapid repo switching, and “work session mode” where the UI curates a sequence of tasks. Lean heavily on minimal UI, high information density, and fast page-load times.
