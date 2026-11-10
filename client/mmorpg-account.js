// Account and realm gateway used before online character creation.
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.GBQMMOAccount) return;

  let activeSession = null;
  let overlay = null;
  let onReady = null;
  let directory = { regions: [], realms: [] };
  let selectedRegion = '';
  let selectedRealm = '';

  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);

  async function request(base, path, token, options = {}) {
    const headers = { accept: 'application/json' };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = 'Bearer ' + token;
    const response = await fetch(base.replace(/\/+$/, '') + path, {
      method: options.method || 'GET', headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'omit', cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw Object.assign(new Error(data.error || 'request_failed'), { status: response.status, code: data.error });
    return data;
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
    const raw = (input && input.value.trim()) || window.GBQ_MMO_REALM_URL || location.origin;
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
    if (!base || !username || !password) return setMessage('Enter the MMO server URL, account name and password.', true);
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) return setMessage('Account names must be 3–16 letters, numbers or underscores.', true);
    if (mode === 'register' && (password.length < 10 || password.length > 72)) return setMessage('New passwords must be 10–72 characters.', true);
    if (mode === 'login' && password.length > 72) return setMessage('Password is too long.', true);
    const buttons = overlay.querySelectorAll('[data-login], [data-register]');
    buttons.forEach(button => { button.disabled = true; });
    setMessage(mode === 'register' ? 'Creating account…' : 'Signing in…');
    try {
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
      setMessage(error.code === 'username_taken' ? 'That account name is already in use.' :
        error.code === 'invalid_credentials' ? 'The account name or password is incorrect.' :
        error.code === 'too_many_auth_attempts' ? 'Too many attempts. Wait before trying again.' :
        error.message || 'Account sign-in failed.', true);
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
          '<label>MMO SERVER URL<input data-server-url type="url" spellcheck="false" value="' + esc(window.GBQ_MMO_REALM_URL || location.origin) + '" placeholder="https://your-realm-server.example"></label>' +
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
    overlay.querySelector('[data-username]').focus();
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

  window.GBQMMOAccount = {
    open,
    close,
    createCharacter,
    get session() { return activeSession; },
    logout() { activeSession = null; }
  };
})();