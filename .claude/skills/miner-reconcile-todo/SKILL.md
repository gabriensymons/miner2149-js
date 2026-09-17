---
name: miner-reconcile-todo
description: Audit the Miner2149 master TODO against the code and tests, closing items that shipped and marking partial ones with the half that remains. Use when the tracker's status is suspect, before planning a work session, or when asked what to do next and the answer is not trustworthy. Do not use to add new tasks or to write plans.
---

# Reconcile the Miner2149 master TODO

The tracker decays in one direction: work ships and the checkbox stays open.
A pass on 2026-09-17 found **60+ items** marked not-started that had been done
for weeks, and a "Recommended implementation order" whose first line was *"push
the preview — this is the next thing to do"* five weeks after the site went live.
Nothing was ever marked done that was not. That asymmetry is the thing to expect.

This is an **evidence-gathering** task, not a judgement task. Close an item only
when you can name the module, test, commit or decision that closes it.

## Files

| | |
|---|---|
| Tracker | `/Users/gabriensymons/Documents/Gabrien/Projects/Video Games/Miner2149/plans/00-MASTER-TODO.md` |
| Archive | `01-ARCHIVE.md` in that folder — append-only; decisions and learnings live here |
| Repo | `/Users/gabriensymons/code/gabriensymons/miner2149-js` |
| Invariants | `AGENTS.md` in the repo — wins over the tracker on what must stay true |

The tracker wins on **status**. `AGENTS.md` wins on **invariants**. The archive
is never edited, only appended.

## Status legend

`[ ]` not started · `[~]` partial · `[x]` done and verified · `[!]` blocked ·
`[-]` deferred or superseded

## Procedure

### 1. Build the evidence base before reading the tracker

Read the evidence first. Reading the tracker first anchors you to its claims.

```bash
export PATH=/opt/homebrew/opt/node@20/bin:$PATH
npm test 2>&1 | grep -E "^# (tests|pass|fail)"
for f in test/*.test.js; do echo "--- $f"; grep -oh "^test('[^']*'" "$f" | sed "s/test('//;s/'$//"; done
grep -h "^test(" test/browser/*.spec.js | sed "s/^test('//;s/'.*//"
ls scripts/ scripts/dev/ test/browser/
git log --oneline -40
wc -l scripts/app.js
```

Test names are the strongest evidence in this project — they are written as
claims about behaviour, so a test name usually *is* the closing citation.

### 2. Sweep the open items

```bash
awk '/^## [A-Z]\./ {sec=$0} /^#{3} [A-Z0-9]+\./ {sec=$0} /- `\[ \]`/ {print NR": "sec" >> "substr($0,1,120)}' "$TODO"
```

### 3. Classify each one against the evidence

- **`[x]`** — cite what closes it: a module, a named test, a commit hash, or a
  row in the archive's decisions log. No citation, no close.
- **`[~]`** — say **specifically** which half remains. "Partially done" is worse
  than leaving it open, because it reads as progress without saying what is left.
- **`[-]`** — for superseded work, say what shipped **instead**. Do not mark a
  differently-solved item `[x]`; that misrepresents it.
- **`[!]`** — blocked. Name the blocker. Most blockers here are "needs a recorded
  emulator trace".
- **`[ ]`** — leave it, and leave it alone.

Watch for these, which the 2026-09-17 pass found repeatedly:

- A **"Decision needed:"** item that the decisions log answered weeks earlier.
- An item blocked on a question that has since been resolved further down its own
  list.
- Sections marked superseded whose checkboxes still read as live work — those
  should be `[-]`, or a sweep of open items keeps surfacing them.
- Pointers to files that have been deleted or moved.
- The same task listed twice in one section.

### 4. Rewrite what answers "what now"

The **Current project snapshot** and **Recommended implementation order** decay
fastest and cause the most harm when wrong. Check every number in the snapshot
(test counts, `app.js` line count, branch state) and rewrite the order around
what is actually open.

Keep completed steps as a short "Done" list with their original numbering, so
older plan files that cite a step number still resolve. Mark exactly one step as
the next thing to do.

### 5. Append a learnings entry to the archive

In `01-ARCHIVE.md`, not the tracker. Say how many items moved, name the judgement
calls, and name anything left deliberately untouched.

### 6. Verify

```bash
grep -c '`\[ \]`' "$TODO"; grep -c '`\[x\]`' "$TODO"; grep -c '`\[~\]`' "$TODO"
```

Re-read the rewritten order as if you had just arrived. If it does not tell you
what to do next in one read, it is not finished.

## Boundaries

- **Do not add new tasks.** This pass records what is true, not what should
  happen next. A genuinely missing item is worth raising with the user instead.
- **Do not edit `ROADMAP.md`.** It is public-facing and the user's to edit. If a
  roadmap item has become eligible for removal, note that in the tracker and say
  so in your report.
- **Do not touch the repo.** This is a documentation pass. If the audit turns up
  a bug — it has before — report it and ask before fixing.
- **Do not edit the archive's existing content.** Append only.
- **Do not commit** unless the user asks in the same task.

## Report

Lead with the count of items that moved and the new next action. Then: the
judgement calls you made, anything you left alone and why, and any contradiction
you could not resolve from evidence.
