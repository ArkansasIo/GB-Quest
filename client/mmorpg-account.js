// Account and realm gateway used before online character creation.
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.GBQMMOAccount) return;

  let activeSession = null;
  let gameplaySession = null;
  let overlay = null;
  let onReady = null;
  let directory = { regions: [], realms: [] };
  let selectedRegion = '';
  let selectedRealm = '';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  // Plain-language message for a failed MMO request (players used to see the raw code "request_failed").
  function describeError(error, base) {
    const where = base ? base.replace(/^https?:\/\//, '') : 'the MMO server';
    const code = error && error.code, status = error && error.status;
    if (error && error.network) return 'Cannot reach an MMO server at ' + where + '. Check the address and that the server is running.';
    if (code === 'invalid_credentials') return 'The account name or password is incorrect.';
    if (code === 'username_taken') return 'That account name is already in use.';
    if (code === 'too_many_auth_attempts' || code === 'api_write_rate_limited' || status === 429) return 'Too many attempts. Wait a minute, then try again.';
    if (code === 'origin_not_allowed' || code === 'cors_preflight_not_allowed') return 'This MMO server does not allow games from this site. Its owner must add ' + location.origin + ' to GBQ_ALLOWED_ORIGINS.';
    if (code === 'unauthorized' || status === 401) return 'Your online session has ended. Sign in again.';
    if (status === 404 || status === 405 || error && error.notJson) return where + ' is not a GB-Quest MMO server. Check the MMO SERVER URL.';
    if (status >= 500) return 'The MMO server had a problem (HTTP ' + status + '). Try again later.';
    if (code) return 'The MMO server refused the request: ' + String(code).replace(/_/g, ' ') + '.';
    return (error && error.message) || 'The MMO server request failed.';
  }

  async function request(base, path, token, options = {}) {
    const headers = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = 'Bearer ' + token;
    let response;
    try {
      response = await fetch(base.replace(/\/+$/, '') + path, {
        method: options.method || 'GET', headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: 'omit', cache: 'no-store'
      });
    } catch (cause) {
      const error = Object.assign(new Error('network'), { network: true, cause });
      error.message = describeError(error, base); throw error;
    }
    let data = {}, notJson = false;
    try { data = await response.json(); } catch (_) { notJson = true; }
    if (!response.ok || notJson) {
      const error = Object.assign(new Error(data.error || 'request_failed'), { status: response.status, code: data.error, notJson });
      error.message = describeError(error, base); throw error;
    }
    return data;
  }

  // Is this address a GB-Quest MMO server? (GET /health answers { service: 'gbquest-mmorpg' }.)
  async function checkServer(base) {
    const health = await request(base, '/health', null);
    if (!health || health.service !== 'gbquest-mmorpg') {
      throw new Error(base.replace(/^https?:\/\//, '') + ' is a different kind of server, not a GB-Quest MMO server. (A realm server is set in ONLINE > SERVER ADDRESS instead.)');
    }
  }

  // Default MMO address: one the player used before, one the build bakes in, or this page's own server when the
  // page could be served by it. Static hosts (itch.io) and local files have no MMO server of their own.
  function defaultServer() {
    let saved = ''; try { saved = localStorage.getItem('gbq_mmo_server_url') || ''; } catch (_) {}
    if (saved) return saved;
    if (window.GBQ_MMO_REALM_URL) return window.GBQ_MMO_REALM_URL;
    if (/^https?:$/.test(location.protocol) && !window.GBQ_STATIC_HOST) return location.origin;
    return '';
  }

  function setMessage(message, isError = false) {
    const node = overlay && overlay.querySelector('[data-account-message]');
    if (!node) return;
    node.textContent = message || '';
    node.classList.toggle('is-error', !!isError);
    node.hidden = !message;
  }

  function apiBase() {
    const input = overlay && overlay.querySelector('[data-server-url]');
    const raw = input ? input.value.trim() : defaultServer();
    if (!raw) return '';
    let parsed;
    try { parsed = new URL(raw); } catch (_) { throw new Error('Enter a valid MMO server URL.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname.toLowerCase());
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && local)) {
      throw new Error('Remote MMO servers must use HTTPS. HTTP is allowed only on localhost.');
    }
    return parsed.origin;
  }

  function showStep(step) {
    overlay.querySelectorAll('[data-account-step]').forEach(node => { node.hidden = node.dataset.accountStep !== step; });
    setMessage('');
  }

  async function loadDirectory(base, token) {
    const [regionResult, realmResult] = await Promise.all([
      request(base, '/api/regions', token),
      request(base, '/api/realms', token)
    ]);
    directory.regions = regionResult.regions || [];
    directory.realms = realmResult.realms || [];
    if (!directory.regions.length || !directory.realms.length) throw new Error('No realms are currently configured.');
    selectedRegion = directory.regions[0].id;
    selectedRealm = (directory.realms.find(realm => realm.recommended && realm.status === 'online') ||
      directory.realms.find(realm => realm.status === 'online') || directory.realms[0]).id;
    renderRegions();
    renderRealms();
  }

  function renderRegions() {
    const select = overlay.querySelector('[data-region]');
    select.innerHTML = directory.regions.map(region =>
      '<option value="' + esc(region.id) + '">' + esc(region.name) + ' (' + esc(region.tag) + ')</option>'
    ).join('');
    select.value = selectedRegion;
  }

  function renderRealms() {
    const select = overlay.querySelector('[data-realm]');
    const realms = directory.realms.filter(realm => realm.regionId === selectedRegion);
    if (!realms.some(realm => realm.id === selectedRealm)) selectedRealm = (realms.find(realm => realm.status === 'online') || realms[0] || {}).id || '';
    select.innerHTML = realms.map(realm => {
      const load = realm.population + '/' + realm.maxPlayers;
      const status = String(realm.status || 'unknown').toUpperCase();
      const characters = Number(realm.characters || 0);
      return '<option value="' + esc(realm.id) + '"' + (realm.status !== 'online' ? ' disabled' : '') + '>' +
        esc(realm.name) + ' · ' + esc(realm.type) + ' · ' + status + ' · ' + esc(load) +
        ' · ' + characters + ' hero(s)' + (realm.recommended ? ' · RECOMMENDED' : '') + '</option>';
    }).join('');
    select.value = selectedRealm;
    const current = realms.find(realm => realm.id === selectedRealm);
    const detail = overlay.querySelector('[data-realm-detail]');
    detail.textContent = current
      ? current.name + ' — ' + current.type + ' — ' + current.population + ' online / ' +
        current.maxPlayers + ' capacity — ' + (current.characters || 0) + ' character(s) on this realm'
      : 'No available realm in this region.';
    overlay.querySelector('[data-enter-creation]').disabled = !current || current.status !== 'online';
  }

  async function authenticate(mode) {
    let base;
    try { base = apiBase(); } catch (error) { return setMessage(error.message, true); }
    const username = overlay.querySelector('[data-username]').value.trim();
    const password = overlay.querySelector('[data-password]').value;
    if (!base) return setMessage('Enter the MMO server URL, or choose PLAY OFFLINE INSTEAD.', true);
    if (!username || !password) return setMessage('Enter your account name and password.', true);
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return setMessage('Account names must be 3–16 letters, numbers or underscores.', true);
    if (mode === 'register' && (password.length < 10 || password.length > 72)) return setMessage('New passwords must be 10–72 characters.', true);
    if (mode === 'login' && password.length > 72) return setMessage('Password is too long.', true);
    const buttons = overlay.querySelectorAll('[data-login], [data-register]');
    buttons.forEach(button => { button.disabled = true; });
    setMessage('Connecting to ' + base.replace(/^https?:\/\//, '') + '…');
    try {
      await checkServer(base);
      try { localStorage.setItem('gbq_mmo_server_url', base); } catch (_) {}
      setMessage(mode === 'register' ? 'Creating account…' : 'Signing in…');
      const result = await request(base, '/api/' + (mode === 'register' ? 'register' : 'login'), null, {
        method: 'POST', body: { username, password }
      });
      activeSession = { baseUrl: base.replace(/\/+$/, ''), token: result.token, account: result.account };
      const me = await request(activeSession.baseUrl, '/api/me', activeSession.token);
      activeSession.characters = me.characters || [];
      await loadDirectory(activeSession.baseUrl, activeSession.token);
      overlay.querySelector('[data-account-identity]').textContent = 'SIGNED IN AS ' + activeSession.account.username;
      overlay.querySelector('[data-password]').value = '';
      showStep('realm');
    } catch (error) {
      activeSession = null;
      setMessage(error.message || 'Account sign-in failed.', true);
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
  }

  function close() {
    if (overlay) overlay.remove();
    overlay = null;
    activeSession = null;
    onReady = null;
  }

  function open(options = {}) {
    if (overlay) return;
    onReady = typeof options.onReady === 'function' ? options.onReady : null;
    overlay = document.createElement('section');
    overlay.className = 'gbq-account-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Account and realm selection');
    overlay.innerHTML =
      '<div class="gbq-account-window">' +
        '<header><div><small>LOST KINGDOM · ONLINE SERVICES</small><h2>ACCOUNT & REALM GATEWAY</h2></div>' +
          '<button type="button" data-close aria-label="Close">×</button></header>' +
        '<div class="gbq-account-message" data-account-message hidden role="status"></div>' +
        '<section class="gbq-account-step" data-account-step="auth">' +
          '<p class="gbq-account-intro">Create an online account or sign in to choose a realm and save your hero to the server.</p>' +
          '<label>MMO SERVER URL<input data-server-url type="url" spellcheck="false" value="' + esc(defaultServer()) + '" placeholder="https://your-realm-server.example"></label>' +
          '<label>ACCOUNT NAME<input data-username autocomplete="username" minlength="3" maxlength="16" required></label>' +
          '<label>PASSWORD<input data-password type="password" autocomplete="current-password" minlength="10" maxlength="72" required></label>' +
          '<div class="gbq-account-actions"><button type="button" data-login>SIGN IN</button><button type="button" data-register>CREATE ACCOUNT</button></div>' +
          '<p class="gbq-account-note">Accounts are stored by the MMO server. Passwords are never saved in this browser. Use HTTPS for remote servers.</p>' +
          '<button type="button" class="gbq-account-secondary" data-offline>PLAY OFFLINE INSTEAD</button>' +
        '</section>' +
        '<section class="gbq-account-step" data-account-step="realm" hidden>' +
          '<p class="gbq-account-intro" data-account-identity></p>' +
          '<label>REGION / DATA CENTER<select data-region></select></label>' +
          '<label>REALM / WORLD<select data-realm></select></label>' +
          '<p class="gbq-account-realm-detail" data-realm-detail></p>' +
          '<div class="gbq-account-actions"><button type="button" data-enter-creation>CONTINUE TO CHARACTER CREATION</button>' +
          '<button type="button" data-back-account>BACK</button></div>' +
          '<p class="gbq-account-note">Each hero belongs to one realm. Character names are unique per realm. Limits: 3 heroes per realm and 12 per account.</p>' +
          '<button type="button" class="gbq-account-secondary" data-logout>USE A DIFFERENT ACCOUNT</button>' +
        '</section>' +
        '<footer>SERVER-AUTHENTICATED · REALM-SCOPED CHARACTERS · PERSISTENT ACCOUNT</footer>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-login]').addEventListener('click', () => authenticate('login'));
    overlay.querySelector('[data-register]').addEventListener('click', () => authenticate('register'));
    overlay.querySelector('[data-password]').addEventListener('keydown', event => { if (event.key === 'Enter') authenticate('login'); });
    overlay.querySelector('[data-offline]').addEventListener('click', () => { close(); options.onReady && options.onReady(null); });
    overlay.querySelector('[data-region]').addEventListener('change', event => { selectedRegion = event.target.value; renderRealms(); });
    overlay.querySelector('[data-realm]').addEventListener('change', event => { selectedRealm = event.target.value; renderRealms(); });
    overlay.querySelector('[data-back-account]').addEventListener('click', () => showStep('auth'));
    overlay.querySelector('[data-logout]').addEventListener('click', () => { activeSession = null; showStep('auth'); });
    overlay.querySelector('[data-enter-creation]').addEventListener('click', () => {
      const realm = directory.realms.find(item => item.id === selectedRealm && item.status === 'online');
      if (!activeSession || !realm) return setMessage('Choose an online realm before continuing.', true);
      const session = Object.assign({}, activeSession, { realm });
      close();
      if (options.onReady) options.onReady(session);
    });
    overlay.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    if (!defaultServer()) {
      setMessage('No MMO server is set. Enter its address to play online, or choose PLAY OFFLINE INSTEAD.');
      overlay.querySelector('[data-server-url]').focus();
    } else overlay.querySelector('[data-username]').focus();
  }

  async function createCharacter(session, name, localClass) {
    if (!session || !session.token || !session.realm) throw new Error('Sign in and select a realm before creating an online character.');
    const classData = typeof CLASSES !== 'undefined' ? CLASSES[localClass] : (window.CLASSES && window.CLASSES[localClass]);
    const role = (classData && classData.role) || '';
    const classMap = {
      warden: 'warrior', berserker: 'warrior', vanguard: 'warrior', sunwarden: 'warrior',
      chaplain: 'cleric', cantor: 'cleric', ascetic: 'cleric', arcanist: 'mage',
      runeblade: 'mage', stormcaller: 'mage', shade: 'rogue', shinobi: 'rogue',
      ronin: 'rogue', bladedancer: 'rogue', strider: 'ranger', voidhunter: 'ranger',
      corsair: 'ranger', beastcaller: 'ranger', wildblood: 'ranger', verdant: 'cleric',
      pactbound: 'mage', necromancer: 'mage', summoner: 'mage', dreadknight: 'warrior',
      wyrmlancer: 'warrior', scalesage: 'mage', puppeteer: 'mage'
    };
    const serverClass = classMap[localClass] || ({ tank: 'warrior', healer: 'cleric', caster: 'mage', striker: 'ranger', support: 'adventurer', dps: 'rogue' })[role] || 'adventurer';
    const result = await request(session.baseUrl, '/api/characters', session.token, {
      method: 'POST', body: { name, class: serverClass, realmId: session.realm.id }
    });
    return result.character;
  }

  async function gameplayRequest(path, options = {}) {
    if (!gameplaySession || !gameplaySession.token) throw new Error('Online session expired. Sign in again to use server progression.');
    return request(gameplaySession.baseUrl, path, gameplaySession.token, options);
  }

  window.GBQMMOAccount = {
    open,
    close,
    createCharacter,
    adoptGameplaySession(session) {
      if (!session || !session.token || !session.baseUrl) throw new Error('A valid online session is required.');
      gameplaySession = { baseUrl: session.baseUrl, token: session.token, account: session.account, realm: session.realm };
      return true;
    },
    gameplayRequest,
    describeError,
    defaultServer,
    get hasGameplaySession() { return !!(gameplaySession && gameplaySession.token); },
    get session() { return activeSession; },
    logout() { activeSession = null; gameplaySession = null; }
  };
})();