# Changelog

All notable changes to Miner2149 JS are documented in this file.

The project did not historically use Git tags or formal releases. Until tagged releases begin, current work is listed under **Unreleased**, and older work is summarized from the repository's commit history without inventing version numbers.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

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

### Changed

- Replaced the Palm device frames with ten original sci-fi PDA frames, retiring the artwork-provenance release blocker. Frame geometry is now measured from each image and applied from a single catalogue rather than hand-written per-frame CSS.
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
