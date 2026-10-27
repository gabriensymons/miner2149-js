---
name: g-sync-skills
description: Pull the latest skills from Gabrien's local personal-agent-skills checkout and copy them into the current repo's .claude/skills, so cloud sessions on that repo can use them. Use when asked to sync, vendor, update, or refresh personal skills in a project. Works only on a machine with that checkout, not in a cloud session.
---

# Sync Skills

Cloud sessions load skills committed to a repo's `.claude/skills/`, but they cannot
read `~/.claude/skills` or the private `personal-agent-skills` repo. This skill
copies the personal skills into a project so the next cloud session gets them from
the clone. Run it once to add the skills to a new project, and again whenever the
skills change.

## Workflow

1. From the target project's root, run the script that sits next to this loaded
   skill. Inside a project that already has the synced copy, that is:

   ```sh
   bash .claude/skills/g-sync-skills/scripts/sync.sh
   ```

   The first time, run it from the user-level copy instead, for example
   `bash ~/.claude/skills/g-sync-skills/scripts/sync.sh`.

   It runs `git pull --ff-only` in `~/code/gabriensymons/personal-agent-skills`,
   then copies that checkout's committed `skills/` folders. Pass `--no-pull` to copy
   the checkout as it is, which is required while it is on a branch with no
   upstream. Set `PERSONAL_SKILLS_REPO` if the checkout lives elsewhere.
2. If the script says there is no checkout, stop and tell the user the sync only
   runs locally. Do not try to fetch the repo from GitHub instead.
3. Report the synced commit and the changed paths it prints, including any skill it
   skipped or removed.
4. Do not commit or push unless the user asks. Cloud sessions see the update only
   after it is committed and pushed to the branch they start from, usually `main`.

## What the script manages

- `.claude/skills/.personal-skills` lists the skills the sync owns and the source
  commit. Only those folders are replaced or deleted.
- A skill removed or renamed upstream is removed from the project on the next sync.
- A folder that already exists in the project but is not in that list belongs to
  the project. The sync skips it and warns instead of overwriting it.
- Only committed files are copied, so uncommitted edits in the skills repo do not
  leak in. The script warns when the copied commit is not pushed yet.

Edit the skills in `personal-agent-skills`, not in a project; project copies are
overwritten by the next sync.
