export async function authenticateUser(client, action, credentials) {
  if (!['sign-in', 'sign-up'].includes(action)) {
    return { data: null, error: new Error('Invalid authentication action.'), mode: null };
  }

  let response;
  try {
    response = action === 'sign-up'
      ? await client.auth.signUp(credentials)
      : await client.auth.signInWithPassword(credentials);
  } catch (error) {
    return { data: null, error, mode: null };
  }
  if (response.error) {
    return { data: null, error: response.error, mode: null };
  }

  const mode = action === 'sign-in'
    ? 'signed-in'
    : response.data.session ? 'signed-up' : 'confirmation-required';
  return { data: response.data, error: null, mode };
}
