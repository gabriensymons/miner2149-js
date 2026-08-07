# Roadmap

This replaces the former scratch `todo.txt` with a short list of durable public priorities. Detailed historical implementation notes were intentionally removed from the current tree and remain available in Git history.

## Release blockers

- Clarify whether the existing personal, noncommercial permission allows public repository hosting and third-party copying, modification, redistribution, or sublicensing of the derivative, then choose a license consistent with that permission.
- Confirm the provenance and redistribution rights for all artwork, bitmap fonts, and editable source assets.
- Independently verify production Supabase RLS using the metadata-only checklist in `docs/SUPABASE_SECURITY.md`.

## Gameplay

- Complete disasters, end-of-term success, scoring, and high scores.
- Validate worker, morale, production, and 30-day forecast calculations against the original behavior.
- Finish grid display and remaining message/confirmation flows.
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
