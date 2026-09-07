# Session Summary — 2026-08-20 (evening) — Meteor storm tuning and three new mechanics

Continues `2026-08-20-miner2149-v32-gap-work.md`. Repo
`/Users/gabriensymons/code/gabrien/miner2149-js`, branch `preview/local-save-demo`,
tip still `62f1d87`. **Nothing was committed** — the project's git policy requires an
explicit request, so the whole session sits in the working tree. Node 20:
`export PATH=/opt/homebrew/opt/node@20/bin:$PATH`.

**Verification: 188/188 Node tests (was 162), 6/6 Playwright, static build clean.**
Playwright needs `PLAYWRIGHT_USE_SYSTEM_CHROME=1`.

## Modified files

`scripts/meteor-storm.js`, `scripts/meteor-storm-view.js`, `scripts/app.js`,
`scripts/dev/meteor-trigger.js`, and the three matching test files.

## Part 1 — playtest tuning (all user-directed)

- **Half fall speed.** `FALL_SPEED_SCALE = 0.5` scales `fallStep` *and* `drift`, so
  every meteor's approach angle is unchanged and only the speed differs.
- **Spawn above the frame** at y = -10, clipped by a play-field mask so a meteor
  emerges from behind the border rather than painting across it.
- **Horizontal wrap** replaces the side-escape miss. Every meteor now resolves as a
  hit or a ground impact.
- **Caption raised** to y = 24, five pixels below the title's dotted rule.
- **Tank settles 2px lower** (settle 145, armed 140): all three tank bitmaps now
  share a bottom edge at y=155, so the jump when it stops is gone.
- **Counters withheld** until the platform settles, then a 2 s beat before the first
  spawn.
- **Laser beam** is a filled triangle — apex at the turret, 3px base at the aim
  point — held 300 ms instead of the single simulation step it used to live for.
  The base is **square to the beam, not to the screen**: the median from the turret
  to the base midpoint runs down the beam axis and meets the base at a right angle,
  so the wedge stays symmetric at every firing angle. A screen-aligned base sheared
  the far end off, worst on shallow shots.
- **The beam is scan-converted onto the 160x160 grid** rather than left as a vector
  shape. At the canvas's 3x resolution the renderer was rasterizing its diagonals
  three times finer than any bitmap beside it, so it read as a sharper, foreign
  medium. `rasterizeTriangle` emits one whole-pixel `drawRect` per row (about 140 for
  a full-height beam), giving it the same stairstep the sprites have. Rows near the
  apex are clamped to a minimum of one pixel so the beam does not fade out before it
  reaches the turret.
- **Craters persist** for the rest of the storm; a 1.2 s closing beat makes the
  finished field readable.
- **`rechargeStep` default is 0.5**, settled by the user's playtest. Tunable from the
  dev panel.
- **`LOW POWER` is latched** until the recharge bar is back to 80% full.

## Part 2 — the parity rule was amended

The user amended the 2026-08-19 rule. It now reads: **no action still yields exactly
the original outcome, but skilled play may beat it, within calibrated caps recorded in
code.** This supersedes the old rule for all four mini-games and means port scores are
no longer comparable to the original's — relevant to any future leaderboard.

Every reward is provably inert on the untouched path: the morale bonus needs zero
misses, and the diridium bonus needs a cracked core. Neither is reachable without
firing, and a player who never fires leaves `power` at `initialPower`, which is what
keeps `nextEfficiency` at the source value.

Caps, all named constants in `scripts/meteor-storm.js`: **+5 morale** for a perfect
defense, **-2 morale per miss**, **2000 diridium** per cracked core.

## Part 3 — three new mechanics

- **Split on early hit.** A hit above y=40 cracks a meteor into two halves sharing one
  sequence slot. The pair can never cost more damage than the single meteor would
  have: both landing is one miss, and killing either half spares the colony entirely.
  Halves never re-split. Clearing both refunds the two killing shots (not the shot
  that cracked it, so a perfect split costs exactly one shot — the same as a clean
  kill) and records a core strike for the closing news flash.
- **Tank hit.** A meteor landing on the platform footprint disables the laser, empties
  the recharge bar, and shows `REPAIRING TANK` with the burst bitmap in the tank's
  place. The bar doubles as the repair timer. `power` is deliberately untouched. When
  the bar refills the platform announces itself with `"Laser Platform Restored! "`,
  held 1.2 s and then stood down — styled after the source's own SRCMSG-011
  `"Preparing Laser Platform! "`, which it answers.
- **Morale outcomes**, applied in `applyMeteorStormResult` clamped to 0..100.

The model was refactored from a single `state.meteor` to a `state.meteors` array with
slot-based resolution; effects now carry their own coordinates so the view no longer
reads meteor state to draw impact frames, and the whole `'impact'` phase is gone.

## Judgment calls made without asking (user was asleep)

1. **`REPAIRING TANK` is uppercase.** The user wrote "Repairing tank"; the two other
   port-added captions sharing that slot are `LOW POWER` and `POWER DRAINED`. **Open
   styling question:** it is now paired with the quoted, title-cased
   `"Laser Platform Restored! "`, so the two halves of one story do not match. Either
   is a one-line change; `"Repairing Laser Platform! "` would match the source's
   SRCMSG-011 exactly.
2. **Split spread is capped.** First implementation let the halves drift apart for the
   whole fall and they ended on opposite sides of the screen — with one tank in the
   middle the bonus would never have fired. They now spread for 20 steps to ~26px
   apart, then fall parallel.
3. **Tank-hit rate is the honest sprite geometry** (~18% of missed meteors), not a
   tuned number. Flagged for playtest.
4. **Repair takes one bar refill** (~1 s at difficulty 3). Matches the user's spec
   literally; may be too forgiving.
5. **Diridium bonus is a flat 2000.** Roughly one day of mid-game production.

## Two bugs found by invariant, worth remembering

- Resolving a landed meteor per *meteor* instead of per *slot* double-counted the miss
  when both halves landed on the same step — silently making an intervention worse
  than doing nothing, i.e. breaking the parity ceiling.
- The laser hold re-armed from the same effect object every frame during the armed
  pause and completion hold, so the beam never cleared.

Both were caught by asking "what invariant must hold?", not "does this case work?".

## What's next

1. **Playtest** the four open numbers above and the split window (y=40).
2. **Review and commit** — this is one large working tree covering tuning plus three
   features; it wants splitting into reviewable commits.
3. The Splash(0) extraction from the previous handoff is **still not started**, and is
   still the highest-leverage refactor left before the other three disaster scenes.
4. Morale arithmetic is now documented in the Master TODO learnings log — read it
   before calibrating any other mini-game reward.
