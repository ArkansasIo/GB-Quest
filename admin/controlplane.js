'use strict';
(() => {
  const token = (() => { try { return localStorage.getItem('gbq_token') || ''; } catch { return ''; } })();
  const message = document.getElementById('message');
  const overview = document.getElementById('overview');
  const players = document.getElementById('players');
  const audit = document.getElementById('audit');

  async function api(path, options = {}) {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`);
    return value;
  }

  function say(text, error = false) {
    message.textContent = text;
    message.classList.toggle('error', error);
  }

  function renderCards(data) {
    overview.replaceChildren();
    for (const [label, value] of Object.entries({ Realm: data.realm, Online: data.online, Accounts: data.accounts, Suspended: data.bans, Listings: data.activeListings, Invites: data.activeInvites })) {
      const card = document.createElement('div'); card.className = 'card';
      const number = document.createElement('strong'); number.textContent = String(value);
      card.append(number, document.createTextNode(label)); overview.append(card);
    }
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

  async function load() {
    if (!token) { say('Log in to the game with the configured admin account, then reload this page.', true); return; }
    try {
      const [summary, accountList, auditLog] = await Promise.all([api('/api/admin/overview'), api('/api/admin/players'), api('/api/admin/audit')]);
      renderCards(summary); renderPlayers(accountList.players);
      audit.replaceChildren();
      for (const entry of auditLog.entries) { const item = document.createElement('li'); item.textContent = `${new Date(entry.at).toLocaleString()} · ${entry.actor} · ${entry.action} · ${entry.target}`; audit.append(item); }
      say('Admin access verified.');
    } catch (error) { say(error.message, true); }
  }

  document.getElementById('refresh').addEventListener('click', load);
  load();
})();
