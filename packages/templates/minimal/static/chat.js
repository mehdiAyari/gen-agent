// Chat page of the agent: sends messages to /api/chat and shows the replies. With OIDC, signs the user in from the
// browser (authorization code with PKCE) and sends the access token with each message. Replies are shown as text,
// never as HTML.

const config = await (await fetch('chat-config.json')).json();
const $ = (id) => document.getElementById(id);
const messages = $('messages');
const form = $('chat');
const input = $('message');
const error = $('error');
/** The conversation going on, kept by the agent; a new page starts a new one. */
let conversationId = null;

function show(role, text) {
  const item = document.createElement('li');
  item.className = role;
  item.textContent = text;
  messages.append(item);
  item.scrollIntoView({ block: 'end' });
  return item;
}

function fail(message) {
  error.textContent = message;
  error.hidden = false;
}

// --- Sign-in (OIDC, authorization code with PKCE) ---

const oidc = config.auth === 'oidc';
let provider;

const base64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
const randomString = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const redirectUri = location.origin + location.pathname;

async function discover() {
  provider ??= await (await fetch(`${config.issuer}/.well-known/openid-configuration`)).json();
  return provider;
}

async function signIn() {
  const { authorization_endpoint } = await discover();
  const verifier = randomString();
  const state = randomString();
  sessionStorage.setItem('pkce', JSON.stringify({ verifier, state }));
  const challenge = base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const url = new URL(authorization_endpoint);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: 'openid',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  location.assign(url);
}

async function requestTokens(parameters) {
  const { token_endpoint } = await discover();
  const response = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, ...parameters }),
  });
  if (!response.ok) throw new Error('The identity provider refused the sign-in.');
  const tokens = await response.json();
  sessionStorage.setItem(
    'tokens',
    JSON.stringify({ ...tokens, expiresAt: Date.now() + (tokens.expires_in - 30) * 1000 }),
  );
}

async function completeSignIn() {
  const parameters = new URLSearchParams(location.search);
  if (!parameters.has('code')) return;
  const pkce = JSON.parse(sessionStorage.getItem('pkce') ?? '{}');
  sessionStorage.removeItem('pkce');
  history.replaceState(null, '', redirectUri);
  if (parameters.get('state') !== pkce.state) throw new Error('The sign-in did not come from this page: try again.');
  await requestTokens({
    grant_type: 'authorization_code',
    code: parameters.get('code'),
    redirect_uri: redirectUri,
    code_verifier: pkce.verifier,
  });
}

/** A valid access token, refreshed when it expires; undefined when the user must sign in again. */
async function accessToken() {
  const tokens = JSON.parse(sessionStorage.getItem('tokens') ?? 'null');
  if (tokens === null) return undefined;
  if (Date.now() < tokens.expiresAt) return tokens.access_token;
  if (tokens.refresh_token === undefined) return undefined;
  try {
    await requestTokens({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
    return JSON.parse(sessionStorage.getItem('tokens')).access_token;
  } catch {
    sessionStorage.removeItem('tokens');
    return undefined;
  }
}

async function signOut() {
  const tokens = JSON.parse(sessionStorage.getItem('tokens') ?? 'null');
  sessionStorage.clear();
  const { end_session_endpoint } = await discover();
  if (end_session_endpoint === undefined || tokens === null) return location.reload();
  const url = new URL(end_session_endpoint);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    id_token_hint: tokens.id_token,
    post_logout_redirect_uri: redirectUri,
  });
  location.assign(url);
}

function showSignedIn(signedIn) {
  $('sign-in').hidden = signedIn;
  form.hidden = !signedIn;
  $('sign-out').hidden = !signedIn;
}

// --- Conversation ---

const FAILURES = {
  404: 'This conversation is gone: your next message starts a new one.',
  409: 'This request was already answered.',
  410: 'This request has expired: ask again.',
  503: 'The agent is switched off for now. Try again later.',
};

/** Posts to the agent and returns its reply; undefined when the user must sign in again. */
async function post(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (oidc) {
    const token = await accessToken();
    if (token === undefined) return showSignedIn(false);
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  if (response.status === 401) {
    sessionStorage.removeItem('tokens');
    showSignedIn(false);
    throw new Error('Your session has ended: sign in again.');
  }
  if (response.status === 404 && path === 'api/chat') conversationId = null;
  if (response.status === 429) {
    const seconds = response.headers.get('Retry-After');
    throw new Error(`Limit reached: try again in ${seconds ?? 'a few'} seconds.`);
  }
  if (!response.ok) throw new Error(FAILURES[response.status] ?? 'The agent could not answer. Try again later.');
  const reply = await response.json();
  conversationId = reply.conversationId;
  return reply;
}

/** Shows the reply in place of its pending item, then the tool calls that wait for the user's approval. */
function showReply(pending, reply) {
  if (reply === undefined) return pending.remove();
  // A model may only ask for a tool, with nothing to say yet.
  if (reply.reply.trim() === '' && (reply.approvals ?? []).length > 0) pending.remove();
  else {
    pending.textContent = reply.reply;
    pending.className = 'agent';
  }
  for (const approval of reply.approvals ?? []) showApproval(approval);
}

function showApproval(approval) {
  const item = show('approval', '');
  const until = new Date(approval.expiresAt).toLocaleString();
  const text = document.createElement('p');
  text.textContent = `${approval.tool} waits for your approval, until ${until}: ${approval.arguments}`;
  const actions = document.createElement('div');
  for (const [label, approved] of [
    ['Approve', true],
    ['Deny', false],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => decide(item, approval.id, approved));
    actions.append(button);
  }
  item.append(text, actions);
}

async function decide(item, id, approved) {
  for (const button of item.querySelectorAll('button')) button.disabled = true;
  error.hidden = true;
  const pending = show('agent pending', '…');
  try {
    showReply(pending, await post(`api/approvals/${encodeURIComponent(id)}`, { approved }));
    item.querySelector('div').replaceChildren(approved ? 'Approved' : 'Denied');
  } catch (exception) {
    pending.remove();
    for (const button of item.querySelectorAll('button')) button.disabled = false;
    fail(exception.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (text === '') return;
  error.hidden = true;
  show('user', text);
  input.value = '';
  const pending = show('agent pending', '…');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    showReply(
      pending,
      await post('api/chat', { message: text, ...(conversationId === null ? {} : { conversationId }) }),
    );
  } catch (exception) {
    pending.remove();
    fail(exception.message);
  } finally {
    button.disabled = false;
    input.focus();
  }
});

// Enter sends, Shift+Enter starts a new line.
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

$('new-conversation').addEventListener('click', () => {
  conversationId = null;
  messages.replaceChildren();
  error.hidden = true;
  input.focus();
});

if (oidc) {
  $('sign-in-button').addEventListener('click', () => signIn().catch((exception) => fail(exception.message)));
  $('sign-out').addEventListener('click', () => signOut());
  try {
    await completeSignIn();
  } catch (exception) {
    fail(exception.message);
  }
  showSignedIn((await accessToken()) !== undefined);
}
