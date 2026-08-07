# Contributing

Thanks for your interest in Miner2149 JS. This is an incomplete preservation/reimplementation project with unresolved licensing and asset-provenance questions.

## Before opening a change

- Use an issue to discuss substantial gameplay or architecture work first.
- Do not submit source code, artwork, fonts, audio, documentation, or other material copied from Miner2149 unless you can document permission to redistribute it.
- Keep Michael Baker's authorship and the original project attribution intact.
- Never include credentials, private user data, or production save-game data.
- Do not use production Supabase records while developing or testing.

## Development workflow

1. Install Node.js 20 or 22.
2. Run `npm ci`.
3. Add a failing test before changing behavior.
4. Make the smallest change that passes the focused test.
5. Run `npm run verify` before submitting a pull request.

Browser tests must remain isolated from production services. The existing Playwright test blocks and probes Supabase HTTP and WebSocket connections; new tests should use local fixtures or an explicitly disposable test project.

## Pull requests

Keep changes focused and explain:

- what changed and why;
- the focused test that failed before the implementation;
- the full verification commands and results;
- any licensing, provenance, security, or compatibility implications.

By contributing, you confirm that you have the right to submit your contribution. Acceptance does not grant rights to the original Miner2149 code or assets.
