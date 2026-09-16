import { pocketRandom } from './random.js';

const RANDOM_EVENT_PHASE = 'before-core-update';

/**
 * The mother ship supports the colony through this day, and `selectDisaster`
 * already refuses to fire before it. Two random events could still reach past
 * that shield, so they are held back to the same boundary.
 *
 * Only the harmful pair is gated. Of the seven events, the alien artifact and
 * the processor boost are literally no-ops this early -- they set morale and
 * efficiency to 100, which is where both already start -- while the geologic
 * survey and the rich vein are useful, and the engineer is a choice the player
 * makes. Suppressing all seven would remove the opening's only good luck to
 * prevent harm that comes from two of them.
 *
 * Port divergence: the v3.0 source snapshot is not on this machine, so whether
 * the original gated these is unverified. Recorded rather than absorbed.
 */
const MOTHER_SHIP_GRACE_DAY = 21;

function withinMotherShipGrace(state) {
  return state.day <= MOTHER_SHIP_GRACE_DAY;
}
const RANDOM_EVENT_IDS = Object.freeze({
  TIME_SHIFT: 0,
  GEOLOGIC_SURVEY: 1,
  PROCESSOR_BOOST: 2,
  ALIEN_ARTIFACT: 3,
  RICH_VEIN: 4,
  ENGINEER: 5,
  WORKERS_LEAVE: 6,
});

function makeDrawer(random, randomDraws) {
  return (label, max) => {
    const value = random === undefined
      ? pocketRandom(max)
      : pocketRandom(max, random);
    randomDraws.push({ label, max, value });
    return value;
  };
}

function selectGeologicSurvey(draw) {
  return {
    level: draw('geologic-level', 3) + 1,
    cells: [
      draw('geologic-cell', 99) + 1,
      draw('geologic-cell', 99) + 1,
    ],
  };
}

function selectRandomEvent({ state, days, noOreVeins = false, random } = {}) {
  const randomDraws = [];
  const draw = makeDrawer(random, randomDraws);
  const id = draw('event-id', 700);
  const event = {
    id,
    phase: RANDOM_EVENT_PHASE,
    pendingChoice: null,
    randomDraws,
  };

  if (id === RANDOM_EVENT_IDS.TIME_SHIFT) {
    event.shift = draw('time-shift-days', 90) + 5;
  }

  if (id === RANDOM_EVENT_IDS.GEOLOGIC_SURVEY) {
    event.geologicSurvey = selectGeologicSurvey(draw);
  } else if (noOreVeins) {
    const fallbackMax = 17 - days;
    if (fallbackMax > 1 && draw('no-ore-fallback', fallbackMax) === 1) {
      event.geologicSurvey = selectGeologicSurvey(draw);
    }
  }

  if (id === RANDOM_EVENT_IDS.RICH_VEIN) {
    event.amount = draw('rich-vein-units', 100) * 50;
  }

  if (
    id === RANDOM_EVENT_IDS.ENGINEER
    && state.credits > 30000
    && state.miningEfficiency < 100
  ) {
    event.cost = (draw('engineer-cost-thousands', 15) + 15) * 1000;
    event.pendingChoice = {
      type: 'engineer-offer',
      cost: event.cost,
      choices: ['accept', 'decline'],
      message: `A visitor claiming to be an engineer has offered to increase the daily output of your mines for ${event.cost} credits. Will you pay for this service?`,
    };
  }

  if (id === RANDOM_EVENT_IDS.WORKERS_LEAVE) {
    event.percent = (draw('workers-leave-tens', state.difficulty) * 10) + 10;
  }

  return event;
}

function cloneMaps(maps) {
  return Object.fromEntries(Object.entries(maps).map(([level, rows]) => [
    level,
    Object.fromEntries(Object.entries(rows).map(([row, cells]) => [row, [...cells]])),
  ]));
}

function applyGeologicSurvey(nextState, survey) {
  const maps = cloneMaps(nextState.maps);
  const levelName = `level${survey.level}`;
  const changedCells = [];

  for (const cell of survey.cells) {
    const index = cell - 1;
    const row = Math.floor(index / 10);
    const column = index % 10;
    if (maps[levelName][`row${row}`][column] < 4) {
      maps[levelName][`row${row}`][column] = 4;
      changedCells.push({ cell, row, column });
    }
  }

  if (changedCells.length === 0) return null;

  nextState.maps = maps;
  return {
    level: levelName,
    cells: changedCells,
    redraw: nextState.level === levelName,
  };
}

function applyRandomEvent(state, event, { choice, random } = {}) {
  const nextState = { ...state };
  const messages = [];
  const effects = [];
  const randomDraws = event.randomDraws.map((draw) => ({ ...draw }));
  const draw = makeDrawer(random, randomDraws);
  let mapUpdate = null;
  let pendingChoice = null;

  // Gated on the effect rather than the selection so the random draws are
  // untouched -- suppressing the roll instead would shift every subsequent draw
  // and invalidate any recorded parity trace.
  if (event.id === RANDOM_EVENT_IDS.TIME_SHIFT && !withinMotherShipGrace(state)) {
    nextState.day += event.shift;
    const text = `NEWS FLASH: Strange electromagnetic storm causes time shift. Time suddenly advances ${event.shift} days.`;
    messages.push(text);
    effects.push({ type: 'time-shift', days: event.shift });
  }

  if (event.geologicSurvey) {
    mapUpdate = applyGeologicSurvey(nextState, event.geologicSurvey);
    if (mapUpdate) {
      const text = `NEWS FLASH: Geologic survey discovers new diridium veins on level ${event.geologicSurvey.level}.`;
      messages.push(text);
      effects.push({ type: 'map-update', ...mapUpdate });
    }
  }

  if (event.id === RANDOM_EVENT_IDS.PROCESSOR_BOOST && nextState.efficiency < 100) {
    nextState.efficiency = 100;
    const text = 'NEWS FLASH: New processor technology temporarily boosts mining efficiency to 100%';
    messages.push(text);
    effects.push({ type: 'set-efficiency', value: 100 });
  }

  if (event.id === RANDOM_EVENT_IDS.ALIEN_ARTIFACT) {
    nextState.morale = 100;
    const text = 'NEWS FLASH: Alien artifact discovered! News of discovery boosts morale to 100%';
    messages.push(text);
    effects.push({ type: 'set-morale', value: 100 });
  }

  if (event.id === RANDOM_EVENT_IDS.RICH_VEIN) {
    nextState.diridium += event.amount;
    const text = `NEWS FLASH: Rich diridium vein discovered. Stored diridium increased by ${event.amount} tons.`;
    messages.push(text);
    effects.push({ type: 'add-diridium', amount: event.amount });
  }

  if (event.pendingChoice) {
    if (choice === undefined) {
      pendingChoice = { ...event.pendingChoice, choices: [...event.pendingChoice.choices] };
      effects.push({ type: 'choice-required', choice: pendingChoice });
    } else if (choice === 'accept') {
      nextState.credits -= event.cost;
      effects.push({ type: 'spend-credits', amount: event.cost });
      const succeeded = draw('engineer-success', 3) > 1;
      if (succeeded) {
        nextState.miningEfficiency = Math.min(100, nextState.miningEfficiency + 20);
        const text = 'Modifications complete. Mining efficiency improved by up to 20%.';
        messages.push(text);
        effects.push({ type: 'increase-mining-efficiency', amount: 20, cap: 100 });
      } else {
        messages.push("You've been swindled! The visitor took your money and fled. Too bad you can't trust everyone.");
      }
    }
  }

  if (event.id === RANDOM_EVENT_IDS.WORKERS_LEAVE && !withinMotherShipGrace(state)) {
    const workersLost = Math.floor(nextState.workers * event.percent / 100);
    nextState.workers -= workersLost;
    const text = `NEWS FLASH: Workers are leaving for a better work offer at a rival mining company. ${event.percent}% of workers have left your mining colony.`;
    messages.push(text);
    effects.push({ type: 'remove-workers', percent: event.percent, amount: workersLost });
  }

  return {
    state: nextState,
    messages,
    effects,
    mapUpdate,
    pendingChoice,
    randomDraws,
    phase: RANDOM_EVENT_PHASE,
  };
}

export {
  MOTHER_SHIP_GRACE_DAY,
  RANDOM_EVENT_IDS,
  RANDOM_EVENT_PHASE,
  applyRandomEvent,
  selectRandomEvent,
};
