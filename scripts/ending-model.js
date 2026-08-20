const CLEAR_ACTIVE_SAVE_EFFECT = { type: 'clear-active-save' };
const FUTURE_USES = [
  'amusement-park',
  'luxury-hotel-and-spa',
  'military-base',
];

export function evaluateEnding({
  day,
  morale,
  credits,
  diridium,
  sellPrice,
  difficulty,
  creditFlag,
  revoltRoll,
  completionFlavorRoll,
  localHighScore,
  recordEligible,
}) {
  const state = { credits, diridium, creditFlag };

  if (morale < 30 && revoltRoll < difficulty) {
    return {
      code: 4,
      outcome: 'revolt',
      terminal: true,
      state,
      effects: [CLEAR_ACTIVE_SAVE_EFFECT],
    };
  }

  const score = credits + (diridium * sellPrice);
  const extensionsAllowed = 6 - difficulty;
  if (credits < 0 && score < 0 && creditFlag < extensionsAllowed) {
    const nextCreditFlag = creditFlag + 1;
    const debtCovered = -credits;
    const limitReached = nextCreditFlag >= extensionsAllowed;
    return {
      code: 1,
      outcome: 'credit-extended',
      terminal: false,
      state: {
        credits: 0,
        diridium: diridium + Math.trunc(credits / sellPrice),
        creditFlag: nextCreditFlag,
      },
      creditExtension: {
        debtCovered,
        extensionsAllowed,
        limitReached,
      },
      effects: [{ type: 'credit-extended', debtCovered, limitReached }],
    };
  }

  if (credits < 0 && score < 0) {
    return {
      code: 2,
      outcome: 'insolvency',
      terminal: true,
      state,
      effects: [CLEAR_ACTIVE_SAVE_EFFECT],
    };
  }

  if (day >= 730) {
    if (!Number.isInteger(completionFlavorRoll) || completionFlavorRoll < 0 || completionFlavorRoll >= FUTURE_USES.length) {
      throw new RangeError('completionFlavorRoll must be an integer from 0 through 2');
    }

    const isNewRecord = recordEligible && score > localHighScore;
    const effects = [CLEAR_ACTIVE_SAVE_EFFECT];
    if (isNewRecord) effects.push({ type: 'set-local-record', score });

    return {
      code: 3,
      outcome: 'complete',
      terminal: true,
      state: { credits: score, diridium, creditFlag },
      score,
      completion: {
        day,
        creditsEarned: credits,
        diridiumRemaining: diridium,
        sellPrice,
        totalCredits: score,
        futureUse: FUTURE_USES[completionFlavorRoll],
      },
      localRecord: {
        eligible: recordEligible,
        previousScore: localHighScore,
        isNewRecord,
      },
      effects,
    };
  }

  return {
    code: 1,
    outcome: 'ongoing',
    terminal: false,
    state,
    effects: [],
  };
}
