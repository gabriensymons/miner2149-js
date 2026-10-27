---
name: g-delegate-claude
description: Plan and coordinate work in Claude Code with Opus, delegating scoped tasks to Sonnet or Haiku subagents. Use when explicitly invoked for this delegation workflow.
---

# Claude Delegation

Invoking this skill authorizes the Agent tool for this task; Claude Code otherwise
leaves subagents alone unless asked for them. Use Opus for planning, architecture
decisions, coordination, integration, and final review. The user selects Opus in
the main chat's model picker; this skill does not switch the main chat's model.

## Choose workers

Delegation has two axes. `subagent_type` picks the worker's tools and instructions;
`model` picks its family.

| Agent type | Suitable work |
| --- | --- |
| `Explore` | Read-only fan-out search where only the conclusion is needed. |
| `Plan` | Design and implementation strategy for a scoped piece. |
| `general-purpose` | Multi-step work that reads, writes, and runs commands. |

| Model | Suitable work |
| --- | --- |
| `opus` | Demanding technical work a smaller model would get wrong. |
| `sonnet` | Most implementation, research, and review. |
| `haiku` | Small, clearly defined, repeatable tasks and wide cheap searches. |

`model` takes a family alias, not a version; the harness resolves which release
runs. Claude Code offers no way to pin a specific version, so do not promise one.
Omit `model` to inherit the main chat's.

Choose only the workers needed. Keep work in the main chat when delegation would
add more coordination than value: a worker starts cold and re-derives context that
is already here, so a task of a few tool calls is cheaper done directly. If a
requested model or agent type is unavailable, report the affected work and ask
before substituting. Continue independent work that does not depend on that choice.

## Subagent or session

A subagent does a piece of this task and reports back within the turn. Work that
outlives the turn and lands on its own — a branch, a PR, a change in another
repository — belongs in a session instead.

## Workflow

1. Inspect the relevant context and plan the smallest complete solution. Identify
   dependencies, completion criteria, and suitable tasks for delegation. Honor a
   request for planning only; otherwise carry the authorized task through execution.
2. Give each worker a clear outcome, necessary context, constraints, completion
   criteria, and ownership of files or deliverables. Use absolute filesystem paths
   for files and handoffs. Assign non-overlapping edits when workers run in parallel;
   sequence tasks that depend on each other.
3. Spawn each worker with its `subagent_type` and `model`, and give it a
   self-contained brief. `subagent_type: "fork"` inherits this conversation but
   ignores `model`, so forking and delegating to a smaller model are mutually
   exclusive. This skill does not ask for an `effort` override; leave it unset
   unless the user sets one.
4. Coordinate workers, resolve architecture questions, and integrate their results.
   Have workers report changed files or deliverables, verification evidence, and
   blockers. Review their work against the task's completion criteria. A worker's
   report is not shown to the user, so relay what matters.
5. Verify the integrated result with checks appropriate to the change. Report what
   was completed, which models handled delegated work, checks actually performed,
   and remaining gaps. Do not treat a worker's success report as proof that the
   integrated result works.

Workers run in the background and the harness reports when one finishes. Wait for
that notification; never predict or invent a worker's result.
