// CONFIG
const CONFIG = {
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbwsNj9BTMVV1vLpso_ftkIp2T3jZG8eiMQETfpOafrKaU8BO1-sorWDyrvTf7fzUXtzeg/exec',

  DEMO_MODE: false,

  DEMO_PW:   'pass123',
  LS_THEME:  'tt_thm',
  LS_SESSION:'tt_sess',
  PAGE_SIZE: 20,

  MANAGER_PW: 'manager2026',

  TEAM_LEADERS: [
    { id: 'TL1', pw: 'teamlead123', name: 'Team Leader 1' },
    { id: 'TL2', pw: 'teamlead456', name: 'Team Leader 2' },
  ],

  HR_ID: 'HR',
  HR_PW: 'hraccess2026',

  CURRENCY:        '₹',
  OFFICE_START:    '09:30',
  LUNCH_MINS:      45,
  EXTENDED_START:  '19:30',
};

// DATA
let EMPLOYEES = [
  {id:'E01', name:'Amarnath',     team:'3D',                 pw:'pass123'},
  {id:'E02', name:'Joseph',       team:'Design',             pw:'pass124'},
  {id:'E03', name:'Madhumitha',   team:'3D',                 pw:'pass125'},
  {id:'E04', name:'Balaji',       team:'Development',        pw:'pass126'},
  {id:'E05', name:'Soloman',      team:'QA',                 pw:'pass127'},
  {id:'E06', name:'Imran',        team:'Project Management', pw:'pass128'},
  {id:'E07', name:'Shiju',        team:'Development',        pw:'pass129'},
  {id:'E08', name:'minmini',      team:'3D',                 pw:'pass130'},
  {id:'E09', name:'radhakrishna', team:'Design',             pw:'pass131'},
  {id:'E10', name:'VijayManoj',   team:'3D',                 pw:'pass132'},
];

let CLIENTS = [
  {id:'C01', name:'Brigade Group'},
  {id:'C02', name:'Prestige Estates'},
  {id:'C03', name:'Godrej Properties'},
  {id:'C04', name:'Sobha Developers'},
  {id:'C05', name:'Internal Projects'},
];

let PROJECTS = [
  {id:'P01', cid:'C01', name:'Raptakose Luxury Residences'},
  {id:'P02', cid:'C01', name:'Brigade Stellar Phase 2'},
  {id:'P03', cid:'C01', name:'Brigade Northridge VR Tour'},
  {id:'P04', cid:'C02', name:'Prestige Meridian AR App'},
  {id:'P05', cid:'C02', name:'Prestige Shantiniketan Tour'},
  {id:'P06', cid:'C03', name:'Godrej Horizon 3D Render'},
  {id:'P07', cid:'C03', name:'Godrej E-City WebXR'},
  {id:'P08', cid:'C04', name:'Sobha Dream Acres Portal'},
  {id:'P09', cid:'C05', name:'Internal Tooling Suite'},
  {id:'P10', cid:'C05', name:'R&D WebXR Framework'},
];

// UTILS
function $(id) { return document.getElementById(id); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad(n) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function weekStart() {
  const d = new Date();
  const dy = d.getDay();
  d.setDate(d.getDate() + (dy === 0 ? -6 : 1 - dy));
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN',
    { day:'numeric', month:'short', year:'numeric' });
}

function fh(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(type, title, msg = '', ms) {
  const dur = ms || (type==='s' ? 4000 : type==='e' ? 6000 : 4000);
  const ic = {
    s: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>',
    e: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    i: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="ttico">${ic[type]||ic.i}</div><div style="flex:1"><div class="ttit">${esc(title)}</div>${msg ? `<div class="tmsg">${esc(msg)}</div>` : ''}</div>`;
  $('tbox').appendChild(el);
  const t = setTimeout(() => rmToast(el), dur);
  el.onclick = () => { clearTimeout(t); rmToast(el); };
}
function rmToast(el) { el.classList.add('out'); setTimeout(() => el.remove(), 200); }

function getTheme() { return localStorage.getItem(CONFIG.LS_THEME) || 'dark'; }
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(CONFIG.LS_THEME, t);
  const dark = t === 'dark';
  $('lsun').style.display  = dark ? 'block' : 'none';
  $('lmoon').style.display = dark ? 'none'  : 'block';
  $('asun').style.display  = dark ? 'block' : 'none';
  $('amoon').style.display = dark ? 'none'  : 'block';
}
function togTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
function toLocalDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
}

function showLoadError(container, message, retry) {
  if (!container) return;
  container.replaceChildren();
  const box = document.createElement('div');
  box.className = 'slot-error';
  const text = document.createElement('div');
  text.textContent = message;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'btn bghost'; button.textContent = '↻ Retry';
  button.style.marginTop = '.75rem'; button.addEventListener('click', retry);
  box.append(text, button); container.append(box);
}

// API
const LS_E = 'tt_entries';

const SHEET_MAX_CONCURRENT = 3;
let sheetActiveCount = 0;
const sheetQueue = [];
const sheetPending = new Map();
const sheetCache = new Map();
const unsupportedActions = new Set();
let sheetRevision = 0;
const READ_TTL = {
  getTLData: 15000, getEmployeeDashboard: 15000, getProjectTabData: 30000,
  getProjectMasterList: 30000, getClientMasterList: 30000,
  getHistoricalRecords: 30000, getHistoricalProjectsSummary: 30000,
  getSalaryHistory: 30000, getAllHistory: 10000,
};
function sheetAcquireSlot() {
  if (sheetActiveCount < SHEET_MAX_CONCURRENT) { sheetActiveCount++; return Promise.resolve(); }
  return new Promise(resolve => sheetQueue.push(resolve));
}
function sheetReleaseSlot() {
  const next = sheetQueue.shift();
  if (next) next(); else sheetActiveCount--;
}
function invalidateApiReads() {
  sheetRevision++;
  sheetCache.clear();
  sheetPending.clear();
}
function sheetGET(params, options = {}) {
  const read = /^get/.test(params.action);
  const key = JSON.stringify(Object.entries(params).sort(([a],[b]) => a.localeCompare(b)));
  const cached = sheetCache.get(key);
  if (read && !options.fresh && cached && cached.expires > Date.now()) return Promise.resolve(cached.data);
  if (read && sheetPending.has(key)) return sheetPending.get(key);
  if (!read && params.action !== 'login') invalidateApiReads();
  const revision = sheetRevision;
  const request = (async () => {
    await sheetAcquireSlot();
    try {
      const data = await sheetGETInner(params, read);
      if (read && READ_TTL[params.action] && revision === sheetRevision && !(data && data.errors && data.errors.length)) {
        sheetCache.set(key, { data, expires: Date.now() + READ_TTL[params.action] });
      }
      return data;
    } finally {
      sheetReleaseSlot();
      if (!read && params.action !== 'login') invalidateApiReads();
    }
  })();
  if (read) {
    sheetPending.set(key, request);
    const cleanup = () => { if (sheetPending.get(key) === request) sheetPending.delete(key); };
    request.then(cleanup, cleanup);
  }
  return request;
}
async function sheetGETInner(params, read) {
  const url = new URL(CONFIG.SHEETS_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
  const bulk = ['getTLData','getEmployeeDashboard','getProjectTabData'].includes(params.action);
  const attempts = read ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), bulk ? 90000 : 30000);
    try {
      const response = await fetch(url.toString(), { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) {
        const error = new Error('Server returned HTTP ' + response.status);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500 || response.status === 404;
        throw error;
      }
      let json;
      try { json = await response.json(); }
      catch (error) { error.retryable = true; throw error; }
      if (json.status !== 'ok') throw new Error(json.message || 'Request failed');
      return json.data;
    } catch (error) {
      const transient = error.name === 'AbortError' || error instanceof TypeError || error.retryable;
      if (transient && attempt + 1 < attempts) {
        clearTimeout(timeout);
        await delay(500 * (attempt + 1));
        continue;
      }
      if (transient) {
        throw new Error(read
          ? 'Could not load data from the server. Please retry.'
          : 'The save could not be confirmed. Refresh to check whether it saved before trying again.');
      }
      throw error;
    } finally { clearTimeout(timeout); }
  }
}
function requireCompleteTeamData(data) {
  if (!data || !Array.isArray(data.entries)) throw new Error('The server returned incomplete team data.');
  if (data.errors && data.errors.length) {
    throw new Error('Could not load timesheets for ' + data.errors.map(e => e.empName || e.empId).join(', ') + '. Please retry.');
  }
  return data;
}
async function apiGetTeamData(options = {}) {
  if (CONFIG.DEMO_MODE) {
    const master = await apiGetMasterData();
    const entries = (await Promise.all(master.employees.map(async emp =>
      (await apiGetAllHistory(emp.id)).map(e => ({ ...e, empId: emp.id, empName: emp.name, empTeam: emp.team }))
    ))).flat();
    return { ...master, entries };
  }
  return requireCompleteTeamData(await sheetGET({ action: 'getTLData' }, options));
}
async function apiOptionalBundle(action, params, fallback, options = {}) {
  if (!unsupportedActions.has(action) && !CONFIG.DEMO_MODE) {
    try { return await sheetGET({ action, ...params }, options); }
    catch (error) {
      if (!error.message.includes('Unknown action: ' + action)) throw error;
      unsupportedActions.add(action);
    }
  }
  return fallback();
}
async function apiGetProjectBundle(role, options = {}) {
  return apiOptionalBundle('getProjectTabData', { role }, async () => {
    const [clients, projects, historicalRecords, historicalProjectsSummary] = await Promise.all([
      sheetGET({ action: 'getClientMasterList' }, options),
      sheetGET({ action: 'getProjectMasterList', role }, options),
      sheetGET({ action: 'getHistoricalRecords', filters: encodeURIComponent('{}') }, options),
      sheetGET({ action: 'getHistoricalProjectsSummary' }, options),
    ]);
    return { clients, projects, historicalRecords, historicalProjectsSummary };
  }, options);
}
async function apiGetEmployeeDashboard(uid) {
  const data = await apiOptionalBundle('getEmployeeDashboard', { uid }, async () => {
    const [team, projects, clients, historicalRecords, salaryRecords] = await Promise.all([
      apiGetTeamData(), sheetGET({ action: 'getProjectMasterList' }),
      sheetGET({ action: 'getClientMasterList' }),
      sheetGET({ action: 'getHistoricalRecords', filters: encodeURIComponent('{}') }),
      sheetGET({ action: 'getSalaryHistory' }),
    ]);
    return { ...team, projects, clients, historicalRecords, salaryRecords,
      history: team.entries.filter(e => e.empId === uid) };
  });
  return requireCompleteTeamData(data);
}

const MASTER_DATA_CACHE_KEY = 'timesheet_master_data_v1';
const MASTER_DATA_CACHE_TTL_MS = 10 * 60 * 1000; 

async function apiGetMasterData() {
  if (CONFIG.DEMO_MODE) {
    return { employees: EMPLOYEES, clients: CLIENTS, projects: PROJECTS };
  }

  const cached = readMasterDataCache();
  if (cached) return cached;

  const data = await sheetGET({ action: 'getMasterData' });
  writeMasterDataCache(data);
  return data;
}

function readMasterDataCache() {
  try {
    const raw = sessionStorage.getItem(MASTER_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || typeof parsed.timestamp !== 'number') return null;
    if (Date.now() - parsed.timestamp >= MASTER_DATA_CACHE_TTL_MS) {
      sessionStorage.removeItem(MASTER_DATA_CACHE_KEY);
      return null;
    }
    return parsed.data;
  } catch(e) {
    return null;
  }
}

function writeMasterDataCache(data) {
  try {
    sessionStorage.setItem(MASTER_DATA_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
  } catch(e) {

  }
}

function clearMasterDataCache() {
  try { sessionStorage.removeItem(MASTER_DATA_CACHE_KEY); } catch(e) {}
}

async function apiLogin(employeeId, password) {
  if (CONFIG.DEMO_MODE) {
    const emp = EMPLOYEES.find(e => e.id === employeeId);
    if (!emp)                throw new Error('Employee not found.');
    if (emp.pw !== password) throw new Error('Wrong password.');
    return { id: emp.id, name: emp.name, team: emp.team };
  }
  return sheetGET({ action: 'login', uid: employeeId, pw: password });
}

async function apiGetDaySlots(uid, date) {
  if (CONFIG.DEMO_MODE) {
    const all     = JSON.parse(localStorage.getItem(LS_E) || '[]');
    const entries = all.filter(e => e.uid === uid && e.date === date);
    return {
      date,
      slots: {
        morning:   { label: 'Morning',   defaultIn: '09:30', defaultOut: '13:00' },
        afternoon: { label: 'Afternoon', defaultIn: '13:45', defaultOut: '19:30' },
        extended:  { label: 'Extended',  defaultIn: '19:30', defaultOut: '22:00' },
      },
      entries,
    };
  }
  return sheetGET({ action: 'getDaySlots', uid, date });
}

async function apiSaveSlot(entry) {
  if (CONFIG.DEMO_MODE) {
    const all      = JSON.parse(localStorage.getItem(LS_E) || '[]');
    const filtered = all.filter(e =>
      !(e.uid === entry.uid && e.date === entry.date &&
        e.slot === entry.slot && e.entryNum === entry.entryNum)
    );
    filtered.unshift(entry);
    localStorage.setItem(LS_E, JSON.stringify(filtered.slice(0, 5000)));
    return { saved: true, history: null };
  }
  const result = await sheetGET({
    action: 'saveSlot',
    data:   encodeURIComponent(JSON.stringify(entry)),
  });
  return { saved: result.saved, history: null };
}

async function apiGetHistory(uid) {
  function safeSort(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return arr.sort((a, b) => {
      const ad = (a && a.date) ? a.date : '';
      const bd = (b && b.date) ? b.date : '';
      const as = (a && a.slot) ? a.slot : '';
      const bs = (b && b.slot) ? b.slot : '';
      if (bd !== ad) return bd.localeCompare(ad);
      return as.localeCompare(bs);
    });
  }

  if (CONFIG.DEMO_MODE) {
    const all   = JSON.parse(localStorage.getItem(LS_E) || '[]');
    const mine  = all.filter(e => e.uid === uid);
    const dates = [...new Set(mine.map(e => e.date).filter(Boolean))].sort().reverse().slice(0, 10);
    const dateSet = new Set(dates);
    return safeSort(mine.filter(e => dateSet.has(e.date)));
  }

  const data = await sheetGET({ action: 'getHistory', uid });
  return safeSort(Array.isArray(data) ? data : []);
}

async function apiGetAllHistory(uid) {
  if (CONFIG.DEMO_MODE) {
    const all = JSON.parse(localStorage.getItem(LS_E) || '[]');
    return all.filter(e => e.uid === uid);
  }
  const data = await sheetGET({ action: 'getAllHistory', uid });
  return Array.isArray(data) ? data : [];
}

async function apiUpdateEmployeeRecord(data) {
  return sheetGET({
    action: 'updateEmployeeRecord',
    data:   encodeURIComponent(JSON.stringify(data)),
  });
}

async function apiChangeOwnPassword(uid, currentPw, newPw) {
  return sheetGET({
    action: 'changeOwnPassword',
    data:   encodeURIComponent(JSON.stringify({ uid, currentPw, newPw })),
  });
}

// AUTH
let USER           = null;
let LIVE_EMPLOYEES = [];
let MANAGER_MODE   = false;
let TL_MODE        = false;
let HR_MODE        = false;

async function initLogin() {
  console.log('[AUTH] initLogin | DEMO_MODE:', CONFIG.DEMO_MODE);
  await loadEmployeesAndRenderLogin();

  try {
    const s = sessionStorage.getItem(CONFIG.LS_SESSION);
    if (s) {
      const u = JSON.parse(s);
      if (u?.id) {
        if (u.role === 'manager')    await loginAsManager(u, true);
        else if (u.role === 'tl')    await loginAsTL(u, true);
        else if (u.role === 'hr')    await loginAsHR(u, true);
        else                         await loginAs(u, true);
      }
    }
  } catch(e) {
    console.error('[AUTH] Session restore failed:', e.message);
  }
}

async function loadEmployeesAndRenderLogin() {
  const empSel = $('lemp');
  const tabs   = $('etabs');
  const errBox = $('empLoadErr');

  if (errBox) errBox.classList.remove('show');
  empSel.innerHTML = '<option value="">— Select your name —</option>';
  tabs.innerHTML   = '';

  if (CONFIG.DEMO_MODE) {
    LIVE_EMPLOYEES = EMPLOYEES;
  } else {
    try {
      const master   = await apiGetMasterData();
      LIVE_EMPLOYEES = master.employees || [];
      if (Array.isArray(master.clients)  && master.clients.length  > 0) CLIENTS  = master.clients;
      if (Array.isArray(master.projects) && master.projects.length > 0) PROJECTS = master.projects;
      if (LIVE_EMPLOYEES.length === 0) throw new Error('Employees sheet returned 0 rows.');
    } catch(e) {
      console.error('[AUTH] Failed to load from Sheet:', e.message);
      LIVE_EMPLOYEES = [];
      renderEmployeeDropdown();
      showEmployeeLoadError(e.message);
      return;
    }
  }

  renderEmployeeDropdown();
}

function showEmployeeLoadError(msg) {
  const errBox = $('empLoadErr');
  if (errBox) {
    errBox.classList.add('show');
    errBox.innerHTML = `
      <span>⚠️ Couldn't load employee list: ${esc(msg)}</span>
      <button type="button" class="btn bghost" id="empRetryBtn" style="margin-top:.5rem">↻ Retry</button>`;
    $('empRetryBtn').onclick = () => loadEmployeesAndRenderLogin();
  }
  toast('e', 'Could not load employees', msg, 8000);
}

function getTeamLeaderAccounts() {
  return Array.isArray(CONFIG.TEAM_LEADERS) && CONFIG.TEAM_LEADERS.length
    ? CONFIG.TEAM_LEADERS
    : [{ id: CONFIG.TL_ID || 'TL', pw: CONFIG.TL_PW || 'teamlead123', name: 'Team Leader' }]; 
}

function renderEmployeeDropdown() {
  const empSel = $('lemp');
  const tabs   = $('etabs');

  const mgrOpt = document.createElement('option');
  mgrOpt.value = CONFIG.MANAGER_ID || 'MGR';
  mgrOpt.textContent = '🔑 Manager';
  empSel.appendChild(mgrOpt);

  getTeamLeaderAccounts().forEach(tl => {
    const tlOpt = document.createElement('option');
    tlOpt.value = tl.id;
    tlOpt.textContent = `👥 ${tl.name}`;
    empSel.appendChild(tlOpt);
  });

  const hrOpt = document.createElement('option');
  hrOpt.value = CONFIG.HR_ID || 'HR';
  hrOpt.textContent = '🧑‍💼 HR';
  empSel.appendChild(hrOpt);

  LIVE_EMPLOYEES.forEach(e => {
    const o = document.createElement('option');
    o.value = e.id; o.textContent = e.name;
    empSel.appendChild(o);
  });

  LIVE_EMPLOYEES.slice(0, 5).forEach(e => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'etab'; b.dataset.id = e.id;
    b.textContent = e.name.split(' ')[0];
    b.onclick = () => {
      empSel.value = e.id;
      empSel.dispatchEvent(new Event('change'));
      $('lpw').focus();
    };
    tabs.appendChild(b);
  });
  if (LIVE_EMPLOYEES.length > 5) {
    const m = document.createElement('button');
    m.type = 'button'; m.className = 'etab'; m.textContent = 'More ▾';
    m.onclick = () => empSel.focus();
    tabs.appendChild(m);
  }

  empSel.onchange = () => {
    const id  = empSel.value;
    const emp = LIVE_EMPLOYEES.find(e => e.id === id);
    const tl  = getTeamLeaderAccounts().find(t => t.id === id);
    const pill = $('idpill'), txt = $('idtxt');
    if (id === (CONFIG.MANAGER_ID || 'MGR')) {
      txt.textContent = 'Manager Access';
      pill.classList.add('show');
    } else if (id === (CONFIG.HR_ID || 'HR')) {
      txt.textContent = 'HR Access';
      pill.classList.add('show');
    } else if (tl) {
      txt.textContent = `${tl.name} Access`;
      pill.classList.add('show');
    } else if (emp) {
      txt.textContent = `${emp.id} · ${emp.team}`;
      pill.classList.add('show');
    } else {
      pill.classList.remove('show');
    }
    tabs.querySelectorAll('.etab').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    $('lerr').classList.remove('show');
  };

  $('pwt').onclick = () => {
    const pw = $('lpw'), s = pw.type === 'text';
    pw.type = s ? 'password' : 'text';
    $('eshow').style.display = s ? 'block' : 'none';
    $('ehide').style.display = s ? 'none'  : 'block';
  };

  $('lform').onsubmit = async ev => {
    ev.preventDefault();
    const id  = empSel.value;
    const pw  = $('lpw').value;
    const err = $('lerr'), msg = $('lerrmsg'), btn = $('lbtn');
    err.classList.remove('show');

    if (!id) { msg.textContent = 'Please select your name.'; err.classList.add('show'); return; }
    if (!pw) { msg.textContent = 'Please enter your password.'; err.classList.add('show'); return; }

    btn.classList.add('ld'); btn.disabled = true;
    try {

      if (id === (CONFIG.MANAGER_ID || 'MGR')) {
        if (pw !== CONFIG.MANAGER_PW) throw new Error('Wrong manager password.');
        await loginAsManager({ id: 'MGR', name: 'Manager', team: 'Management', role: 'manager' });
        return;
      }

      if (id === (CONFIG.HR_ID || 'HR')) {
        if (pw !== CONFIG.HR_PW) throw new Error('Wrong HR password.');
        await loginAsHR({ id: 'HR', name: 'HR', team: 'Human Resources', role: 'hr' });
        return;
      }

      const tlAccount = getTeamLeaderAccounts().find(t => t.id === id);
      if (tlAccount) {
        if (pw !== tlAccount.pw) throw new Error('Wrong team leader password.');
        await loginAsTL({ id: tlAccount.id, name: tlAccount.name, team: 'All Teams', role: 'tl' });
        return;
      }

      const user = await apiLogin(id, pw);
      await loginAs(user);
    } catch(e) {
      msg.textContent = e.message || 'Login failed.';
      err.classList.add('show');
      $('lpw').value = ''; $('lpw').focus();
    } finally {
      btn.classList.remove('ld'); btn.disabled = false;
    }
  };
}

async function loginAs(emp, silent = false) {
  await ensureAppLoaded();
  resetAppSession();
  MANAGER_MODE = false;
  TL_MODE      = false;
  USER = emp;
  sessionStorage.setItem(CONFIG.LS_SESSION, JSON.stringify(emp));

  const av = $('av'), wn = $('wn'), wt = $('wt');
  if (av) av.textContent = emp.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  if (wn) wn.textContent = emp.name;
  if (wt) wt.textContent = `${emp.team} · ${emp.id}`;

  $('login').classList.add('gone');
  $('mgrPortal').classList.remove('on');
  $('tlPortal')?.classList.remove('on');
  $('app').classList.add('on');

  const session = APP_SESSION;
  try {
    const entries = await apiGetHistory(emp.id);
    if (session !== APP_SESSION) return;
    ENTRIES = entries;
    initForm();
    refreshStats();
    refreshFilters();
    refreshTable();
    refreshChart();
    switchEmpTab('projects');
    if (!silent) toast('s', `Welcome back, ${emp.name.split(' ')[0]}! 👋`, emp.team);
  } catch(err) {
    if (session !== APP_SESSION) return;
    console.error('[AUTH] Failed to load entries for', emp.id, ':', err.message);
    toast('e', 'Could not load your timesheet', err.message, 8000);
    switchEmpTab('timesheet');
    showLoadError($('slotsContainer'), 'Could not load your timesheet: ' + err.message, () => loginAs(emp, true));
  }
}

async function loginAsManager(emp, silent = false) {
  await ensureAppLoaded();
  resetAppSession();
  MANAGER_MODE = true;
  TL_MODE      = false;
  USER = emp;
  sessionStorage.setItem(CONFIG.LS_SESSION, JSON.stringify({ ...emp, role: 'manager' }));

  const av = $('mgrAv');
  if (av) av.textContent = 'M';
  const mn = $('mgrName');
  if (mn) mn.textContent = emp.name;
  const mt = $('mgrTeam');
  if (mt) mt.textContent = 'Manager Portal';

  $('login').classList.add('gone');
  $('app').classList.remove('on');
  $('tlPortal')?.classList.remove('on');
  $('mgrPortal').classList.add('on');

  if (!silent) toast('s', `Welcome, Manager! 👋`, 'Manager Portal');
  initManager();
}

async function loginAsTL(emp, silent = false) {
  await ensureAppLoaded();
  resetAppSession();
  MANAGER_MODE = false;
  TL_MODE      = true;
  USER = emp;
  sessionStorage.setItem(CONFIG.LS_SESSION, JSON.stringify({ ...emp, role: 'tl' }));

  const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'TL';

  const av = $('tlAv');
  if (av) av.textContent = initials;
  const tn = $('tlName');
  if (tn) tn.textContent = emp.name;
  const tt = $('tlTeam');
  if (tt) tt.textContent = 'Team Leader Portal';

  $('login').classList.add('gone');
  $('app').classList.remove('on');
  $('mgrPortal').classList.remove('on');
  $('tlPortal').classList.add('on');

  if (!silent) toast('s', `Welcome, ${emp.name}! 👋`, 'Team Leader Portal');
  initTeamLeader();
}

async function loginAsHR(emp, silent = false) {
  await ensureAppLoaded();
  resetAppSession();
  MANAGER_MODE = false;
  TL_MODE      = false;
  HR_MODE      = true;
  USER = emp;
  sessionStorage.setItem(CONFIG.LS_SESSION, JSON.stringify({ ...emp, role: 'hr' }));

  const av = $('hrAv');
  if (av) av.textContent = 'HR';
  const hn = $('hrName');
  if (hn) hn.textContent = emp.name;
  const ht = $('hrTeam');
  if (ht) ht.textContent = 'HR Portal';

  $('login').classList.add('gone');
  $('app').classList.remove('on');
  $('mgrPortal').classList.remove('on');
  $('tlPortal')?.classList.remove('on');
  $('hrPortal')?.classList.add('on');

  if (!silent) toast('s', `Welcome, HR! 👋`, 'HR Portal');
  if (!$('hrPortal')) {
    console.error('[AUTH] #hrPortal not found in index.html — HR Portal cannot render. See humanresource.js bottom-of-file note for the markup needed.');
    toast('e', 'HR Portal markup missing', 'index.html needs an #hrPortal container — ask to have it added.');
    return;
  }
  initHR();
}

function openChangePasswordModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);'
    + 'display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border-md);
      border-radius:14px;padding:1.25rem;width:340px;max-width:92vw;">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🔒 Change Password</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">${esc(USER ? USER.name : '')}</div>

      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:10px 0 4px;">Current Password</label>
      <input id="cpwCurrent" type="password" autocomplete="current-password" placeholder="Enter current password"
        style="width:100%;background:var(--inp);border:1px solid var(--inp-b);border-radius:7px;
          color:var(--txt);font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;"/>

      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:10px 0 4px;">New Password</label>
      <input id="cpwNew" type="password" autocomplete="new-password" placeholder="At least 4 characters"
        style="width:100%;background:var(--inp);border:1px solid var(--inp-b);border-radius:7px;
          color:var(--txt);font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;"/>

      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:10px 0 4px;">Confirm New Password</label>
      <input id="cpwConfirm" type="password" autocomplete="new-password" placeholder="Re-enter new password"
        style="width:100%;background:var(--inp);border:1px solid var(--inp-b);border-radius:7px;
          color:var(--txt);font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;"/>

      <div id="cpwErr" style="display:none;font-size:11.5px;color:var(--err);margin-top:8px;"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="cpwCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="cpwSubmit" style="background:var(--a1);border:none;
          color:#fff;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Change Password</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const errEl = overlay.querySelector('#cpwErr');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#cpwCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#cpwSubmit').addEventListener('click', async () => {
    const currentPw = overlay.querySelector('#cpwCurrent').value;
    const newPw     = overlay.querySelector('#cpwNew').value;
    const confirmPw = overlay.querySelector('#cpwConfirm').value;

    errEl.style.display = 'none';

    if (!currentPw) { showErr('Enter your current password.'); return; }
    if (newPw.length < 4) { showErr('New password must be at least 4 characters.'); return; }
    if (newPw !== confirmPw) { showErr('New password and confirmation do not match.'); return; }
    if (newPw === currentPw) { showErr('New password must be different from the current one.'); return; }

    const btn = overlay.querySelector('#cpwSubmit');
    btn.disabled = true;
    btn.textContent = 'Changing…';

    try {
      await apiChangeOwnPassword(USER.id, currentPw, newPw);
      toast?.('s', 'Password changed', 'Use your new password next time you sign in.');
      overlay.remove();
    } catch(err) {
      showErr(err.message || 'Failed to change password.');
      btn.disabled = false;
      btn.textContent = 'Change Password';
    }
  });
}

function logout() {
  resetAppSession();
  sessionStorage.removeItem(CONFIG.LS_SESSION);
  USER = null; ENTRIES = []; MANAGER_MODE = false; TL_MODE = false; HR_MODE = false;

  $('app').classList.remove('on');
  $('mgrPortal').classList.remove('on');
  $('tlPortal')?.classList.remove('on');
  $('hrPortal')?.classList.remove('on');
  $('login').classList.remove('gone');
  $('lemp').value = ''; $('lpw').value = '';
  $('idpill').classList.remove('show');
  $('lerr').classList.remove('show');
  $('etabs').querySelectorAll('.etab').forEach(b => b.classList.remove('on'));
}

let APP_SESSION = 0;
const APP_SCRIPTS = new Map();
let APP_INITIALIZED = false;
async function ensureAppLoaded() {
  const names = ['employee', 'projects', 'portals'];
  await Promise.all(names.map(name => {
    if (APP_SCRIPTS.has(name)) return APP_SCRIPTS.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/' + name + '.js?v=2026100701'; script.async = false;
      script.onload = resolve;
      script.onerror = () => { script.remove(); APP_SCRIPTS.delete(name); reject(new Error('Could not load the app. Please try signing in again.')); };
      document.head.appendChild(script);
    });
    APP_SCRIPTS.set(name, promise);
    return promise;
  }));
  if (!APP_INITIALIZED) {
    initTable(); initChart(); initMyProjectsTab(); APP_INITIALIZED = true;
  }
}
function resetAppSession() {
  APP_SESSION++;
  invalidateApiReads();
  MANAGER_MODE = false; TL_MODE = false; HR_MODE = false;
  if (!APP_INITIALIZED) return;
  stopProjectDetailAutoRefresh();
  DAY_LOAD_SEQUENCE++;
  ENTRIES = []; DAY_ENTRIES = {}; CHART_ALL_HISTORY_CACHE = null;
  EMP_DASHBOARD_DATA_LOADED = false; EMP_DASHBOARD_PROMISE = null;
  EMP_DASH_FULL_HISTORY = []; EMP_DASH_FULL_HISTORY_LOADED = false;
  EMP_HISTORY_PROMISE = null;
  SAL_RECORDS = []; SAL_LOADED = false; SAL_PENDING = null;
  CP_TIMESHEET_DATA = []; CP_EMPLOYEES = []; CP_PROJECTS = []; CP_CLIENTS = [];
  CP_HISTORICAL_DATA = []; CP_HIST_PROJECTS_SUMMARY = []; CP_DATA_LOADED = false;
  MGR_DATA = []; TL_DATA = []; HR_DATA = []; TL_EMPLOYEE_INDEX = {};
  GANTT_PROJECTS = []; GANTT_ALL_ENTRIES = [];
  CP_ROLE = null; CP_ATTEND_HR_DEFAULTED = false;
}
function boot() {
  setTheme(getTheme());
  $('lthm').onclick = togTheme; $('athm').onclick = togTheme; $('so').onclick = logout;
  const date = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  ['dbadge','mgrBadge','tlBadge','hrBadge'].forEach(id => { if ($(id)) $(id).textContent = date; });
  initLogin().catch(error => showEmployeeLoadError(error.message));
}
boot();
