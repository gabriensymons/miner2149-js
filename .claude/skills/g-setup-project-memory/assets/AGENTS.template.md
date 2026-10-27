# AGENTS.md

Read this before changing anything. It records what must stay true, not what changed when —
git holds the history.

## What this is

{{ONE_PARAGRAPH: what the project does, for whom, and what stage it is at.}}

{{ONE_SENTENCE: what it deliberately is not — the scope boundary that stops well-meaning
expansion.}}

## The thesis you can break without failing a test

{{OPTIONAL BUT USUALLY THE MOST VALUABLE SECTION. The change that would keep every test
green while destroying what the project is for. Delete this heading only if the project
genuinely has no such thesis.}}

## Terminology

| Term | Meaning |
| --- | --- |
| **{{TERM}}** | {{What it means *here* — include every word an outsider would guess wrong.}} |

## Invariants

{{Each one: the rule, the reason, and where it is enforced. "Do not weaken this" without a
reason invites a well-meaning refactor. Drop this section rather than pad it.}}

1. **{{RULE}}** — {{why it holds, and what breaks without it}}. Enforced by {{constraint,
   module, or test}}.

## Stack

{{Frameworks, runtime, data layer, test runner — one line, not a dependency list.}}

```bash
{{INSTALL}}
{{RUN}}
{{TEST}}
```

{{Anything a fresh clone needs: runtime version, environment variables, seeded data,
external services — or an explicit "none".}}

## Conventions

{{Only decisions, not defaults. Path aliases, file layout, where particular logic belongs,
test placement. If it is the framework's default, leave it out.}}

## Working rules

{{How to work on this project: what to verify and how, what never to assume, which
categories must stay separate. Include permission boundaries — what must not be run, what
needs a human.}}

## Out of scope

{{What is deliberately excluded, and whether that is permanent or "not yet".}}

## Map of the documentation

| Path | What it is |
| --- | --- |
| `{{PATH}}` | {{What it owns, and when to read it.}} |

{{State which file wins where two could disagree. Delete this section entirely if
AGENTS.md is the only documentation.}}

## Planning layout

{{Include only when a planning workflow exists or was established by this request.
Record durable routing, not current tasks. Remove private paths and URLs from public
instructions; an optional external maintainer workflow must not block contributors.}}

- **Planning home:** {{PATH_RELATIVE_TO_THIS_FILE_OR_PUBLIC_SAFE_DESCRIPTION}}
- **Code root:** {{PATH_RELATIVE_TO_THIS_FILE_IF_THIS_IS_A_PLANNING_REPO}}
- **Operational status:** {{CANONICAL_TRACKER_OR_ISSUE_SYSTEM}}
- **Plans and ideas:** {{LOCATIONS_WITHIN_THE_PLANNING_HOME}}
- **Decision log:** {{CANONICAL_LOG_OR_ADR_INDEX_AND_AUDIENCE}}
- **Roadmap:** {{CANONICAL_ROADMAP_AND_AUDIENCE}}
- **Handoffs:** {{OPTIONAL_SESSION_SUMMARY_LOCATION}}
- **If the planning home is unavailable:** report the missing home; do not create a
  replacement tracker in the code repo. Contributor work should not require private access.

{{For paired repos, state that source edits and code checks belong in the code root,
and each repo's Git state is independent. Do not mirror private plans into public docs.
If g-handoff-project is used, record that it updates the log, roadmap, and existing
tracker before writing a dated continuation note; these artifacts have distinct roles.}}
