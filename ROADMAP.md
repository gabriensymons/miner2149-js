# Roadmap

This replaces the former scratch `todo.txt` with a short list of durable public priorities. Detailed historical implementation notes were intentionally removed from the current tree and remain available in Git history.

## Release blockers

- Document the source and permitted use of each optional Palm device frame, or replace any frame that cannot be confidently published.

## Gameplay

- Complete disasters, end-of-term success, scoring, and high scores.
- Add an opt-in leaderboard for completed two-year runs, with developer/sandbox sessions clearly marked unranked and blocked from score submission.
- Finish source-parity implementation and tests for worker, morale, production, and 30-day forecast calculations.
- Finish remaining message and confirmation flows.
- Evaluate the original laser-defense mini-game without copying restricted source or assets.

## Experience and accessibility

- Improve mobile sizing and text-input behavior.
- Add keyboard navigation and Escape/Return shortcuts.
- Improve account status, loading, and error feedback.
- Add accessible alternatives for canvas-only controls where practical.

## Engineering

- Expand unit coverage around simulation calculations and local-save recovery.
- Extend browser coverage through probe launch and asteroid selection.
- Revisit PixiJS 7/8 only with rendering regression coverage.

## Future cloud saves

- Keep account and remote-save features disabled for the local-save-only preview.
- Independently verify production Supabase RLS using the metadata-only checklist in `docs/SUPABASE_SECURITY.md` before re-enabling cloud saves.
