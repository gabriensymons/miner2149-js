---
name: g-handoff-project
description: Prepare a project handoff by saving session context and updating the decision log, roadmap, and existing operational tracker. Use when wrapping up work or handing a project to the next chat or collaborator.
---

# Handoff Project

Leave the project ready for the next session. Review and reconcile its decision log
and roadmap on every handoff, then save a concise continuation note. Make changes
supported by the session; a handoff does not require editing an unchanged document.

## Resolve the project and planning home

Read project instructions and follow the recorded planning home, including an
adjacent planning repo. Resolve relative paths from the file declaring them and read
the destination's instructions. Honor explicit user paths and existing filenames,
capitalization, and artifact roles. Do not create `roadmap.md` next to an existing
`ROADMAP.md` that already serves the same purpose.

If no home is recorded, reuse the established planning documents or session directory.
For a new project, `.agents/` is the default when its audience matches the content.
For private planning alongside public code, use an established private destination;
a hidden folder or `-plans` suffix does not establish privacy. Clarify only a material
unresolved location or audience choice. If a recorded home is unavailable, report it
instead of creating a fallback copy in the code repo. Do not guess a sibling by name.

## Workflow

1. Review the relevant conversation, current decision log, roadmap, active plans,
   existing master TODO or issue tracker, and prior handoff where useful. Check code
   Git state in the code checkout and planning Git state separately. Use observed
   work and verification evidence; do not rerun expensive checks solely for a summary.
2. Reconcile the **decision log**. In a new planning layout, use
   `<planning-home>/decision-log.md`. Append consequential decisions from the session
   with date, status, choice, rationale, alternatives/tradeoffs when discussed, and
   relevant links. Mark accepted only when evidenced; keep unresolved options open.
   Preserve earlier entries and link superseding decisions rather than rewriting
   history. If ADRs already own full records, use the existing log/index to link them
   instead of copying their rationale into a second canonical store.
3. Reconcile the **roadmap**. In a new planning layout, use
   `<planning-home>/roadmap.md`. Update affected outcomes, priorities, dependencies,
   and milestone status from the actual decisions and progress. Keep untouched work
   and the project's structure. Link decision-log entries and implementation plans
   where they explain a change. Record completion only with observed evidence; do
   not turn proposals into commitments or invent dates or percentages.
4. Update an **existing operational tracker** where this session changed status,
   blockers, or the exact next action. The roadmap owns broader direction; a master
   TODO or issue system owns the detailed queue. Do not create a new master TODO as
   a side effect, duplicate its task list into the roadmap, or mutate an external
   issue system without authorization. If external updates are needed but outside
   scope, record them as pending work in the handoff.
5. Save a **session handoff** in the established location, defaulting to
   `<planning-home>/sessions/YYYY-MM-DD-<topic>.md`. Capture what changed, verification
   evidence and limits, unresolved issues, working-tree state relevant to resuming,
   and the exact next action. Link the log, roadmap, tracker, and plans instead of
   reproducing them. Use the user's current date. Reuse a same-session note when
   updating it; preserve an unrelated same-day note with a distinct filename.
6. Check the edited documents for contradictions, broken relative links, duplicate
   entries, and unsupported claims. Report absolute paths, important updates, anything
   unchanged because no update was warranted, and the recommended next action.

Use [the document shapes](references/document-shapes.md) for new documents; preserve
existing conventions. Create a missing log or roadmap only when there is substantive
content to record. Repeating the same handoff should not duplicate decisions or
milestones. A session note is a dated snapshot, not a competing current status source.

## Boundaries

- Invoking this skill authorizes the relevant local handoff and planning-document
  updates. It does not authorize implementation, commits, pushes, publication,
  creating repositories or chats, or messaging a collaborator or another chat.
- Keep private details in the private planning home. If a public roadmap is the
  recorded target, update only audience-appropriate outcomes; do not copy private
  discussion, paths, or planning content into it. Do not synchronize public and
  private roadmaps merely because both exist.
- Do not rewrite `AGENTS.md` as a session log. Note a needed memory correction for
  follow-up unless updating durable memory is already part of the request.
- Preserve unrelated edits and historical rationale. If evidence is unavailable,
  state that limitation rather than claiming a check passed or work is complete.
