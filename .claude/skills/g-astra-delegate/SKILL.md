---
name: g-astra-delegate
description: Plan and coordinate work in Codex with Astra, delegating scoped tasks to Sol, Terra, or Luna subagents. Use when explicitly invoked for this delegation workflow.
---

# Astra Delegation

Use GPT-6 Astra for planning, architecture decisions, coordination, integration,
and final review. The user selects Astra in the main chat's model picker; this
skill does not switch the main chat's model.

## Choose workers

| Model | Suitable work |
| --- | --- |
| `gpt-6.1-sol` | Complex implementation and demanding technical work. |
| `gpt-6.1-terra` | Writing, visual tasks, and supported app interactions. |
| `gpt-6-luna` | Small, clearly defined, repeatable tasks. |

Choose only the workers needed; there is no requirement to use every model.
Keep work with Astra when delegation would add more coordination than value.
If a requested model or model-selection capability is unavailable, report the
affected work and ask before substituting a different model. Continue independent
work that does not depend on that choice.

## Workflow

1. Inspect the relevant context and plan the smallest complete solution. Identify
   dependencies, completion criteria, and suitable tasks for delegation. Honor a
   request for planning only; otherwise carry the authorized task through execution.
2. Give each worker a clear outcome, necessary context, constraints, completion
   criteria, and ownership of files or deliverables. Use absolute filesystem paths
   for files and handoffs. Assign non-overlapping edits when workers run in parallel;
   sequence tasks that depend on each other.
3. Select the worker's model explicitly when spawning it. If a model override
   requires a fresh context, provide a self-contained brief instead of forking the
   full conversation. Use subagents within the current task. Keep delegation within
   the user's authorized scope.
4. Coordinate workers, resolve architecture questions, and integrate their results.
   Have workers report changed files or deliverables, verification evidence, and
   blockers. Review their work against the task's completion criteria.
5. Verify the integrated result with checks appropriate to the change. Report what
   was completed, which models handled delegated work, checks actually performed,
   and remaining gaps. Do not treat a worker's success report as proof that the
   integrated result works.
