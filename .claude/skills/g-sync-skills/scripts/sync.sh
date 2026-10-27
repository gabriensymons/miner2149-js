#!/usr/bin/env bash
# Copy the committed skills from a local personal-agent-skills checkout into
# the .claude/skills of the git repository containing the current directory,
# so cloud sessions get them from the clone.
#
# Usage: sync.sh [--no-pull]
#   --no-pull  Copy the checkout's current HEAD without pulling first.
#
# Set PERSONAL_SKILLS_REPO to use a checkout somewhere other than the default.

set -euo pipefail

src_repo="${PERSONAL_SKILLS_REPO:-$HOME/code/gabriensymons/personal-agent-skills}"
pull=1

for arg in "$@"; do
  case "$arg" in
    --no-pull) pull=0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 64 ;;
  esac
done

if [ ! -d "$src_repo/.git" ]; then
  echo "No personal-agent-skills checkout at $src_repo." >&2
  echo "This sync runs on a machine with that checkout, not in a cloud session." >&2
  echo "Set PERSONAL_SKILLS_REPO if the checkout lives elsewhere." >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
dest="$repo_root/.claude/skills"
manifest="$dest/.personal-skills"

if [ "$(cd "$repo_root" && pwd -P)" = "$(cd "$src_repo" && pwd -P)" ]; then
  echo "Run this from the project to sync into, not from personal-agent-skills." >&2
  exit 64
fi

if [ "$pull" -eq 1 ]; then
  if ! git -C "$src_repo" rev-parse --verify --quiet '@{upstream}' > /dev/null; then
    echo "$src_repo is on a branch with no upstream; rerun with --no-pull." >&2
    exit 2
  fi
  echo "Pulling $src_repo ..."
  git -C "$src_repo" pull --ff-only --quiet
fi

sha="$(git -C "$src_repo" rev-parse --short HEAD)"
if [ -n "$(git -C "$src_repo" log --oneline '@{upstream}..HEAD' 2>/dev/null)" ]; then
  echo "Warning: $src_repo has commits that are not pushed; copying them anyway." >&2
fi

# Export only committed files, so local edits and .DS_Store never get vendored.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$src_repo" archive HEAD skills | tar -x -C "$tmp"

mkdir -p "$dest"
touch "$manifest"

is_managed() { grep -qx "$1" "$manifest"; }

new_list="$tmp/managed"
: > "$new_list"

for skill_dir in "$tmp"/skills/*/; do
  name="$(basename "$skill_dir")"
  [ -f "$skill_dir/SKILL.md" ] || continue

  if [ -e "$dest/$name" ] && ! is_managed "$name"; then
    echo "Skipped $name: .claude/skills/$name belongs to this repo, not the sync." >&2
    continue
  fi

  rm -rf "${dest:?}/$name"
  cp -R "$skill_dir" "$dest/$name"
  echo "$name" >> "$new_list"
done

# Remove skills this sync added earlier that no longer exist upstream.
while IFS= read -r name; do
  case "$name" in ''|'#'*) continue ;; esac
  if ! grep -qx "$name" "$new_list"; then
    rm -rf "${dest:?}/$name"
    echo "Removed $name: no longer in personal-agent-skills."
  fi
done < "$manifest"

{
  echo "# Managed by the g-sync-skills skill. Do not edit by hand."
  echo "# source: gabriensymons/personal-agent-skills@$sha"
  sort "$new_list"
} > "$manifest"

echo "Synced $(wc -l < "$new_list" | tr -d ' ') skills from personal-agent-skills@$sha."
git -C "$repo_root" status --short -- .claude/skills
