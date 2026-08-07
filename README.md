<p align="center">
  <img width="420" src="https://user-images.githubusercontent.com/493546/169638892-8a6fdbf9-936f-4b44-9266-8af23c406132.png" alt="Miner2149 running in a web browser">
</p>

# Miner2149 JS

An in-progress browser reimplementation of Michael Baker's **Miner2149**, a mining-colony simulation originally released for Palm OS.

[Play the current demo](https://miner2149-js.vercel.app/) · [View the original source release](https://github.com/BProjectsGames/Miner2149)

## Attribution and licensing status

Miner2149 was created by Michael Baker. This independent reimplementation is not affiliated with or endorsed by Michael Baker or BProjectsGames.

The original source release does not carry an open-source license. Its publication notice restricts copying, modification, and distribution without the author's written permission. This repository therefore does **not** claim an MIT license and does not currently include a `LICENSE` file. Rights and asset provenance must be resolved before treating this project as redistributable or releasing it commercially. See [Asset provenance](docs/ASSET_PROVENANCE.md).

## Gameplay

Use a mouse, trackpad, or touch input to:

1. Start a new mine and launch probes.
2. Select an asteroid and build a colony across its three levels.
3. Manage credits, workers, morale, life support, food, health, power, and storage.
4. Mine and sell diridium while keeping the colony viable through a two-year term.

The zoom control above the game enlarges the intentionally low-resolution Palm-style interface.

## Local development

### Prerequisites

- Node.js 20 or newer
- npm 9 or newer

```sh
git clone https://github.com/gabriensymons/miner2149-js.git
cd miner2149-js
npm ci
npm run dev
```

Open <http://127.0.0.1:8080>. Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Serve the static site locally with caching disabled |
| `npm test` | Run unit and repository-hygiene tests |
| `npm run test:smoke` | Run the Chromium startup smoke test |
| `npm run build` | Validate JavaScript and vendored browser dependencies |
| `npm run verify` | Run checks, tests, browser smoke test, and dependency audit |

## Architecture

- Plain HTML, CSS, and native JavaScript modules
- PixiJS 6 for rendering and pointer interaction
- Local storage for offline save slots
- A disabled, test-covered Supabase adapter reserved for future optional cloud saves
- Node's built-in test runner for persistence and source-hygiene tests
- Playwright for a data-isolated browser smoke test

PixiJS is pinned in `package.json` and vendored for deterministic static deployment; its license is preserved in [Third-Party Notices](THIRD_PARTY_NOTICES.md). The public build does not load the Supabase browser SDK while cloud saves are disabled.

## Accounts and save-game security

The public demo currently disables account creation, sign-in, and remote save operations. Cloud-save safety depends on correctly configured Row Level Security (RLS), and the deployed project's policies have not yet been independently verified. RLS verification remains a release blocker before those features can be enabled again.

The dormant adapter scopes reads and writes to the authenticated user as defense in depth, restricts writes to known save slots, and does not log sessions or save data. Client-side filtering is not a substitute for RLS. A Supabase project URL and anonymous client key appeared in prior browser code; those are public client identifiers rather than privileged credentials. See the [Supabase security checklist](docs/SUPABASE_SECURITY.md).

Local saves are stored for the browser origin. The dormant synchronization policy keeps local slots authoritative and uses cloud data only to fill missing slots, preventing a stale remote record from replacing a newer local save after a failed write.

The automated browser smoke test blocks HTTP and WebSocket connections to Supabase-hosted endpoints, verifies those blockers with synthetic probes, and never touches production account or save-game data.

## Project status

This is an incomplete personal preservation/reimplementation project, not a finished release. Core colony building, saves, reports, and economic systems are present; additional simulation events, scoring, accessibility, and mobile polish remain on the [roadmap](ROADMAP.md).

Contributions are welcome only where the contributor has the right to submit the material. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) first.
