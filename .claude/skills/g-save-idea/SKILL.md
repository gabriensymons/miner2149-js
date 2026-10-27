---
name: g-save-idea
description: Save ideas as project-local Markdown with consistent naming and metadata. Use when asked to capture, park, archive, or persist brainstorms, concepts, or early proposals.
---

# Save Idea

Save an idea so either Codex or Claude Code can retrieve it later. Keep the content
in the project and resolve this skill's helper relative to the loaded `SKILL.md`.

## Workflow

1. Resolve the target project and idea content. Save the idea from the conversation,
   or draft it first when the user explicitly requests that. Do not treat an unrelated
   last response as an idea.
2. Read project instructions and any project-local `.claude/commands/save-idea.md`
   or matching project skill, if present and distinct from this shared skill.
   Preserve its domain guidance (for example, songwriting or story structure), destination, and explicit filename convention.
   Read those instructions directly; do not invoke the project command or this skill again.
3. Honor a user-specified destination, then the planning home recorded in project
   instructions. This may be an adjacent planning repo: resolve relative paths from
   the file that declares them, inspect that home's instructions, and pass its
   established ideas directory explicitly via `--out-dir` (usually `<planning-home>/ideas`).
   The helper does not read project instructions or discover sibling repositories.
   If no recorded home or other project convention exists, the helper prefers existing `.agents/ideas`, falls back to a single
   existing `.codex/ideas` or `.claude/ideas`, and defaults to `.agents/ideas` for
   a new project. When both legacy directories exist, resolve the location from
   project instructions or ask the user, then pass `--out-dir`.
4. Run `scripts/save_idea.py` from the target project root. Pass `--source codex`
   or `--source claude` for the current agent, and `--date` when the user's date
   differs from the host date.
5. Report the absolute path and whether the file was created or updated.

## Helper

Replace `/path/to/g-save-idea` with the directory containing this loaded skill:

```sh
python3 /path/to/g-save-idea/scripts/save_idea.py \
  --title "Example idea" --source claude --input /tmp/idea.md
```

Options:

- `--title`: Required; used for `YYYY-MM-DD-<slug>.md` by default.
- `--source`: Authorship metadata; defaults to `agent`.
- `--status`: Defaults to `idea`.
- `--owner`: Defaults to the current OS user.
- `--date`: `YYYY-MM-DD`; defaults to the host's local date.
- `--out-dir`: Explicit destination, overriding directory discovery.
- `--filename`: Explicit Markdown basename, for a user or project naming convention.
- `--stdin` or `--input`: Supply the body using exactly one method.
- `--force`: Replace an existing file only when the user requested that update.

The helper adds `title`, `date`, `source`, `status`, and `owner` metadata. Supply
only the body to avoid duplicating the header. Preserve provided content rather
than rewriting it to fit a template. When drafting, use
[the idea template](references/idea_template.md) where appropriate.

## Boundaries

- Saving an idea does not authorize implementation, committing, or publishing.
- Do not move existing documents, replace domain-specific project commands, or
  configure native Plan Mode storage as part of saving.
- Never overwrite an existing document unless the requested update warrants it.
- If a recorded planning home is unavailable, report it rather than creating a
  competing directory in the code repo. Do not guess a sibling by its name.
- For private material associated with public code, establish an appropriate private
  destination; hidden directories and a `-plans` suffix do not establish privacy.
- Do not use the skills repository as the destination for another project's documents.
