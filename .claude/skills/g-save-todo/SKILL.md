---
name: g-save-todo
description: Save a todo list or checklist as project-local Markdown with consistent naming and metadata. Use when asked to save, capture, or persist a task list or checklist; use g-create-master-todo for the project-wide operational tracker.
---

# Save Todo

Save a checklist so either Codex or Claude Code can pick it up later. Keep the
content in the project and resolve this skill's helper relative to the loaded `SKILL.md`.

This is for a focused list: the steps of one task, an onboarding checklist, the
follow-ups from a review. The project's overall status and next action belong in
`00-MASTER-TODO.md`, which `g-create-master-todo` maintains.

## Workflow

1. Resolve the target project and the list. Save the list from the conversation, or
   draft it first when the user gives an instruction such as "list the steps to
   onboard a backend engineer". Do not treat an unrelated last response as a list.
2. Read project instructions and any project-local `.claude/commands/save-todo.md`
   or matching project skill, if present and distinct from this shared skill.
   Preserve its template, destination, and filename convention. Read those
   instructions directly; do not invoke the project command or this skill again.
3. Honor a user-specified destination, then the planning home recorded in project
   instructions, passing its todo directory via `--out-dir` (usually
   `<planning-home>/todo`). If no recorded home or other convention exists, the helper
   prefers existing `.agents/todo`, falls back to a single existing `.codex/todo` or
   `.claude/todo`, and defaults to `.agents/todo` for a new project. When both legacy
   directories exist, resolve the location from project instructions or ask the user,
   then pass `--out-dir`.
4. Run `scripts/save_todo.py` from the target project root. Pass `--source codex`
   or `--source claude` for the current agent, and `--date` when the user's date
   differs from the host date.
5. Report the absolute path and whether the file was created or updated.

## Helper

Replace `/path/to/g-save-todo` with the directory containing this loaded skill:

```sh
python3 /path/to/g-save-todo/scripts/save_todo.py \
  --title "Refactor auth" --source claude --input /tmp/todo.md
```

Options:

- `--title`: Required; used for `YYYY-MM-DD-<slug>.md` by default.
- `--source`: Authorship metadata; defaults to `agent`.
- `--status`: Defaults to `open`; use `done` when every item is complete.
- `--owner`: Defaults to the current OS user.
- `--date`: `YYYY-MM-DD`; defaults to the host's local date.
- `--out-dir`: Explicit destination, overriding directory discovery.
- `--filename`: Explicit Markdown basename, for a user or project naming convention.
- `--stdin` or `--input`: Supply the body using exactly one method.
- `--force`: Replace an existing file only when the user requested that update.

The helper adds `title`, `date`, `source`, `status`, and `owner` metadata. Supply
only the body. When drafting, use [the todo template](references/todo_template.md).

## Boundaries

- Saving a list does not authorize doing the work, committing, or publishing.
- Never overwrite an existing list unless the requested update warrants it; to tick
  items off, edit the saved file in place.
- If a recorded planning home is unavailable, report it rather than creating a
  competing directory in the code repo.
- Do not use the skills repository as the destination for another project's lists.
