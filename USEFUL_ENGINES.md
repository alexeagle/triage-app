# Useful Engines Feature (Early Design Notes)

This document summarizes the early design direction for the **Useful Engines** feature. The goal is to identify and nurture contributors who show signs of becoming strong maintainers, while also distinguishing between different participation patterns across the project ecosystem.

Inspired by Sir Topham Hatt’s phrase *“really useful engines,”* the intention is **community growth**, not exclusion or ranking for its own sake.

---

## Purpose

GitHub repositories attract many types of participants:

- Drive-by contributors  
- Helpful reviewers  
- People opening issues with or without follow-up  
- Long-term maintainers  
- Bots  
- Users who mostly ask for help and disappear  
- Contributors whose PRs routinely get merged  
- Contributors who help others in issues and PRs  
- Users who ghost after submitting work  
- Users who generate noisy or low-value issues  

The Useful Engines system aims to model these behaviors in a structured, data-driven way. The primary goal is:

### **Identify and grow emerging maintainers — not gatekeep.**

By understanding user behavior over time, we can:
- Proactively engage contributors showing promise  
- Detect maintainers hidden in the noise  
- Direct mentorship where it has the highest return  
- Reduce maintainer fatigue by recognizing “time sink” patterns  
- Improve triage by seeing the relationship context of each participant  

---

## Current Implemented Foundation

A new **github_users** table is now part of the database schema. It stores every GitHub handle observed across issues, pull requests, reviews, and assignees.

**Captured fields:**
- github_id  
- login  
- avatar_url  
- name  
- type (User or Bot)  
- first_seen  
- last_seen  
- is_maintainer (boolean)  
- maintainer_sources (JSON array of strings)

Examples of maintainer sources:
- `"github-app"`  
- `"bcr-metadata"`  
- `"manual"`  

### How data enters this table
The issue and PR sync workers now call `upsertGitHubUser()` for:
- Issue authors  
- Issue assignees  
- PR authors  
- PR assignees  
- PR reviewers  

This gives a growing inventory of all GitHub users who interact with your repos.

At this stage:
- No classification is done  
- No “usefulness score” is computed  
- We are just collecting raw participation data  

---

## Intended Future Inputs for Classification

The following signals are planned for future phases of the feature. They will feed into a “usefulness model” that eventually becomes an AI-assisted contributor-engagement tool.

### Behavioral Activity Signals
- Number of issues authored  
- Number of PRs authored  
- Review response time  
- PR iteration quality (how quickly they address feedback)  
- Number of merged PRs  
- Number of abandoned or stale PRs  
- Number of times their work unblocks others  
- Cross-repo participation  
- Commenting patterns (helpful vs. noise)  

### Social / Maintainer Signals
- Appears as maintainer in `.bcr/metadata.json`  
- Has GitHub write or triage permission  
- Frequently requested as a reviewer  
- Provides solutions in issues and PRs  
- Recognized by other maintainers as dependable  
- Consistently active over long periods  

### Risk / Non-Helpful Patterns (to detect, not punish)
- Opens large numbers of issues with no follow-up  
- Opens PRs that stall repeatedly  
- Appears primarily to ask for support rather than contribute  
- Creates noisy discussions with little actionable value  

These signals will be combined into higher-level categories such as:
- “Emerging maintainer”  
- “Reliable contributor”  
- “Community helper”  
- “Drive-by contributor”  
- “Support-seeker”  
- “Ghoster”  
- “Smelter’s Yard” (low-value participation)  

---

## Long-Term Goal

The Useful Engines feature is ultimately about:
- **Recognizing promising contributors early**
- **Giving them opportunities to grow**
- **Encouraging more maintainers across your org**
- **Helping you direct attention where it matters most**

The system is intentionally descriptive rather than judgmental — it’s a tool for project health and community development.

---

## Next Steps

1. Identify maintainers from `.bcr/metadata.json`  
2. Identify maintainers via GitHub permission APIs  
3. Add AI-assisted behavior classification  
4. Provide per-user visualizations (timeline, heatmap, contribution spikes)  
5. Add dashboard widgets (e.g., “Rising Contributors this month”)  
6. Add actions: “Nominate as Maintainer”, “Assign Mentorship”, “Watch Contributor”  
7. Integrate into repo pages for context-sensitive triage  
8. Build notifications or weekly digest of contributor insights  
