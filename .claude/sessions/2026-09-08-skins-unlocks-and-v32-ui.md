# Session Summary — 2026-09-07/08 — Skins, unlocks, Disaster Mode, day picker, Field Kit

Handoff for a fresh session. `AGENTS.md` loads automatically via the `CLAUDE.md` symlink and
carries the invariants; this file is the narrative and the traps.

Repo: `/Users/gabriensymons/code/gabriensymons/miner2149-js`, branch
**`preview/v32-skins-unlocks`**, 29 commits ahead of `origin/main`, clean worktree,
**not pushed**. Node 20: `export PATH=/opt/homebrew/opt/node@20/bin:$PATH`.

**255 Node tests, 14 Playwright, `npm run check` and `npm run build` clean.**

## The next thing to do

**Push the branch.** Everything else queues behind it, and 29 commits exist only on this
machine. Master TODO §0 has the checklist. The provenance blocker that made pushing unsafe is
retired.

## What was done

**The Palm frames are out of history.** `git filter-branch --index-filter` over
`origin/main..HEAD`, then the four recovery refs deleted, reflog expired, `gc --prune=now`.
`origin/main` never contained them, so no published history needed rewriting. Tip tree verified
byte-identical before and after. Zero `assets/skins/palm-*` objects remain anywhere.

**Eleven original PDA frames** replace the six Palm ones, driven by a new
`scripts/skin-catalogue.js` — id, label, file, measured screen geometry, unlock rule, and lore
per frame. This replaced seven hard-coded copies of the frame list.

**Frames unlock through play.** Four ship unlocked (AstroDyne, TC-II, TrekStat, EnKom); the
rest come from the alien artifact, a level-3 mine, a meteor storm, an EM time shift, a million
credits of lifetime diridium sales, the Konami code, and a full Disaster Mode run.
`scripts/unlock-progress.js` keeps progress in its own localStorage key — **not** in a save,
because `resetGameData()` wipes `gameData` every new mine and a "lifetime" total kept there
would reset with the colony.

**Disaster Mode** replaces the Auto Save toggle (autosave is now unconditional). It is ranked
in **its own category**, not excluded — this reversed the 2026-08-19 decision, which had
grouped it with sandbox sessions. A sandbox result was *not earned*; a Disaster Mode result was
earned *harder*.

**The v3.2 advance-day picker** — clock button opening the 1–20 grid. Geometry lives in
`scripts/day-picker.js`.

**The Field Kit** — a catalogue section on the site with hardware lore, numbered placeholders
for locked frames, and the Konami rewards (dark matter screen tone, two concept images,
click-to-expand archive viewer).

**Random events are gated during the mother-ship period.** The time shift and the walkout are
suppressed while `day <= 21`. Verified against `Miner30Source.txt:2498-2557`: the original has
no such gate, so this is a deliberate divergence, recorded in `docs/ORIGINAL_BEHAVIOR_NOTES.md`.

## Traps that cost real time

1. **Playwright serves `dist/`, not the source.** `npx playwright test` silently tests the last
   build. Always `npm run test:smoke`. A CSS fix produced a byte-identical screenshot and I
   diagnosed it as a layout bug before spotting this.
2. **A glob pathspec in `filter-branch` matched nothing.** `git rm --cached
   "assets/skins/palm-*.png"` reported success and removed nothing. Explicit filenames worked.
3. **Verifying that rewrite with `grep "palm-.*\.png"` gave a false failure** — it matched the
   Palm OS bitmap *fonts*, which are legitimate assets that must stay.
4. **The hidden browser pane serves stale screenshots.** Driving the page in one tool call and
   capturing in the next showed a pre-change frame, which looked like the PDA art was misnamed.
   It was not. Batch the action and the capture, or make the page self-labelling.
5. **A hard-coded coordinate in two places** (`DAY_PICKER_ORIGIN`) let a browser test keep
   passing while clicking a different cell than it named.

## Open, and only you can close them

Four numbers need play, not analysis — all named constants:

- `rechargeStep` **0.5** (`meteor-storm.js`)
- Tank repair takes **one bar refill**, ~1s at difficulty 3. Possibly too forgiving.
- Tank-hit rate ~**18%** of missed meteors (honest sprite geometry).
- `DISASTER_MODE_DIVISOR` **10** — at class 5 that is a disaster every other day, which may be
  unplayable rather than hard. **Play it before believing the number.**

One styling call: `REPAIRING TANK` (uppercase, your wording) sits oddly beside
`"Laser Platform Restored! "` (quoted, title case). `"Repairing Laser Platform! "` would pair.

## Still open in the plan

- **Extract the shared `Splash(0)` frame** — highest-leverage refactor before the other three
  disaster scenes. Still inline in `scripts/meteor-storm-view.js`.
- **Characterize the N-day advance.** The picker runs one turn for N days, matching the old +7
  button. Master TODO O3 wants N turns. Changing it alters event and disaster frequency and
  would invalidate the parity tests, so it needs an emulator trace first.
- Whether asteroid class partitions or multiplies scores — still undecided, and now the only
  thing standing between the score model and a leaderboard.

## Working notes

- The original source is at
  `/Users/gabriensymons/code/gabriensymons/Miner2149/Miner30Source.txt`. It settled the random
  event question in one look; consult it before recording a divergence as unverified.
- `tools/measure-skin-cutouts.js` derives frame geometry from alpha. `tools/build-skin-thumbnails.js`
  generates Field Kit thumbnails but **will not overwrite without `--force`** — they are
  hand-finished afterwards.
- The sprite atlas is still hand-exported from TexturePacker outside the repo.
