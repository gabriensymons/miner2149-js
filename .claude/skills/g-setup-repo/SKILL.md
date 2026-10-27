---
name: g-setup-repo
description: Create a new personal project repository on GitHub with agent scaffolding and a domain-tailored /save-idea command, then hand off to g-setup-project-memory. Use only when the user asks to create, start, or bootstrap a new repo, or to add the same scaffolding to an existing one.
---

# Setup Repo

Create a repository under `~/code/gabriensymons/`, publish it as
`gabriensymons/<repo-name>` on GitHub, and add the small amount of scaffolding the
other personal skills expect. Project memory (`AGENTS.md`, `CLAUDE.md`) and the
planning layout belong to `g-setup-project-memory`; this skill hands off to it.

## Arguments

- **repo-name** (required): kebab-case, for example `poems`, `recipes`, `board-games`.
- **description** (optional): one sentence about the project. Pass it on to
  `g-setup-project-memory` so its interview can skip the first question.

## Confirm first

Creating a GitHub repository is visible outside this machine. Before running any
command, confirm in one message:

- the local path, `~/code/gabriensymons/<repo-name>`
- the GitHub repository, `gabriensymons/<repo-name>`
- the visibility: ask **private or public**, and do not assume either

If the path already exists, stop and ask whether to add scaffolding to that
existing repository instead (see [Existing repositories](#existing-repositories)).

## Workflow

1. Create the directory and a `README.md` containing `# <repo-name>`, plus the
   description when given. Run `git init -b main`, add the README, and commit with
   the message `first commit`.
2. Create the GitHub repository and push, using `gh` from `PATH`:

   ```sh
   gh repo create gabriensymons/<repo-name> --private --source=. --remote=origin --push
   ```

   Use `--public` instead when the user chose public. If `gh` is missing or not
   signed in, stop and tell the user to run `gh auth login`.
3. Write `.claude/settings.json` so Claude can maintain planning documents without
   a prompt for each edit. Merge into an existing file instead of replacing it.

   ```json
   {
     "permissions": {
       "allow": ["Edit(/.agents/**)"]
     }
   }
   ```

   The leading `/` anchors the rule at the project root. `Edit` rules also cover
   new files, and reads inside the project are allowed by default.
4. Tailor `/save-idea` to the repository's domain (see below) and write it to
   `.claude/commands/save-idea.md`.
5. Commit the scaffolding with the message
   `Add agent settings and a tailored save-idea command` and push it.
6. Offer to run `g-setup-project-memory` now. It interviews the user, writes
   `AGENTS.md`, wires `CLAUDE.md`, and records the planning home. Pass along the
   description if one was given.
7. Report the local path, the GitHub URL, its visibility, and what was committed.

Do not create empty planning folders. The saving skills create `.agents/ideas`,
`.agents/plans`, and similar folders the first time they write to them.

## Tailor /save-idea

`g-save-idea` handles the location, filename, and metadata of every saved idea. A
project's `/save-idea` command adds only domain guidance, which `g-save-idea` reads.

1. Guess the domain from the repo name and description, as specifically as
   possible: `poems` is poetry (form, meter, imagery, theme); `recipes` is cooking
   (ingredients, cuisine, dietary needs, technique); `board-games` is tabletop
   design (mechanics, player count, theme, components).
2. Present the guess and the facets you would include, one line each, and ask the
   user to confirm, add, or remove items. Wait for the answer.
3. Write the command from [the template](references/save-idea.template.md). Replace
   every `<...>` token and keep only facets the user confirmed.

## Existing repositories

When the user wants the scaffolding in a repository that already exists, skip
steps 1 and 2. Add only what is missing in steps 3 and 4, and preserve an existing
`/save-idea` command unless the user asks to replace it. Do not commit or push
unless the user asks, then continue from step 6.

## Boundaries

- Never create, rename, or change the visibility of a GitHub repository without
  the confirmation above.
- Use `gabriensymons` as the GitHub owner and `~/code/gabriensymons/` as the parent
  directory unless the user names others.
- Do not write `AGENTS.md` or project facts into `CLAUDE.md` here; that is
  `g-setup-project-memory`'s job.
