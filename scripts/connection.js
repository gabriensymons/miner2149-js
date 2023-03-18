const supabase = window.supabase.createClient('https://msvmofomkozketpmbqyu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zdm1vZm9ta296a2V0cG1icXl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzkxMTAyMjMsImV4cCI6MTk5NDY4NjIyM30.RTA0_n5O-MIkgDTARw_Z7cuA8NoBWnHF1z2WkirBTmI')

async function saveGame(slot, saveData) {
  const { data: { user } } = await supabase.auth.getUser()
  const gameStateId = `${user.id}-${slot}`;
  console.log(saveData);
  const { data, error } = await supabase
    .from('game_states')
    .upsert({ id: gameStateId, save_data: saveData, user_id: user.id, save_slot: slot, name: saveData.saveName })
    .select();
  console.error(error);
}

async function loadGame() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: db_data, error } = await supabase
    .from('game_states')
    .select('save_slot,save_data')
    .match({ user_id: user.id });
  if (error) {
    console.error(error)
    return { data: null, error };
  }
  let return_data = db_data.reduce((obj, { save_slot, save_data }) => {
    obj[save_slot] = {
      name: save_data.saveName,
      hasCustomName: true,
      empty: false,
      saveData: save_data
    };
    return obj;
  }, {});
  console.log(return_data)
  return { data: return_data, error: null };
}

async function renderUserForm() {
  const { data, error } = await supabase.auth.getSession();
  if (!data.session) {
    document.querySelector('#user-section').innerHTML = `
      <div>
       <p>Login or Make and Account to Save Games and Load Saved Games</p>
       <form id="user-form">
        <input name="email">
        <input name="password">
        <button type="submit">Do it man</button>
       </form>
      </div>
    `;
    document.querySelector('#user-form').addEventListener('submit', createOrLogin);
  } else {
    console.log(data);
    document.querySelector('#user-section').innerHTML = `
    <div>
    <p>Logged in with email ${data.session.user.email}
    </div>
    `;
  }

}

async function createOrLogin(e) {
  e.preventDefault();
  let email = e.target[0].value;
  let password = e.target[1].value;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert("Problem with registering or logging in, we dont really know we are in a hurry and dont want to build this part yet");
    }
  }
  else {
    await renderUserForm();
  }
}

function initUser() {
  renderUserForm();
}

function getGameStates() {

}

export {
  initUser,
  saveGame,
  loadGame
};
