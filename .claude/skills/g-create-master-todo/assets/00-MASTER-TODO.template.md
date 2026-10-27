title: "{{PROJECT_NAME}} Master TODO"
date: "{{CURRENT_DATE}}"
source: "{{AUTHORING_SOURCE}}"
status: active
owner: "{{OWNER}}"

# Master TODO — {{PROJECT_NAME}}

## Summary

This file is the {{AUDIENCE}} operational source of truth for {{PROJECT_NAME}} across sessions. It tracks current status, recommended order, dependencies, decisions, verification evidence, and the exact next action.

- Keep public product direction in the project's roadmap when one exists.
- Keep detailed execution designs in dedicated plan files.
- Keep current invariants and terminology in project memory; keep choices and rationale in decision records.
- Keep completed release history in the changelog when one exists.

**Last updated:** {{CURRENT_DATE}} ({{UPDATE_REASON}})

## Status legend

- `[ ]` not started
- `[~]` in progress or partially complete
- `[x]` completed and verified
- `[!]` blocked or intentionally waiting on a dependency
- `[-]` deferred, superseded, or outside the current scope

## Maintenance rules

1. Update this file when work starts, finishes, becomes blocked, changes scope, or yields a durable learning.
2. This file wins when operational status or recommended order differs from an older plan.
3. Close work only with concrete evidence such as tests, direct verification, deployment evidence, or a recorded decision.
4. Add durable discoveries to the append-only Learnings Log instead of burying them in transient handoffs.
5. Keep private operational details out of public planning artifacts.
6. Preserve the project's authorization rules for commits, pushes, releases, deployments, and destructive actions.

## Sources of truth

| Artifact | Audience | Purpose |
| --- | --- | --- |
| This master TODO | {{AUDIENCE}} | Current queue, status, dependencies, and exact next action |
| {{ROADMAP_ARTIFACT}} | Public or project-facing | Broad product direction and milestone outcomes |
| {{PLAN_ARTIFACT}} | Project team | Detailed implementation strategy |
| {{ARCHITECTURE_ARTIFACT}} | Project team | Durable architecture and technical decisions |
| {{DECISION_ARTIFACT}} | {{DECISION_AUDIENCE}} | Canonical choices, rationale, alternatives, and consequences |
| {{CHANGELOG_ARTIFACT}} | Project users | Completed release history |

## Current project snapshot

- **Project:** {{PROJECT_DESCRIPTION}}
- **Code root:** {{CODE_ROOT_RELATIVE_TO_THIS_FILE}}
- **Planning home:** {{PLANNING_HOME_RELATIVE_TO_THIS_FILE}}
- **Planning visibility:** {{VERIFIED_VISIBILITY_OR_UNKNOWN}}
- **Branch or release:** {{CURRENT_BRANCH_OR_RELEASE}}
- **Current milestone:** {{CURRENT_MILESTONE}}
- **Verification baseline:** {{VERIFICATION_BASELINE}}
- **Safety or delivery state:** {{SAFETY_OR_DELIVERY_STATE}}
- **Exact next action:** {{EXACT_NEXT_ACTION}}

## Recommended order

1. {{FIRST_PRIORITY}}
2. {{SECOND_PRIORITY}}
3. {{THIRD_PRIORITY}}

## Workstream checklist

### A. {{CURRENT_WORKSTREAM}}

- `[~]` {{CURRENT_WORK}}
- `[ ]` {{NEXT_TASK}}
- `[ ]` {{FOLLOWING_TASK}}

**Exit criterion:** {{CURRENT_EXIT_CRITERION}}

### B. {{NEXT_WORKSTREAM}}

- `[ ]` {{FUTURE_TASK}}

**Dependency:** {{DEPENDENCY}}

**Exit criterion:** {{NEXT_EXIT_CRITERION}}

## Decisions and open questions

### Decided

- {{STATUS_RELEVANT_DECISION_WITH_LINK_TO_CANONICAL_RECORD}}

### Open

- {{OPEN_QUESTION}}

## Learnings Log

- **{{CURRENT_DATE}} — {{LEARNING_TITLE}}.** {{DURABLE_LEARNING}}

## Tests

- {{VERIFICATION_EXPECTATION}}
- Run implementation checks in the code checkout; inspect the planning repository's Git state separately.
- Record results only after observing them.

## Assumptions

- {{MATERIAL_ASSUMPTION}}
