# Design: “What should I work on next?”

## Goal

Given a logged-in user, surface **one actionable issue(s) or PR(s)** that is the *best use of their time right now*.

This feature should:
- Reduce cognitive load (“just tell me what to do next”)
- Be explainable (no black-box magic)
- Improve as more signals become available
- Work **without AI**, but optionally benefit from it

This is a **decision-support tool**, not an autonomous agent.

---

## Scope (v1)

- Choose **one primary recommendation**
- From issues and PRs the user can reasonably act on
- Optimized for *maintainers / frequent contributors*
- Public repos only

---

## Eligibility Filter (hard constraints)

Before ranking, filter candidates to things the user *could* act on.

An issue/PR is eligible if **all** are true:

1. **Repo relevance**
   - User is a maintainer of the repo

2. **Open state**
   - Issue.state = open OR PR.state = open
   - Exclude draft PRs

3. **Actionability**
   - `turn = 'maintainer'` OR
   - Assigned to the user OR
   - PR has a pending review requested from the user (future)

4. **Not blocked**
   - Not explicitly waiting on author
   - Not labeled `blocked` / `needs-info` (if present)

This produces a **candidate set** that is already high-signal.

---

## Ranking Criteria (scored, weighted)

Each candidate gets a score composed of multiple signals.
Weights are tunable and intentionally simple.

### 1. Stalled severity (highest weight)
**Why:** Neglect compounds.

- Waiting on maintainer
- Stall duration (days overdue)
- Repo-level stall ratio (systemic pain)

> Strongly bias toward stalled work, but don’t *only* show stalled work.

---

### 2. User proximity
**Why:** People should work where they have context.

Signals:
- Assigned to user
- User previously commented
- User reviewed PR before
- Repo is starred (baseline)

---

### 3. Repo health pressure
**Why:** Some repos need attention more urgently.

Signals:
- High stalled issue ratio
- Poor maintainer response metrics
- Overdue relative to typical release cadence

This is how repo-level health informs item-level priority.

---

### 4. Item freshness / momentum
**Why:** Active threads are easier to finish.

Signals:
- Recent activity (but not noise)
- PR with recent CI pass
- Issue with recent author reply

Avoid resurrecting truly dead threads unless stalled + important.

---

### 5. Impact proxies (cheap heuristics)
**Why:** We don’t have full business context.

Signals:
- 👍 reactions (if present)
- Priority labels (`p0`, `high`)
- Number of affected users (future NLP)

Low weight, but useful tie-breakers.

---

## Output Shape

The system returns:

```json
{
  "kind": "issue" | "pr",
  "repo": "owner/name",
  "number": 123,
  "title": "...",
  "why_this": [
    "Stalled for 18 days waiting on maintainers",
    "You commented previously",
    "High stalled ratio in this repo"
  ],
  "confidence": "high" | "medium"
}