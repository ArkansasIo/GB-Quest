class GBQuestMMOApi {
  constructor({baseUrl,onStatus=()=>{},onMessage=()=>{}}={}) {
    if(!baseUrl) throw new TypeError('baseUrl is required');
    const parsed=new URL(baseUrl);
    const localDevelopmentHost=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(parsed.host);
    if(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&localDevelopmentHost)) throw new TypeError('Remote MMO realms must use HTTPS; HTTP is allowed only on localhost');
    this.baseUrl=parsed.origin; this.token=null; this.onStatus=onStatus; this.onMessage=onMessage; this.socket=null; this.sequence=0;
  }
  async request(path,{method='GET',body,auth=true}={}) {
    const headers={accept:'application/json'};
    if(body!==undefined) headers['content-type']='application/json';
    if(auth&&this.token) headers.authorization='Bearer '+this.token;
    const response=await fetch(this.baseUrl+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit'});
    const data=await response.json();
    if(!response.ok) throw Object.assign(new Error(data.error||'request_failed'),{status:response.status,code:data.error});
    return data;
  }
  async register(username,password) { const result=await this.request('/api/register',{method:'POST',body:{username,password},auth:false});this.token=result.token;return result; }
  async login(username,password) { const result=await this.request('/api/login',{method:'POST',body:{username,password},auth:false});this.token=result.token;return result; }
  me() { return this.request('/api/me'); }
  regions() { return this.request('/api/regions',{auth:false}); }
  realms(regionId) { return this.request('/api/realms'+(regionId?'?region='+encodeURIComponent(regionId):''),{auth:false}); }
  characters(realmId) { return this.request('/api/characters'+(realmId?'?realm='+encodeURIComponent(realmId):'')); }
  createCharacter(name,characterClass,realmId,species,background) {
    return this.request('/api/characters',{method:'POST',body:{name,class:characterClass,...(realmId?{realmId}:{}),...(species?{species}:{}),...(background?{background}:{})}});
  }
  whispers(characterId,peerId,limit=50) {
    const query=new URLSearchParams(); if(peerId)query.set('with',peerId);query.set('limit',String(limit));
    return this.request('/api/characters/'+encodeURIComponent(characterId)+'/whispers?'+query.toString());
  }
  sendWhisper(characterId,toCharacterId,text) {
    return this.request('/api/characters/'+encodeURIComponent(characterId)+'/whispers',{method:'POST',body:{toCharacterId,text}});
  }
  inventory(id) { return this.request('/api/characters/'+encodeURIComponent(id)+'/inventory'); }
  dungeonCatalog() { return this.request('/api/dungeons/catalog',{auth:false}); }
  joinDungeonQueue(characterId,dungeonId,role) {
    return this.request('/api/dungeons/queue',{method:'POST',body:{characterId,dungeonId,role}});
  }
  dungeonQueueStatus(characterId) { return this.request('/api/dungeons/queue/'+encodeURIComponent(characterId)); }
  leaveDungeonQueue(characterId) { return this.request('/api/dungeons/queue/'+encodeURIComponent(characterId),{method:'DELETE'}); }
  dungeonGroup(groupId) { return this.request('/api/dungeons/groups/'+encodeURIComponent(groupId)); }
  startDungeonGroup(groupId) { return this.request('/api/dungeons/groups/'+encodeURIComponent(groupId)+'/start',{method:'POST',body:{}}); }
  completeDungeonGroup(groupId) { return this.request('/api/dungeons/groups/'+encodeURIComponent(groupId)+'/complete',{method:'POST',body:{}}); }
  trades(id) { return this.request('/api/characters/'+encodeURIComponent(id)+'/trades'); }
  createTrade(id,toCharacterId,offer={}) { return this.request('/api/characters/'+encodeURIComponent(id)+'/trades',{method:'POST',body:{...offer,toCharacterId}}); }
  acceptTrade(id) { return this.request('/api/trades/'+encodeURIComponent(id)+'/accept',{method:'POST',body:{}}); }
  cancelTrade(id) { return this.request('/api/trades/'+encodeURIComponent(id)+'/cancel',{method:'POST',body:{}}); }
  wallet(id) { return this.request('/api/characters/'+encodeURIComponent(id)+'/wallet'); }
  bank(id) { return this.request('/api/characters/'+encodeURIComponent(id)+'/bank'); }
  depositBank(id,amount) { return this.request('/api/characters/'+encodeURIComponent(id)+'/bank/deposit',{method:'POST',body:{amount}}); }
  withdrawBank(id,amount) { return this.request('/api/characters/'+encodeURIComponent(id)+'/bank/withdraw',{method:'POST',body:{amount}}); }
  connect() {
    if(!this.token) throw new Error('Log in before connecting to the realm');
    const wsUrl=new URL('/ws',this.baseUrl); wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';
    const local=/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(new URL(this.baseUrl).host);
    if(wsUrl.protocol!=='wss:'&&!local) throw new Error('Secure WSS is required for remote realms');
    this.disconnect(); const socket=new WebSocket(wsUrl.toString()); this.socket=socket; this.onStatus('connecting');
    const current=()=>this.socket===socket;
    socket.addEventListener('open',()=>{if(!current())return;this.onStatus('connected');this.send('authenticate',{token:this.token});});
    socket.addEventListener('message',event=>{if(!current())return;let message;try{message=JSON.parse(event.data);}catch{this.onStatus('invalid_message');return;}if(message&&typeof message.type==='string')this.onMessage(message);});
    socket.addEventListener('close',()=>{if(current()){this.socket=null;this.onStatus('disconnected');}});
    socket.addEventListener('error',()=>{if(current())this.onStatus('error');});
  }
  send(type,payload={}) { if(!this.socket||this.socket.readyState!==1)return false;this.socket.send(JSON.stringify({type,sequence:++this.sequence,payload}));return true; }
  selectCharacter(characterId) { if(!this.send('character.select',{characterId})) throw new Error('Connect to the realm before selecting a character'); }
  disconnect() { const socket=this.socket;if(!socket)return;this.socket=null;socket.close();this.onStatus('disconnected'); }
  logout() { this.disconnect();this.token=null; }
}


(() => {
  'use strict';
  if (window.GBQMMOTrade) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const state = { api:null, characters:[], selected:null, players:[], inventory:[], offers:[], bank:null, status:'disconnected', busy:false, error:'', tab:'trade', seenOfferIds:new Set(), offersInitialized:false, pollHandle:null, refreshing:false, offerFilter:'all' };
  const storageKey = 'gbq.mmo.trade.realm';
  function apiBase() {
    try { return localStorage.getItem(storageKey) || window.GBQ_MMO_REALM_URL || location.origin; }
    catch { return window.GBQ_MMO_REALM_URL || location.origin; }
  }
  function setStatus(value) { state.status=value; const node=document.querySelector('[data-mmo-status]'); if(node) node.textContent=value.toUpperCase(); if(value==='error'||value==='disconnected') state.authReject?.(new Error('Realm connection '+value)); }
  function panel() { return document.getElementById('gbq-trade-panel'); }
  function toast(message) {
    const node=panel()?.querySelector('[data-mmo-message]');
    if(node) { node.textContent=message; node.hidden=false; }
  }
  function hideMessage() { const node=panel()?.querySelector('[data-mmo-message]'); if(node) node.hidden=true; }
  function createApi(base) {
    if (state.api) state.api.logout();
    state.players=[]; state.selected=null;
    state.api=new GBQuestMMOApi({baseUrl:base,onStatus:setStatus,onMessage:handleMessage});
    try { localStorage.setItem(storageKey,base); } catch {}
    return state.api;
  }
  function handleMessage(message) {
    const p=message.payload||{};
    if(message.type==='authenticated') { state.authResolve?.(); state.authResolve=null; state.authReject=null; if(Array.isArray(p.characters)) state.characters=p.characters; }
    if(message.type==='zone.snapshot') {
      state.players=Array.isArray(p.players)?p.players:[];
      if(p.self) state.selected={...(state.selected||{}),...p.self};
      refresh();
    } else if(message.type==='presence.joined') {
      if(p.id && p.id!==state.selected?.id) state.players=[...state.players.filter(x=>x.id!==p.id),p];
      refresh();
    } else if(message.type==='presence.moved') {
      state.players=state.players.map(x=>x.id===p.characterId?{...x,x:p.x,y:p.y}:x);
      refresh();
    } else if(message.type==='presence.left') {
      state.players=state.players.filter(x=>x.id!==p.characterId);
      refresh();
    } else if(message.type==='error') {
      toast('Realm: '+(p.code||'server_error'));
    }
  }
  async function refresh() {
    if(!state.api?.token || !state.selected || state.refreshing) return;
    state.refreshing=true;
    try {
      const [trades,inventory,wallet,bank]=await Promise.all([
        state.api.trades(state.selected.id),state.api.inventory(state.selected.id),state.api.wallet(state.selected.id),state.api.bank(state.selected.id)
      ]);
      const nextOffers=trades.trades||[];
      const incoming=nextOffers.filter(o=>o.to_character_id===state.selected.id&&o.status==='pending');
      const unseen=state.offersInitialized?incoming.filter(o=>!state.seenOfferIds.has(o.id)):[];
      for(const offer of nextOffers) state.seenOfferIds.add(offer.id);
      state.offersInitialized=true;
      state.offers=nextOffers; state.inventory=inventory.items||[]; state.wallet=wallet; state.bank=bank;
      const badge=panel()?.querySelector('[data-tab="offers"]');
      if(badge) badge.textContent='OFFERS'+(incoming.length?' ('+incoming.length+')':'');
      if(unseen.length) toast('New trade offer from '+unseen.map(o=>o.from_name).filter(Boolean).join(', '));
      renderContent();
    } catch(error) { toast(error.message||'Could not refresh trading data'); }
    finally { state.refreshing=false; }
  }
  function startPolling() {
    if(state.pollHandle!==null) window.clearInterval(state.pollHandle);
    state.pollHandle=window.setInterval(()=>{if(panel()&&state.selected) refresh();},15000);
  }
  function stopPolling() {
    if(state.pollHandle!==null) window.clearInterval(state.pollHandle);
    state.pollHandle=null;
  }
  function render() {
    if(panel()) return;
    const root=document.createElement('section');
    root.id='gbq-trade-panel'; root.className='gbq-trade-overlay'; root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','Realm trading');
    root.innerHTML='<div class="gbq-trade-window"><header class="gbq-trade-header"><div><small>GB-QUEST · REALM ECONOMY</small><h2>PLAYER EXCHANGE</h2><span data-mmo-status>DISCONNECTED</span></div><button type="button" data-close aria-label="Close trading">×</button></header><div class="gbq-trade-message" data-mmo-message hidden></div><div class="gbq-trade-content"><section class="gbq-trade-auth" data-auth><label>MMO SERVER URL<input data-realm-url type="url" value="'+esc(apiBase())+'" placeholder="https://realm.example.com"></label><label>Account name<input data-username autocomplete="username" minlength="3" maxlength="24"></label><label>Password<input data-password type="password" autocomplete="current-password" minlength="10" maxlength="128"></label><div class="gbq-trade-actions"><button type="button" data-login>LOG IN</button><button type="button" data-register>CREATE MMO ACCOUNT</button></div><p>This is the dedicated PostgreSQL MMO realm account. It is separate from offline/local game saves.</p></section><section class="gbq-trade-characters" data-characters hidden><div class="gbq-trade-row"><label>Active character<select data-character></select></label><button type="button" data-connect>CONNECT</button></div><div class="gbq-trade-row"><label>New character name<input data-new-name maxlength="24" placeholder="Character name"></label><label>Class<select data-new-class><option value="ranger">Ranger</option><option value="warrior">Warrior</option><option value="mage">Mage</option><option value="cleric">Cleric</option></select></label><button type="button" data-create-character>CREATE</button></div><nav><button type="button" data-tab="trade">TRADE</button><button type="button" data-tab="offers">OFFERS</button><button type="button" data-tab="bank">BANK</button></nav><div data-mmo-main></div></section></div><footer><span>Same-zone trading · 15-minute offer expiry</span><button type="button" data-logout>LOG OUT</button></footer></div>';
    document.body.appendChild(root);
    root.addEventListener('click',onClick);
    root.addEventListener('submit',onSubmit);
    root.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    root.querySelector('[data-realm-url]').value=apiBase();
    syncAuth();
  }
  function syncAuth() {
    const logged=!!state.api?.token;
    const auth=panel()?.querySelector('[data-auth]'),chars=panel()?.querySelector('[data-characters]');
    if(auth) auth.hidden=logged;
    if(chars) chars.hidden=!logged;
    if(logged) renderContent();
  }
  async function authenticate(kind) {
    const root=panel(),base=root.querySelector('[data-realm-url]').value.trim();
    const username=root.querySelector('[data-username]').value.trim(),password=root.querySelector('[data-password]').value;
    if(!base || !username || !password) throw new Error('Enter the realm URL, account name and password.');
    const api=createApi(base);
    const result=await api[kind](username,password);
    try { localStorage.setItem('gbq.mmo.token',api.token); } catch {}
    await loadCharacters(result.characters);
    syncAuth();
  }
  async function loadCharacters(existing) {
    const result=existing?{characters:existing}:await state.api.characters();
    state.characters=result.characters||[];
    if(!state.characters.length) { toast('Create a character to enter the realm.'); renderContent(); return; }
    const select=panel().querySelector('[data-character]');
    select.innerHTML=state.characters.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · Lv '+esc(c.level||1)+'</option>').join('');
    renderContent();
  }
  async function selectCharacter() {
    const id=panel().querySelector('[data-character]').value;
    const character=state.characters.find(c=>c.id===id);
    if(!character) throw new Error('Select a character first.');
    state.selected=character;
    state.seenOfferIds=new Set(); state.offersInitialized=false;
    state.api.connect();
    await new Promise((resolve,reject)=>{
      const timeout=window.setTimeout(()=>{state.authResolve=null;state.authReject=null;reject(new Error('Timed out authenticating with the realm.'));},12000);
      state.authResolve=()=>{window.clearTimeout(timeout);resolve();};
      state.authReject=error=>{window.clearTimeout(timeout);state.authResolve=null;state.authReject=null;reject(error);};
    });
    state.api.selectCharacter(id);
    await refresh();
    startPolling();
    renderContent();
  }
  function renderContent() {
    const target=panel()?.querySelector('[data-mmo-main]');
    if(!target) return;
    if(!state.selected) {
      target.innerHTML='<p class="gbq-trade-empty">Choose a character and connect to see players in your current zone.</p>';
      return;
    }
    if(state.tab==='bank') {
      const bank=state.bank||{};
      target.innerHTML='<h3>CHARACTER BANK</h3><div class="gbq-trade-bank-balances"><div><small>AVAILABLE WALLET</small><b>'+esc(state.wallet?.gold??bank.gold??0)+' GOLD</b></div><div><small>SECURE BANK</small><b>'+esc(bank.bankGold??0)+' GOLD</b></div></div><div class="gbq-trade-bank-actions"><form data-bank-action="deposit"><label>Deposit gold<input data-bank-amount type="number" min="1" max="1000000000" step="1" value="100" required></label><button type="submit">DEPOSIT</button></form><form data-bank-action="withdraw"><label>Withdraw gold<input data-bank-amount type="number" min="1" max="1000000000" step="1" value="100" required></label><button type="submit">WITHDRAW</button></form></div><p class="gbq-trade-empty">Transfers are processed by the realm server and recorded in the persistent bank ledger.</p>';
      return;
    }
    if(state.tab==='offers') {
      const filters=['all','incoming','outgoing','pending','completed','closed'];
      const filtered=state.offers.filter(o=>{
        const incoming=o.to_character_id===state.selected.id;
        if(state.offerFilter==='incoming') return incoming;
        if(state.offerFilter==='outgoing') return !incoming;
        if(state.offerFilter==='pending'||state.offerFilter==='completed') return o.status===state.offerFilter;
        if(state.offerFilter==='closed') return o.status==='cancelled'||o.status==='expired';
        return true;
      });
      target.innerHTML='<h3>TRADE HISTORY <small>'+state.offers.length+' RECORDS</small></h3><div class="gbq-trade-filterbar">'+filters.map(filter=>'<button type="button" data-offer-filter="'+filter+'" aria-pressed="'+(state.offerFilter===filter)+'">'+filter.toUpperCase()+'</button>').join('')+'</div>'+(filtered.length?filtered.map(o=>{
        const incoming=o.to_character_id===state.selected.id, action=incoming&&o.status==='pending'?'<button data-accept="'+esc(o.id)+'">ACCEPT</button>':'';
        const cancel=(o.status==='pending'&&(incoming||o.from_character_id===state.selected.id))?'<button data-cancel="'+esc(o.id)+'">CANCEL</button>':'';
        return '<article class="gbq-trade-offer"><b>'+esc(incoming?'INCOMING':'OUTGOING')+' · '+esc(o.status)+'</b><span>'+esc(o.from_name)+' → '+esc(o.to_name)+'</span><span>'+esc(o.item_name||'Gold')+' × '+esc(o.quantity||0)+' · '+esc(o.gold_amount||0)+' gold</span><div>'+action+cancel+'</div></article>';
      }).join(''):'<p class="gbq-trade-empty">No offers match this history filter.</p>');
      return;
    }
    const players=state.players.filter(p=>p.id!==state.selected.id);
    target.innerHTML='<div class="gbq-trade-balance">WALLET: '+esc(state.wallet?.gold??state.selected.gold??0)+' GOLD</div><h3>PLAYERS IN YOUR ZONE <small>'+players.length+'</small></h3>'+(players.length?'<label>Recipient<select data-recipient>'+players.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+' · Lv '+esc(p.level||1)+'</option>').join('')+'</select></label>':'<p class="gbq-trade-empty">No other connected characters in this zone. Both players must be online in the same zone.</p>')+'<div class="gbq-trade-offer-form"><label>Offer item<select data-item><option value="">No item</option>'+state.inventory.map(i=>'<option value="'+esc(i.item_id)+'" data-inventory="'+esc(i.inventory_id)+'">'+esc(i.item_name||i.name||i.item_id)+' · '+esc(i.quantity)+'</option>').join('')+'</select></label><label>Quantity<input data-quantity type="number" min="1" max="99" value="1"></label><label>Gold offered<input data-gold type="number" min="0" max="1000000000" value="0"></label><button type="button" data-send-offer '+(!players.length?'disabled':'')+'>SEND OFFER</button></div>';
  }
  async function onSubmit(event) {
    const form=event.target.closest('form[data-bank-action]');
    if(!form) return;
    event.preventDefault();
    try {
      hideMessage();
      if(!state.selected||!state.api?.token) throw new Error('Connect a character before using the bank.');
      const amount=Number(form.querySelector('[data-bank-amount]').value);
      if(!Number.isSafeInteger(amount)||amount<1||amount>1000000000) throw new Error('Enter a whole gold amount between 1 and 1,000,000,000.');
      const action=form.dataset.bankAction;
      const result=action==='deposit'?await state.api.depositBank(state.selected.id,amount):await state.api.withdrawBank(state.selected.id,amount);
      toast((action==='deposit'?'Deposited ':'Withdrew ')+Number(result.amount).toLocaleString()+' gold.');
      await refresh();
    } catch(error) { toast(error.message||'Bank transfer failed'); }
  }
  async function onClick(event) {
    const b=event.target.closest('button'); if(!b) return;
    try {
      hideMessage();
      if(b.hasAttribute('data-close')) return close();
      if(b.hasAttribute('data-login')) { await authenticate('login'); return; }
      if(b.hasAttribute('data-register')) { await authenticate('register'); return; }
      if(b.hasAttribute('data-create-character')) {
        const name=panel().querySelector('[data-new-name]').value.trim(),cls=panel().querySelector('[data-new-class]').value;
        const result=await state.api.createCharacter(name,cls); state.characters.push(result.character||result); 
        const select=panel().querySelector('[data-character]'); select.innerHTML=state.characters.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' · Lv '+esc(c.level||1)+'</option>').join(''); select.value=(result.character||result).id; toast('Character created. Connect to enter the zone.'); return;
      }
      if(b.hasAttribute('data-connect')) { await selectCharacter(); return; }
      if(b.dataset.offerFilter) { state.offerFilter=b.dataset.offerFilter; renderContent(); return; }
      if(b.dataset.tab) { state.tab=b.dataset.tab; renderContent(); return; }
      if(b.hasAttribute('data-send-offer')) {
        const root=panel(),item=root.querySelector('[data-item]'),option=item.selectedOptions[0],itemId=item.value||null;
        const quantity=itemId?Number(root.querySelector('[data-quantity]').value):0,goldAmount=Number(root.querySelector('[data-gold]').value);
        if(!itemId&&goldAmount===0) throw new Error('Offer an item, gold, or both.');
        if(itemId&&(!Number.isInteger(quantity)||quantity<1||quantity>99)) throw new Error('Quantity must be between 1 and 99.');
        await state.api.createTrade(state.selected.id,root.querySelector('[data-recipient]').value,{itemId,quantity,goldAmount});
        toast('Trade offer sent. Assets move only when the recipient accepts.');
        await refresh(); return;
      }
      if(b.dataset.accept) { await state.api.acceptTrade(b.dataset.accept); toast('Trade completed.'); await refresh(); return; }
      if(b.dataset.cancel) { await state.api.cancelTrade(b.dataset.cancel); toast('Offer cancelled.'); await refresh(); return; }
      if(b.hasAttribute('data-logout')) { stopPolling(); state.api?.logout(); state.api=null; state.selected=null; state.characters=[]; syncAuth(); setStatus('disconnected'); return; }
    } catch(error) { toast(error.message||'Trading action failed'); }
  }
  function close() { stopPolling(); state.api?.disconnect(); panel()?.remove(); }
  function open() {
    render();
    const token=(()=>{try{return localStorage.getItem('gbq.mmo.token');}catch{return null;}})();
    if(token&&!state.api) {
      const api=createApi(apiBase()); api.token=token;
      api.me().then(()=>loadCharacters()).then(syncAuth).catch(()=>{try{localStorage.removeItem('gbq.mmo.token');}catch{};state.api=null;syncAuth();});
    }
  }
  window.GBQMMOTrade={open,close,refresh,get status(){return state.status;}};
})();
