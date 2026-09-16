# AGENTS.md

Durable memory for this repository: what must stay true, and the constraints that are not
visible from the code. Status, plans, and next actions live elsewhere — see
[Where other things live](#where-other-things-live).

## What this is

A browser reimplementation of Michael Baker's **Miner 2149**, a mining-colony simulation for
Palm OS. The canvas is a faithful 160×160 monochrome recreation of the original, wrapped in a
modern responsive site.

It is deliberately **not** a remake, a re-imagining, or a modernisation of the simulation. The
economy, events, disasters, and endings reproduce the original's arithmetic, including its
quirks. Where the port diverges, the divergence is recorded rather than absorbed.

Michael Baker granted written permission to use the original source, formulas, sprites,
imagery, and documentation for this personal, noncommercial project. That permission does not
extend to third parties.

## The thesis you can break with every test still green

**Source parity.** You can refactor any module, keep every test passing, and destroy the
thing this project is for — by "fixing" a formula that looks wrong, rounding where the
original truncated, or smoothing a behaviour that reads as a bug but is what the Palm did.

Two rules follow:

1. **Never tune a simulation formula by feel.** Economy, disaster, and event changes need a
   recorded emulator trace against the original binary first.
2. **Truncation is load-bearing.** The source truncates toward zero constantly
   (`truncTowardZero` in `scripts/simulation-rules.js`). Sub-integer daily changes are
   discarded every turn, which is why morale does not move at all on +1-day advances. That is
   correct behaviour, not a bug.

### The parity rule for mini-games

Amended 2026-08-20. **Taking no action yields exactly the original outcome; skilled play may
beat it, within calibrated caps recorded in code.**

Every reward must be provably inert on the untouched path. The meteor storm is the worked
example: its morale bonus requires zero misses and its diridium bonus requires a cracked
meteor core, and neither is reachable without firing — and a player who never fires leaves
`power` at `initialPower`, which is what keeps the efficiency outcome at the source value.

Caps live in named constants with their reasoning attached (see `scripts/meteor-storm.js`), so
they can be re-tuned without re-deriving them.

Amended 2026-09-08. **Mini-game tuning may scale with the asteroid class, provided every knob
on the gradient is unreachable on the untouched path.** The meteor storm's recharge rate and
its glancing-blow tolerance both qualify: recharge governs when the player may fire again, and
the tank only matters once there is a laser to disable, so a storm nobody shoots at is
identical at class 1 and class 5. `stepDelay` is not on the gradient -- it is the source's own
`30 - class * 6` and is not ours to re-tune.

## Terminology

| Term | Meaning here |
| --- | --- |
| **Diridium** | The ore the colony mines and sells. The whole economy. |
| **Level** | One of three 10×10 asteroid grids (`level1`/`level2`/`level3`), not a difficulty. |
| **Class** | The asteroid's difficulty, 1–5. `gameData.difficulty`. |
| **Slot** | One of four save slots (`autoSave`, `save1`–`save3`) inside one localStorage key. |
| **Cadence / turn** | One advance. `runTurnCadence` selects at most one random event per advance, regardless of how many days it covers. |
| **Effect** | The committed contract between a pure rules module and `app.js` — match on effect types, not on event ids. |
| **Sandbox** | A session touched by dev tooling (`gameData.devSandbox`). Never ranked. |
| **Category** | Which record pool a finished run belongs to: `normal` or `disaster`. Not the same as asteroid class, whose ranking treatment is still undecided. |
| **Skin / frame** | A PDA device image the canvas is mounted inside. Not a colour theme. |
| **Screen tone** | The canvas colour treatment (white / Palm OS / backlight, plus dark matter once earned). Separate axis from skins. |
| **Transmission** | One dated Mission Log entry, shipped or `Under construction`. Curated for players; the changelog stays the factual record, and only shipped work goes in it. |
| **Plate** | One archive concept image plus its in-fiction record, released with the Konami frame. |

## Invariants

**Adding a field to `gameDataInit` breaks every existing save.** `isValidSaveData()`
(`scripts/game-state-repository.js`) iterates every key of the template and rejects a save
missing any of them. Backfill new fields in `normalizeSaveData()` in the same file — the
`sellPriceAccumulator` case is the precedent. Ask first whether the value belongs in a save at
all: `resetGameData()` wipes `gameData` on every new mine, so anything meant to persist across
colonies must not live there.

**Cross-game state goes in its own localStorage key, not in a save.** `local-best-score.js` is
the pattern: one `STORAGE_KEY`, injected storage, total validation, corrupt data reads as
empty rather than throwing.

**`scripts/app.js` and `scripts/site-controls.js` are separate entry points and must stay
that way.** They are loaded independently by `index.html` and do not import each other:
`app.js` pulls in Pixi and, in development, `scripts/dev/`. Share state between them through a
pure module both import (`scripts/skin-catalogue.js`) plus a DOM `CustomEvent`.

**Development tooling must be absent from production, not merely disabled.**
`tools/build-static.js` skips `scripts/dev/` and strips `/* dev-only:start */ … /* dev-only:end */`
regions from copied scripts. `test/dev-tooling-excluded.test.js` proves both. Anything
player-facing — the Konami listener especially — must never import, trigger, alias, or share
state with that directory. Putting such code in `site-controls.js`, which has no path to
`scripts/dev/`, makes that structural rather than a rule to remember.

**A frame may ship locked and unreachable, but only out loud.** `unlockPending` on a catalogue
entry declares a trigger that nothing fires yet, with the reason, and
`test/unlock-wiring.test.js` asserts both halves: every other trigger has a grant site, and a
pending one has *none*. So wiring the trigger without clearing the flag fails the build, and
the exemption cannot quietly become the place unreachable frames go to be forgotten. EnKom is
the current entry (Plan 12).

**Sprites are identified by their position in the binary's string pool, not by appearance.**
Appearance-based identification produced three wrong sprite assignments in a single session.

**Committed art is not always reproducible from its generator.** The sprite atlas is exported
by hand from TexturePacker, and the Field Kit thumbnails are hand-finished after
`tools/build-skin-thumbnails.js` runs (the screen cutout is filled black, which `sips` cannot
do). That tool therefore refuses to overwrite an existing thumbnail without `--force`. Treat
any generator in `tools/` as a starting point unless it says otherwise.

**`isNormalSession()` gates whether a result may be recorded at all; `scoreCategory()`
decides which record it goes in; `!devSandbox` gates cosmetics.** Three different boundaries.
Only a sandbox session is unrecordable — a result that was *not earned*. Disaster Mode is
*earned harder*, so it is ranked in its own category rather than discarded, and a colony
counts as a Disaster Mode run only if `daysOutsideDisasterMode` is zero. `isNormalSession`
additionally requires a matching asteroid class, so gating unlocks on it would mean the
hardest ways to play unlock nothing.

## Conventions that are decisions, not defaults

- **Some tests assert on `app.js` source text, not behaviour.**
  `canvas-control-wiring.test.js` and `sell-dialog-buttons.test.js` read the file, strip all
  whitespace, and regex-match literal call shapes; `app-turn-wiring.test.js` also asserts
  statement *ordering* inside functions and requires functions separated by exactly `\n}\n\n`.
  **A correct refactor can break them, and loop-generated UI cannot be expressed in them.**
  Test generated UI through a pure module plus Playwright instead.
- **The Mission Log may name unshipped work; the Field Kit may not.** An `Under construction`
  transmission is the one place the site promises something that does not exist yet — that is
  what the chip is for. But the Field Kit's lede promises *"the game will not tell you how"*
  and `lockedLabel()` withholds every locked frame's name and trigger, so a teaser must not
  name which frame a coming mini-game unlocks. Tease the fiction, not the reward.
- **Site content is static HTML unless it depends on state.** The Introduction, Playing
  Instructions and Mission Log are written into `index.html`, so they are crawlable, survive a
  failed module load, and need no renderer. The Field Kit and the frame picker are built by
  `site-controls.js` because they depend on what the player has unlocked. Do not migrate the
  first group into data modules for symmetry — being static *is* the feature. Expandable
  sections are plain `<details>`; the keyboard and screen-reader behaviour is the platform's.
- **A `<dialog>` must only get its `display` while `[open]`.** A bare `display: grid` on a
  dialog overrides the UA's `display: none` for the closed state, and the dialog never goes
  away — it is invisible to the eye but present to layout and to tests. `.image-viewer[open]`
  is the pattern. Its `<form method="dialog">` wrapper also takes a grid cell, so it needs
  `display: contents` or the children land one cell along.
- **The Diridium lightning clip is keyed by arithmetic, not by a chroma key.** The source
  plate is green-screen; `tools/build-lightning-overlay.js` rewrites green as
  `min(g, max(r, b))`, which collapses the background to black and leaves the bolt untouched,
  and the page composites the result with `mix-blend-mode: screen`. There is no alpha channel
  and nothing is keyed at runtime. A chroma key would have to guess a matte edge, and any
  green fringe it left would be *added* as green light by the blend.
- **The sprite atlas is built outside this repo.** `assets/spritesheet.json` / `.png` come
  from TexturePacker and are committed by hand. There is no generator, no `.tps`, and no
  source-image directory. Sprites reach the game only through the atlas, and the string key
  must match the frame name exactly, spaces and extension included.
- **PDA frame geometry is measured, not eyeballed.** `tools/measure-skin-cutouts.js` derives
  each screen cutout from the image's alpha channel; `scripts/skin-catalogue.js` stores the
  raw pixel measurements and computes the CSS percentages. Adding a frame is one catalogue
  entry — it used to be seven hard-coded places.
- Pure rules modules (`simulation-rules`, `disaster-rules`, `random-events`, `meteor-storm`,
  `ending-model`) take injected randomness and return new state. Keep them DOM-free and
  Node-testable; `app.js` owns all the Pixi and storage.
- Node's built-in test runner for logic; Playwright only for Pixi, pointer input, animation,
  scaling, and end-to-end integration.

## Commands

```bash
export PATH=/opt/homebrew/opt/node@20/bin:$PATH   # Node 20 is not on the default PATH here
npm test                                          # Node test runner
PLAYWRIGHT_USE_SYSTEM_CHROME=1 npm run test:smoke # bundled Chromium is not installed
npm run check                                     # syntax + vendored-Pixi staleness
npm run build                                     # static site into dist/
npm run dev                                       # http-server on :8080
node tools/measure-skin-cutouts.js                # regenerate PDA frame geometry
node tools/build-skin-thumbnails.js               # regenerate Field Kit thumbnails (macOS sips)
node tools/build-lightning-overlay.js            # re-encode the Diridium strike (needs ffmpeg)
```

**Playwright serves `dist/`, not the source tree** (`playwright.config.js`). Always run it as
`npm run test:smoke`, which builds first. Running `npx playwright test` on its own silently
tests whatever the last build left behind, and will happily pass against code you just
changed.

## Agent boundaries

- **Do not commit, push, merge, deploy, or delete recovery refs unless asked in the current
  task.** Verify a commit in a clean detached worktree — untracked files in the working tree
  otherwise mask a broken commit.
- Preserve a recovery ref before reorganising mixed or binary changes.
- Inspect the live branch and worktree before starting. Do not assume `main`.
- Do not develop multiple large `app.js` features in parallel; land one decomposition phase,
  then rebase the next onto the new seams.

## Out of scope

- **Cloud saves and accounts** — Supabase code exists but is disabled for the local-save-only
  preview. Not yet, rather than never.
- **Colour** — deferred entirely. `MinerColor.prc` is relevant only as evidence that v3.2a and
  v3.2c share formulas.
- **The v3.2 disasters and events whose triggers are unknown.** Their strings are proven to
  exist in the shipped binary; nothing tells us when they fire or what they cost, so they stay
  unimplemented until characterized on an emulator.

## Where other things live

| Subject | File | Wins on |
| --- | --- | --- |
| What must stay true | this file | invariants, terminology, conventions |
| Status, plans, decisions log | `00-MASTER-TODO.md` — **outside this repo**, at `/Users/gabriensymons/Documents/Gabrien/Projects/Video Games/Miner2149/plans/` | what is done, what is next, why a decision was made |
| Factual history | `CHANGELOG.md` | what changed and when |
| Player-facing history and what is coming | the Mission Log section of `index.html` | how a change is told to players; curated, not exhaustive, and the only place unshipped work is promised by name |
| Public priorities | `ROADMAP.md` | durable promises only, deliberately short |
| Asset origins | `docs/ASSET_PROVENANCE.md` | where art and fonts came from |
| Original quirks | `docs/ORIGINAL_BEHAVIOR_NOTES.md` | deliberate Palm-era behaviour |
| Session handoffs | `.claude/sessions/` — **local only, gitignored** | narrative of a working session |

The Master TODO is the operational source of truth for status and decisions; it wins over this
file whenever the two disagree about state. This file wins on invariants. Read it at the start
of any session that changes scope, and update it when a plan starts, finishes, or yields a
decision — the same folder also holds the individual plan files and the original
`Miner30Source.txt` snapshot lives at `/Users/gabriensymons/code/gabriensymons/Miner2149/`.
