export function runTurnCadence({
  days,
  state,
  noOreVeins,
  selectEvent,
  applyEvent,
  commitEvent,
  requestChoice,
  coreUpdate,
}) {
  if (days <= 0) return false;

  const event = selectEvent({ state, days, noOreVeins });
  const initialResult = applyEvent(state, event);
  let continued = false;

  function continueTurn(choice) {
    if (continued) return;
    continued = true;
    const result = choice === undefined
      ? initialResult
      : applyEvent(state, event, { choice });
    commitEvent(result);
    coreUpdate(days);
  }

  if (initialResult.pendingChoice) {
    requestChoice(
      initialResult.pendingChoice,
      () => continueTurn('accept'),
      () => continueTurn('decline'),
    );
    return true;
  }

  continueTurn();
  return true;
}
