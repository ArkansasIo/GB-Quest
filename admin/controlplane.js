'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const message = $('message'), loginPanel = $('loginPanel'), loginForm = $('loginForm');
  const adminPanel = $('adminPanel'), sessionLabel = $('sessionLabel');
  const refreshButton = $('refresh'), logoutButton = $('logout');
  const nav = $('adminNav'), overview = $('overview'), players = $('players');
  const staff = $('staff'), audit = $('audit'), settingsForm = $('settingsForm');
  const createAccountForm = $('createAccountForm');
  let token = readToken(), accountName = '', myRole = '', permissions = [], accountRows = [], activeTab = '';

  function readToken() {
    try { return sessionStorage.getItem('gbq_admin_token') || localStorage.getItem('gbq_token') || ''; }
    catch { return ''; }
  }
  function saveToken(value) {
    token = value;
    try { if (value) sessionStorage.setItem('gbq_admin_token', value); else sessionStorage.removeItem('gbq_admin_token'); }
    catch { /* Keep this session in memory if browser storage is unavailable. */ }
  }
  function say(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
  function signedOut() {
    loginPanel.hidden = false; adminPanel.hidden = true;
    refreshButton.hidden = true; logoutButton.hidden = true;
    sessionLabel.textContent = 'Sign in with your dedicated admin account';
  }
  function signedIn() {
    loginPanel.hidden = true; adminPanel.hidden = false;
    refreshButton.hidden = false; logoutButton.hidden = false;
    sessionLabel.textContent = accountName ? `Signed in as ${accountName}` : 'Authenticated staff session';
  }
  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) {
      if ((response.status === 401 || (response.status === 403 && path === '/api/admin/me')) && path !== '/api/login') {
        saveToken(''); accountName = ''; signedOut();
      }
      throw new Error(value.error || `Request failed (${response.status})`);
    }
    return value;
  }
  function can(permission) { return permissions.includes(permission); }

  function showTab(id) {
    activeTab = id;
    for (const panel of adminPanel.querySelectorAll('[data-panel]')) panel.hidden = panel.dataset.panel !== id;
    for (const button of nav.querySelectorAll('button[data-tab]')) {
      if (button.dataset.tab === id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  }
  function buildNav() {
    nav.replaceChildren();
    const tabs = [
      ['overview', 'Overview', 'overview.view'], ['players', 'Accounts', 'players.view'],
      ['settings', 'Game settings', 'settings.manage'], ['permissions', 'Permissions', 'staff.manage'], ['audit', 'Audit log', 'audit.view'],
    ].filter(([, , permission]) => can(permission));
    for (const [id, label] of tabs) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.tab = id; button.textContent = label;
      button.addEventListener('click', () => showTab(id)); nav.append(button);
    }
    if (!tabs.some(([id]) => id === activeTab)) activeTab = tabs[0]?.[0] || 'overview';
    showTab(activeTab);
  }
  function renderCards(data) {
    overview.replaceChildren();
    for (const [label, value] of Object.entries({ Realm: data.realm, Online: data.online, Accounts: data.accounts, Suspended: data.bans, Listings: data.activeListings, Invites: data.activeInvites })) {
      const card = document.createElement('div'); card.className = 'card';
      const number = document.createElement('strong'); number.textContent = String(value);
      card.append(number, document.createTextNode(label)); overview.append(card);
    }
    const state = $('realmState'); state.replaceChildren();
    const line = document.createElement('strong'); line.textContent = data.maintenance ? 'MAINTENANCE MODE' : 'Realm operational';
    line.className = data.maintenance ? 'banned' : 'status'; state.append(line);
    state.append(document.createTextNode(` · ${data.realm}`));
  }
  function renderPlayers(rows) {
    players.replaceChildren();
    for (const player of rows) {
      const row = document.createElement('tr');
      const name = document.createElement('td'); name.textContent = player.name;
      const status = document.createElement('td'); status.textContent = player.banned ? 'Suspended' : player.online ? 'Online' : 'Offline'; status.className = player.banned ? 'banned' : player.online ? 'status' : 'muted';
      const login = document.createElement('td'); login.textContent = player.lastLogin ? new Date(player.lastLogin).toLocaleString() : 'Never';
      const actionCell = document.createElement('td'), button = document.createElement('button');
      button.textContent = player.banned ? 'Restore access' : 'Suspend'; button.className = player.banned ? '' : 'danger';
      button.addEventListener('click', async () => {
        const action = player.banned ? 'unban' : 'ban';
        const reason = action === 'ban' ? window.prompt(`Reason for suspending ${player.name}:`, 'Policy review') : '';
        if (action === 'ban' && reason === null) return;
        button.disabled = true;
        try { await api(`/api/admin/players/${encodeURIComponent(player.id)}/${action}`, { method: 'POST', body: { reason } }); await load(); }
        catch (error) { say(error.message, true); button.disabled = false; }
      });
      actionCell.append(button); row.append(name, status, login, actionCell); players.append(row);
    }
  }
  function renderSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      const field = settingsForm.elements.namedItem(key); if (!field) continue;
      if (field.type === 'checkbox') field.checked = Boolean(value); else field.value = String(value);
    }
  }
  function renderStaff() {
    staff.replaceChildren();
    for (const person of accountRows) {
      const row = document.createElement('tr'), name = document.createElement('td'), current = document.createElement('td'), action = document.createElement('td');
      name.textContent = person.name; current.textContent = person.role;
      const select = document.createElement('select');
      for (const [value, label] of [['player', 'Player'], ['moderator', 'Moderator']]) {
        const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
      }
      { const option = document.createElement('option'); option.value = 'admin'; option.textContent = 'Admin'; option.disabled = myRole !== 'root'; select.append(option); }
      select.value = person.role === 'moderator' ? 'moderator' : 'player';
      if (person.role === 'admin') {
        select.value = 'admin'; current.textContent = 'admin';
        if (myRole !== 'root') select.disabled = true;
      }
      if (person.role === 'root') { select.disabled = true; select.value = 'player'; current.textContent = 'root (environment configured)'; }
      select.addEventListener('change', async () => {
        select.disabled = true;
        try {
          await api(`/api/admin/players/${encodeURIComponent(person.id)}/role`, { method: 'PUT', body: { role: select.value } });
          say(`Updated ${person.name}'s role.`); await load();
        } catch (error) { say(error.message, true); select.disabled = false; }
      });
      action.append(select); row.append(name, current, action); staff.append(row);
    }
  }
  function renderAudit(entries) {
    audit.replaceChildren();
    for (const entry of entries) {
      const item = document.createElement('li');
      const details = entry.details ? ` · ${JSON.stringify(entry.details)}` : '';
      item.textContent = `${new Date(entry.at).toLocaleString()} · ${entry.actor} · ${entry.action} · ${entry.target}${details}`;
      audit.append(item);
    }
  }

  async function load() {
    if (!token) { signedOut(); say('Sign in with an account granted realm staff permissions.', true); return; }
    try {
      const me = await api('/api/admin/me');
      accountName = me.account.name; myRole = me.role; permissions = me.permissions; signedIn(); buildNav();
      $('createAdminRole').hidden = myRole !== 'root'; $('createAdminRole').disabled = myRole !== 'root';
      const jobs = [api('/api/admin/overview')];
      if (can('players.view')) jobs.push(api('/api/admin/players'));
      if (can('settings.manage')) jobs.push(api('/api/admin/settings'));
      if (can('audit.view')) jobs.push(api('/api/admin/audit'));
      const results = await Promise.all(jobs);
      let i = 0; renderCards(results[i++]);
      if (can('players.view')) { accountRows = results[i++].players; renderPlayers(accountRows); }
      if (can('settings.manage')) renderSettings(results[i++].settings);
      if (can('audit.view')) renderAudit(results[i++].entries);
      if (can('staff.manage')) renderStaff();
      say(`Access verified · ${me.role}.`);
    } catch (error) { say(error.message, true); }
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = loginForm.querySelector('button[type="submit"]'), fields = new FormData(loginForm);
    submit.disabled = true; say('Signing in…');
    try {
      const result = await api('/api/login', { method: 'POST', body: { username: fields.get('username'), password: fields.get('password') } });
      saveToken(result.token); accountName = result.account?.name || String(fields.get('username') || '');
      loginForm.reset(); await load();
    } catch (error) { say(error.message, true); }
    finally { submit.disabled = false; }
  });
  settingsForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(settingsForm), settings = {};
    for (const field of settingsForm.elements) {
      if (!field.name) continue;
      if (field.type === 'checkbox') settings[field.name] = field.checked;
      else if (field.type === 'number') settings[field.name] = Number(form.get(field.name));
      else settings[field.name] = String(form.get(field.name) || '').trim();
    }
    const submit = settingsForm.querySelector('button[type="submit"]'); submit.disabled = true;
    try { const result = await api('/api/admin/settings', { method: 'PUT', body: settings }); renderSettings(result.settings); say('Realm settings saved.'); await load(); }
    catch (error) { say(error.message, true); }
    finally { submit.disabled = false; }
  });
  createAccountForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = createAccountForm.querySelector('button[type="submit"]');
    const fields = new FormData(createAccountForm);
    submit.disabled = true; say('Creating account…');
    try {
      const result = await api('/api/admin/accounts', { method: 'POST', body: {
        username: fields.get('username'), password: fields.get('password'), role: fields.get('role'),
      } });
      createAccountForm.reset();
      say(`Created ${result.role} account ${result.account.name}. Share its password securely.`);
      await load();
    } catch (error) { say(error.message, true); }
    finally { submit.disabled = false; }
  });
  refreshButton.addEventListener('click', load);
  logoutButton.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch { /* Clear local state even if the token expired. */ }
    saveToken(''); accountName = ''; myRole = ''; permissions = []; signedOut(); say('Signed out.');
  });
  load();
})();
