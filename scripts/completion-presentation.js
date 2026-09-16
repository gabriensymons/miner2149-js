const FUTURE_MESSAGES = Object.freeze({
  'amusement-park': 'You have completed your mission. The mine soon will be turned into an amusement park.',
  'luxury-hotel-and-spa': 'You have completed your mission. The mine soon will be turned into a luxury hotel and spa.',
  'military-base': 'You have completed your mission. The mine soon will be turned into a military base.',
});

export function buildCompletionPresentation(completion) {
  const futureMessage = FUTURE_MESSAGES[completion.futureUse];
  if (!futureMessage) throw new RangeError(`Unknown future use: ${completion.futureUse}`);

  return {
    lines: [
      'Mission Status: COMPLETE',
      `Credits Earned: ${completion.creditsEarned}`,
      `Diridium Remaining: ${completion.diridiumRemaining}`,
      `Current Selling Price: ${completion.sellPrice}`,
      `Total Credits: ${completion.totalCredits}`,
    ],
    futureMessage,
  };
}
