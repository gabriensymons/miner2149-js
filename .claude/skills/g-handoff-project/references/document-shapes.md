# New handoff documents

Adapt these shapes only when the project does not already have an established
format. Replace placeholders and omit empty sections. Paths resolve relative to
the document containing them.

## Decision log

Use `decision-log.md` at the planning home. If a log or ADR index already exists,
maintain it rather than adding a competing history. Append entries; give each a
stable heading or ID so roadmaps and handoffs can link to the exact decision.

```markdown
# Decision log

## YYYY-MM-DD — Decision title

**Status:** Accepted / Proposed / Superseded, as supported by evidence

**Decision:** What was chosen and its scope.

**Why:** Relevant constraints and the actual reason for the choice.

**Tradeoffs:** Material consequences or alternatives discussed.

**Related:** Links to an ADR, plan, or earlier decision this supersedes.
```

When an ADR owns the details, the log entry can be just the date, status, a concise
choice, and a link. Do not fabricate rationale to fill a template. An unresolved
question belongs in the handoff or a clearly marked proposed entry, not as accepted.

## Roadmap

Use `roadmap.md` at the planning home unless another roadmap is already canonical.
Keep broad outcomes and their ordering here; task-level progress belongs in the
existing operational tracker. A private planning roadmap and a public product roadmap
can have different audiences and roles. Follow the project's recorded distinction.

```markdown
# Roadmap

## Current

- Outcome being pursued — status, relevant dependency, and plan/tracker link.

## Next

- Prioritized outcome supported by the current direction.

## Later

- Deferred outcome, with any known condition for revisiting it.

## Completed

- Completed outcome with verification or release evidence.
```

Use only sections with content. Changing priority is a decision worth linking to
when the rationale matters. Preserve the project's own status vocabulary. Do not
infer delivery dates or readiness from the ordering alone.

## Session handoff

Use the established location, or `sessions/YYYY-MM-DD-<topic>.md` inside the planning
home. A handoff is written for someone who has not read the conversation.

```markdown
# Handoff — YYYY-MM-DD — Topic

## What changed

Concrete work and outcomes; include relevant branches and uncommitted work.

## Decisions and direction

Links to new/updated decisions and roadmap changes, with brief implications.

## Verification

Checks actually observed, their results, and any remaining validation gap.

## Open issues

Unresolved questions, blockers, dependencies, and required external updates.

## Continue here

Exact next action, code/planning locations needed to resume, and canonical links.
```

Keep sensitive paths or operational context out of public artifacts. A stale session
note never overrides the current roadmap, tracker, decision log, or project memory.
