# Changelog

All notable changes to Miner2149 JS are documented in this file.

The project did not historically use Git tags or formal releases. Until tagged releases begin, current work is listed under **Unreleased**, and older work is summarized from the repository's commit history without inventing version numbers.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- A `CHARGE` caption above the meter in the meteor defence screen. The original leaves it unlabelled and explains it in prose in the manual instead, so this is a deliberate divergence: a bare bar that empties as it refills reads backwards to anyone who has not read the manual. The bar itself drops two rows below its source row to sit clear of the caption — the only part of its geometry that moves.

- A responsive public site around the original 160×160 game canvas, including navigation, an expanded game guide, display controls, and optional device frames.
- Screen-size, screen-tone, and device-frame controls with locally stored preferences.
- Search, Open Graph, Twitter Card, and structured-data metadata, plus a styleable SVG logo, social preview image, `robots.txt`, and `sitemap.xml`.
- Hover textures and pointer-over behavior for text, message, arrow, icon, level, advance, report, Options, and Sell Diridium controls.
- Dedicated hover sprites for the Sell and Cancel buttons in the Select Quantity dialog.
- Shared hover-only overlays for shop items, asteroid map tiles, and Options menu rows.
- Native-width hover overlays for the Bulldozer and Space Port shop controls, plus hover feedback for Undo.
- Pure unit coverage for Diridium storage-capacity calculation and all four storage-icon fill boundaries.
- A deterministic asteroid-surface reveal animation that inverts each row and restores its tiles from left to right.
- Unit coverage for the map reveal sequence and broader browser coverage for startup, responsive sizing, controls, hover behavior, and site presentation.
- Deterministic, DOM-free specifications for Operations and Production Report calculations, ordinary random events, ending precedence, mission scoring, and all seven source disasters.
- A nonblocking meteor-defense sequence with sequential meteors, power-limited held-pointer laser fire, source-compatible colony consequences, and newly authored monochrome PixiJS primitives.
- A two-year mission-completion flow with source-compatible score details, three future-use outcomes, and eligible local best-score persistence with the asteroid difficulty.
- Meteor defense interaction: a hit near the top of the fall cracks a meteor into two halves that share one slot and can never cost more damage than leaving it alone; clearing both refunds the killing shots and pays a diridium bonus. A meteor landing on the platform disables the laser until the recharge bar refills.
- Storm outcomes now move colony morale, and a perfect defense reports it.
- The v3.2 advance bar: a clock button opening a "Select # of days:" grid for any advance from 1 to 20, replacing the fixed +14 button.
- Disaster Mode, replacing the Auto Save toggle, with its own score category and a device frame for completing a full two-year run without leaving it.
- Device frames unlock through play, with a Konami-code easter egg.
- A Field Kit section cataloguing every device frame, with in-fiction hardware notes for the ones you have earned and numbered placeholders for the ones you have not.
- Concept art and a dark matter screen tone, released with the Konami frame.
- Meteor-defense tuning now scales with the asteroid class: the previous numbers become the class 5 end of a gradient, with the recharge rate easing and a small amount of meteor-on-tank overlap forgiven as a glancing blow at each lower class. Both knobs are unreachable without firing, so a storm the player never touches is identical at every class.
- An asteroid-class selector in the development meteor panel, which fills the recharge and glance knobs from the class and lets either be overridden for playtesting.
- The Diridium strike: a full-viewport lightning overlay played when the Konami frame is found and whenever it is chosen, with the page flashing behind it and the frame's name flickering in the notice. Composited with `screen` over a black-backed clip rather than keyed at runtime, and requested only by players who have earned it.
- Archive image entries: the two concept plates are now record cards — a catalogue line, a subject, a lead sentence, and the record in short paragraphs — rather than a one-line label or a single block of prose.
- A full favicon set: an SVG for modern tabs, a 96px PNG fallback, a legacy `.ico`, a 180px Apple touch icon, and a web manifest with the site's own identity and colors. The mark is the bulldozer silhouette, drawn for the size rather than downscaled.
- A Mission Log: dated, curated dispatches about what shipped, what was wrong, and what the original Palm binary keeps revealing, each with an expandable technical note, plus `Under construction` entries for work that is coming. Static markup, so it reads without JavaScript and points at the changelog rather than duplicating it.
- A field note for the mounted device frame, opened from the console line ("Asteroid Belt // Operations Console // About the AstroDyne") and rendered from the same catalogue entry the Field Kit shows.

### Changed

- A destroyed meteor no longer vanishes on the frame it dies. The burst keeps the meteor's own momentum for a moment and falls with it, then flickers out, so a kill reads as wreckage dropping away rather than as a sprite being deleted. Two meteors killed on the same step — which is what clearing both halves of a split does — now both show; the single sprite this replaced could only ever draw one of them.

### Changed

- The colony's state has one owner. Every change to it goes through a session that tells the screen, instead of each path mutating the state and repainting whichever label its author was thinking about. In development the state is handed out frozen, so a change that skips the session raises an error where it happens rather than leaving the screen disagreeing with the save; the freeze is stripped from the production build. Saving no longer mutates the colony it was asked to copy, the slot-naming rules moved into a tested module, and `cloneMaps` stopped being written out separately in three rules modules.

### Fixed

- The "cannot afford" marker on the store caption was set when a purchase put an item out of reach and then never cleared, so it survived until the next selection even after selling ore. It is derived from the price against the credits now, both ways.
- Loading a saved colony restored the shop caption but not the shop itself, so a mine saved with Hydroponics selected reopened captioned `Hydroponics` with the bulldozer drawn as the selected item — and building would have placed the wrong thing. The selection highlight, the caption tint and the affordability marker are all restored from the save now. The bulldozer is the only selection sprite that starts visible, which is why this never showed on a new colony and only ever appeared after a load.
- A colony saved on level 2 or 3 reopened on level 1, discarding the level it was left on. The original restores it, so the port now does too.
- Clearing one half of a split and letting the other land scored correctly — the slot counts as a hit and does no damage — but the landing played the full miss animation and left a permanent crater, so the field recorded damage the player never took. A saved slot's landing now plays its impact and leaves no scar. The rock can still wreck the laser platform it lands on: it is a real rock, and a saved slot is not a free pass for whatever is underneath it.
- The mobile navigation wrapped its last link out of sight. It was a horizontal scroller, which was survivable at five items and stopped being so at six; it now wraps to a second row so every link is visible, and the unlock notice measures its clearance from the header rather than assuming a height.
- The full-size archive viewer clipped its record away entirely: the dialog capped at 92vh and hid its overflow while the image alone was allowed 84vh. Image and record are now two panes that each get a real share of the space — side by side above 900px — and the record scrolls on its own if it still runs long.

### Changed

- The EnKom handset is no longer issued with a new posting. It is earnable, and currently unreachable: its unlock trigger is declared but deliberately wired to nothing until the mini-game that earns it is built, with a test that fails if a grant site appears and the pending flag is not removed.
- Moved the unlock notice from the bottom-right corner to top centre under the navigation, enlarged it, and cut its corners to match the navigation logo and the controls panel. The Konami notice now announces both of its rewards, applies them, strikes its name a syllable at a time, and rings the two controls the rewards live in — each ring staying up until that control is used, not merely until the drawer is opened. The Controls badge counts rewards rather than frames, so that unlock reads as two.

- Replaced the Palm device frames with eleven original sci-fi PDA frames. Frame geometry is now measured from each image and applied from a single catalogue rather than hand-written per-frame CSS.
- Retuned the meteor storm for the browser: half the source fall speed, meteors entering from above the frame, horizontal wrapping instead of a side miss, a held triangular laser beam, counters withheld until the platform settles, and craters that stay on the field for the rest of the storm.
- Reworked the site layout and visual design while preserving the pixelated Palm-style game presentation.
- Moved display behavior from the former zoom script into the site-controls module.
- Refreshed the PixiJS spritesheet to include hover states and updated interface assets.
- Converted the level selectors and 1/7/14-day advance controls from raw hit zones to configuration-driven sprite buttons with transparent normal overlays, hover sprites, pressed sprites, and existing persistent level-selection indicators.
- Converted the Operations, Production, and Options controls from raw hit zones to configuration-driven sprite buttons that show their inverted artwork on hover and reveal the normal artwork baked into the mine screen while idle or pressed.
- Moved Diridium storage percentage and fill-band selection into a small pure module, and mapped each fill state to its matching hover sprite with an intentionally transparent pressed/on texture.
- Hardened `buildSpriteButton()` with explicit pointer-over/pressed state and a cancellation callback for outside releases and pointer cancellation.
- Converted Save Mine and Load Mine slots and Cancel controls, plus the Game Over New Mine, Load Mine, and Quit controls, to reusable text buttons.
- Made the Grid Lines option redraw smooth asteroid tiles with the dedicated grid texture.
- Replaced rendered blue hit-zone fills in hit-zone and sprite-button controls with transparent `PIXI.Rectangle` hit areas.
- Expanded the static-site build allowlist and checks for runtime assets, metadata, device frames, and source-only exclusions.
- Disabled public account and cloud-save UI while production Row Level Security remains unverified; local save slots remain available.
- Aligned Pocket C-derived random calls with exclusive upper bounds, moved ordinary event effects ahead of the core turn update, and allowed one event roll for every positive Advance action, including during the mother-ship period.
- Replaced the disaster no-op with the intended post-day-21 probability of `1 / [20 × (6 − difficulty)]` followed by uniform selection among the seven source disasters; the historical Page Down path remains development-only.
- Separated report math, random-event transitions, disasters, meteor simulation, and ending evaluation from PixiJS so inexpensive Node tests can verify behavior without browser globals.

### Fixed

- Registered the missing `pointerover` event for text-button hover sprites.
- Corrected sprite-button texture/callback argument order for the sell, cancel, and storage controls.
- Cleared sprite-button hover overlays when an action disables the parent screen, preventing report and Options icons from remaining inverted behind an open menu.
- Normalized legacy string-valued shop prices before save validation and kept newly calculated shop prices numeric, allowing existing locally saved mines to load safely.
- Standardized probe counts as numbers and migrated numeric-string probe counts during load so saves made after adjusting launch probes remain reloadable, including from the Game Over screen.
- Ensured held diridium arrow controls stop repeating when released outside or cancelled.
- Replaced random row inversion during map drawing with a consistent tile-by-tile reveal.
- Declared the Options menu's OK-button reference so initialization completes without a runtime error.
- Preserved rounded button caps on wide Save Mine and Load Mine slots with nine-slice scaling.
- Prevented Options menu clicks from activating newly opened Save Mine or Load Mine slots on the same pointer release.
- Preserved rounded button caps on the Game Over New Mine and Load Mine controls with nine-slice scaling.
- Corrected report thresholds, processor-backed storage capacity, zero-capacity presentation, wage refreshes, and stale report alert visuals using source-derived pure calculations.
- Preserved the source market’s floating selling-price accumulator across turns while keeping the displayed and persisted public price integer-compatible; legacy saves initialize the accumulator from their stored price.
- Corrected random-event ranges and engineer success odds, worker-revolt probability and precedence, insolvency handling, and single-execution terminal cleanup.

### Security

- Extended source-hygiene and browser-isolation checks to prevent debug state exposure and production Supabase traffic during tests.

## Pre-changelog history

### 2026-08-07 — Security, maintenance, and deployment

- Added Node.js 20/22 project metadata, npm-based development commands, source checks, Node tests, and Playwright smoke tests.
- Added repository security, contribution, asset-provenance, third-party notice, Supabase security, and roadmap documentation.
- Added authenticated save-state boundaries, validation, local-first save recovery, and tests for authentication and database failures.
- Pinned and vendored PixiJS for deterministic builds and removed obsolete or duplicate runtime dependencies.
- Added GitHub Actions continuous integration and Dependabot configuration.
- Added a static Vercel build, deployment configuration, and build-output tests.
- Clarified the project's personal, noncommercial status and unresolved redistribution and licensing questions.

### 2021-12-24 to 2023-08-03 — Initial browser reimplementation

- Established the browser-based PixiJS reimplementation and project documentation.
- Added the start, launch, load, save, instructions, options, report, and game-over interface flows.
- Added save-slot naming, local saves, autosave, loading, and restoration of saved day and credit values.
- Added asteroid generation, three map levels, ore veins, map redraw animation, hit zones, building placement, construction status, and bulldozing behavior.
- Added the building shop, wages, diridium sales, production and operations report updates, and random colony events.
- Added reusable text and sprite buttons and improved pointer handling to reduce accidental clicks.
- Fixed construction-adjacency, save/load, sell-dialog, increment/decrement, and empty-storage button issues.
