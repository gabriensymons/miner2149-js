# Choose a planning home

Choose the home from the project's audience, existing workflow, and sharing needs.
A planning home is the directory that owns operational planning; the code root owns
source, contributor instructions, and documentation needed to use or develop the project.

## Options

| Layout | Fits when | Tradeoff |
| --- | --- | --- |
| Existing issue tracker or planning documents | A maintained system already owns status | Link it; do not add a master TODO without a distinct purpose. |
| Project-local `.agents/` | Planning can share the code repo's audience and lifecycle | Simple to discover; tracked files share the repository's visibility. |
| Adjacent `<project>-plans/` repository | Public code has private maintainer plans, or planning needs independent history/access | Requires a second checkout and explicit discovery instructions. |
| Private local directory | Notes are personal and need no shared/versioned planning history | Not available to collaborators or other machines automatically. |

Prefer an established home. For a new project with no conflicting convention,
`.agents/` is the simple default. Recommend an adjacent private repository when
public source and private planning need different audiences; do not prescribe one
for every public project. A public team may intentionally keep plans in public issues.

A folder name, leading dot, `.gitignore` rule, or lack of a remote does not establish
privacy. Determine the intended audience and inspect tracking/remote visibility when
relevant and available. If visibility is unknown, say so and keep sensitive content
out until the destination is established.

## Adjacent repositories

Illustrative layout using the user's project names:

```text
agent-almanac/                   code root, public project
  AGENTS.md                     contributor-safe memory and instructions
  CLAUDE.md                     imports AGENTS.md when Claude is used
  docs/                         public reference material, only if needed
agent-almanac-plans/             planning home, intended private repository
  AGENTS.md                     repo relationship and planning conventions
  CLAUDE.md                     imports this repo's AGENTS.md when needed
  decision-log.md               decisions and rationale, or links to canonical ADRs
  roadmap.md                    internal outcomes, priorities, and milestones
  00-MASTER-TODO.md              optional canonical operational tracker
  plans/                        implementation plans, when needed
  ideas/                        early proposals, when needed
  sessions/                     handoff snapshots for subsequent sessions
```

This is a recommendation, not a claim that either example repository has been
inspected or that the planning remote is private. Add folders when there is content
for them. Do not create a remote repository merely to implement this layout.

Record in the private planning home's instructions:

- Which code checkout it describes, using a path relative to that file.
- Which file/system owns status, plans, decisions, and public product direction.
- Where plans, ideas, the decision log, roadmap, and handoffs go within this home.
- Where code commands must run, and that each repo has independent Git state.
- What to do when the code checkout or planning home is unavailable.

Keep the code repo usable without private access. A public `AGENTS.md` may say that
maintainer planning is external and optional. Include a concrete sibling path or
private URL there only if it is appropriate to disclose. A local/private instruction
can supply the actual relationship when it should not appear publicly. Do not import
private planning contents into the public `AGENTS.md` or make contributor setup depend
on them.

Do not discover a planning home solely by guessing a sibling name. Follow a recorded
path or the user's instruction, inspect the destination's own instructions, and
resolve relative paths from the file that declared them. If the recorded home is
missing, report that instead of creating a fallback tracker in the code repo. Respect
workspace permissions and verify a worktree's code/planning relationship rather than
assuming that its adjacent directories match the main checkout.

## Artifact ownership

Memory records current invariants. The tracker owns task-level operational status
and order. The roadmap owns broader outcomes, priorities, and milestones; distinguish
an internal planning roadmap from a public product roadmap when both exist. Plans own
execution detail. The decision log owns choices and rationale, or indexes canonical
ADRs when that convention already exists. Session notes are dated handoff snapshots
that link to these sources.

`g-handoff-project` reviews the decision log and roadmap each run, updates them where
the session supplies meaningful changes, reconciles an existing tracker, and saves
the continuation note. Do not create another decision log, roadmap, or master TODO
when a maintained artifact already owns that role. New layouts use `decision-log.md`
and `roadmap.md` at the planning home; preserve existing names and formats.
