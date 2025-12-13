# Repo Maintenance Signals — Future Direction

This document captures the **signals we plan to use to answer “is this repo maintained?”**  
It is intentionally pragmatic: metrics must be **objective**, **cheap to compute**, and **derivable from GitHub data** we already have or can easily sync.

This is guidance for future work, not a commitment to implement everything at once.

---

## Principles

- Prefer **responsiveness** over raw activity
- Favor **maintainer actions** over community noise
- Metrics must be explainable in plain English
- Start simple; allow refinement later

---

## Core Maintenance Signals

### 1. Median maintainer response time
**Definition:**  
Median time from issue creation to first maintainer comment (over last 30/90 days).

**Why it matters:**  
Fast first response = actively maintained, even if fixes take time.

**AI prompt (short):**  
> Compute median time from issue.created_at to first comment by a maintainer per repo.

---

### 2. % of issues with maintainer response
**Definition:**  
Fraction of new issues that received *any* maintainer comment within N days.

**Why:**  
Silence is the strongest unmaintained signal.

**AI prompt:**  
> For issues opened in the last N days, compute percentage with ≥1 maintainer comment.

---

### 3. Stalled issue ratio
**Definition:**  
`stalled_issues / open_issues`, where stalled = waiting on maintainers beyond threshold.

**Why:**  
Directly measures neglected backlog.

**AI prompt:**  
> Count open issues where turn=maintainer and last_maintainer_action exceeds threshold.

---

### 4. Maintainer activity recency
**Definition:**  
Days since last maintainer action (issue comment, PR review).

**Why:**  
If no maintainer touched the repo recently, it’s likely dormant.

**AI prompt:**  
> Compute days since most recent maintainer action per repo.

---

### 5. PR review latency
**Definition:**  
Median time from PR open to first maintainer review.

**Why:**  
PRs represent higher investment than issues.

**AI prompt:**  
> Compute median time from PR.created_at to first maintainer review.

---

### 6. PR closure ratio
**Definition:**  
Percentage of PRs closed (merged or rejected) vs left open.

**Why:**  
Lingering PRs indicate poor maintainer engagement.

**AI prompt:**  
> For PRs opened in last N days, compute closed vs still-open ratio.

---

### 7. Active maintainer count (bus factor)
**Definition:**  
Number of distinct maintainers active in last 30/90 days.

**Why:**  
Single-maintainer repos are fragile; multiple indicates resilience.

**AI prompt:**  
> Count distinct maintainers with actions in last N days.

---

### 8. Release freshness
**Definition:**  
Days since last release or tag.

**Why:**  
Important signal for libraries and tooling.

**AI prompt:**  
> Compute days since latest GitHub release or tag per repo.

---

### 9. Issue churn
**Definition:**  
Issues opened vs issues closed in last N days.

**Why:**  
Growing backlog over time suggests neglect.

**AI prompt:**  
> Compare counts of issues opened vs closed over rolling window.

---

## Explicit Non-Goals (for now)

We intentionally exclude:
- Stars / forks (popularity ≠ maintenance)
- Raw commit counts (noisy, gameable)
- Comment volume (spam-prone)

---

## Intended Outcomes

These signals should enable:
- Sorting repos by “needs attention”
- Simple health badges (Healthy / At Risk / Neglected)
- Inputs to future AI-based triage or summaries

They are **decision-support signals**, not public rankings.

---

## Next Steps (when ready)

- Pick 2–3 signals to implement first
- Define default time windows (30 / 90 days)
- Decide on aggregation into a single “health score” or badge