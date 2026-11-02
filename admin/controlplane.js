'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const message = $('message'), loginPanel = $('loginPanel'), loginForm = $('loginForm');
  const adminPanel = $('adminPanel'), sessionLabel = $('sessionLabel');
  const refreshButton = $('refresh'), logoutButton = $('logout');
  const nav = $('adminNav'), overview = $('overview'), players = $('players');
  const staff = $('staff'), audit = $('audit'), logs = $('logs'), settingsForm = $('settingsForm');
  const auditFilter = $('auditFilter'), logsFilter = $('logsFilter');
  let auditRows = [], logRows = [];
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
      ['logs', 'Debug log', 'logs.view', 'debug'],
    ].filter(([, , permission]) => can(permission));
    for (const [id, label, , icon] of tabs) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.tab = id; button.textContent = label; button.className = 'ic ic-' + (icon || id);
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
  function cell(text, className) { const td = document.createElement('td'); td.textContent = text == null ? '' : String(text); if (className) td.className = className; return td; }
  function renderAudit(entries) {
    auditRows = entries; audit.replaceChildren();
    if (!entries.length) { const row = document.createElement('tr'); row.append(cell('No matching entries.', 'muted')); audit.append(row); return; }
    for (const entry of entries) {
      const row = document.createElement('tr'), outcome = entry.outcome || 'success';
      row.append(cell(new Date(entry.at).toLocaleString(), 'nowrap'), cell(entry.action), cell(outcome, 'out-' + outcome), cell(entry.actor || '—'),
        cell(entry.target || ''), cell(entry.ip || '', 'nowrap'), cell(entry.details ? JSON.stringify(entry.details) : '', 'details'));
      row.title = `#${entry.seq || ''}${entry.reqId ? ' · request ' + entry.reqId : ''}`;
      audit.append(row);
    }
  }
  function renderLogs(data) {
    logRows = data.entries; logs.replaceChildren(); $('logLevel').value = data.level;
    if (!data.entries.length) { const row = document.createElement('tr'); row.append(cell('Nothing logged at this level.', 'muted')); logs.append(row); return; }
    for (const entry of data.entries) {
      const { at, level, msg, ...rest } = entry, row = document.createElement('tr');
      const stack = rest.err && rest.err.stack; if (stack) delete rest.err.stack;
      const text = Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('  ') + (stack ? '\n' + stack : '');
      row.append(cell(new Date(at).toLocaleString(), 'nowrap'), cell(level, 'lvl-' + level), cell(msg), cell(text, 'details'));
      logs.append(row);
    }
  }
  const query = form => { const params = new URLSearchParams(); for (const [k, v] of new FormData(form)) if (String(v).trim()) params.set(k, String(v).trim()); return params; };
  async function loadAudit() { const params = query(auditFilter); params.set('limit', '300'); renderAudit((await api('/api/admin/audit?' + params)).entries); }
  async function loadLogs() { const params = query(logsFilter); params.set('limit', '300'); renderLogs(await api('/api/admin/logs?' + params)); }
  function download(name, rows) {
    const blob = new Blob([rows.map(r => JSON.stringify(r)).join('\n') + '\n'], { type: 'application/x-ndjson' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  auditFilter.addEventListener('submit', event => { event.preventDefault(); loadAudit().catch(error => say(error.message, true)); });
  logsFilter.addEventListener('submit', event => { event.preventDefault(); loadLogs().catch(error => say(error.message, true)); });
  $('auditExport').addEventListener('click', () => download(`audit-${new Date().toISOString().slice(0, 10)}.jsonl`, auditRows));
  $('logsExport').addEventListener('click', () => download(`debug-${new Date().toISOString().slice(0, 10)}.jsonl`, logRows));
  $('auditVerify').addEventListener('click', async () => {
    const status = $('auditStatus'); status.textContent = 'Verifying…'; status.className = 'muted';
    try {
      const r = await api('/api/admin/audit/verify');
      status.textContent = r.ok ? `Chain intact: ${r.checked} entries verified.` : `Chain BROKEN at entry #${r.seq ?? '?'} (${r.file}): ${r.error}`;
      status.className = r.ok ? 'status' : 'banned';
      await loadAudit();
    } catch (error) { status.textContent = error.message; status.className = 'banned'; }
  });
  $('logLevel').addEventListener('change', async event => {
    try { const r = await api('/api/admin/logs/level', { method: 'PUT', body: { level: event.target.value } }); say(`Server log level set to ${r.level}.`); await loadLogs(); }
    catch (error) { say(error.message, true); }
  });

  async function load() {
    if (!token) { signedOut(); say('Sign in with an account granted realm staff permissions.', true); return; }
    try {
      const me = await api('/api/admin/me');
      accountName = me.account.name; myRole = me.role; permissions = me.permissions; signedIn(); buildNav();
      $('createAdminRole').hidden = myRole !== 'root'; $('createAdminRole').disabled = myRole !== 'root';
      const jobs = [api('/api/admin/overview')];
      if (can('players.view')) jobs.push(api('/api/admin/players'));
      if (can('settings.manage')) jobs.push(api('/api/admin/settings'));
      if (can('audit.view')) jobs.push(api('/api/admin/audit?limit=300&' + query(auditFilter)));
      if (can('logs.view')) jobs.push(api('/api/admin/logs?limit=300&' + query(logsFilter)));
      const results = await Promise.all(jobs);
      let i = 0; renderCards(results[i++]);
      if (can('players.view')) { accountRows = results[i++].players; renderPlayers(accountRows); }
      if (can('settings.manage')) renderSettings(results[i++].settings);
      if (can('audit.view')) renderAudit(results[i++].entries);
      if (can('logs.view')) renderLogs(results[i++]);
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
