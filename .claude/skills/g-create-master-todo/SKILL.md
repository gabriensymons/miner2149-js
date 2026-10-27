---
name: g-create-master-todo
description: Create or update 00-MASTER-TODO.md in a project's established planning home, including an adjacent planning repo. Use for master TODOs and cross-session operational tracking, not planning-layout design, public roadmaps, or ordinary task lists (use g-save-todo for those).
---

# Create Master TODO

Create or maintain a project-level `00-MASTER-TODO.md` that another session can use to understand the project's real status and exact next action.

`g-setup-project-memory` recommends and records the planning layout. This skill works
within that layout. The tracker belongs to the project, but need not live in its
code repository.

For a routine session wrap-up, `g-handoff-project` coordinates the decision log,
roadmap, existing tracker, and continuation note. This skill remains focused on
creating or maintaining the operational tracker itself.

## Workflow

1. Resolve both the code root and planning home. Honor an explicit destination;
   otherwise read project instructions and use the recorded home or existing canonical
   tracker. Resolve relative paths from the file declaring them. For an adjacent
   planning repo, inspect its own instructions and confirm which code checkout it covers.
2. Inspect the existing master TODO, README, roadmap, active plans, decision records,
   durable architecture notes, and relevant verification evidence. Inspect code Git
   state in the code checkout, and planning Git state separately. Do not infer project
   completion from a planning commit or a stale plan.
3. If `00-MASTER-TODO.md` already exists, update it surgically. Preserve durable decisions and the append-only learnings log. Do not replace it wholesale unless the user explicitly requests that.
4. For a new tracker, read and adapt [the template](assets/00-MASTER-TODO.template.md). Remove irrelevant sections and replace every template token with project-specific content.
5. Distinguish sources of truth explicitly. The master TODO owns task-level status
   and recommended order; the roadmap owns broader outcomes and milestones; plans
   own execution detail; the decision log or canonical ADRs own choices and rationale;
   project memory owns current invariants; a changelog owns completed release history.
   Preserve any established distinction between private planning and a public roadmap.
6. Report the absolute output path, whether the file was created or updated, the current next action, and any important uncertainty.

## When the planning home is unclear

- Preserve an existing canonical tracker even if its location differs from a new
  convention. A local layout might use `.agents/00-MASTER-TODO.md`; an adjacent
  planning repo might use `00-MASTER-TODO.md` at its root.
- If a recorded planning home is unavailable, report that instead of creating a
  competing tracker in the code checkout. Do not guess a sibling from its name.
- If no layout exists, use the `g-setup-project-memory` approach to recommend one.
  A request for a tracker does not itself authorize rewriting project memory or
  creating a remote planning repository. For a simple project, `.agents/` is the
  default when the tracker's audience matches the repo; private planning for public
  code needs an appropriate private home. Clarify only an unresolved material choice.
- If an issue tracker already owns operational status, use this document only for
  a distinct requested overview, with links and explicit ownership. Avoid a parallel
  queue that must be kept in sync manually.

## Content requirements

- State the audience and whether the file is private, public, tracked, or outside the repository.
- Record the code root and planning home using portable paths where possible. In a
  private adjacent repo, make it clear where implementation and verification run.
- Include a compact status legend and maintenance rules.
- Capture a current project snapshot using only inspected evidence.
- Put the exact recommended order before the detailed workstreams.
- Organize work into milestone or workstream checklists with dependencies and exit criteria where useful.
- Separate settled decisions from open questions.
- Link canonical decision records for rationale. Include only the status-relevant
  consequence here; the master TODO is not a second decision log.
- Keep a dated, append-only learnings log for discoveries that should survive chat handoffs.
- When a learning becomes a durable invariant, update or link the relevant memory
  through authorized work; keep historical learning entries as evidence, not current policy.
- Record verification evidence precisely. Never claim a test, build, deployment, or live check passed unless the evidence was actually observed.
- End with project-specific verification expectations and assumptions when they materially affect future work.

## Safety and boundaries

- Do not create a competing tracker. Reconcile or link existing planning artifacts and declare which one wins for status.
- Do not create or change a public `ROADMAP.md` unless the user also requests it.
- Do not stage, commit, push, publish, or mutate external task systems unless separately authorized.
- Never include credentials, tokens, raw private transcripts, or sensitive logs.
- Include absolute local paths or account-specific details only when operationally useful and the destination is private. Never place them in a public repository.
- A hidden directory is not a privacy boundary. Do not assume a `-plans` repo is
  private or publish its contents back into the code repo.
- Keep future work outcome-oriented. Avoid invented dates, unsupported commitments, and speculative completion percentages.
