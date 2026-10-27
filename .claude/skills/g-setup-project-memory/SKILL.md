---
name: g-setup-project-memory
description: Set up or update durable project memory (AGENTS.md, wired into CLAUDE.md) and recommend where documentation and planning belong, including an adjacent planning repo. Use for creating or refreshing AGENTS.md or CLAUDE.md, project setup, or choosing a planning structure; use g-create-master-todo to maintain operational status.
---

# Setup Project Memory

Give a project a durable memory so agents stop re-learning it every session. Produce an
`AGENTS.md` that records what must stay true, and recommend both a documentation
structure and a planning home proportionate to the project. These are separate
choices: public code can keep contributor memory locally and private planning in
an adjacent repository.

The signal this is overdue: the same context has been explained to a third session, or the
same paragraphs have been written into a second handoff prompt.

## Which structure does this project need?

Three jobs get conflated under "documentation". Choose folders by job.

| Job | Holds | How it goes stale |
| --- | --- | --- |
| **Memory** | What is true about the system right now | Silently, and dangerously |
| **Reference** | Research, product thinking, decisions with rationale | Visibly, usually harmlessly |
| **Tracking** | Status, next action, open work | Constantly, by design |

Apply four tests before creating any folder.

1. **Is this what *is*, or what we *planned*?** Aspirational documents are fine as reference
   and poisonous as memory — an agent retrieving a superseded design will build it. Memory
   holds only current truth.
2. **Would a new engineer and a fresh agent want the same file?** If yes, one place. If no,
   two jobs are wearing one folder name.
3. **What does staleness cost?** Stale reference is mild confusion. Stale memory is an agent
   confidently doing the wrong thing, because memory is written to be trusted. Memory needs a
   maintenance story before it is created.
4. **Must context be retrieved, or can it be read?** This is the real threshold for a folder
   tree. Structure earns its keep when nobody reads all of it — separable subsystems, a
   monorepo. Below that, structure is overhead.

Recommend the smallest structure that passes:

```
AGENTS.md                        most projects, indefinitely
AGENTS.md + docs/                there is human material that is not "how it works"
AGENTS.md + lode/ (+ docs/)      AGENTS.md no longer fits in one screenful
```

Graduate when: the file references its own sections, subsystems need context irrelevant to
each other, or a single file has stopped being skimmable.

A `lode/` tree (`summary.md`, `terminology.md`, `practices.md`, `lode-map.md`, plus domain
folders) is current-state memory at scale. Pair it with `docs/` only when there are durable
human artefacts — decision records, research, spike write-ups — that an agent is not the
audience for.

Two guiding rules:

- **Prefer established conventions.** Reuse a working layout, while accounting for
  different audiences and privacy needs across projects.
- **Never maintain the same fact in two places.** One copy is wrong and nobody knows which.

## Where should planning live?

Read [planning layout guidance](references/planning-layout.md) when choosing or
changing the planning home. Compare the existing tracker, project-local `.agents/`,
an adjacent planning repository, and private local notes against the actual workflow.

For public projects with private maintainer planning, consider the paired layout
`<project>/` and `<project>-plans/`, as in `agent-almanac` and `agent-almanac-plans`.
Establish the planning destination's audience instead of assuming the sibling is
private. Keep public contributor instructions usable without private access.

Record the chosen home, the code/planning relationship, and artifact ownership in
appropriate project instructions. The choice should tell the saving and tracking
skills where to work; it should not require them to rediscover the layout each time.
Do not duplicate private planning contents into public memory.

## Workflow

1. Inspect before writing. Read the README, the source tree, tests, configuration, scripts,
   and existing documentation. Establish size: file count, source lines, subsystem count,
   project age. Recommendations follow evidence, not preference.
2. Identify what is **non-obvious from the code**: invariants, constraints enforced in one
   place that everything depends on, deliberate designs that look arbitrary, and scope
   boundaries. These are the point of the file. Anything an agent can read off the code in
   thirty seconds is filler.
3. Look for the thesis that can be broken without failing a test — the change that would keep
   every test green while destroying what the project is for. State it explicitly.
4. Interview the user for what inspection could not establish. See
   [Interview](#interview). Skip it when the code and existing memory already answer
   everything, or when the user asked for a recommendation only.
5. Recommend the memory/reference structure and the planning home using the shape
   below. This recommendation is not an extra approval gate when setup is already
   authorized; ask only when a material location or audience choice remains unresolved.
6. When `AGENTS.md` or `CLAUDE.md` already exists, preview the change before writing:
   a short list such as "Commands: test is now `bun test`". If nothing changed, say so
   and stop without rewriting the file.
7. Write or update `AGENTS.md` at the repository root. Update surgically; preserve
   project-specific content already there. Target **under 200 lines** — longer files consume
   more context and measurably reduce adherence.
8. Wire it up for Claude Code through `CLAUDE.md`. Preserve an existing file's
   instructions and add `@AGENTS.md` if appropriate. When no file exists and no
   Claude-specific content is needed, a `CLAUDE.md` symlink to `AGENTS.md` also works.
   Prefer the import on Windows, where symlinks need Administrator or Developer Mode.
   An older `CLAUDE.md` may hold project facts directly (stack, commands, conventions).
   Move those facts into `AGENTS.md` and leave `CLAUDE.md` with the import and any
   Claude-specific instructions, so each fact lives in one place.
9. Record the planning home and document ownership where future agents can discover
   them without exposing private details. In an adjacent planning repo, record the
   code checkout and run code verification there, not in the planning checkout.
   Initialize only artifacts warranted by the request; a recommendation alone does
   not require empty folders, a master TODO, or a new remote repository.
10. Report the absolute paths, what was created or updated, both layout choices, and
    any unresolved visibility or access limitation.

## Interview

Ask only what the code, configuration, and existing memory do not answer. A new or
nearly empty repository (for example, one just made with `g-setup-repo`) relies on the
interview; there, keep `AGENTS.md` short and mark unknowns instead of guessing.

1. If the user supplied a short project description with the request, use it to
   prefill or skip the first question.
2. Ask whether they want all questions at once or one at a time. All at once: one
   numbered list and one combined reply. One at a time: wait for each answer.
3. Choose from these questions, dropping any the inspection already settled:
   - What is the project, and what is it deliberately not?
   - What type of project is it (web app, API, CLI, library, mobile app, game, pipeline)?
   - Which languages, frameworks, and key libraries matter?
   - How do you build, run locally, test, and lint? (Only when scripts do not say.)
   - Which naming, style, or architecture conventions are decisions rather than defaults?
   - What else should an agent know: legacy areas, off-limits files, performance
     requirements, things that need a human? This one is optional.
4. When memory already exists, show the current value under each question and ask
   the user to reply only with what changed; a blank answer keeps the current value.

## Shape of the recommendation

A bare verdict is not useful. Argue against the options not taken — that is what makes the
answer trustworthy and what lets someone disagree with it. Produce four parts:

**The verdict:** the memory/reference structure and the planning home, with the
intended audience and whether each belongs in the code repo or elsewhere.

**Why not each alternative**, each with evidence from the inspection, not from taste:

> *Why not `lode/`:* 29 tracked files, ~1,900 source lines, one app, four days old. Context can
> be read, not retrieved. Structure earns its keep when nobody reads all of it — this is not
> that yet.
>
> *Why not `docs/`:* the README already states the product thesis and the scope boundary
> ("intentionally focuses on one workflow rather than accounts, workspaces, permissions"),
> which is the sentence that would otherwise justify the folder. No research, decision log,
> or product brief exists separately from the code.

Cite inspected evidence. For planning, weigh visibility, existing artifacts, and
collaboration needs; file counts alone do not choose the planning home.

**What is actually missing** — the specific things that would keep being re-explained, named
concretely. This is the strongest part of the answer, because it shows the recommendation came
from reading the project rather than from a rule. Three to five items, each one sentence on why
it is non-obvious from the code.

**When to revisit** — the concrete trigger that would change the verdict, so the decision has
an expiry rather than being permanent by default.

## What belongs in AGENTS.md

- What the project is, in two or three sentences, including what it deliberately is not.
- **Terminology** — domain words with specific meanings here. Name every term an outsider
  would guess wrong.
- **Invariants**, each with its reason. "Do not weaken this" without a reason invites a
  well-meaning refactor.
- Where an invariant is enforced — a database constraint, a single module, a test — so it is
  clear what guards it.
- Conventions that are decisions rather than defaults: layout rules, naming, path aliases,
  test placement.
- Commands to run, test, and verify.
- What is out of scope, and whether that is permanent or "not yet".
- A map of other documentation and the planning home, stating which file wins on
  each subject. Include only paths and details appropriate for the file's audience.
- Constraints on the agent itself: permission boundaries, what must not be run, what needs a
  human.

## What does not belong

- **A changelog.** Git holds history. A memory file that says "on Tuesday we added X"
  decays into a worse changelog.
- **Status, progress, or next actions.** That is tracking; see below.
- Anything restating the code without adding constraint or reason.
- Aspirational architecture. If it is not built, label it clearly or leave it in reference.
- Credentials, tokens, private transcripts.
- Family members, colleagues, or other individuals by name unless the project genuinely
  requires it.

## Related skills

Use **`g-create-master-todo`** alongside this, not instead of it. They cover different jobs and
each keeps the other clean:

| | `AGENTS.md` | `00-MASTER-TODO.md` |
| --- | --- | --- |
| Job | Memory | Tracking |
| Answers | "What must stay true?" | "What is the state, and what is next?" |
| Changes | Rarely, when the system changes | Constantly, by design |
| Read | At the start of any work | When picking up or handing off |

The failure this prevents is specific: without somewhere for status to live, it leaks into
`AGENTS.md` — "currently working on", "next up" — and the memory file rots into the changelog
it was never supposed to be. Give status its own home and memory stays durable.

This skill chooses and records the layout. `g-create-master-todo` maintains a tracker
inside that layout when requested. `g-save-plan` and `g-save-idea` follow the same home.
`g-handoff-project` maintains the decision log and roadmap, reconciles existing
operational status, and saves session context there. Record the canonical log and
roadmap locations alongside the planning home so handoffs use the right documents.
When both memory and tracking are needed, establish
the terminology and layout first, then create or update the tracker in its home.

## Safety and boundaries

- Inspect the actual project. Never write an `AGENTS.md` from a README paraphrase or from
  assumptions about the stack — a confidently wrong memory file is worse than none.
- Do not invent invariants. If a constraint is believed but unverified, say so or leave it
  out.
- Do not create a second file that duplicates existing documentation. Reconcile or link, and
  declare which file wins.
- Do not stage, commit, or push unless separately authorized.
- Do not create a remote planning repo or migrate existing planning artifacts unless
  requested. Do not change either repository merely because it is used as an example.
- Keep it proportionate. A 2,000-line project does not need a 300-line memory file.
- Verify the wiring rather than assuming it. After writing, confirm `CLAUDE.md` resolves to
  the content — in Claude Code, `/context` lists what actually loaded under **Memory files**.
