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

## Catching up to Miner 2149 v3.2

The port was built from the v3.0 source. The shipped v3.2 release added
interface and content we are still working through.

- Replace the fixed advance buttons with the v3.2 clock control and its
  1-20 day picker.
- Add Disaster Mode, and move to the v3.2 four-slot save model with
  save-on-exit and restore-on-launch.
- Implement the disasters and news events that were added after the v3.0
  source snapshot, once their behavior is characterized against the original.
- Refresh the on-site instructions from Michael Baker's official v3.2
  documentation.

## Disasters worth playing

Several original disasters play out as animations with no way to respond. We
want to give the player something to do, without changing the original game
underneath: taking no action always produces exactly the original outcome, and
any intervention can only reduce the damage.

- Add optional interactive responses to the shuttle crash, power-plant
  overload, and mine cave-in.
- Finish the laser-defense presentation: the colony skyline, the laser tank and
  its arrival, and a clearer picture of what firing costs.
- Offer an auto-resolve option so the original, non-interactive experience stays
  available and fully ranked.

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
