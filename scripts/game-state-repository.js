const SAVE_SLOTS = new Set(['autoSave', 'save1', 'save2', 'save3']);

export function getRemoteSaveData(gameStates, slot) {
  return gameStates?.[slot]?.saveData ?? null;
}

export function getPreferredSaveData(localSaves, remoteSaves, slot) {
  return getRemoteSaveData(localSaves, slot) ?? getRemoteSaveData(remoteSaves, slot);
}

export function mergeSaveCollections(localSaves, remoteSaves) {
  return { ...(remoteSaves ?? {}), ...(localSaves ?? {}) };
}

export function isValidSaveData(saveData, template) {
  if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) return false;
  if (!template || typeof template !== 'object') return false;
  if (Object.keys(template).some((key) => !Object.hasOwn(saveData, key) || saveData[key] === undefined)) {
    return false;
  }

  return ['level1', 'level2', 'level3'].every((level) => {
    const map = saveData.maps?.[level];
    if (!map || typeof map !== 'object' || Array.isArray(map)) return false;

    return Array.from({ length: 10 }, (_, row) => map[`row${row}`]).every(
      (sites) => Array.isArray(sites)
        && sites.length === 10
        && sites.every(Number.isFinite),
    );
  });
}

function invalidSaveSlot(slot) {
  return !SAVE_SLOTS.has(slot);
}

async function authenticatedUser(client) {
  let response;
  try {
    response = await client.auth.getUser();
  } catch (error) {
    return { error, user: null };
  }
  const { data, error } = response;

  if (error) return { error, user: null };
  if (!data?.user) {
    return { error: new Error('You must be signed in to use cloud saves.'), user: null };
  }

  return { error: null, user: data.user };
}

export async function saveGameState(client, slot, saveData) {
  if (invalidSaveSlot(slot)) {
    return { data: null, error: new Error('Invalid save slot.') };
  }

  const { error: authError, user } = await authenticatedUser(client);
  if (authError) return { data: null, error: authError };

  const record = {
    id: `${user.id}-${slot}`,
    name: saveData.saveName,
    save_data: saveData,
    save_slot: slot,
    user_id: user.id,
  };
  let error;
  try {
    ({ error } = await client
      .from('game_states')
      .upsert(record, { onConflict: 'id' }));
  } catch (queryError) {
    error = queryError;
  }

  return { data: null, error: error ?? null };
}

export async function loadGameStates(client) {
  const { error: authError, user } = await authenticatedUser(client);
  if (authError) return { data: null, error: authError };

  let response;
  try {
    response = await client
      .from('game_states')
      .select('save_slot,save_data')
      .eq('user_id', user.id);
  } catch (error) {
    return { data: null, error };
  }
  const { data, error } = response;

  if (error) return { data: null, error };

  const gameStates = (data ?? []).reduce((states, { save_slot: slot, save_data: saveData }) => {
    if (invalidSaveSlot(slot) || !saveData) return states;

    states[slot] = {
      empty: false,
      hasCustomName: true,
      name: saveData.saveName,
      saveData,
    };
    return states;
  }, {});

  return { data: gameStates, error: null };
}
