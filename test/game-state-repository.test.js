import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPreferredSaveData,
  getRemoteSaveData,
  isValidSaveData,
  loadGameStates,
  mergeSaveCollections,
  normalizeSaveData,
  saveGameState,
} from '../scripts/game-state-repository.js';
import { authenticateUser } from '../scripts/auth-service.js';

function authenticatedClient({ userId = 'user-123', rows = [], queryError = null } = {}) {
  const calls = [];
  const query = {
    eq(column, value) {
      calls.push(['eq', column, value]);
      return Promise.resolve({ data: rows, error: queryError });
    },
    select(columns) {
      calls.push(['select', columns]);
      return this;
    },
    upsert(record, options) {
      calls.push(['upsert', record, options]);
      return Promise.resolve({ error: queryError });
    },
  };

  return {
    calls,
    client: {
      auth: {
        getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      },
      from(table) {
        calls.push(['from', table]);
        return query;
      },
    },
  };
}

test('saveGameState rejects unauthenticated writes before querying game states', async () => {
  let queried = false;
  const client = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
    from() {
      queried = true;
    },
  };

  const result = await saveGameState(client, 'save1', { saveName: 'Mine' });

  assert.equal(result.data, null);
  assert.match(result.error.message, /signed in/i);
  assert.equal(queried, false);
});

test('saveGameState returns authentication failures instead of rejecting', async () => {
  const failure = new Error('Network unavailable');
  const client = {
    auth: {
      async getUser() {
        throw failure;
      },
    },
  };

  const result = await saveGameState(client, 'save1', { saveName: 'Mine' });

  assert.equal(result.data, null);
  assert.equal(result.error, failure);
});

test('saveGameState writes only an allowed slot owned by the authenticated user', async () => {
  const { client, calls } = authenticatedClient();
  const saveData = { saveName: 'Mine', day: 4 };

  const result = await saveGameState(client, 'save1', saveData);

  assert.deepEqual(result, { data: null, error: null });
  assert.deepEqual(calls, [
    ['from', 'game_states'],
    ['upsert', {
      id: 'user-123-save1',
      name: 'Mine',
      save_data: saveData,
      save_slot: 'save1',
      user_id: 'user-123',
    }, { onConflict: 'id' }],
  ]);
});

test('saveGameState returns database failures instead of rejecting', async () => {
  const failure = new Error('Database unavailable');
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }),
    },
    from() {
      return {
        async upsert() {
          throw failure;
        },
      };
    },
  };

  const result = await saveGameState(client, 'save1', { saveName: 'Mine' });

  assert.equal(result.data, null);
  assert.equal(result.error, failure);
});

test('saveGameState rejects unknown save slots before querying game states', async () => {
  const { client, calls } = authenticatedClient();

  const result = await saveGameState(client, 'other-user-slot', { saveName: 'Mine' });

  assert.match(result.error.message, /save slot/i);
  assert.deepEqual(calls, []);
});

test('loadGameStates filters by authenticated user and ignores unexpected slots', async () => {
  const { client, calls } = authenticatedClient({
    rows: [
      { save_slot: 'save1', save_data: { saveName: 'Mine', day: 4 } },
      { save_slot: 'unexpected', save_data: { saveName: 'Ignore me' } },
    ],
  });

  const result = await loadGameStates(client);

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    save1: {
      empty: false,
      hasCustomName: true,
      name: 'Mine',
      saveData: { saveName: 'Mine', day: 4 },
    },
  });
  assert.deepEqual(calls, [
    ['from', 'game_states'],
    ['select', 'save_slot,save_data'],
    ['eq', 'user_id', 'user-123'],
  ]);
});

test('loadGameStates returns database failures instead of rejecting', async () => {
  const failure = new Error('Database unavailable');
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-123' } }, error: null }),
    },
    from() {
      return {
        select() {
          return this;
        },
        async eq() {
          throw failure;
        },
      };
    },
  };

  const result = await loadGameStates(client);

  assert.equal(result.data, null);
  assert.equal(result.error, failure);
});

test('getRemoteSaveData returns null when an authenticated user has no save in the slot', () => {
  assert.equal(getRemoteSaveData({}, 'save1'), null);
  assert.equal(getRemoteSaveData({ save1: null }, 'save1'), null);
});

test('getPreferredSaveData uses local data before stale remote data', () => {
  const localSave = { saveName: 'Local' };
  const remoteSave = { saveName: 'Remote' };
  const local = { save1: { saveData: localSave } };
  const remote = {
    save1: { saveData: remoteSave },
    save2: { saveData: remoteSave },
  };

  assert.equal(getPreferredSaveData(local, remote, 'save1'), localSave);
  assert.equal(getPreferredSaveData(local, remote, 'save2'), remoteSave);
  assert.equal(getPreferredSaveData(local, remote, 'save3'), null);
});

test('mergeSaveCollections keeps local slots authoritative after cloud sync failures', () => {
  const local = {
    save1: { saveData: { saveName: 'Local 1' } },
    save2: { saveData: { saveName: 'Local 2' } },
  };
  const remote = {
    save1: { saveData: { saveName: 'Remote 1' } },
  };

  assert.deepEqual(mergeSaveCollections(local, remote), {
    save1: local.save1,
    save2: local.save2,
  });
  assert.deepEqual(mergeSaveCollections(local, null), local);
  assert.deepEqual(mergeSaveCollections(null, remote), remote);
});

test('normalizeSaveData converts legacy numeric shop prices without mutating the stored save', () => {
  const storedSave = { saveName: 'test', shopPrice: '6500' };

  const normalized = normalizeSaveData(storedSave);

  assert.deepEqual(normalized, { saveName: 'test', shopPrice: 6500, disasterMode: false, daysOutsideDisasterMode: 0 });
  assert.deepEqual(storedSave, { saveName: 'test', shopPrice: '6500' });
});

test('normalizeSaveData converts an empty legacy shop price to zero', () => {
  assert.deepEqual(
    normalizeSaveData({ saveName: 'test', shopPrice: '' }),
    { saveName: 'test', shopPrice: 0, disasterMode: false, daysOutsideDisasterMode: 0 },
  );
});

test('normalizeSaveData leaves malformed shop prices invalid', () => {
  const storedSave = { saveName: 'test', shopPrice: 'not-a-price' };

  assert.deepEqual(normalizeSaveData(storedSave),
    { ...storedSave, disasterMode: false, daysOutsideDisasterMode: 0 });
});

test('normalizeSaveData converts legacy numeric-string probes to a number', () => {
  const storedSave = { probes: '4', saveName: 'Day 428' };

  const normalized = normalizeSaveData(storedSave);

  assert.deepEqual(normalized, { probes: 4, saveName: 'Day 428', disasterMode: false, daysOutsideDisasterMode: 0 });
  assert.deepEqual(storedSave, { probes: '4', saveName: 'Day 428' });
});

test('normalizeSaveData leaves malformed probes invalid', () => {
  const storedSave = { probes: 'many', saveName: 'Day 428' };

  assert.deepEqual(normalizeSaveData(storedSave),
    { ...storedSave, disasterMode: false, daysOutsideDisasterMode: 0 });
});

test('normalizeSaveData migrates legacy sell prices to a floating accumulator', () => {
  const storedSave = { sellPrice: 19, saveName: 'Day 30' };

  const normalized = normalizeSaveData(storedSave);

  assert.deepEqual(normalized, {
    sellPrice: 19,
    sellPriceAccumulator: 19,
    saveName: 'Day 30',
    disasterMode: false,
    daysOutsideDisasterMode: 0,
  });
  assert.deepEqual(storedSave, { sellPrice: 19, saveName: 'Day 30' });
});

test('normalizeSaveData preserves an existing floating sell-price accumulator', () => {
  assert.deepEqual(
    normalizeSaveData({ sellPrice: 19, sellPriceAccumulator: 19.95 }),
    { sellPrice: 19, sellPriceAccumulator: 19.95, disasterMode: false, daysOutsideDisasterMode: 0 },
  );
});

test('isValidSaveData rejects missing or malformed game states', () => {
  const level = Object.fromEntries(
    Array.from({ length: 10 }, (_, row) => [`row${row}`, Array(10).fill(2)]),
  );
  const template = {
    credits: 1_000_000,
    day: 0,
    level: 'level1',
    maps: { level1: level, level2: level, level3: level },
  };
  const valid = structuredClone(template);
  valid.day = 4;

  assert.equal(isValidSaveData(valid, template), true);
  assert.equal(isValidSaveData(null, template), false);
  assert.equal(isValidSaveData(false, template), false);
  assert.equal(isValidSaveData({}, template), false);
  assert.equal(isValidSaveData({ day: 4, maps: {} }, template), false);
  assert.equal(isValidSaveData({ ...valid, credits: undefined }, template), false);
  assert.equal(isValidSaveData({ ...valid, day: '4' }, template), false);
  assert.equal(isValidSaveData({ ...valid, credits: {} }, template), false);
  assert.equal(isValidSaveData({ ...valid, level: 'level9' }, template), false);
  assert.equal(isValidSaveData({ ...valid, maps: { ...valid.maps, level2: {} } }, template), false);
  const malformedRows = structuredClone(valid);
  malformedRows.maps.level2.row4[3] = '2';
  assert.equal(isValidSaveData(malformedRows, template), false);
});

test('authenticateUser signs in without attempting account creation', async () => {
  const calls = [];
  const client = {
    auth: {
      async signUp(credentials) {
        calls.push(['signUp', credentials]);
        return { data: null, error: null };
      },
      async signInWithPassword(credentials) {
        calls.push(['signInWithPassword', credentials]);
        return { data: { user: { id: 'user-123' } }, error: null };
      },
    },
  };

  const credentials = { email: 'player@example.com', password: 'correct horse' };
  const result = await authenticateUser(client, 'sign-in', credentials);

  assert.equal(result.error, null);
  assert.equal(result.mode, 'signed-in');
  assert.deepEqual(calls, [['signInWithPassword', credentials]]);
});

test('authenticateUser reports when account creation requires email confirmation', async () => {
  const calls = [];
  const client = {
    auth: {
      async signUp(credentials) {
        calls.push(['signUp', credentials]);
        return { data: { session: null, user: { id: 'user-123' } }, error: null };
      },
    },
  };

  const credentials = { email: 'player@example.com', password: 'correct horse' };
  const result = await authenticateUser(client, 'sign-up', credentials);

  assert.equal(result.error, null);
  assert.equal(result.mode, 'confirmation-required');
  assert.deepEqual(calls, [['signUp', credentials]]);
});

test('authenticateUser returns network failures without exposing credentials', async () => {
  const failure = new Error('Network unavailable');
  const client = {
    auth: {
      async signInWithPassword() {
        throw failure;
      },
    },
  };

  const result = await authenticateUser(client, 'sign-in', {
    email: 'player@example.com',
    password: 'do-not-return-this',
  });

  assert.equal(result.data, null);
  assert.equal(result.error, failure);
  assert.equal(result.mode, null);
  assert.doesNotMatch(JSON.stringify(result), /do-not-return-this/);
});

// isValidSaveData rejects a save missing any key of the template, so a field
// added to gameDataInit invalidates every save ever written unless it is
// backfilled here. This is the sellPriceAccumulator precedent applied again.
test('a save written before Disaster Mode existed is normalized into a normal run', () => {
  const legacySave = { saveName: 'Day 200', sellPrice: 19, sellPriceAccumulator: 19 };

  assert.equal(normalizeSaveData(legacySave).disasterMode, false);
  assert.equal(Object.hasOwn(legacySave, 'disasterMode'), false, 'the stored save is untouched');
});

test('a Disaster Mode run stays one when it is reloaded', () => {
  assert.equal(
    normalizeSaveData({ saveName: 'Day 200', disasterMode: true }).disasterMode,
    true,
  );
});

// A save from before Disaster Mode was played entirely outside it. Seeding the
// counter from the day count keeps it in the normal category rather than
// promoting a legacy run to a Disaster Mode record it never earned.
test('a legacy save is treated as having been played wholly outside Disaster Mode', () => {
  assert.equal(normalizeSaveData({ saveName: 'Day 400', day: 400 }).daysOutsideDisasterMode, 400);
  assert.equal(normalizeSaveData({ saveName: 'new' }).daysOutsideDisasterMode, 0);
  assert.equal(
    normalizeSaveData({ day: 400, daysOutsideDisasterMode: 0 }).daysOutsideDisasterMode,
    0,
    'a genuine full Disaster Mode run is left alone',
  );
});
