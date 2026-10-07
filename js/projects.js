// SALARY
let SAL_LOADED   = false;
let SAL_RECORDS  = [];               
let SAL_SELECTED = null;             
let SAL_YEAR     = new Date().getFullYear();

async function renderSalaryTab(content) {

  if (typeof MANAGER_MODE !== 'undefined' && !MANAGER_MODE) {
    content.innerHTML = `<div class="chart-empty">Salary data is only accessible to the Manager.</div>`;
    return;
  }

  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading salary data…</span></div>`;

  try {
    await loadSalaryData();
  } catch(err) {
    content.innerHTML = `<div class="slot-error">Failed to load salary data: ${esc(err.message)}</div>`;
    return;
  }

  if (!SAL_SELECTED && typeof MGR_EMPLOYEES !== 'undefined' && MGR_EMPLOYEES.length) {
    SAL_SELECTED = MGR_EMPLOYEES[0].id;
  }

  renderSalaryLayout(content);
}

async function loadSalaryData(fresh = false) {
  if (SAL_PENDING) return SAL_PENDING;
  const session = APP_SESSION;
  const promise = sheetGET({ action: 'getSalaryHistory' }, { fresh }).then(data => {
    if (session !== APP_SESSION) return;
    SAL_RECORDS = data; SAL_LOADED = true;
  });
  SAL_PENDING = promise;
  try { await promise; } finally { if (SAL_PENDING === promise) SAL_PENDING = null; }
}

function renderSalaryLayout(content) {
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--txt1);">💼 Master Salary Database</div>
        <div style="font-size:12px;color:var(--txt2);">Month-wise · carries forward automatically until changed</div>
      </div>
    </div>

    <div style="display:flex;gap:1.25rem;align-items:flex-start;">
      <!-- Employee list -->
      <div style="width:230px;flex-shrink:0;background:var(--surface1);border:1px solid var(--border);
        border-radius:12px;padding:.8rem;">
        <div style="font-weight:700;font-size:12.5px;color:var(--txt1);margin-bottom:.6rem;">Employees</div>
        <input type="search" id="salEmpSearch" placeholder="Search…" style="width:100%;margin-bottom:.6rem;
          padding:6px 9px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;
          color:var(--txt1);font-size:12px;box-sizing:border-box;"/>
        <div id="salEmpList" style="display:flex;flex-direction:column;gap:4px;max-height:520px;overflow-y:auto;"></div>
      </div>

      <!-- Timeline -->
      <div style="flex:1;min-width:0;" id="salTimelinePanel"></div>
    </div>

    <style>
      .sal-emp-btn:hover { background:var(--hover) !important; }
      .sal-nav-btn {
        width:28px;height:28px;border-radius:50%;border:1px solid var(--border-md);
        background:var(--elevated);color:var(--txt1);font-size:12px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      }
      .sal-field-label { font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em; }
      .sal-field-val   { font-size:13px;font-weight:700;color:var(--txt1); }
      .sal-edit-btn:hover { border-color:var(--a1) !important;color:var(--a1) !important; }

      .sal-modal-overlay {
        position:fixed;inset:0;background:rgba(0,0,0,.55);
        display:flex;align-items:center;justify-content:center;z-index:9999;
      }
      .sal-modal {
        background:var(--surface1);border:1px solid var(--border-md);
        border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;
      }
      .sal-flabel { font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:10px 0 4px; }
      .sal-finput {
        width:100%;background:var(--surface2);border:1px solid var(--border);
        border-radius:7px;color:var(--txt1);font-size:12.5px;padding:7px 9px;
        box-sizing:border-box;font-family:inherit;
      }
      .sal-btn-ghost {
        background:none;border:1px solid var(--border-md);color:var(--txt2);
        border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;
      }
      .sal-btn-primary {
        background:var(--a1);border:none;color:#fff;
        border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;
      }
    </style>
  `;

  renderSalEmpList(content);
  renderSalTimeline(content);

  $('salEmpSearch').addEventListener('input', e => renderSalEmpList(content, e.target.value.toLowerCase().trim()));
}

function renderSalEmpList(content, query = '') {
  const list = $('salEmpList');
  if (!list) return;
  const emps = (MGR_EMPLOYEES || []).filter(e =>
    !query || e.name.toLowerCase().includes(query) || e.id.toLowerCase().includes(query)
  );

  list.innerHTML = emps.map(e => `
    <button class="sal-emp-btn" data-emp-id="${e.id}" style="
      display:flex;flex-direction:column;align-items:flex-start;gap:1px;
      text-align:left;padding:7px 10px;border-radius:8px;border:none;
      background:${e.id === SAL_SELECTED ? 'var(--a1)' : 'transparent'};
      color:${e.id === SAL_SELECTED ? '#fff' : 'var(--txt1)'};cursor:pointer;">
      <span style="font-size:12.5px;font-weight:600;">${esc(e.name)}</span>
      <span style="font-size:10.5px;opacity:.8;">${esc(e.id)}</span>
    </button>`).join('') || `<div style="font-size:11.5px;color:var(--txt2);padding:.5rem;">No matches.</div>`;

  list.querySelectorAll('.sal-emp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      SAL_SELECTED = btn.dataset.empId;
      renderSalEmpList(content, query);
      renderSalTimeline(content);
    });
  });
}

function renderSalTimeline(content) {
  const panel = $('salTimelinePanel');
  if (!panel) return;

  const emp = (MGR_EMPLOYEES || []).find(e => e.id === SAL_SELECTED);
  if (!emp) { panel.innerHTML = `<div class="chart-empty">Select an employee to view their salary timeline.</div>`; return; }

  const monthKeys = [];
  for (let m = 1; m <= 12; m++) monthKeys.push(`${SAL_YEAR}-${String(m).padStart(2, '0')}`);

  const cards = monthKeys.map(mk => buildSalMonthCard(emp, mk)).join('');

  panel.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1rem 1.1rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--txt1);">${esc(emp.name)}</div>
          <div style="font-size:11.5px;color:var(--txt2);">${esc(emp.id)} · Salary Timeline</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button id="salYearPrev" class="sal-nav-btn">◀</button>
          <span style="font-size:13px;font-weight:700;color:var(--txt1);min-width:50px;text-align:center;">${SAL_YEAR}</span>
          <button id="salYearNext" class="sal-nav-btn">▶</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.85rem;">
        ${cards}
      </div>
    </div>
  `;

  $('salYearPrev').addEventListener('click', () => { SAL_YEAR--; renderSalTimeline(content); });
  $('salYearNext').addEventListener('click', () => { SAL_YEAR++; renderSalTimeline(content); });

  panel.querySelectorAll('.sal-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openSalaryEditor(content, emp, btn.dataset.month));
  });
}

function buildSalMonthCard(emp, monthKey) {
  const effective  = getEffectiveSalary(emp.id, monthKey, emp.name);
  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthShort = monthLabel.split(' ')[0];

  if (!effective) {
    return `
      <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:12px;padding:.85rem;">
        <div style="font-size:11.5px;font-weight:700;color:var(--txt2);margin-bottom:.5rem;">${monthLabel}</div>
        <div style="font-size:11px;color:var(--txt2);margin-bottom:.6rem;">Not set</div>
        <button class="sal-edit-btn" data-month="${monthKey}" style="width:100%;padding:6px;
          background:var(--a1);color:#fff;border:none;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;">
          + Set Salary
        </button>
      </div>`;
  }

  const { record, inherited } = effective;
  return `
    <div style="background:var(--surface1);border:1px solid ${inherited ? 'var(--border)' : 'rgba(79,142,247,0.45)'};
      border-radius:12px;padding:.85rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.55rem;gap:6px;">
        <span style="font-size:11.5px;font-weight:700;color:var(--txt1);">${monthLabel}</span>
        ${inherited
          ? `<span style="font-size:9px;color:var(--txt2);background:var(--surface2);border-radius:10px;
              padding:1px 7px;white-space:nowrap;" title="Carried forward from ${fmtSalMonth(record.month)}">↳ inherited</span>`
          : `<span style="font-size:9px;color:var(--a1);background:rgba(79,142,247,0.12);border-radius:10px;
              padding:1px 7px;white-space:nowrap;">✏ set here</span>`}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:.65rem;">
        <div><div class="sal-field-label">LPA</div><div class="sal-field-val">${fmtRupeesSal(record.lpa)}</div></div>
        <div><div class="sal-field-label">Monthly</div><div class="sal-field-val">${fmtRupeesSal(record.monthly)}</div></div>
        <div>
          <div class="sal-field-label">Hourly</div>
          <div class="sal-field-val">${fmtRupeesSal(record.hourly)}</div>
          ${record.workHours ? `<div style="font-size:9px;color:var(--txt2);">@ ${record.workHours}h/day</div>` : ''}
        </div>
        <div><div class="sal-field-label">Points (X)</div><div class="sal-field-val">${record.points || record.points === 0 ? record.points : '—'}</div></div>
      </div>
      <button class="sal-edit-btn" data-month="${monthKey}" style="width:100%;padding:6px;
        background:none;border:1px solid var(--border-md);color:var(--txt2);border-radius:7px;
        font-size:11px;font-weight:600;cursor:pointer;">
        ✏️ Edit ${esc(monthShort)}
      </button>
    </div>`;
}

function getEffectiveSalary(empId, monthKey, empName) {

  const norm = v => String(v ?? '').trim().toLowerCase();
  const empIdN   = norm(empId);
  const empNameN = norm(empName);
  const recs = SAL_RECORDS
    .filter(r => {
      const rEmpIdN   = norm(r.empId);
      const rEmpNameN = norm(r.empName);
      const idMatches   = rEmpIdN && (rEmpIdN === empIdN || (empNameN && rEmpIdN === empNameN));
      const nameMatches = rEmpNameN && (rEmpNameN === empIdN || (empNameN && rEmpNameN === empNameN));
      return (idMatches || nameMatches) && r.month <= monthKey;
    })
    .sort((a, b) => b.month.localeCompare(a.month));
  if (!recs.length) return null;
  const record = recs[0];

  const inherited = record.month === monthKey ? !record.explicit : true;
  return { record, inherited };
}

function openSalaryEditor(content, emp, monthKey) {
  const effective  = getEffectiveSalary(emp.id, monthKey, emp.name);
  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const cur = effective ? effective.record : { lpa: '', monthly: '', hourly: '', points: '', workHours: '' };

  const overlay = document.createElement('div');
  overlay.className = 'sal-modal-overlay';
  overlay.innerHTML = `
    <div class="sal-modal">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">💼 Set Salary — ${esc(emp.name)}</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:6px;">${monthLabel}</div>
      <div style="font-size:11px;color:var(--txt2);background:var(--surface2);border-radius:7px;padding:6px 9px;margin-bottom:6px;">
        This applies to ${monthLabel} and automatically carries forward to every month after it, until changed again. Earlier months are never affected.
      </div>

      <label class="sal-flabel">LPA (₹ / year)</label>
      <input class="sal-finput" id="salLpa" type="number" min="0" step="1000" value="${cur.lpa || ''}" placeholder="e.g. 900000"/>

      <label class="sal-flabel">Monthly Salary (₹) <span style="font-weight:400;color:var(--txt2);">— auto: LPA ÷ 12</span></label>
      <input class="sal-finput" id="salMonthly" type="number" min="0" step="100" value="${cur.monthly || ''}" placeholder="e.g. 75000"/>

      <label class="sal-flabel">Working Hours / Day</label>
      <input class="sal-finput" id="salWorkHours" type="number" min="1" max="24" step="0.5" value="${cur.workHours || ''}" placeholder="e.g. 8"/>
      <div style="font-size:10px;color:var(--txt2);margin-top:3px;">Varies per person — some work 8h, some 9h or 10h/day. Used to work out this person's hourly rate.</div>

      <label class="sal-flabel">Hourly Rate (₹) <span style="font-weight:400;color:var(--txt2);">— auto: Monthly ÷ 30 ÷ Hours/day</span></label>
      <input class="sal-finput" id="salHourly" type="number" min="0" step="1" value="${cur.hourly || ''}" placeholder="e.g. 277"/>

      <label class="sal-flabel">Points (X)</label>
      <input class="sal-finput" id="salPoints" type="number" min="0" step="0.1" value="${cur.points ?? ''}" placeholder="e.g. 1.2"/>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="salModalCancel" class="sal-btn-ghost">Cancel</button>
        <button id="salModalSave" class="sal-btn-primary">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const lpaEl       = overlay.querySelector('#salLpa');
  const monthlyEl   = overlay.querySelector('#salMonthly');
  const workHoursEl = overlay.querySelector('#salWorkHours');
  const hourlyEl    = overlay.querySelector('#salHourly');

  function recomputeMonthlyFromLpa() {
    const lpa = parseFloat(lpaEl.value);
    if (lpa > 0) monthlyEl.value = Math.round(lpa / 12);
    recomputeHourly();
  }

  function recomputeHourly() {
    const monthly   = parseFloat(monthlyEl.value);
    const workHours = parseFloat(workHoursEl.value);
    if (monthly > 0 && workHours > 0) {
      hourlyEl.value = Math.round((monthly / 30) / workHours);
    }
  }

  lpaEl.addEventListener('input', recomputeMonthlyFromLpa);
  monthlyEl.addEventListener('input', recomputeHourly);
  workHoursEl.addEventListener('input', recomputeHourly);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#salModalCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#salModalSave').addEventListener('click', async () => {
    const lpa       = parseFloat(lpaEl.value)       || 0;
    const monthly   = parseFloat(monthlyEl.value)   || 0;
    const workHours = parseFloat(workHoursEl.value) || 0;
    const hourly    = parseFloat(hourlyEl.value)    || 0;
    const points    = parseFloat(overlay.querySelector('#salPoints').value) || 0;

    if (!lpa && !monthly && !hourly && !points) {
      toast?.('e', 'Nothing to save', 'Enter at least one value.');
      return;
    }

    const btn = overlay.querySelector('#salModalSave');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      await sheetGET({
        action: 'saveSalaryMonth',
        data: encodeURIComponent(JSON.stringify({
          empId: emp.id, empName: emp.name, month: monthKey,
          lpa, monthly, hourly, points, workHours,
        })),
      });

      const idx = SAL_RECORDS.findIndex(r => r.empId === emp.id && r.month === monthKey);
      const newRec = { empId: emp.id, empName: emp.name, month: monthKey, lpa, monthly, hourly, points, workHours, updatedAt: new Date().toISOString() };
      if (idx >= 0) SAL_RECORDS[idx] = newRec; else SAL_RECORDS.push(newRec);

      toast?.('s', 'Salary saved', `${monthLabel} updated for ${emp.name} — carries forward automatically.`);
      overlay.remove();
      renderSalTimeline(content);
    } catch(err) {
      btn.disabled = false;
      btn.textContent = 'Save';
      toast?.('e', 'Save failed', err.message);
    }
  });
}

function fmtRupeesSal(v) {
  const n = parseFloat(v) || 0;
  if (!n) return '—';
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function fmtSalMonth(monthKey) {
  return new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

(function forceSalaryTabOverride() {
  const thisRenderSalaryTab = renderSalaryTab;
  const install = () => {
    window.renderSalaryTab = thisRenderSalaryTab;
    console.log('[salary.js] renderSalaryTab override active — master salary database UI is live.');
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
let SAL_PENDING = null;

// CLIENT-PROJECT
let CP_ROLE           = null;   
let CP_CLIENTS        = [];     
let CP_PROJECTS       = [];     
let CP_EMPLOYEES      = [];     

function sameProjectId(a, b) {
  const norm = v => String(v ?? '').trim().toLowerCase().replace(/\s*-\s*/g, '-');
  return norm(a) === norm(b) && norm(a) !== '';
}

function isoDateOrBlank(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  let m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

let CP_TIMESHEET_DATA = [];     
let CP_MASTER_LOADED  = false;  

let CP_DETAIL_REFRESH_TIMER = null;

const CP_STATUSES = ['In Progress', 'Completed', 'On Hold'];

const CP_STATUS_META = {
  'In Progress': { bg: 'rgba(79,142,247,0.12)',  fg: '#4f8ef7' },
  'Completed':   { bg: 'rgba(52,211,153,0.12)',  fg: '#34d399' },
  'On Hold':     { bg: 'rgba(251,191,36,0.12)',  fg: '#fbbf24' },
};

const CP_PROJECT_PALETTE = [
  '#4f8ef7', '#7c5cfc', '#34d399', '#fbbf24', '#5eead4', '#22d3ee',
  '#fb923c', '#a78bfa', '#f472b6', '#84cc16', '#38bdf8', '#4ade80',
  '#facc15', '#c084fc', '#818cf8', '#2dd4bf',
];

function getColorForKey(key) {
  const str = String(key || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return CP_PROJECT_PALETTE[hash % CP_PROJECT_PALETTE.length];
}

function getProjectColor(projectId)  { return getColorForKey('proj:' + projectId); }
function getEmployeeColor(empId)     { return getColorForKey('emp:'  + empId); }

const CP_MONTH_ABBR = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
function parseAppTimestamp(str) {
  if (!str) return 0;
  const m = /^(\d{1,2})\s+(\w{3})\s+(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(String(str).trim());
  if (!m) return 0;
  const mon = CP_MONTH_ABBR[m[2].toLowerCase()];
  if (mon === undefined) return 0;
  let hour = parseInt(m[4], 10) % 12;
  if (/pm/i.test(m[7])) hour += 12;
  return new Date(parseInt(m[3], 10), mon, parseInt(m[1], 10), hour, parseInt(m[5], 10), parseInt(m[6], 10)).getTime();
}

function getProjectLastActivity(project) {
  let latest = Math.max(parseAppTimestamp(project.updatedDate), parseAppTimestamp(project.createdDate));

  if (typeof CP_TIMESHEET_DATA !== 'undefined' && CP_TIMESHEET_DATA.length) {
    CP_TIMESHEET_DATA.forEach(e => {
      if (e.project !== project.projectName || e.status === 'Leave' || !e.date) return;
      const t = new Date(e.date + 'T00:00:00').getTime();
      if (t > latest) latest = t;
    });
  }

  return latest;
}

function sortProjectsByRecency(projects) {
  return projects.slice().sort((a, b) => getProjectLastActivity(b) - getProjectLastActivity(a));
}

function sortProjectsByCreated(projects) {
  return projects.slice().sort((a, b) => {
    const ta = parseAppTimestamp(a.createdDate);
    const tb = parseAppTimestamp(b.createdDate);
    if (ta !== tb) return tb - ta;
    return (b.entryIndex || 0) - (a.entryIndex || 0);
  });
}

function getClientLastActivity(clientId) {
  const projects = CP_PROJECTS.filter(p => p.clientId === clientId);
  if (!projects.length) return 0;
  return Math.max(...projects.map(getProjectLastActivity));
}

function clientHasActiveProject(clientId) {
  return CP_PROJECTS.some(p => p.clientId === clientId && p.status === 'In Progress');
}

function sortClientsByRecency(clients) {
  return clients.slice().sort((a, b) => getClientLastActivity(b.id) - getClientLastActivity(a.id));
}

function sortClientsByEntry(clients) {
  return clients.slice().sort((a, b) => (b.entryIndex || 0) - (a.entryIndex || 0));
}

let CP_PROJECT_SORT = 'new'; 

let CP_PC_CLIENT     = ''; 
let CP_PC_PROJECT_ID = ''; 

function sortProjectsBySelection(projects, mode) {
  if (mode === 'az') return projects.slice().sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
  if (mode === 'za') return projects.slice().sort((a, b) => (b.projectName || '').localeCompare(a.projectName || ''));
  if (mode === 'old') return sortProjectsByCreated(projects).slice().reverse();
  return sortProjectsByCreated(projects); 
}

function getCPRole() {
  if (typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE) return 'manager';
  if (typeof TL_MODE !== 'undefined' && TL_MODE)          return 'tl';
  if (typeof HR_MODE !== 'undefined' && HR_MODE)          return 'hr';
  return null;
}

function ensureCPStyles() {
  if (document.getElementById('cp-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'cp-global-styles';
  style.textContent = `
    @keyframes cpBarShimmer { from { background-position: -60px 0; } to { background-position: 200px 0; } }
    .cp-modal-overlay {
      position:fixed;inset:0;background:rgba(0,0,0,.55);
      display:flex;align-items:center;justify-content:center;z-index:9999;
    }
    .cp-modal {
      background:var(--surface1);border:1px solid var(--border-md);
      border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;max-height:85vh;overflow-y:auto;
    }
    .cp-flabel { font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:0 0 5px; }
    .cp-finput {
      width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;
      color:var(--txt1);font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;
    }
    .cp-finput:disabled { opacity:.55;cursor:not-allowed; }
    .cp-finput:focus { outline:none;border-color:var(--a1); }
    .cp-btn-ghost {
      background:none;border:1px solid var(--border-md);color:var(--txt2);
      border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;
    }
    .cp-btn-primary {
      background:var(--a1);border:none;color:#fff;
      border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;
    }
    .cp-card {
      background:var(--surface1);border:1px solid var(--border);border-radius:14px;
      padding:1.25rem;width:100%;box-sizing:border-box;margin-bottom:1.25rem;
    }
    .cp-form-field { display:flex;flex-direction:column;gap:2px;margin-bottom:.9rem; }
    .cp-form-grid {
      display:grid;grid-template-columns:1fr 1fr;gap:0 14px;
    }
    .cp-form-grid .cp-form-field.cp-span2 { grid-column:1 / -1; }
    .cp-hint { font-size:10.5px;color:var(--txt2);font-weight:400; }
    .cp-pager-btn {
      padding:6px 12px;border-radius:7px;border:1px solid var(--border-md);
      background:var(--elevated);color:var(--txt2);font-size:11.5px;font-weight:600;cursor:pointer;
    }
    .cp-pager-btn:hover:not(:disabled) { color:var(--txt1);border-color:var(--a1); }
    .cp-pager-btn:disabled { opacity:.35;cursor:default; }
    .cp-pager-btn.active { background:var(--a1);color:#fff;border-color:var(--a1); }
    .cp-pager-num { min-width:30px;text-align:center; }

    /* ── Card grid (Client + Project tabs) ─────────────────────── */
    .cp-tab-header {
      display:flex;align-items:center;justify-content:space-between;
      margin-bottom:1.1rem;flex-wrap:wrap;gap:8px;
    }
    .cp-tab-title { font-size:16px;font-weight:700;color:var(--txt1); }
    .cp-tab-sub { font-size:12px;color:var(--txt2); }

    .cp-back-btn {
      display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;
      border:1px solid var(--border-md);background:var(--elevated);color:var(--txt2);
      font-size:13px;font-weight:600;cursor:pointer;
    }

    .cp-card-grid {
      display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));
      gap:.25rem;margin-top:.25rem;
    }
    /* Main Project tab (the landing page) — one card per row, full
       width. Scoped to #cpProjectGrid only: a client's own scoped
       project grid on the Client Detail page keeps the denser
       auto-fill layout. */
    #cpProjectGrid {
      grid-template-columns:1fr;
    }
    /* Client grid — one client per row, full width, so there's room
       for the per-project performance candles inside each card. */
    #cpClientGrid {
      grid-template-columns:1fr;
    }

    .cp-entity-card {
      background:var(--surface1);border:1px solid var(--border);border-radius:14px;
      padding:.24rem .4rem;display:flex;flex-direction:column;
    }
    .cp-entity-head { display:flex;align-items:center;gap:12px;margin-bottom:1.1rem; }
    .cp-entity-avatar {
      width:46px;height:46px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,var(--a1),#7c5cfc);
      display:flex;align-items:center;justify-content:center;
      font-weight:700;font-size:15px;color:#fff;
    }
    .cp-entity-titles { flex:1;min-width:0; }
    .cp-entity-name {
      font-weight:700;font-size:16px;color:var(--txt1);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .cp-entity-id {
      font-size:12px;color:var(--txt2);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }

    .cp-icon-btn {
      flex-shrink:0;background:none;border:none;color:var(--txt2);cursor:pointer;
      font-size:14px;padding:5px 7px;border-radius:6px;
    }
    .cp-icon-btn:hover { background:var(--surface2); }

    .cp-status-pill {
      display:inline-flex;align-items:center;gap:5px;border-radius:20px;
      padding:5px 12px;font-size:11.5px;font-weight:700;
    }
    .cp-status-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }

    .cp-entity-metrics {
      display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1.1rem;
    }
    .cp-metric-box { background:var(--surface2);border-radius:10px;padding:10px 14px; }
    .cp-metric-label {
      font-size:10.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;
    }
    .cp-metric-val { font-size:18px;font-weight:800;color:var(--txt1); }

    .cp-view-btn {
      align-self:flex-start;margin-top:auto;background:var(--a1);color:#fff;border:none;
      border-radius:7px;padding:7px 16px;font-size:12px;font-weight:600;cursor:pointer;
    }
    .attend-scrollbox:focus {
      box-shadow: 0 0 0 2px var(--a1, #4f8ef7);
    }
    .attend-scrollbox::-webkit-scrollbar { height: 10px; width: 10px; }
    .attend-scrollbox::-webkit-scrollbar-thumb {
      background: var(--border-md, #c7c7c7); border-radius: 6px;
    }
    .attend-scrollbox::-webkit-scrollbar-track { background: transparent; }
  `;
  document.head.appendChild(style);
}

window.ClientProjectAPI = window.ClientProjectAPI || {};
ClientProjectAPI.ingestMasterData = function(master) {
  window.MGR_CLIENTS  = master.clients  || [];
  window.MGR_PROJECTS = master.projects || [];
  CP_EMPLOYEES     = master.employees || [];
  CP_MASTER_LOADED = true;
};

ClientProjectAPI.ingestTimesheetData = function(entries) {
  CP_TIMESHEET_DATA = entries || [];
};

let CP_HISTORICAL_DATA = []; 

async function ensureSalaryDataLoaded() {
  if (!SAL_LOADED) await loadSalaryData();
}

function getProjectMonthlyHoursByEmployee(project) {
  const byEmpMonth = {}; 

  CP_TIMESHEET_DATA.forEach(e => {
    if (e.project !== project.projectName || e.status === 'Leave' || !e.date) return;
    const month = e.date.slice(0, 7);
    if (!byEmpMonth[e.empId]) byEmpMonth[e.empId] = {};
    byEmpMonth[e.empId][month] = (byEmpMonth[e.empId][month] || 0) + parseH(e.hours);
  });

  CP_HISTORICAL_DATA
    .filter(h => sameProjectId(h.projectId, project.projectId))
    .forEach(h => {
      const month = histMonthYearToKey_(h.month, h.year);
      if (!month || !h.employeeId) return;
      if (!byEmpMonth[h.employeeId]) byEmpMonth[h.employeeId] = {};
      byEmpMonth[h.employeeId][month] = (byEmpMonth[h.employeeId][month] || 0) + (Number(h.totalHours) || 0);
    });

  return byEmpMonth;
}

function getMonthlyPointsForEmployee(empId, month, empName) {
  if (typeof getEffectiveSalary !== 'function') return 0;
  const eff = getEffectiveSalary(empId, month, empName);
  return eff && eff.record ? (parseFloat(eff.record.points) || 0) : 0;
}

function getProjectCostBreakdown(project) {
  const totals = getProjectEmployeeTotals(project); 
  const byEmpMonth = getProjectMonthlyHoursByEmployee(project);
  let totalCost = 0;
  const missingPoints = [];

  const rows = totals.map(t => {
    const months = byEmpMonth[t.empId] || {};
    let cost = 0;
    Object.entries(months).forEach(([month, hrs]) => {
      cost += hrs * getMonthlyPointsForEmployee(t.empId, month, t.name);
    });
    const hasPoints = cost > 0;
    if (!hasPoints) missingPoints.push(t.name);
    totalCost += cost;
    return { empId: t.empId, name: t.name, hours: t.hours, cost, hasPoints };
  });

  return { rows, totalCost, missingPoints };
}

let CP_HIST_PROJECTS_SUMMARY = [];

function getHistoricalOnlyProjects() {
  const realPairs = new Set(CP_PROJECTS.map(p => {
    const client = CP_CLIENTS.find(c => c.id === p.clientId);
    return ((p.projectName || '') + '|' + (client?.name || '')).toLowerCase();
  }));
  return CP_HIST_PROJECTS_SUMMARY.filter(hp =>
    !realPairs.has(((hp.projectName || '') + '|' + (hp.clientName || '')).toLowerCase())
  );
}

const HIST_MONTH_NUM_ = {
  January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
};

function histMonthYearToKey_(monthName, year) {
  const num = HIST_MONTH_NUM_[monthName];
  return num ? `${year}-${num}` : null;
}

async function renderClientTab(content) {
  ensureCPStyles();
  CP_ROLE = getCPRole();
  if (!CP_ROLE) {
    content.innerHTML = `<div class="chart-empty">Client data is only accessible to the Manager or Team Leader.</div>`;
    return;
  }
  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading clients…</span></div>`;
  try {

    await loadProjectBundle(false);
  } catch(err) {
    content.innerHTML = `<div class="slot-error">Failed to load clients: ${esc(err.message)}</div>`;
    return;
  }

  try {
    renderClientCards(content);
  } catch (err) {
    content.innerHTML = `<div class="slot-error">Failed to display clients: ${esc(err.message)}</div>`;
  }
}

async function renderProjectTab(content) {
  ensureCPStyles();
  CP_ROLE = getCPRole();
  if (!CP_ROLE) {
    content.innerHTML = `<div class="chart-empty">Project data is only accessible to the Manager or Team Leader.</div>`;
    return;
  }
  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading projects…</span></div>`;
  try {

    await loadProjectBundle(false);
    if (CP_ROLE === 'manager' || CP_ROLE === 'tl') await ensureSalaryDataLoaded();
  } catch(err) {
    content.innerHTML = `<div class="slot-error">Failed to load projects: ${esc(err.message)}</div>`;
    return;
  }

  try {
    renderProjectList(content);
  } catch (err) {
    content.innerHTML = `<div class="slot-error">Failed to display projects: ${esc(err.message)}</div>`;
  }
}

async function refreshProjectTab(content) {
  const btn = $('cpRefreshBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.5'; }
  try {
    await loadProjectBundle(true);
    if (CP_ROLE === 'manager' || CP_ROLE === 'tl') await loadSalaryData(true);
    toast?.('s', 'Refreshed', 'Projects & Clients data is up to date.');
  } catch (err) {
    toast?.('e', 'Refresh failed', err.message);
  }

  try {
    renderProjectList(content);
  } catch (err) {
    content.innerHTML = `<div class="slot-error">Failed to display projects: ${esc(err.message)}</div>`;
  }
}

async function loadClientData() {

  const clients = await sheetGET({ action: 'getClientMasterList' });
  CP_CLIENTS = clients.map((c, idx) => ({ ...c, entryIndex: idx }));
  window.MGR_CLIENTS = CP_CLIENTS; 
}

async function loadProjectData() {

  const projects = await sheetGET({ action: 'getProjectMasterList', role: CP_ROLE });
  CP_PROJECTS = projects.map((p, idx) => ({ ...p, entryIndex: idx }));
}

async function renderClientCards(content) {
  const isManager = CP_ROLE === 'manager';
  const sorted = sortClientsByRecency(CP_CLIENTS); 

  content.innerHTML = `
    <div class="cp-tab-header">
      <div>
        <div class="cp-tab-title">🏢 Clients</div>
        <div class="cp-tab-sub">${isManager ? 'Client ID is auto-generated and permanent once created.' : 'View each client\u2019s projects and progress.'}</div>
      </div>
      ${(isManager || CP_ROLE === 'tl') ? `<button id="cpNewClientBtn" class="cp-btn-primary" style="padding:8px 16px;font-size:13px;border-radius:8px;">+ New Client</button>` : ''}
    </div>

    ${sorted.length === 0
      ? `<div class="chart-empty">No clients yet.${isManager ? ' Click “+ New Client” to add one.' : ''}</div>`
      : `<div class="cp-card-grid" id="cpClientGrid">${sorted.map(c => buildClientCard(c, isManager)).join('')}</div>`}
  `;

  $('cpNewClientBtn')?.addEventListener('click', () =>
    openClientEditor(content, null, () => renderClientCards(content)));

  wireClientCardEvents(content);
}

function wireClientCardEvents(content) {
  content.querySelectorAll('.cp-client-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const client = CP_CLIENTS.find(c => c.id === btn.dataset.id);
      if (!client) return;

      const clientProjects = sortProjectsByRecency(CP_PROJECTS.filter(p => p.clientId === client.id));
      if (!clientProjects.length) {
        toast?.('i', 'No projects yet', `${client.name} has no projects to view.`);
        return;
      }

      openProjectDetail(content, clientProjects[0].projectId, { onBack: () => renderClientCards(content) });
    });
  });
  content.querySelectorAll('.cp-client-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const client = CP_CLIENTS.find(c => c.id === btn.dataset.id);
      if (client) openClientEditor(content, client, () => renderClientCards(content));
    });
  });
}

function buildClientCard(client, isManager) {
  const initials = client.name.split(' ').map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?';
  const isActive = clientHasActiveProject(client.id);
  const clientProjects = CP_PROJECTS.filter(p => p.clientId === client.id);
  const totalHours = clientProjects.reduce((s, p) => s + getProjectTeamActivity(p).totalHours, 0);

  const st = isActive
    ? { bg: 'rgba(52,211,153,0.12)', fg: '#34d399', label: 'Active Project' }
    : { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8', label: 'No Active Project' };

  return `
    <div class="cp-entity-card">
      <div class="cp-entity-head">
        <div class="cp-entity-avatar">${esc(initials)}</div>
        <div class="cp-entity-titles">
          <div class="cp-entity-name" title="${esc(client.name)}">${esc(client.name)}</div>
          <div class="cp-entity-id">${esc(client.id)}</div>
        </div>
        ${isManager ? `<button class="cp-icon-btn cp-client-edit-btn" data-id="${esc(client.id)}" title="Edit client">✏️</button>` : ''}
      </div>

      <div style="margin-bottom:.9rem;">
        <span class="cp-status-pill" style="background:${st.bg};color:${st.fg};">
          <span class="cp-status-dot" style="background:${st.fg};"></span>${st.label}
        </span>
      </div>

      <div class="cp-entity-metrics" style="grid-template-columns:1fr 1fr;max-width:400px;">
        <div class="cp-metric-box">
          <div class="cp-metric-label">Projects</div>
          <div class="cp-metric-val">${clientProjects.length}</div>
        </div>
        <div class="cp-metric-box">
          <div class="cp-metric-label">Total Hours</div>
          <div class="cp-metric-val">${totalHours.toFixed(1)}h</div>
        </div>
      </div>

      <div style="margin:1rem 0;">
        <div style="font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Project Performance</div>
        ${buildClientCandleChart(client, clientProjects)}
      </div>

      <button class="cp-view-btn cp-client-view-btn" data-id="${esc(client.id)}">View Projects →</button>
    </div>`;
}

function buildClientCandleChart(client, projects) {
  if (!projects.length) {
    return `<div style="font-size:11px;color:var(--txt2);">No projects yet for this client.</div>`;
  }

  const perProject = projects.map(p => {
    const totals = getProjectEmployeeTotals(p);
    const totalHours = totals.reduce((s, t) => s + t.hours, 0);
    return { project: p, totals, totalHours };
  });

  const maxHours = Math.max(...perProject.map(x => x.totalHours), 0.01);
  const isManager = CP_ROLE === 'manager';
  const maxConstant = isManager
    ? Math.max(...perProject.map(x => parseFloat(x.project.projectConstant) || 0), 0.01)
    : 0;

  const rows = perProject.map(({ project: p, totals, totalHours }, i) => {
    const isLast = i === perProject.length - 1;
    return buildProjectPerfRow(p, totals, totalHours, maxHours, isLast, isManager, maxConstant);
  }).join('');

  return `<div>${rows}</div>`;
}

function buildProjectPerfRow(project, totals, totalHours, maxHours, isLast, isManager, maxConstant) {
  const hasHours = totalHours > 0;
  const timeFillPct = hasHours ? Math.max((totalHours / maxHours) * 100, 3) : 100;
  const timeSegments = hasHours
    ? totals.map(t => {
        const segPct = (t.hours / totalHours) * 100;
        return `<div style="width:${segPct}%;height:100%;background:${getEmployeeColor(t.empId)};"
          title="${esc(t.name)}: ${fmtHM(t.hours)}"></div>`;
      }).join('')
    : `<div style="width:100%;height:100%;background:var(--border-md);" title="No hours logged yet"></div>`;

  const constantVal = parseFloat(project.projectConstant) || 0;
  const constantRow = isManager ? `
      <div style="display:flex;align-items:center;gap:10px;margin-top:4px;">
        <span style="flex:0 0 62px;font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Constant</span>
        <div style="flex:1;height:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;overflow:hidden;">
          <div style="width:${Math.max((constantVal / maxConstant) * 100, constantVal > 0 ? 3 : 0)}%;height:100%;background:var(--a1);"></div>
        </div>
        <span style="flex:0 0 74px;text-align:right;font-size:10px;color:var(--txt1);font-weight:700;white-space:nowrap;">${esc(fmtCPConstant(constantVal))}</span>
      </div>` : '';

  return `
    <div style="${isLast ? '' : 'margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border);'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:11.5px;font-weight:700;color:var(--txt1);" title="${esc(project.projectName || project.projectId)}">${esc(project.projectId)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="flex:0 0 62px;font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Time</span>
        <div style="flex:1;height:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;overflow:hidden;">
          <div style="width:${timeFillPct}%;height:100%;display:flex;">${timeSegments}</div>
        </div>
        <span style="flex:0 0 74px;text-align:right;font-size:10px;color:var(--txt1);font-weight:700;white-space:nowrap;">${fmtHM(totalHours)}</span>
      </div>${constantRow}
    </div>`;
}

function openClientEditor(content, client = null, onDone = null) {
  const isNew = !client;

  if (!isNew && CP_ROLE !== 'manager') return;
  if (isNew && CP_ROLE !== 'manager' && CP_ROLE !== 'tl') return;

  const refresh = onDone || (() => renderClientCards(content));

  const overlay = document.createElement('div');
  overlay.className = 'cp-modal-overlay';
  overlay.innerHTML = `
    <div class="cp-modal">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:12px;">${isNew ? '🏢 New Client' : '✏️ Rename Client'}</div>

      <label class="cp-flabel">Client Name</label>
      <input class="cp-finput" id="cpClientName" value="${isNew ? '' : esc(client.name)}" placeholder="e.g. Brigade Group"/>

      <label class="cp-flabel">Client ID</label>
      <input class="cp-finput" id="cpClientIdPreview" value="${isNew ? 'Generating…' : esc(client.id)}" disabled/>

      <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:16px;">
        ${(!isNew) ? `<button id="cpClientDelete" style="background:none;border:1px solid rgba(248,113,113,0.4);
          color:#f87171;border-radius:7px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;">🗑 Delete</button>` : `<span></span>`}
        <div style="display:flex;gap:8px;">
          <button id="cpClientCancel" class="cp-btn-ghost">Cancel</button>
          <button id="cpClientSave" class="cp-btn-primary">${isNew ? 'Create' : 'Save'}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  if (isNew) {
    sheetGET({ action: 'getNextClientId' })
      .then(id => { const el = overlay.querySelector('#cpClientIdPreview'); if (el) el.value = id; })
      .catch(() => { const el = overlay.querySelector('#cpClientIdPreview'); if (el) el.value = '—'; });
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#cpClientCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#cpClientSave').addEventListener('click', async () => {
    const name = overlay.querySelector('#cpClientName').value.trim();
    if (!name) { toast?.('e', 'Client name is required'); return; }

    const btn = overlay.querySelector('#cpClientSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (isNew) {
        await sheetGET({ action: 'createClientMaster', data: encodeURIComponent(JSON.stringify({ role: CP_ROLE, name })) });
        toast?.('s', 'Client created', name);
      } else {
        await sheetGET({ action: 'updateClientMaster', data: encodeURIComponent(JSON.stringify({ role: CP_ROLE, id: client.id, name })) });
        toast?.('s', 'Client updated', name);
      }

      if (typeof clearMasterDataCache === 'function') clearMasterDataCache();
      overlay.remove();
      await loadClientData();
      refresh();
    } catch(err) {
      btn.disabled = false; btn.textContent = isNew ? 'Create' : 'Save';
      toast?.('e', 'Save failed', err.message);
    }
  });

  overlay.querySelector('#cpClientDelete')?.addEventListener('click', async () => {
    if (!confirm(`Delete client "${client.name}" (${client.id})? This cannot be undone.`)) return;
    try {
      await sheetGET({ action: 'deleteClientMaster', data: encodeURIComponent(JSON.stringify({ role: CP_ROLE, id: client.id })) });
      toast?.('s', 'Client deleted', client.name);
      if (typeof clearMasterDataCache === 'function') clearMasterDataCache();
      overlay.remove();
      await loadClientData();
      refresh();
    } catch(err) {
      toast?.('e', 'Delete failed', err.message);
    }
  });
}

async function renderClientProjectPerformanceInto(content, gridEl, projects, onBack) {
  if (!gridEl) return;
  gridEl.innerHTML = buildClientProjectPerfGrid(projects);
  wireProjectCards(content, gridEl, projects, onBack);
}

function buildClientProjectPerfGrid(projects) {
  if (!projects.length) return `<div class="chart-empty">No projects yet for this client.</div>`;

  const perProject = projects.map(p => {
    const totals = getProjectEmployeeTotals(p);
    const totalHours = totals.reduce((s, t) => s + t.hours, 0);
    return { project: p, totals, totalHours };
  });

  const maxHours = Math.max(...perProject.map(x => x.totalHours), 0.01);

  const cards = perProject.map(({ project: p, totals, totalHours }) => {
    return `
      <div class="cp-card">
        ${buildProjectPerfRow(p, totals, totalHours, maxHours, true)}
        <button class="cp-project-view-btn" data-id="${esc(p.projectId)}" style="margin-top:1rem;width:100%;
          background:var(--a1);color:#fff;border:none;border-radius:8px;padding:8px 14px;
          font-size:12px;font-weight:700;cursor:pointer;">View Details →</button>
      </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.25rem;">${cards}</div>`;
}

function renderClientDetail(content, client) {
  const isManager = CP_ROLE === 'manager';
  const projects = sortProjectsByRecency(CP_PROJECTS.filter(p => p.clientId === client.id)); 

  content.innerHTML = `
    <div style="margin-bottom:1rem;">
      <button id="cpClientBack" class="cp-back-btn">← Back to Clients</button>
    </div>

    <div class="cp-tab-header">
      <div>
        <div class="cp-tab-title">🏢 ${esc(client.name)}</div>
        <div class="cp-tab-sub">${esc(client.id)} · ${projects.length} project${projects.length !== 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;gap:8px;">
        ${isManager ? `<button id="cpClientDetailEdit" class="cp-btn-ghost">✏️ Edit Client</button>` : ''}
        ${(isManager || CP_ROLE === 'tl') ? `<button id="cpClientAddProject" class="cp-btn-primary" style="padding:8px 16px;font-size:13px;border-radius:8px;">+ Add Project</button>` : ''}
      </div>
    </div>

    ${projects.length === 0
      ? `<div class="chart-empty">No projects yet for this client.${isManager ? ' Click “+ Add Project” to add one.' : ''}</div>`
      : `<div class="cp-card-grid" id="cpClientProjectGrid"></div>`}
  `;

  $('cpClientBack').addEventListener('click', () => renderClientCards(content));
  $('cpClientDetailEdit')?.addEventListener('click', () =>
    openClientEditor(content, client, () => renderClientDetail(content, client)));
  $('cpClientAddProject')?.addEventListener('click', () =>
    openProjectDetail(content, null, { onBack: () => renderClientDetail(content, client), presetClientId: client.id }));

  if (projects.length) {
    renderClientProjectPerformanceInto(content, $('cpClientProjectGrid'), projects, () => renderClientDetail(content, client));
  }
}

function renderProjectList(content) {
  const isManager = CP_ROLE === 'manager';
  const filteredProjects = CP_PC_CLIENT ? CP_PROJECTS.filter(p => p.clientId === CP_PC_CLIENT) : CP_PROJECTS;
  const sortedProjects = sortProjectsBySelection(filteredProjects, CP_PROJECT_SORT);
  const inDetail = !!CP_PC_PROJECT_ID; 

  const selectedClientName = CP_PC_CLIENT ? (CP_CLIENTS.find(c => c.id === CP_PC_CLIENT)?.name || '') : '';
  const filteredHistorical = inDetail ? [] : getHistoricalOnlyProjects()
    .filter(hp => !selectedClientName || (hp.clientName || '').toLowerCase() === selectedClientName.toLowerCase());
  const hasAnyResults = sortedProjects.length > 0 || filteredHistorical.length > 0;

  content.innerHTML = `
    <div class="cp-tab-header">
      <div>
        <div class="cp-tab-title">📁 Projects & Clients</div>
        <div class="cp-tab-sub">Projects received from clients — status and view progress. Not a task board.</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button id="cpRefreshBtn" title="Refresh this tab's data" style="background:var(--elevated);
          border:1px solid var(--border-md);border-radius:6px;color:var(--txt2);cursor:pointer;
          padding:7px 10px;font-size:13px;line-height:1;display:flex;align-items:center;">🔄</button>
        <input id="cpProjectSearch" type="text" placeholder="🔍 Search projects…" style="background:var(--surface2);
          border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12.5px;padding:7px 10px;width:180px;"/>
        <select id="cpProjectSort" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
          color:var(--txt1);font-size:12.5px;padding:7px 10px;cursor:pointer;">
          <option value="new" ${CP_PROJECT_SORT === 'new' ? 'selected' : ''}>Newest → Oldest</option>
          <option value="old" ${CP_PROJECT_SORT === 'old' ? 'selected' : ''}>Oldest → Newest</option>
          <option value="az"  ${CP_PROJECT_SORT === 'az'  ? 'selected' : ''}>A → Z</option>
          <option value="za"  ${CP_PROJECT_SORT === 'za'  ? 'selected' : ''}>Z → A</option>
        </select>
        ${(isManager || CP_ROLE === 'tl') ? `<button id="cpNewClientBtn" class="cp-btn-primary" style="padding:8px 16px;font-size:13px;border-radius:8px;background:var(--elevated);color:var(--txt1);border:1px solid var(--border-md);">+ New Client</button>` : ''}
        ${(isManager || CP_ROLE === 'tl') ? `<button id="cpNewProjectBtn" class="cp-btn-primary" style="padding:8px 16px;font-size:13px;border-radius:8px;">+ New Project</button>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:16px;align-items:flex-start;">
      <div id="cpClientsSidebar" style="flex:0 0 ${inDetail ? '170px' : '230px'};"></div>
      <div style="flex:${inDetail ? '0 0 230px' : '1'};min-width:0;">
        ${!hasAnyResults
          ? `<div class="chart-empty">No projects${CP_PC_CLIENT ? ' for this client' : ''} yet.${isManager && !CP_PC_CLIENT ? ' Click “+ New Project” to add one.' : ''}</div>`
          : inDetail
            ? `<div id="cpProjectListPane"></div>`
            : `<div class="cp-card-grid" id="cpProjectGrid"></div>`}
      </div>
      ${inDetail ? `<div style="flex:1;min-width:0;" id="cpProjectDetailPane"></div>` : ''}
    </div>
  `;

  $('cpNewClientBtn')?.addEventListener('click', () =>
    openClientEditor(content, null, () => renderProjectList(content)));
  $('cpNewProjectBtn')?.addEventListener('click', () =>
    openProjectDetail(content, null, { presetClientId: CP_PC_CLIENT, onBack: () => renderProjectList(content) }));
  $('cpRefreshBtn')?.addEventListener('click', () => refreshProjectTab(content));
  $('cpProjectSort')?.addEventListener('change', e => {
    CP_PROJECT_SORT = e.target.value;
    renderProjectList(content);
  });
  $('cpProjectSearch')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    content.querySelectorAll('[data-search]').forEach(el => {

      if (!el.classList.contains('cp-entity-card') && !el.classList.contains('cp-project-list-row')) return;
      el.style.display = !q || el.dataset.search.includes(q) ? '' : 'none';
    });
  });

  renderClientsSidebarInto($('cpClientsSidebar'), content);

  if (!hasAnyResults) return;

  if (!inDetail) {

    const gridEl = $('cpProjectGrid');
    const wireGridClicks = () => {
      gridEl.querySelectorAll('.cp-project-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          CP_PC_PROJECT_ID = btn.dataset.id;
          renderProjectList(content);
        });
      });
    };
    gridEl.innerHTML = sortedProjects.map(p => buildProjectCard(p)).join('')
      + filteredHistorical.map(buildHistoricalOnlyCard).join('');
    wireGridClicks();
    return;
  }

  renderCompactProjectListInto($('cpProjectListPane'), sortedProjects, content);
  openProjectDetail($('cpProjectDetailPane'), CP_PC_PROJECT_ID, {
    onBack: () => { CP_PC_PROJECT_ID = ''; renderProjectList(content); },
  });
}

function renderClientsSidebarInto(wrap, content) {
  if (!wrap) return;
  const sortedClients = sortClientsByRecency(CP_CLIENTS);
  const allCount = CP_PROJECTS.length;

  wrap.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-size:10.5px;font-weight:700;
        color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;">Clients</div>
      <div style="padding:10px 12px;border-bottom:1px solid var(--border);">
        <input id="cpClientSearch" type="text" placeholder="🔍 Search clients…" style="width:100%;box-sizing:border-box;
          background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);
          font-size:12px;padding:6px 8px;"/>
      </div>
      <div class="cp-client-sidebar-row" data-client="" data-search="all clients" style="padding:10px 14px;cursor:pointer;
        display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;
        ${!CP_PC_CLIENT ? 'background:var(--elevated);color:var(--a1);' : 'color:var(--txt1);'}">
        <span>All Clients</span><span style="font-size:11px;color:var(--txt2);">${allCount}</span>
      </div>
      ${sortedClients.map(c => {
        const count = CP_PROJECTS.filter(p => p.clientId === c.id).length;
        const active = CP_PC_CLIENT === c.id;
        return `
          <div class="cp-client-sidebar-row" data-client="${esc(c.id)}" data-search="${esc((c.name || '').toLowerCase())}" style="padding:10px 14px;cursor:pointer;
            display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;
            border-top:1px solid var(--border);${active ? 'background:var(--elevated);color:var(--a1);font-weight:700;' : 'color:var(--txt1);'}">
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.name)}</span>
            <span style="font-size:11px;color:var(--txt2);flex-shrink:0;">${count}</span>
          </div>`;
      }).join('')}
    </div>`;

  wrap.querySelectorAll('.cp-client-sidebar-row').forEach(row => {
    row.addEventListener('click', () => {
      CP_PC_CLIENT = row.dataset.client;
      CP_PC_PROJECT_ID = ''; 
      renderProjectList(content);
    });
  });

  $('cpClientSearch')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    wrap.querySelectorAll('.cp-client-sidebar-row[data-client]:not([data-client=""])').forEach(row => {
      row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
    });
  });
}

function renderCompactProjectListInto(wrap, projects, content) {
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      ${projects.map((p, i) => {
        const client = CP_CLIENTS.find(c => c.id === p.clientId);
        const active = p.projectId === CP_PC_PROJECT_ID;
        return `
          <div class="cp-project-list-row" data-id="${esc(p.projectId)}" data-search="${esc(((p.projectName || '') + ' ' + (p.projectId || '')).toLowerCase())}" style="padding:10px 14px;cursor:pointer;
            ${i > 0 ? 'border-top:1px solid var(--border);' : ''}${active ? 'background:var(--elevated);' : ''}">
            <div style="font-size:12.5px;font-weight:700;color:${active ? 'var(--a1)' : 'var(--txt1)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.projectName || p.projectId)}</div>
            <div style="font-size:10.5px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${esc(p.projectId)} · ${esc(client?.name || p.clientId || '—')}</div>
          </div>`;
      }).join('')}
    </div>`;

  wrap.querySelectorAll('.cp-project-list-row').forEach(row => {
    row.addEventListener('click', () => {
      CP_PC_PROJECT_ID = row.dataset.id;
      renderProjectList(content);
    });
  });
}

async function renderProjectCardsInto(content, gridEl, projects, onBack) {
  if (!gridEl) return;
  gridEl.innerHTML = projects.map(p => buildProjectCard(p)).join('');
  wireProjectCards(content, gridEl, projects, onBack);
}

function wireProjectCards(content, gridEl, projects, onBack) {
  gridEl.querySelectorAll('.cp-project-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const project = projects.find(p => p.projectId === btn.dataset.id);
      if (project) openProjectDetail(content, project.projectId, { onBack });
    });
  });
}

function buildProjectCard(p) {
  const client = CP_CLIENTS.find(c => c.id === p.clientId);
  const initials = (p.projectName || p.projectId || '?').trim().slice(0, 2).toUpperCase();
  const color  = getProjectColor(p.projectId);

  const isManager = CP_ROLE === 'manager';
  const isTL      = CP_ROLE === 'tl';
  const totals = getProjectEmployeeTotals(p); 
  const totalHours = totals.reduce((s, t) => s + t.hours, 0);

  const endOrStatusLabel = 'Status';
  const endOrStatusValue = p.status;

  let consumedBarHtml, barLabelHtml;

  if (isManager) {
    const { rows: costRows, totalCost } = getProjectCostBreakdown(p);
    const budget = parseFloat(p.projectConstant) || 0;
    const hasBudget = budget > 0;
    const isOverBudget = hasBudget && totalCost > budget;
    const fillPct = hasBudget
      ? Math.min((totalCost / budget) * 100, 100)
      : (totalCost > 0 ? 100 : 0);

    if (!totalCost) {
      consumedBarHtml = `<div style="width:100%;height:100%;background:var(--border-md);"></div>`;
    } else if (isOverBudget) {
      consumedBarHtml = `<div style="width:100%;height:100%;background:#f87171;"
        title="${esc(fmtCPMoney(totalCost))} cost vs ${esc(fmtCPMoney(budget))} budget — over by ${esc(fmtCPMoney(totalCost - budget))}"></div>`;
    } else {
      consumedBarHtml = costRows.filter(r => r.cost > 0).map(r => {

        const pct = (r.cost / totalCost) * fillPct;
        return `<div style="width:${pct}%;height:100%;background:${getEmployeeColor(r.empId)};"
          title="${esc(r.name)}: ${fmtCPMoney(r.cost)}"></div>`;
      }).join('');
    }

    barLabelHtml = `<div style="font-size:9px;font-weight:700;margin-bottom:3px;
        color:${isOverBudget ? '#f87171' : 'var(--txt1)'};">
        ${!totalCost
          ? (totalHours > 0 ? `${esc(fmtHM(totalHours))} logged — no Points set` : 'No hours logged yet')
          : hasBudget
            ? (isOverBudget
                ? `${esc(fmtCPMoney(totalCost))} cost — ${esc(fmtCPMoney(totalCost - budget))} over budget`
                : `${esc(fmtCPMoney(totalCost))} of ${esc(fmtCPMoney(budget))} budget consumed`)
            : `${esc(fmtCPMoney(totalCost))} cost so far`}
      </div>`;
  } else if (isTL) {

    const { totalCost } = getProjectCostBreakdown(p);
    const budget = parseFloat(p.projectConstant) || 0;
    const hasBudget = budget > 0;
    const isOverBudget = hasBudget && totalCost > budget;
    const fillPct = hasBudget
      ? Math.min((totalCost / budget) * 100, 100)
      : (totalCost > 0 ? 100 : 0);

    if (!totalCost) {
      consumedBarHtml = `<div style="width:100%;height:100%;background:var(--border-md);"></div>`;
    } else if (isOverBudget) {
      consumedBarHtml = `<div style="width:100%;height:100%;background:#f87171;"
        title="${esc(fmtCPMoney(totalCost))} cost vs ${esc(fmtCPMoney(budget))} budget — over by ${esc(fmtCPMoney(totalCost - budget))}"></div>`;
    } else {
      consumedBarHtml = `<div style="width:${fillPct}%;height:100%;background:#34d399;"
        title="${esc(fmtCPMoney(totalCost))} of ${esc(fmtCPMoney(budget))} budget consumed"></div>`;
    }

    barLabelHtml = `<div style="font-size:9px;font-weight:700;margin-bottom:3px;
        color:${isOverBudget ? '#f87171' : (totalCost > 0 && hasBudget ? '#34d399' : 'var(--txt1)')};">
        ${!totalCost
          ? (totalHours > 0 ? `${esc(fmtHM(totalHours))} logged — no Points set` : 'No hours logged yet')
          : hasBudget
            ? (isOverBudget
                ? `${esc(fmtCPMoney(totalCost))} cost — ${esc(fmtCPMoney(totalCost - budget))} over budget`
                : `${esc(fmtCPMoney(totalCost))} of ${esc(fmtCPMoney(budget))} budget consumed`)
            : `${esc(fmtCPMoney(totalCost))} cost so far`}
      </div>`;
  } else {
    consumedBarHtml = totalHours > 0
      ? totals.map(t => {
          const pct = (t.hours / totalHours) * 100;
          return `<div style="width:${pct}%;height:100%;background:${getEmployeeColor(t.empId)};"
            title="${esc(t.name)}: ${fmtHM(t.hours)}"></div>`;
        }).join('')
      : `<div style="width:100%;height:100%;background:var(--border-md);"></div>`;
    barLabelHtml = `<div style="font-size:9px;font-weight:700;color:var(--txt1);margin-bottom:3px;">
        ${totalHours > 0 ? `${esc(fmtHM(totalHours))} consumed` : 'No hours logged yet'}
      </div>`;
  }

  return `
    <div class="cp-entity-card" data-search="${esc(((p.projectName || '') + ' ' + (p.projectId || '')).toLowerCase())}">
      <div style="display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:5px;margin-bottom:.18rem;">
        <div style="display:flex;align-items:center;gap:8px;min-width:180px;">
          <div class="cp-entity-avatar" style="background:${color};width:16px;height:16px;font-size:8px;">${esc(initials)}</div>
          <div>
            <div class="cp-entity-name" style="font-size:12px;" title="${esc(p.projectName)}">${esc(p.projectName || p.projectId)}</div>
            <div class="cp-entity-id" style="font-size:9.5px;" title="${esc(client?.name || p.clientId || '')}">${esc(p.projectId)} · ${esc(client?.name || p.clientId || '—')}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="cp-metric-box" style="min-width:60px;padding:3px 6px;">
            <div class="cp-metric-label">Start Date</div>
            <div class="cp-metric-val" style="font-size:9px;">${esc(fmtCPDateShort(p.startDate))}</div>
          </div>
          <div class="cp-metric-box" style="min-width:60px;padding:3px 6px;">
            <div class="cp-metric-label">${esc(endOrStatusLabel)}</div>
            <div class="cp-metric-val" style="font-size:9px;">${esc(endOrStatusValue)}</div>
          </div>
        </div>
      </div>

      <div>
        ${barLabelHtml}
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="flex:1;height:4px;background:var(--surface2);border-radius:4px;overflow:hidden;position:relative;display:flex;">
            ${consumedBarHtml}
          </div>
          <button class="cp-view-btn cp-project-view-btn" data-id="${esc(p.projectId)}" style="flex-shrink:0;">View Details →</button>
        </div>
      </div>
    </div>`;
}

function buildHistoricalOnlyCard(hp) {
  const initials = (hp.projectName || '?').trim().slice(0, 2).toUpperCase();
  const color = getProjectColor(hp.projectName || hp.clientName || '');

  return `
    <div class="cp-entity-card" data-search="${esc(((hp.projectName || '') + ' ' + (hp.clientName || '')).toLowerCase())}">
      <div style="display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:5px;margin-bottom:.18rem;">
        <div style="display:flex;align-items:center;gap:8px;min-width:180px;">
          <div class="cp-entity-avatar" style="background:${color};width:16px;height:16px;font-size:8px;">${esc(initials)}</div>
          <div>
            <div class="cp-entity-name" style="font-size:12px;" title="${esc(hp.projectName || '')}">${esc(hp.projectName || '—')}
              <span style="font-size:9.5px;font-weight:700;color:var(--txt2);background:var(--surface2);
                border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:middle;">Historical</span>
            </div>
            <div class="cp-entity-id" style="font-size:9.5px;" title="${esc(hp.clientName || '')}">${esc(hp.clientName || '—')}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div class="cp-metric-box" style="min-width:60px;padding:3px 6px;">
            <div class="cp-metric-label">Months</div>
            <div class="cp-metric-val" style="font-size:9px;">${esc(hp.monthCount ?? '—')}</div>
          </div>
          <div class="cp-metric-box" style="min-width:60px;padding:3px 6px;">
            <div class="cp-metric-label">Status</div>
            <div class="cp-metric-val" style="font-size:9px;">${hp.isFinal ? 'Final' : 'Draft'}</div>
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:4px;background:var(--surface2);border-radius:4px;overflow:hidden;position:relative;display:flex;">
          <div style="width:100%;height:100%;background:var(--border-md);"></div>
          <span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
            font-size:10.5px;font-weight:700;color:var(--txt1);">
            ${fmtOldProjHours(hp.totalHours)} total · ${hp.employeeCount ?? 0} employees
          </span>
        </div>
      </div>
    </div>`;
}

function buildProjNavChip(proj, direction) {
  const initials = (proj.projectName || proj.projectId || '?').trim().slice(0, 2).toUpperCase();
  const color = getProjectColor(proj.projectId);
  const arrow = direction === 'prev' ? '◀' : '▶';
  const avatar = `<span style="width:22px;height:22px;border-radius:50%;background:${color};flex-shrink:0;
    display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">${esc(initials)}</span>`;
  const label = `<span style="display:flex;flex-direction:column;line-height:1.25;${direction === 'next' ? 'align-items:flex-end;' : ''}min-width:0;">
    <span style="font-size:10.5px;font-weight:700;color:var(--txt1);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(proj.projectName || proj.projectId)}">${esc(proj.projectName || proj.projectId)}</span>
    <span style="font-size:9px;color:var(--txt2);">${esc(proj.projectId)}</span>
  </span>`;

  return `
    <button class="cp-btn-ghost cp-proj-nav-chip" data-project-id="${esc(proj.projectId)}"
      style="display:flex;align-items:center;gap:7px;text-align:left;padding:6px 10px;">
      ${direction === 'prev' ? `<span>${arrow}</span>${avatar}${label}` : `${label}${avatar}<span>${arrow}</span>`}
    </button>`;
}

async function openProjectDetail(content, projectId, opts = {}) {
  const goBack = opts.onBack || (() => renderProjectList(content));
  const presetClientId = opts.presetClientId || '';

  const isNew = !projectId;
  const project = isNew
    ? { projectId: '', projectName: '', clientId: presetClientId, status: 'In Progress', startDate: '', endDate: '', plannedViews: 0, completedViews: 0 }
    : CP_PROJECTS.find(p => p.projectId === projectId);

  if (!isNew && !project) { toast?.('e', 'Project not found', projectId); return; }

  const isManager = CP_ROLE === 'manager';
  const isTL      = CP_ROLE === 'tl';

  const canEdit = isManager || isTL;

  let suggestedId = '';
  if (isNew && isManager) {
    try { suggestedId = (await sheetGET({ action: 'getNextProjectId' })) || ''; } catch(e) {  }
  }

  const formCard = `
    <div class="cp-card">
      <div style="font-weight:700;font-size:16px;color:var(--txt1);margin-bottom:.2rem;">
        ${isNew ? '📁 New Project' : '📁 ' + esc(project.projectName || project.projectId)}
      </div>
      <div style="font-size:11.5px;color:var(--txt2);margin-bottom:1.1rem;">
        ${canEdit ? 'You can edit project details and status.' : 'Project details are view-only for your role.'}
      </div>

      <div class="cp-form-grid">
        <div class="cp-form-field cp-span2">
          <label class="cp-flabel">Project Name</label>
          <input class="cp-finput" id="cpName" value="${esc(project.projectName)}" ${canEdit ? '' : 'disabled'} placeholder="e.g. SPR Tower F&amp;G Floorplan"/>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Project ID ${isNew && isManager ? '<span class="cp-hint">— suggested, editable</span>' : ''}</label>
          <input class="cp-finput" id="cpId" value="${esc(isNew ? suggestedId : project.projectId)}" ${canEdit ? '' : 'disabled'} placeholder="e.g. EUZ-042"/>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Client</label>
          <select class="cp-finput" id="cpClient" ${canEdit ? '' : 'disabled'}>
            <option value="">— Select client —</option>
            ${CP_CLIENTS.map(c => `<option value="${esc(c.id)}" ${c.id === project.clientId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Status</label>
          <select class="cp-finput" id="cpStatus" ${canEdit ? '' : 'disabled'}>
            ${CP_STATUSES.map(s => `<option value="${s}" ${s === project.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Start Date</label>
          <input class="cp-finput" id="cpStartDate" type="date" value="${isoDateOrBlank(project.startDate)}" ${canEdit ? '' : 'disabled'}/>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">End Date</label>
          <input class="cp-finput" id="cpEndDate" type="date" value="${isoDateOrBlank(project.endDate)}" ${canEdit ? '' : 'disabled'}/>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Views Planned</label>
          <input class="cp-finput" id="cpPlannedViews" type="number" step="any" min="0"
            value="${project.plannedViews !== undefined && project.plannedViews !== '' ? esc(String(project.plannedViews)) : '0'}"
            ${canEdit ? '' : 'disabled'}/>
        </div>

        <div class="cp-form-field">
          <label class="cp-flabel">Views Completed</label>
          <input class="cp-finput" id="cpCompletedViews" type="number" step="any" min="0"
            value="${project.completedViews !== undefined && project.completedViews !== '' ? esc(String(project.completedViews)) : '0'}"
            ${canEdit ? '' : 'disabled'}/>
        </div>

        ${canEdit ? `
        <div class="cp-form-field">
          <label class="cp-flabel">Project Constant</label>
          <input class="cp-finput" id="cpConstant" type="number" step="any" min="0"
            value="${project.projectConstant !== undefined && project.projectConstant !== '' ? esc(String(project.projectConstant)) : '0'}"/>
        </div>` : ''}
      </div>

      <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:.4rem;">
        ${(!isNew && isManager)
          ? `<button id="cpDeleteBtn" style="background:none;border:1px solid rgba(248,113,113,0.4);
              color:#f87171;border-radius:8px;padding:8px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">🗑 Delete</button>`
          : `<span></span>`}
        <button id="cpSaveBtn" style="background:var(--a1);color:#fff;border:none;border-radius:8px;
          padding:8px 18px;font-size:12.5px;font-weight:700;cursor:pointer;">${isNew ? 'Create Project' : 'Save Changes'}</button>
      </div>
    </div>`;

  const bodyHtml = isNew
    ? `<div style="max-width:620px;margin:0 auto;">${formCard}</div>`
    : `
      <div style="max-width:1400px;margin:0 auto;display:grid;grid-template-columns:minmax(0,620px) minmax(0,1fr);gap:1.5rem;align-items:start;min-width:0;">
        <div style="min-width:0;">
          ${formCard}
          <div id="cpTimelineSection" style="margin-top:1.25rem;"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1.25rem;min-width:0;">
          ${isManager ? `<div id="cpProfitSection"></div>` : ''}
          <div id="cpTaskSection"></div>
          <div id="cpSubtaskSection"></div>
          <div id="cpMonthlyPerfSection"></div>
          <div id="cpTeamSection"></div>
        </div>
      </div>`;

  let clientSiblings = [];
  let clientSiblingIdx = -1;
  if (!isNew && project.clientId) {
    clientSiblings = sortProjectsByRecency(CP_PROJECTS.filter(p => p.clientId === project.clientId));
    clientSiblingIdx = clientSiblings.findIndex(p => p.projectId === project.projectId);
  }
  const hasSiblingNav = clientSiblings.length > 1 && clientSiblingIdx !== -1;

  content.innerHTML = `
    <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <button id="cpProjBack" class="cp-back-btn">← Back</button>
        ${hasSiblingNav ? `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${clientSiblingIdx > 0
              ? buildProjNavChip(clientSiblings[clientSiblingIdx - 1], 'prev')
              : `<span class="cp-btn-ghost" style="opacity:.35;cursor:default;">◀ Prev</span>`}
            <span style="font-size:10.5px;color:var(--txt2);white-space:nowrap;">${clientSiblingIdx + 1} of ${clientSiblings.length}</span>
            ${clientSiblingIdx < clientSiblings.length - 1
              ? buildProjNavChip(clientSiblings[clientSiblingIdx + 1], 'next')
              : `<span class="cp-btn-ghost" style="opacity:.35;cursor:default;">Next ▶</span>`}
          </div>` : ''}
      </div>
      ${!isNew ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <input type="month" id="cpReportMonthPicker" class="cp-finput" style="padding:7px 10px;font-size:12px;width:150px;"
            value="${esc(todayStr().slice(0, 7))}" title="Pick a month to download that month's report"/>
          <button id="cpReportMonth" class="cp-btn-ghost">📥 Download Month</button>
          <button id="cpReportOverall" class="cp-btn-ghost">📥 Overall Report</button>
        </div>` : ''}
    </div>
    ${bodyHtml}
  `;

  $('cpProjBack').addEventListener('click', () => { stopProjectDetailAutoRefresh(); goBack(); });
  content.querySelectorAll('.cp-proj-nav-chip').forEach(chip => {
    chip.addEventListener('click', () => openProjectDetail(content, chip.dataset.projectId, opts));
  });
  $('cpSaveBtn').addEventListener('click', () => saveProjectFromForm(content, isNew, project, goBack));
  $('cpDeleteBtn')?.addEventListener('click', () => deleteProjectFromForm(content, project, goBack));
  $('cpReportMonth')?.addEventListener('click', () => {
    const picked = $('cpReportMonthPicker')?.value || todayStr().slice(0, 7);
    openProjectReport(project, 'month', picked);
  });
  $('cpReportOverall')?.addEventListener('click', () => openProjectReport(project, 'overall'));

  if (!isNew) renderProjectTimelineSection(project);
  if (!isNew && isManager) {
    await ensureSalaryDataLoaded();
    renderProjectProfitSection(project);
  }
  if (!isNew) renderProjectTaskSection(project);
  if (!isNew) renderProjectSubtasksSection(project);
  if (!isNew) renderProjectMonthlyPerfSection(project);
  if (!isNew) renderProjectTeamSection(project);

  stopProjectDetailAutoRefresh();
  if (!isNew) startProjectDetailAutoRefresh(content, project.projectId);
}

function stopProjectDetailAutoRefresh() {
  if (CP_DETAIL_REFRESH_TIMER) {
    clearInterval(CP_DETAIL_REFRESH_TIMER);
    CP_DETAIL_REFRESH_TIMER = null;
  }
}

function startProjectDetailAutoRefresh(content, projectId) {
  stopProjectDetailAutoRefresh();
  let refreshing = false;
  const session = APP_SESSION;
  CP_DETAIL_REFRESH_TIMER = setInterval(async () => {
    if (session !== APP_SESSION) { stopProjectDetailAutoRefresh(); return; }
    if (document.hidden || refreshing) return;

    if (!document.body.contains(content) || !$('cpTimelineSection')) {
      stopProjectDetailAutoRefresh();
      return;
    }

    try {
      refreshing = true;
      await Promise.all([loadProjectBundle(true), refreshCPTimesheetData()]);
    } catch (err) {
      console.warn('[client-project] Dashboard auto-refresh failed, will retry next cycle:', err.message);
      return;
    } finally { refreshing = false; }
    if (session !== APP_SESSION) return;

    if (!document.body.contains(content) || !$('cpTimelineSection')) {
      stopProjectDetailAutoRefresh();
      return;
    }

    const freshProject = CP_PROJECTS.find(p => p.projectId === projectId);
    if (!freshProject) { stopProjectDetailAutoRefresh(); return; } 

    renderProjectTimelineSection(freshProject);
    if (CP_ROLE === 'manager') renderProjectProfitSection(freshProject);
    renderProjectTaskSection(freshProject);
    renderProjectSubtasksSection(freshProject);
    renderProjectMonthlyPerfSection(freshProject);
    renderProjectTeamSection(freshProject);
  }, 60000);
}

async function refreshCPTimesheetData() {
  const session = APP_SESSION;
  const data = await apiGetTeamData({ fresh: true });
  if (session !== APP_SESSION) return;
  CP_TIMESHEET_DATA = data.entries;
  if (MANAGER_MODE) MGR_DATA = data.entries;
  if (TL_MODE) { TL_DATA = data.entries; rebuildTLEmployeeIndex(); }
  if (HR_MODE) HR_DATA = data.entries;
}

async function saveProjectFromForm(content, isNew, originalProject, onDone) {
  const btn = $('cpSaveBtn');
  const payload = { role: CP_ROLE };

  const name     = $('cpName').value.trim();
  const id       = $('cpId').value.trim();
  const clientId = $('cpClient').value;
  if (!name) { toast?.('e', 'Project Name is required'); return; }
  if (!id)   { toast?.('e', 'Project ID is required');   return; }

  payload.projectId   = id;
  payload.projectName = name;
  payload.clientId    = clientId;
  payload.status       = $('cpStatus').value;
  payload.startDate    = $('cpStartDate').value;
  payload.endDate      = $('cpEndDate').value;

  const plannedViewsEl = $('cpPlannedViews');
  if (plannedViewsEl && !plannedViewsEl.disabled) payload.plannedViews = parseFloat(plannedViewsEl.value) || 0;

  const completedViewsEl = $('cpCompletedViews');
  if (completedViewsEl && !completedViewsEl.disabled) payload.completedViews = parseFloat(completedViewsEl.value) || 0;

  const constantEl = $('cpConstant');
  if (constantEl) payload.projectConstant = parseFloat(constantEl.value) || 0;
  if (!isNew) payload.originalProjectId = originalProject.projectId;

  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await sheetGET({ action: 'saveProjectMaster', data: encodeURIComponent(JSON.stringify(payload)) });
    toast?.('s', isNew ? 'Project created' : 'Project updated', payload.projectName || originalProject.projectName || originalProject.projectId);

    if (typeof clearMasterDataCache === 'function') clearMasterDataCache();
    await loadProjectData();
    if (typeof onDone === 'function') onDone(); else renderProjectList(content);
  } catch(err) {
    btn.disabled = false; btn.textContent = isNew ? 'Create Project' : 'Save Changes';
    toast?.('e', 'Save failed', err.message);
  }
}

async function deleteProjectFromForm(content, project, onDone) {
  if (CP_ROLE !== 'manager') return;
  if (!confirm(`Delete project "${project.projectName || project.projectId}"? This cannot be undone.`)) return;
  try {
    await sheetGET({ action: 'deleteProjectMaster', data: encodeURIComponent(JSON.stringify({ role: CP_ROLE, projectId: project.projectId })) });
    toast?.('s', 'Project deleted', project.projectName || project.projectId);
    if (typeof clearMasterDataCache === 'function') clearMasterDataCache();
    await loadProjectData();
    if (typeof onDone === 'function') onDone(); else renderProjectList(content);
  } catch(err) {
    toast?.('e', 'Delete failed', err.message);
  }
}

function getProjectTeamActivity(project) {
  const entries = CP_TIMESHEET_DATA.filter(e => e.project === project.projectName && e.status !== 'Leave');
  const byMonth = {}; 
  entries.forEach(e => {
    const month = (e.date || '').slice(0, 7);
    if (!month) return;
    if (!byMonth[month]) byMonth[month] = {};
    byMonth[month][e.empId] = (byMonth[month][e.empId] || 0) + parseH(e.hours);
  });

  const months = Object.keys(byMonth).sort();
  const allMembers = new Set();
  let totalHours = 0;

  const monthBreakdown = months.map(month => {
    let monthHours = 0;
    const members = Object.entries(byMonth[month])
      .map(([empId, hours]) => {
        monthHours += hours;
        allMembers.add(empId);
        const emp = CP_EMPLOYEES.find(e => e.id === empId);
        return { empId, name: emp ? emp.name : empId, hours };
      })
      .sort((a, b) => b.hours - a.hours);
    totalHours += monthHours;
    return { month, members, monthHours };
  });

  return { months: monthBreakdown, totalMembers: allMembers.size, totalHours };
}

function getProjectEmployeeTotals(project) {
  const entries = CP_TIMESHEET_DATA.filter(e => e.project === project.projectName && e.status !== 'Leave');
  const totals = {};
  entries.forEach(e => {
    totals[e.empId] = (totals[e.empId] || 0) + parseH(e.hours);
  });

  CP_HISTORICAL_DATA
    .filter(h => sameProjectId(h.projectId, project.projectId))
    .forEach(h => {
      totals[h.employeeId] = (totals[h.employeeId] || 0) + (Number(h.totalHours) || 0);
    });

  return Object.entries(totals)
    .map(([empId, hours]) => {
      const emp = CP_EMPLOYEES.find(x => x.id === empId);
      return { empId, name: emp ? emp.name : empId, hours };
    })
    .filter(t => t.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

function fmtHM(hours) {
  const totalMins = Math.round((hours || 0) * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtCPConstant(n) {
  const v = parseFloat(n) || 0;
  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function buildProjectHoursBar(project) {
  const totals = getProjectEmployeeTotals(project);
  if (!totals.length) {
    return `<div style="font-size:11px;color:var(--txt2);padding:2px 2px 0;">No hours logged yet</div>`;
  }

  const totalHours = totals.reduce((s, t) => s + t.hours, 0) || 1;
  const segments = totals.map(t => {
    const pct = Math.max((t.hours / totalHours) * 100, 1.5);
    return `<div style="flex:0 0 ${pct}%;background:${getEmployeeColor(t.empId)};height:100%;"
      title="${esc(t.name)}: ${fmtHM(t.hours)}"></div>`;
  }).join('');

  const legend = totals.map(t => `
    <div style="display:flex;align-items:center;gap:5px;">
      <span style="width:7px;height:7px;border-radius:50%;background:${getEmployeeColor(t.empId)};flex-shrink:0;"></span>
      <span style="font-size:10.5px;color:var(--txt1);font-weight:600;max-width:90px;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;" title="${esc(t.name)}">${esc(t.name)}</span>
      <span style="font-size:10.5px;color:var(--txt2);">${fmtHM(t.hours)}</span>
    </div>`).join('');

  return `
    <div style="display:flex;border-radius:6px;overflow:hidden;height:14px;margin-bottom:8px;">${segments}</div>
    <div style="display:flex;flex-wrap:wrap;gap:7px 12px;">${legend}</div>`;
}

function monthFromAppTimestamp(str) {
  const ts = parseAppTimestamp(str);
  if (!ts) return null;
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function addOneMonthStr(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m, 1); 
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function fmtMonthShort(monthKey) {
  return new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function getProjectMonthlyTimeline(project) {
  const entries = CP_TIMESHEET_DATA.filter(e => e.project === project.projectName && e.status !== 'Leave');
  const histRecords = CP_HISTORICAL_DATA.filter(h => sameProjectId(h.projectId, project.projectId));

  let earliestMonth = null;
  entries.forEach(e => {
    const m = (e.date || '').slice(0, 7);
    if (m && (!earliestMonth || m < earliestMonth)) earliestMonth = m;
  });
  histRecords.forEach(h => {
    const m = histMonthYearToKey_(h.month, h.year);
    if (m && (!earliestMonth || m < earliestMonth)) earliestMonth = m;
  });
  const createdMonth = monthFromAppTimestamp(project.createdDate);
  if (createdMonth && (!earliestMonth || createdMonth < earliestMonth)) earliestMonth = createdMonth;

  if (!earliestMonth) return { months: [], maxHours: 0 }; 

  const nowMonth = todayStr().slice(0, 7);
  const byMonth = {}; 
  entries.forEach(e => {
    const m = (e.date || '').slice(0, 7);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { hours: 0, byEmp: {} };
    const h = parseH(e.hours);
    byMonth[m].hours += h;
    byMonth[m].byEmp[e.empId] = (byMonth[m].byEmp[e.empId] || 0) + h;
  });
  histRecords.forEach(h => {
    const m = histMonthYearToKey_(h.month, h.year);
    if (!m) return;
    if (!byMonth[m]) byMonth[m] = { hours: 0, byEmp: {} };
    const hrs = Number(h.totalHours) || 0;
    byMonth[m].hours += hrs;
    byMonth[m].byEmp[h.employeeId] = (byMonth[m].byEmp[h.employeeId] || 0) + hrs;
  });

  const months = [];
  let cursor = earliestMonth;
  let guard = 0; 
  while (cursor <= nowMonth && guard < 240) {
    const bucket = byMonth[cursor];
    const totals = bucket
      ? Object.entries(bucket.byEmp)
          .map(([empId, hours]) => {
            const emp = CP_EMPLOYEES.find(x => x.id === empId);
            return { empId, name: emp ? emp.name : empId, hours };
          })
          .filter(t => t.hours > 0)
          .sort((a, b) => b.hours - a.hours)
      : [];
    months.push({ month: cursor, hours: bucket ? bucket.hours : 0, memberCount: totals.length, totals });
    cursor = addOneMonthStr(cursor);
    guard++;
  }

  const maxHours = Math.max(...months.map(m => m.hours), 0.01);
  return { months, maxHours };
}

function buildProjectTimelineMini(project) {
  const { months, maxHours } = getProjectMonthlyTimeline(project);
  if (!months.length) {
    return `<div style="font-size:11px;color:var(--txt2);padding:2px 2px 0;">No activity yet</div>`;
  }

  const bars = months.map(m => {
    const pct = m.hours > 0 ? Math.max((m.hours / maxHours) * 100, 10) : 6;
    return `
      <div style="flex:0 0 9px;display:flex;flex-direction:column;justify-content:flex-end;height:32px;"
        title="${esc(fmtMonthShort(m.month))}: ${fmtHM(m.hours)}">
        <div style="width:100%;height:${pct}%;border-radius:2px;
          background:${m.hours > 0 ? 'var(--a1)' : 'var(--border-md)'};"></div>
      </div>`;
  }).join('');

  return `<div style="display:flex;align-items:flex-end;gap:3px;overflow-x:auto;padding-bottom:2px;">${bars}</div>`;
}

function renderProjectTimelineSection(project) {
  const el = $('cpTimelineSection');
  if (!el) return;

  const totals = getProjectEmployeeTotals(project); 
  const totalHours = totals.reduce((s, t) => s + t.hours, 0);

  if (totalHours === 0) {
    el.innerHTML = `
      <div class="cp-card">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.5rem;">📅 Project Timeline</div>
        <div style="font-size:12.5px;color:var(--txt2);">No activity logged yet.</div>
      </div>`;
    return;
  }

  const showEmpPoints = CP_ROLE === 'manager' || CP_ROLE === 'tl';
  const costByEmp = {};
  if (showEmpPoints) {
    getProjectCostBreakdown(project).rows.forEach(r => { costByEmp[r.empId] = r; });
  }
  const empPointsLabel = t => {
    const r = costByEmp[t.empId];
    return (r && r.hasPoints) ? fmtCPMoney(r.cost) : '—';
  };

  const segmentsHtml = totals.map(t => {
    const segPct = (t.hours / totalHours) * 100;
    return `<div style="width:${segPct}%;height:100%;background:${getEmployeeColor(t.empId)};"
      title="${esc(t.name)}: ${fmtHM(t.hours)}${showEmpPoints ? ' · ' + esc(empPointsLabel(t)) + ' pts' : ''}"></div>`;
  }).join('');

  el.innerHTML = `
    <div class="cp-card">
      <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:1rem;">📅 Project Timeline</div>
      <details>
        <summary style="display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none;">
          <span style="flex:0 0 84px;font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:4px;">
            <span class="cp-cost-arrow" style="font-size:9px;transition:transform .15s;">▶</span>
            Total
          </span>
          <div style="flex:1;min-width:0;height:16px;background:var(--surface2);border-radius:8px;overflow:hidden;display:flex;">
            ${segmentsHtml}
          </div>
          <span style="flex:0 0 84px;text-align:right;font-size:13px;font-weight:700;color:var(--txt1);white-space:nowrap;">${fmtHM(totalHours)}</span>
        </summary>
        <div style="margin-top:10px;padding-left:96px;display:flex;flex-direction:column;gap:4px;">
          ${totals.slice().sort((a, b) => b.hours - a.hours).map(t => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:11.5px;
              padding:5px 8px;background:var(--surface2);border-radius:6px;">
              <span style="display:flex;align-items:center;gap:6px;color:var(--txt1);font-weight:600;">
                <span style="width:7px;height:7px;border-radius:50%;background:${getEmployeeColor(t.empId)};flex-shrink:0;"></span>
                ${esc(t.name)}
              </span>
              <span style="display:flex;align-items:center;gap:12px;white-space:nowrap;">
                ${showEmpPoints ? `<span style="color:#4f8ef7;font-weight:700;" title="Points consumed on this project">${esc(empPointsLabel(t))} pts</span>` : ''}
                <span style="color:var(--txt1);font-weight:700;">${fmtHM(t.hours)}</span>
              </span>
            </div>`).join('')}
        </div>
      </details>
      <style>
        .cp-cost-arrow { display:inline-block; }
        details[open] summary .cp-cost-arrow { transform: rotate(90deg); }
        summary::-webkit-details-marker { display:none; }
      </style>
    </div>`;
}

function fmtCPMoney(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('en-IN');
}

function renderProjectProfitSection(project) {
  const el = $('cpProfitSection');
  if (!el) return;

  const revenue = parseFloat(project.projectConstant) || 0;
  const { rows, totalCost, missingPoints } = getProjectCostBreakdown(project);
  const profit = revenue - totalCost;
  const isProfit = profit >= 0;

  const rowsHtml = rows.length
    ? rows.map(r => `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11.5px;
          padding:6px 0;border-bottom:1px solid var(--border);">
          <span style="color:var(--txt1);font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
            white-space:nowrap;" title="${esc(r.name)}">${esc(r.name)}</span>
          <span style="color:var(--txt2);white-space:nowrap;">${fmtHM(r.hours)}${r.hasPoints ? '' : ' (no Points set)'}</span>
          <span style="color:var(--txt1);font-weight:700;white-space:nowrap;flex:0 0 auto;">${r.hasPoints ? fmtCPMoney(r.cost) : '—'}</span>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--txt2);">No hours logged yet.</div>`;

  el.innerHTML = `
    <div class="cp-card">
      <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:1rem;">💰 Profit / Loss</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:1rem;">
        <div class="cp-metric-box">
          <div class="cp-metric-label">Revenue (Constant)</div>
          <div class="cp-metric-val">${fmtCPMoney(revenue)}</div>
        </div>
        <div class="cp-metric-box">
          <div class="cp-metric-label">Cost (hours × rate)</div>
          <div class="cp-metric-val">${fmtCPMoney(totalCost)}</div>
        </div>
      </div>

      <div style="padding:10px 14px;border-radius:8px;margin-bottom:1rem;font-weight:700;font-size:14px;
        background:${isProfit ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)'};
        color:${isProfit ? '#34d399' : '#f87171'};">
        ${isProfit ? '▲ Profit' : '▼ Loss'}: ${fmtCPMoney(Math.abs(profit))}
      </div>

      <div style="font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Cost Breakdown</div>
      ${rowsHtml}
      ${missingPoints.length ? `<div style="margin-top:8px;font-size:10.5px;color:var(--txt2);">No Points set for: ${esc(missingPoints.join(', '))} — their hours aren't included in cost.</div>` : ''}
    </div>`;
}

function renderProjectMonthlyPerfSection(project) {
  const el = $('cpMonthlyPerfSection');
  if (!el) return;

  const { months, maxHours } = getProjectMonthlyTimeline(project);
  if (!months.length) {
    el.innerHTML = `
      <div class="cp-card">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.5rem;">📊 Overall Performance</div>
        <div style="font-size:12.5px;color:var(--txt2);">No activity logged yet, and no creation date on record to start a timeline from.</div>
      </div>`;
    return;
  }

  const nowMonth     = todayStr().slice(0, 7);
  const startLabel   = fmtCPMonthLabel(months[0].month);
  const totalHours   = months.reduce((s, m) => s + m.hours, 0);
  const activeMonths = months.filter(m => m.hours > 0).length;

  const rows = months.map((m, i) => {
    const pct    = m.hours > 0 ? Math.max((m.hours / maxHours) * 100, 2) : 0;
    const isNow  = m.month === nowMonth;
    const isLast = i === months.length - 1;
    const segmentsHtml = m.hours > 0
      ? m.totals.map(t => {
          const segPct = (t.hours / m.hours) * 100;
          return `<div style="width:${segPct}%;height:100%;background:${getEmployeeColor(t.empId)};"
            title="${esc(t.name)}: ${fmtHM(t.hours)}"></div>`;
        }).join('')
      : '';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;${isLast ? '' : 'border-bottom:1px solid var(--border);'}"
        title="${esc(fmtCPMonthLabel(m.month))}: ${fmtHM(m.hours)}${m.memberCount ? ' · ' + m.memberCount + ' member' + (m.memberCount !== 1 ? 's' : '') : ''}">
        <span style="flex:0 0 84px;font-size:12px;font-weight:700;color:${isNow ? 'var(--a1)' : 'var(--txt1)'};white-space:nowrap;">${esc(fmtMonthShort(m.month))}${isNow ? ' •' : ''}</span>
        <div style="flex:1;min-width:0;height:12px;background:var(--surface2);border-radius:6px;overflow:hidden;display:flex;">
          ${m.hours > 0 ? segmentsHtml : `<div style="width:${pct}%;height:100%;background:var(--border-md);"></div>`}
        </div>
        <span style="flex:0 0 68px;text-align:right;font-size:12px;font-weight:${m.hours > 0 ? '700' : '400'};color:${m.hours > 0 ? 'var(--txt1)' : 'var(--txt2)'};">${m.hours > 0 ? fmtHM(m.hours) : '—'}</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:6px;">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);">📊 Overall Performance</div>
        <div style="font-size:11.5px;color:var(--txt2);">Since ${esc(startLabel)} · ${activeMonths}/${months.length} active month${months.length !== 1 ? 's' : ''} · ${fmtHM(totalHours)} total</div>
      </div>
      <div>${rows}</div>
    </div>`;
}

function getProjectTaskBreakdown(project) {
  const entries = CP_TIMESHEET_DATA.filter(e => e.project === project.projectName && e.status !== 'Leave' && (e.task || '').trim());

  const byTaskKey = {}; 
  entries.forEach(e => {
    const label = e.task.trim();
    const key   = label.toLowerCase();
    if (!byTaskKey[key]) byTaskKey[key] = { labelCounts: {}, byEmp: {} };
    byTaskKey[key].labelCounts[label] = (byTaskKey[key].labelCounts[label] || 0) + 1;
    byTaskKey[key].byEmp[e.empId] = (byTaskKey[key].byEmp[e.empId] || 0) + parseH(e.hours);
  });

  const tasks = Object.values(byTaskKey).map(bucket => {
    const label = Object.entries(bucket.labelCounts).sort((a, b) => b[1] - a[1])[0][0];
    const employees = Object.entries(bucket.byEmp)
      .map(([empId, hours]) => {
        const emp = CP_EMPLOYEES.find(x => x.id === empId);
        return { empId, name: emp ? emp.name : empId, hours };
      })
      .filter(t => t.hours > 0)
      .sort((a, b) => b.hours - a.hours);
    return { task: label, employees, totalHours: employees.reduce((s, e) => s + e.hours, 0) };
  }).sort((a, b) => b.totalHours - a.totalHours);

  const grandTotal = tasks.reduce((s, t) => s + t.totalHours, 0);
  return { tasks, grandTotal };
}

function renderProjectTaskSection(project) {
  const el = $('cpTaskSection');
  if (!el) return;

  const { tasks, grandTotal } = getProjectTaskBreakdown(project);
  const maxTaskHours = Math.max(...tasks.map(t => t.totalHours), 0.01);

  const rows = tasks.map(t => {
    const hasHours  = t.totalHours > 0;

    const fillPct   = hasHours ? Math.max((t.totalHours / maxTaskHours) * 100, 4) : 100;

    const LABEL_MIN_ROW_PCT = 6;
    const labelsHtml = hasHours
      ? `<div style="display:flex;width:${fillPct}%;margin-bottom:4px;">
          ${t.employees.map(e => {
            const pct = (e.hours / t.totalHours) * 100;
            const pctOfFullRow = pct * fillPct / 100;
            const showText = pctOfFullRow >= LABEL_MIN_ROW_PCT;
            return `<div style="width:${pct}%;min-width:0;overflow:hidden;font-size:10px;font-weight:700;
              color:${getEmployeeColor(e.empId)};white-space:nowrap;text-overflow:ellipsis;padding:0 4px;box-sizing:border-box;"
              title="${esc(e.name)}: ${fmtHM(e.hours)}">
              ${showText ? `${esc(e.name)} ${fmtHM(e.hours)}` : ''}
            </div>`;
          }).join('')}
        </div>`
      : '';

    const barHtml = hasHours
      ? `<div style="flex:1;min-width:0;height:22px;border-radius:6px;background:var(--surface2);border:2px solid var(--border-md);overflow:hidden;">
          <div style="width:${fillPct}%;height:100%;display:flex;">
            ${t.employees.map((e, i) => {
              const pct = (e.hours / t.totalHours) * 100;
              const isLastSeg = i === t.employees.length - 1;
              return `<div style="width:${pct}%;height:100%;background:${getEmployeeColor(e.empId)};
                ${isLastSeg ? '' : 'border-right:2px solid rgba(255,255,255,.35);'}"
                title="${esc(e.name)}: ${fmtHM(e.hours)}"></div>`;
            }).join('')}
          </div>
        </div>`
      : `<div style="flex:1;height:22px;border-radius:6px;border:2px solid var(--border-md);background:transparent;"></div>`;

    return `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div style="flex:0 0 190px;padding:10px 14px;border:2px solid var(--border-md);border-radius:6px;
          font-size:12.5px;font-weight:600;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
          title="${esc(t.task)}">${esc(t.task)}</div>
        <div style="flex:1;min-width:0;">
          ${labelsHtml}
          <div style="display:flex;align-items:center;gap:10px;">
            ${barHtml}
            <span style="flex:0 0 62px;text-align:right;font-size:12px;font-weight:${hasHours ? '700' : '400'};
              color:${hasHours ? 'var(--txt1)' : 'var(--txt2)'};">${hasHours ? fmtHM(t.totalHours) : '—'}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;flex-wrap:wrap;gap:6px;">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);">🗂️ Task Breakdown</div>
        <div style="font-size:11.5px;color:var(--txt2);">Total time consumed: ${fmtHM(grandTotal)}</div>
      </div>
      ${tasks.length ? rows : `<div style="font-size:12.5px;color:var(--txt2);">No tasked hours logged yet for this project.</div>`}
    </div>`;
}

function getProjectSubtaskBreakdown(project) {
  const defined = (typeof SUBTASKS !== 'undefined' ? SUBTASKS : [])
    .filter(s => s.pid === project.projectId);

  const hoursBySubtask = {}; 
  CP_TIMESHEET_DATA.forEach(e => {
    if (e.project !== project.projectName || e.status === 'Leave' || !e.subtaskId) return;
    if (!hoursBySubtask[e.subtaskId]) hoursBySubtask[e.subtaskId] = {};
    hoursBySubtask[e.subtaskId][e.empId] = (hoursBySubtask[e.subtaskId][e.empId] || 0) + parseH(e.hours);
  });

  const rows = defined.map(s => {
    const byEmp = hoursBySubtask[s.id] || {};
    const employees = Object.entries(byEmp)
      .map(([empId, hours]) => {
        const emp = CP_EMPLOYEES.find(x => x.id === empId);
        return { empId, name: emp ? emp.name : empId, hours };
      })
      .filter(t => t.hours > 0)
      .sort((a, b) => b.hours - a.hours);
    return { subtaskId: s.id, subtaskName: s.name, employees, totalHours: employees.reduce((sum, e) => sum + e.hours, 0) };
  });

  const definedIds = new Set(defined.map(s => s.id));
  Object.keys(hoursBySubtask).forEach(subtaskId => {
    if (definedIds.has(subtaskId)) return;
    const byEmp = hoursBySubtask[subtaskId];
    const employees = Object.entries(byEmp)
      .map(([empId, hours]) => {
        const emp = CP_EMPLOYEES.find(x => x.id === empId);
        return { empId, name: emp ? emp.name : empId, hours };
      })
      .filter(t => t.hours > 0)
      .sort((a, b) => b.hours - a.hours);
    if (employees.length) {
      rows.push({ subtaskId, subtaskName: '(not in Subtasks sheet)', employees, totalHours: employees.reduce((sum, e) => sum + e.hours, 0) });
    }
  });

  rows.sort((a, b) => b.totalHours - a.totalHours);
  const grandTotal = rows.reduce((s, r) => s + r.totalHours, 0);
  return { rows, grandTotal };
}

function renderProjectSubtasksSection(project) {
  const el = $('cpSubtaskSection');
  if (!el) return;

  const { rows, grandTotal } = getProjectSubtaskBreakdown(project);

  if (!rows.length) {
    el.innerHTML = `
      <div class="cp-card">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.5rem;">🧩 Subtasks</div>
        <div style="font-size:12.5px;color:var(--txt2);">No subtasks defined for this project yet — add rows to the Subtasks sheet (Project ID = ${esc(project.projectId)}).</div>
      </div>`;
    return;
  }

  const maxSubHours = Math.max(...rows.map(r => r.totalHours), 0.01);

  const rowsHtml = rows.map((r, i) => {
    const hasHours = r.totalHours > 0;
    const fillPct  = hasHours ? Math.max((r.totalHours / maxSubHours) * 100, 4) : 100;

    const barHtml = hasHours
      ? `<div style="flex:1;min-width:0;height:18px;border-radius:6px;background:var(--surface2);border:1px solid var(--border-md);overflow:hidden;">
          <div style="width:${fillPct}%;height:100%;display:flex;">
            ${r.employees.map((e, idx) => {
              const pct = (e.hours / r.totalHours) * 100;
              const isLastSeg = idx === r.employees.length - 1;
              return `<div style="width:${pct}%;height:100%;background:${getEmployeeColor(e.empId)};
                ${isLastSeg ? '' : 'border-right:2px solid rgba(255,255,255,.35);'}"
                title="${esc(e.name)}: ${fmtHM(e.hours)}"></div>`;
            }).join('')}
          </div>
        </div>`
      : `<div style="flex:1;height:18px;border-radius:6px;border:1px solid var(--border-md);background:transparent;"></div>`;

    return `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <div style="flex:0 0 160px;font-size:12px;font-weight:600;color:var(--txt1);white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis;" title="${esc(r.subtaskId)} — ${esc(r.subtaskName)}">
          ${esc(r.subtaskName)}
          <div style="font-size:10px;color:var(--txt2);font-weight:400;">${esc(r.subtaskId)}</div>
        </div>
        ${barHtml}
        <span style="flex:0 0 56px;text-align:right;font-size:11.5px;font-weight:${hasHours ? '700' : '400'};
          color:${hasHours ? 'var(--txt1)' : 'var(--txt2)'};">${hasHours ? fmtHM(r.totalHours) : '—'}</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:6px;">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);">🧩 Subtasks</div>
        <div style="font-size:11.5px;color:var(--txt2);">${rows.length} subtask${rows.length !== 1 ? 's' : ''} · ${fmtHM(grandTotal)} total</div>
      </div>
      ${rowsHtml}
    </div>`;
}

const CP_TEAM_PAGE_SIZE = 10;
let CP_TEAM_DAILY_DATES  = [];
let CP_TEAM_DAILY_BYDATE = {};
let CP_TEAM_PAGE         = 0;

function getProjectDailyActivity(project) {
  const byDate = {};
  CP_TIMESHEET_DATA.forEach(e => {
    if (e.project !== project.projectName || e.status === 'Leave' || !e.date) return;
    if (!byDate[e.date]) byDate[e.date] = {};
    if (!byDate[e.date][e.empId]) byDate[e.date][e.empId] = { hours: 0, notes: [], byTask: {} };
    const h = parseH(e.hours);
    byDate[e.date][e.empId].hours += h;
    if (e.notes && e.notes.trim()) byDate[e.date][e.empId].notes.push(e.notes.trim());
    const task = (e.task || '').trim() || 'Unspecified';
    byDate[e.date][e.empId].byTask[task] = (byDate[e.date][e.empId].byTask[task] || 0) + h;
  });

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a)); 
  return { byDate, dates };
}

const CP_REPORT_PALETTE = ['#2563eb','#7c3aed','#059669','#d97706','#0891b2','#65a30d','#c026d3','#0d9488'];

function getProjectContribution(project, fromDate, toDate) {
  const entries = CP_TIMESHEET_DATA.filter(e =>
    e.project === project.projectName && e.status !== 'Leave' &&
    e.date && e.date >= fromDate && e.date <= toDate
  );

  const byEmp   = {};
  const allDays = new Set();
  entries.forEach(e => {
    allDays.add(e.date);
    if (!byEmp[e.empId]) byEmp[e.empId] = { hours: 0, days: new Set(), notes: [], byTask: {} };
    const h = parseH(e.hours);
    byEmp[e.empId].hours += h;
    byEmp[e.empId].days.add(e.date);
    if (e.notes && e.notes.trim()) byEmp[e.empId].notes.push({ date: e.date, note: e.notes.trim(), hours: h });
    const task = (e.task || '').trim() || 'Unspecified';
    byEmp[e.empId].byTask[task] = (byEmp[e.empId].byTask[task] || 0) + h;
  });

  const members = Object.entries(byEmp)
    .map(([empId, d]) => {
      const emp = CP_EMPLOYEES.find(x => x.id === empId);
      const tasks = Object.entries(d.byTask)
        .map(([task, hours]) => ({ task, hours }))
        .sort((a, b) => b.hours - a.hours);
      return { empId, name: emp ? emp.name : empId, hours: d.hours, days: d.days.size, notes: d.notes, tasks };
    })
    .sort((a, b) => b.hours - a.hours);

  const byTaskTotal = {};
  entries.forEach(e => {
    const task = (e.task || '').trim() || 'Unspecified';
    byTaskTotal[task] = (byTaskTotal[task] || 0) + parseH(e.hours);
  });
  const totalHoursAll = members.reduce((s, m) => s + m.hours, 0);
  const taskTotals = Object.entries(byTaskTotal)
    .map(([task, hours]) => ({ task, hours }))
    .sort((a, b) => b.hours - a.hours);

  return { members, taskTotals, totalHours: totalHoursAll, totalDays: allDays.size, fromDate, toDate };
}

function buildReportDonutPath(cx, cy, rOuter, rInner, startDeg, endDeg) {
  if (endDeg - startDeg >= 359.999) endDeg = startDeg + 359.999;
  const pt = (r, deg) => { const rad = deg * Math.PI / 180; return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }; };
  const sO = pt(rOuter, startDeg), eO = pt(rOuter, endDeg), sI = pt(rInner, endDeg), eI = pt(rInner, startDeg);
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
  return [`M ${sO.x} ${sO.y}`, `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${eO.x} ${eO.y}`, `L ${sI.x} ${sI.y}`, `A ${rInner} ${rInner} 0 ${largeArc} 0 ${eI.x} ${eI.y}`, 'Z'].join(' ');
}

function buildReportPieSVG(members, totalHours) {
  if (!totalHours || !members.length) {
    return `<svg viewBox="0 0 200 200" width="180" height="180"><circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" stroke-width="26"/></svg>`;
  }
  let angle = -90;
  const slices = members.map((m, i) => {
    const end = angle + (m.hours / totalHours) * 360;
    const path = buildReportDonutPath(100, 100, 80, 46, angle, end);
    const color = CP_REPORT_PALETTE[i % CP_REPORT_PALETTE.length];
    angle = end;
    return `<path d="${path}" fill="${color}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" width="180" height="180" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
}

function buildReportLegendHTML(members, totalHours) {
  if (!members.length) return `<div style="font-size:12px;color:#64748b;">No contributions recorded for this period.</div>`;
  return members.map((m, i) => {
    const pct = totalHours > 0 ? Math.round((m.hours / totalHours) * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:12.5px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${CP_REPORT_PALETTE[i % CP_REPORT_PALETTE.length]};flex-shrink:0;"></span>
      <span style="color:#1e293b;">${esc(m.name)} — <b>${fmtHM(m.hours)}</b> (${pct}%)</span>
    </div>`;
  }).join('');
}

const CP_TASK_PALETTE = ['#0ea5e9','#f472b6','#84cc16','#fb923c','#a78bfa','#facc15','#2dd4bf','#f87171','#818cf8','#4ade80'];
function reportTaskColor(task, taskList) {
  const idx = taskList.indexOf(task);
  return CP_TASK_PALETTE[(idx >= 0 ? idx : 0) % CP_TASK_PALETTE.length];
}

function buildReportTaskSummaryHTML(taskTotals, totalHours) {
  if (!taskTotals.length) return `<div style="font-size:12px;color:#64748b;">No task data recorded for this period.</div>`;
  const taskNames = taskTotals.map(t => t.task);
  const bar = taskTotals.map(t => {
    const pct = totalHours > 0 ? (t.hours / totalHours) * 100 : 0;
    return `<div style="width:${pct}%;height:100%;background:${reportTaskColor(t.task, taskNames)};"></div>`;
  }).join('');
  const legend = taskTotals.map(t => {
    const pct = totalHours > 0 ? Math.round((t.hours / totalHours) * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;font-size:12.5px;">
      <span style="width:10px;height:10px;border-radius:50%;background:${reportTaskColor(t.task, taskNames)};flex-shrink:0;"></span>
      <span style="color:#1e293b;">${esc(t.task)} — <b>${fmtHM(t.hours)}</b> (${pct}%)</span>
    </div>`;
  }).join('');
  return `
    <div style="height:16px;background:#f1f5f9;border-radius:8px;overflow:hidden;display:flex;margin-bottom:14px;">${bar}</div>
    <div>${legend}</div>`;
}

function buildReportTaskByEmployeeHTML(members, taskTotals) {
  if (!members.length) return `<div style="font-size:12px;color:#64748b;">No contributions recorded for this period.</div>`;
  const taskNames = taskTotals.map(t => t.task);
  return members.map(m => {
    const bar = m.tasks.map(t => {
      const pct = m.hours > 0 ? (t.hours / m.hours) * 100 : 0;
      return `<div style="width:${pct}%;height:100%;background:${reportTaskColor(t.task, taskNames)};" title="${esc(t.task)}: ${fmtHM(t.hours)}"></div>`;
    }).join('');
    const chips = m.tasks.map(t =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;color:#334155;margin:0 10px 0 0;">
        <span style="width:8px;height:8px;border-radius:50%;background:${reportTaskColor(t.task, taskNames)};flex-shrink:0;"></span>
        ${esc(t.task)} · ${fmtHM(t.hours)}
      </span>`
    ).join('');
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
          <span style="font-size:12.5px;font-weight:700;color:#1e293b;">${esc(m.name)}</span>
          <span style="font-size:11.5px;color:#64748b;">${fmtHM(m.hours)}</span>
        </div>
        <div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;display:flex;margin-bottom:6px;">${bar}</div>
        <div>${chips}</div>
      </div>`;
  }).join('');
}

function buildReportLogTableHTML(members) {
  const rows = [];
  members.forEach(m => m.notes.forEach(n => rows.push({ ...n, name: m.name })));
  rows.sort((a, b) => a.date.localeCompare(b.date));

  if (!rows.length) return `<div style="font-size:12px;color:#64748b;">No notes recorded for this period.</div>`;

  return `
    <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
      <thead>
        <tr style="background:#eef2ff;">
          <th style="text-align:left;padding:7px 9px;border:1px solid #dbeafe;color:#334155;">Date</th>
          <th style="text-align:left;padding:7px 9px;border:1px solid #dbeafe;color:#334155;">Employee</th>
          <th style="text-align:right;padding:7px 9px;border:1px solid #dbeafe;color:#334155;">Hours</th>
          <th style="text-align:left;padding:7px 9px;border:1px solid #dbeafe;color:#334155;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td style="padding:6px 9px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(fmtCPDateShort(r.date))}</td>
            <td style="padding:6px 9px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(r.name)}</td>
            <td style="padding:6px 9px;border:1px solid #e2e8f0;text-align:right;white-space:nowrap;">${fmtHM(r.hours)}</td>
            <td style="padding:6px 9px;border:1px solid #e2e8f0;">${esc(r.note)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function joinNaturalList(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function buildWorkNarrativeText(contrib) {
  const byEmp = contrib.members
    .map(m => ({ name: m.name, notes: [...new Set(m.notes.map(n => n.note.trim()).filter(Boolean))] }))
    .filter(m => m.notes.length > 0);

  if (!byEmp.length) return '';

  const countWords = s => s.split(/\s+/).filter(Boolean).length;
  const render = cap => byEmp.map(m => {
    const notes = cap ? m.notes.slice(0, cap) : m.notes;
    return `${m.name} worked on ${joinNaturalList(notes)}.`;
  }).join(' ');

  let text = render(null);
  for (let cap = 3; cap >= 1 && countWords(text) > 200; cap--) {
    text = render(cap);
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 210) text = words.slice(0, 200).join(' ') + '…';

  return text;
}

function buildReportSummaryText(project, contrib) {
  if (!contrib.members.length) {
    return `No activity was logged against ${project.projectName || project.projectId} during this period.`;
  }

  const total = contrib.totalHours || 1;
  const shares = contrib.members.map(m => `${m.name} (${fmtHM(m.hours)}, ${Math.round((m.hours / total) * 100)}%)`);

  const breakdown = contrib.members.length === 1
    ? `${shares[0]} was the sole contributor.`
    : `Contribution breakdown, from highest to lowest: ${joinNaturalList(shares)}.`;

  return `This report covers ${contrib.members.length} team member${contrib.members.length !== 1 ? 's' : ''} who together logged ${fmtHM(contrib.totalHours)} across ${contrib.totalDays} day${contrib.totalDays !== 1 ? 's' : ''}. ${breakdown}`;
}

function buildProjectReportHTML(project, mode, targetMonth) {
  const client = CP_CLIENTS.find(c => c.id === project.clientId);
  const today  = todayStr();

  let fromDate, toDate, periodLabel, reportTypeLabel;
  if (mode === 'month') {
    const m = targetMonth || today.slice(0, 7);
    fromDate = m + '-01';
    toDate   = (m === today.slice(0, 7)) ? today : lastDayOfMonthStr_(m);
    periodLabel = fmtCPMonthLabel(m);
    reportTypeLabel = 'Monthly Report';
  } else {
    const entries  = CP_TIMESHEET_DATA.filter(e => e.project === project.projectName && e.status !== 'Leave' && e.date);
    let earliest   = entries.reduce((min, e) => (!min || e.date < min) ? e.date : min, null);
    if (project.startDate && (!earliest || project.startDate < earliest)) earliest = project.startDate;
    fromDate = earliest || today;
    toDate   = today;
    periodLabel = `${fmtCPDateShort(fromDate)} – ${fmtCPDateShort(toDate)}`;
    reportTypeLabel = 'Overall Report';
  }

  const contrib   = getProjectContribution(project, fromDate, toDate);
  const genStamp  = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const workNarrative = buildWorkNarrativeText(contrib);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(project.projectName || project.projectId)} — ${esc(reportTypeLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin:0; padding:28px; background:#eef2ff; color:#1e293b; }
  .sheet { max-width:820px; margin:0 auto; background:#fff; border-radius:16px; padding:36px 42px 44px; box-shadow:0 4px 24px rgba(0,0,0,.06); }
  h1 { font-size:25px; color:#2563eb; margin:0 0 4px; font-weight:800; }
  .sub { font-size:12px; color:#64748b; margin-bottom:20px; }
  .infobar { display:flex; gap:28px; flex-wrap:wrap; padding:14px 0; border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; margin-bottom:26px; }
  .infobar div { font-size:12.5px; }
  .infobar b { display:block; color:#2563eb; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:3px; font-weight:700; }
  h2 { font-size:14px; color:#2563eb; margin:26px 0 12px; font-weight:800; }
  .row { display:flex; gap:36px; align-items:center; flex-wrap:wrap; }
  .footer { margin-top:30px; font-size:10.5px; color:#94a3b8; text-align:right; }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { box-shadow:none; border-radius:0; max-width:100%; padding:0; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <h1>${esc(project.projectName || project.projectId)}</h1>
    <div class="sub">${esc(reportTypeLabel)} · ${esc(project.projectId)} · ${esc(client ? client.name : (project.clientId || '—'))}</div>

    <div class="infobar">
      <div><b>Report Type</b>${esc(reportTypeLabel)}</div>
      <div><b>Period</b>${esc(periodLabel)}</div>
      <div><b>Start Date</b>${esc(fmtCPDateShort(project.startDate))}</div>
      <div><b>Status</b>${esc(project.status)}</div>
    </div>

    <h2>Contribution by Team Member</h2>
    <div class="row">
      <div>${buildReportPieSVG(contrib.members, contrib.totalHours)}</div>
      <div>${buildReportLegendHTML(contrib.members, contrib.totalHours)}</div>
    </div>

    <h2>Time by Task</h2>
    ${buildReportTaskSummaryHTML(contrib.taskTotals, contrib.totalHours)}

    <h2>Time by Task — per Team Member</h2>
    ${buildReportTaskByEmployeeHTML(contrib.members, contrib.taskTotals)}

    <h2>Detailed Log</h2>
    ${buildReportLogTableHTML(contrib.members)}

    <h2>Summary</h2>
    <div style="font-size:12.5px;color:#334155;line-height:1.6;">
      <p style="margin:0 0 10px;">${esc(buildReportSummaryText(project, contrib))}</p>
      ${workNarrative ? `<p style="margin:0;">${esc(workNarrative)}</p>` : ''}
    </div>

    <div class="footer">Generated ${esc(genStamp)}</div>
  </div>
</body>
</html>`;
}

function lastDayOfMonthStr_(m) {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  return `${m}-${String(last).padStart(2, '0')}`;
}

function openProjectReport(project, mode, targetMonth) {
  const win = window.open('', '_blank');
  if (!win) {
    toast?.('e', 'Popup blocked', 'Please allow popups for this site, then try again.');
    return;
  }
  win.document.open();
  win.document.write(buildProjectReportHTML(project, mode, targetMonth));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

function renderProjectTeamSection(project) {
  const el = $('cpTeamSection');
  if (!el) return;

  const { byDate, dates } = getProjectDailyActivity(project);
  CP_TEAM_DAILY_BYDATE = byDate;
  CP_TEAM_DAILY_DATES  = dates;
  CP_TEAM_PAGE = 0;

  if (!dates.length) {
    el.innerHTML = `
      <div class="cp-card">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.5rem;">👥 Team Performance</div>
        <div style="font-size:12.5px;color:var(--txt2);">No timesheet hours logged against this project yet.</div>
      </div>`;
    return;
  }

  const totalMembers = new Set(dates.flatMap(d => Object.keys(byDate[d]))).size;
  const totalHours   = dates.reduce((s, d) => s + Object.values(byDate[d]).reduce((s2, m) => s2 + m.hours, 0), 0);

  el.innerHTML = `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:6px;">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);">👥 Team Performance</div>
        <div style="font-size:11.5px;color:var(--txt2);">${totalMembers} member${totalMembers !== 1 ? 's' : ''} · ${totalHours.toFixed(1)}h total, all time</div>
      </div>
      <div id="cpTeamDailyList"></div>
      <div id="cpTeamPager" style="margin-top:1rem;"></div>
    </div>`;

  renderCPTeamDailyPage();
}

function renderCPTeamDailyPage() {
  const listEl  = $('cpTeamDailyList');
  const pagerEl = $('cpTeamPager');
  if (!listEl) return;

  const start     = CP_TEAM_PAGE * CP_TEAM_PAGE_SIZE;
  const pageDates = CP_TEAM_DAILY_DATES.slice(start, start + CP_TEAM_PAGE_SIZE);

  listEl.innerHTML = pageDates.map((date, i) =>
    buildTeamDailyRow(date, CP_TEAM_DAILY_BYDATE[date], i === pageDates.length - 1)
  ).join('');

  const totalPages = Math.max(1, Math.ceil(CP_TEAM_DAILY_DATES.length / CP_TEAM_PAGE_SIZE));
  if (!pagerEl) return;

  if (totalPages <= 1) { pagerEl.innerHTML = ''; return; }

  const pageNums = [];
  for (let p = 0; p < totalPages; p++) pageNums.push(p);

  pagerEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">
      <button class="cp-pager-btn" id="cpTeamPagePrev" ${CP_TEAM_PAGE === 0 ? 'disabled' : ''}>‹ Prev</button>
      ${pageNums.map(p => `<button class="cp-pager-btn cp-pager-num${p === CP_TEAM_PAGE ? ' active' : ''}" data-page="${p}">${p + 1}</button>`).join('')}
      <button class="cp-pager-btn" id="cpTeamPageNext" ${CP_TEAM_PAGE === totalPages - 1 ? 'disabled' : ''}>Next ›</button>
    </div>`;

  $('cpTeamPagePrev')?.addEventListener('click', () => { if (CP_TEAM_PAGE > 0) { CP_TEAM_PAGE--; renderCPTeamDailyPage(); } });
  $('cpTeamPageNext')?.addEventListener('click', () => { if (CP_TEAM_PAGE < totalPages - 1) { CP_TEAM_PAGE++; renderCPTeamDailyPage(); } });
  pagerEl.querySelectorAll('.cp-pager-num').forEach(btn => {
    btn.addEventListener('click', () => { CP_TEAM_PAGE = parseInt(btn.dataset.page, 10); renderCPTeamDailyPage(); });
  });
}

function buildTeamDailyRow(date, dayData, isLast) {
  const members = Object.entries(dayData)
    .map(([empId, d]) => {
      const emp = CP_EMPLOYEES.find(x => x.id === empId);
      const tasks = Object.entries(d.byTask)
        .map(([task, hours]) => ({ task, hours }))
        .sort((a, b) => b.hours - a.hours);
      return { empId, name: emp ? emp.name : empId, hours: d.hours, notes: d.notes.join(' · '), tasks };
    })
    .sort((a, b) => b.hours - a.hours);

  const dayTotal = members.reduce((s, m) => s + m.hours, 0);
  const safeTotal = dayTotal || 0.01;

  const dayTaskNames = [...new Set(members.flatMap(m => m.tasks.map(t => t.task)))];

  const segments = members.map(m => {
    const pct = Math.max((m.hours / safeTotal) * 100, 3);
    const taskSummary = m.tasks.map(t => `${t.task}: ${fmtHM(t.hours)}`).join(', ');
    return `<div style="width:${pct}%;height:100%;background:${getEmployeeColor(m.empId)};"
      title="${esc(m.name)}: ${fmtHM(m.hours)}${taskSummary ? ' — ' + esc(taskSummary) : ''}"></div>`;
  }).join('');

  const memberRows = members.map(m => {
    const taskChips = m.tasks.map(t => `
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--txt2);
        background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:2px 8px;margin:3px 5px 0 0;">
        <span style="width:6px;height:6px;border-radius:50%;background:${reportTaskColor(t.task, dayTaskNames)};flex-shrink:0;"></span>
        ${esc(t.task)} · ${fmtHM(t.hours)}
      </span>`).join('');
    return `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);">
      <span style="width:8px;height:8px;border-radius:50%;background:${getEmployeeColor(m.empId)};flex-shrink:0;margin-top:4px;"></span>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-size:12px;font-weight:700;color:var(--txt1);">${esc(m.name)}</span>
          <span style="font-size:12px;font-weight:700;color:var(--a1);white-space:nowrap;">${fmtHM(m.hours)}</span>
        </div>
        <div style="font-size:11px;color:var(--txt2);margin-top:2px;">${esc(m.notes || 'No notes')}</div>
        ${taskChips ? `<div style="display:flex;flex-wrap:wrap;">${taskChips}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return `
    <div style="margin-bottom:${isLast ? '0' : '1.1rem'};padding-bottom:${isLast ? '0' : '1.1rem'};${isLast ? '' : 'border-bottom:1px solid var(--border-md);'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <span style="font-size:13px;font-weight:700;color:var(--txt1);">${esc(dateLabel)}</span>
        <span style="font-size:11.5px;color:var(--txt2);">${members.length} member${members.length !== 1 ? 's' : ''} · ${fmtHM(dayTotal)}</span>
      </div>
      <div style="display:flex;border-radius:6px;overflow:hidden;height:14px;margin-bottom:4px;">${segments}</div>
      <div>${memberRows}</div>
    </div>`;
}

function fmtCPMonthLabel(monthKey) {
  return new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function fmtCPDateShort(dateStr) {
  if (!dateStr) return '—';

  const iso = isoDateOrBlank(dateStr);
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
let CP_DATA_LOADED = false;
async function loadProjectBundle(fresh = false) {
  const session = APP_SESSION;
  const data = await apiGetProjectBundle(getCPRole() || 'employee', { fresh });
  if (session !== APP_SESSION) return;
  CP_CLIENTS = data.clients.map((c, entryIndex) => ({ ...c, entryIndex }));
  CP_PROJECTS = data.projects.map((p, entryIndex) => ({ ...p, entryIndex }));
  CP_HISTORICAL_DATA = data.historicalRecords;
  CP_HIST_PROJECTS_SUMMARY = data.historicalProjectsSummary;
  window.MGR_CLIENTS = CP_CLIENTS;
  CP_DATA_LOADED = true;
}

// CLIENT-PROJECT-ATTENDANCE
let CP_ATTEND_MODE  = 'last15'; 
let CP_ATTEND_FROM  = '';
let CP_ATTEND_TO    = '';
let CP_ATTEND_MONTH = ''; 
let CP_ATTEND_HR_DEFAULTED = false; 

const CP_ATTEND_MONTH_FLOOR = '2026-07'; 

function renderAttendanceTab(content) {
  if (typeof ensureCPStyles === 'function') ensureCPStyles();
  const tod = todayStr();
  if (!CP_ATTEND_TO)   CP_ATTEND_TO = tod;
  if (!CP_ATTEND_FROM) {
    const f = new Date(); f.setDate(f.getDate() - 14);
    CP_ATTEND_FROM = toLocalDateStr(f);
  }
  if (!CP_ATTEND_MONTH) CP_ATTEND_MONTH = tod.slice(0, 7) < CP_ATTEND_MONTH_FLOOR ? CP_ATTEND_MONTH_FLOOR : tod.slice(0, 7);

  if (getCPRole() === 'hr' && !CP_ATTEND_HR_DEFAULTED) {
    CP_ATTEND_HR_DEFAULTED = true;
    CP_ATTEND_MODE = 'month';
    applyAttendMonth(CP_ATTEND_MONTH);
  }

  const monthOptions = [];
  {
    const [fy, fm] = CP_ATTEND_MONTH_FLOOR.split('-').map(Number);
    const [ty, tm] = tod.slice(0, 7).split('-').map(Number);
    const cur = new Date(ty, tm - 1, 1);
    const floor = new Date(fy, fm - 1, 1);
    while (cur >= floor) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      monthOptions.push({ key, label: cur.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) });
      cur.setMonth(cur.getMonth() - 1);
    }
  }

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--txt1);">🕒 Attendance</div>
        <div style="font-size:12px;color:var(--txt2);">Daily check-in / check-out and hours per employee.</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="chart-range" id="attendModeBtns">
          <button class="rbtn${CP_ATTEND_MODE==='last15'?' active':''}" data-mode="last15">Last 15 Days</button>
          <button class="rbtn${CP_ATTEND_MODE==='month'?' active':''}" data-mode="month">Month Wise</button>
          <button class="rbtn${CP_ATTEND_MODE==='custom'?' active':''}" data-mode="custom">Start → End</button>
        </div>
        <div id="attendMonthPicker" style="display:${CP_ATTEND_MODE==='month'?'flex':'none'};align-items:center;gap:6px;">
          <select id="attendMonthSelect" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
            color:var(--txt1);font-size:12px;padding:6px 8px;cursor:pointer;">
            ${monthOptions.map(m => `<option value="${m.key}" ${m.key === CP_ATTEND_MONTH ? 'selected' : ''}>${m.label}</option>`).join('')}
          </select>
        </div>
        <div id="attendCustomRange" style="display:${CP_ATTEND_MODE==='custom'?'flex':'none'};align-items:center;gap:6px;">
          <input type="date" id="attendFrom" value="${CP_ATTEND_FROM}" max="${tod}"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
            color:var(--txt1);font-size:12px;padding:5px 8px;cursor:pointer;"/>
          <span style="color:var(--txt2);font-size:11px;">to</span>
          <input type="date" id="attendTo" value="${CP_ATTEND_TO}" max="${tod}"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
            color:var(--txt1);font-size:12px;padding:5px 8px;cursor:pointer;"/>
          <button id="attendApplyRange" style="background:var(--a1);color:#fff;border:none;border-radius:6px;
            padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Apply</button>
        </div>
        <button id="attendExportPdf" style="background:var(--elevated);color:var(--txt1);border:1px solid var(--border-md);
          border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;">
          ⬇ Export PDF
        </button>
        <button id="attendRefreshBtn" title="Refresh this tab's data" style="background:var(--elevated);
          border:1px solid var(--border-md);border-radius:6px;color:var(--txt2);cursor:pointer;
          padding:7px 10px;font-size:13px;line-height:1;display:flex;align-items:center;">🔄</button>
        ${getCPRole() === 'hr' ? `
        <button id="attendPushHoliday" style="background:#fbbf24;color:#1a1a2e;border:none;
          border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
          📅 Push Public Holiday
        </button>` : ''}
      </div>
    </div>
    <div id="attendGridWrap"></div>
    <div style="margin-top:8px;font-size:11px;color:var(--txt2);display:flex;gap:14px;flex-wrap:wrap;">
      <span><span style="color:#34d399;font-weight:700;">Hours</span> = worked that day</span>
      <span><span style="color:#fbbf24;font-weight:700;">🏖 Leave</span> = approved leave (full day)</span>
      <span>Hours <span style="color:#fbbf24;">🏖</span> = worked part of the day, also had a half-day leave entry that date</span>
      <span><span style="color:#9ca3af;font-weight:700;">⚫ [Name]</span> = public holiday (name shown is what HR entered when pushing it)</span>
      <span><span style="color:#f87171;font-weight:700;">✕ No Entry</span> = working day, nothing logged</span>
      <span><span style="color:var(--txt2);">—</span> = weekend</span>
      <span><span style="color:#a78bfa;font-weight:700;">Permission Hrs</span> = shortfall below a ${9}h full day, on days actually worked</span>
    </div>
  `;

  $('attendModeBtns').addEventListener('click', e => {
    const btn = e.target.closest('.rbtn');
    if (!btn) return;
    CP_ATTEND_MODE = btn.dataset.mode;
    $('attendModeBtns').querySelectorAll('.rbtn').forEach(b => b.classList.toggle('active', b === btn));
    $('attendCustomRange').style.display = CP_ATTEND_MODE === 'custom' ? 'flex' : 'none';
    $('attendMonthPicker').style.display = CP_ATTEND_MODE === 'month'  ? 'flex' : 'none';
    if (CP_ATTEND_MODE === 'last15') {
      CP_ATTEND_TO = todayStr();
      const f = new Date(); f.setDate(f.getDate() - 14);
      CP_ATTEND_FROM = toLocalDateStr(f);
    } else if (CP_ATTEND_MODE === 'month') {
      applyAttendMonth(CP_ATTEND_MONTH);
    }
    renderAttendanceGrid();
  });

  $('attendMonthSelect').addEventListener('change', e => {
    applyAttendMonth(e.target.value);
    renderAttendanceGrid();
  });

  $('attendApplyRange').addEventListener('click', () => {
    const from = $('attendFrom').value;
    const to   = $('attendTo').value;
    if (!from || !to || from > to) { toast?.('e', 'Invalid range', 'Pick a valid Start and End date.'); return; }
    CP_ATTEND_FROM = from;
    CP_ATTEND_TO   = to;
    renderAttendanceGrid();
  });

  $('attendExportPdf').addEventListener('click', () => exportAttendanceToPDF());
  $('attendPushHoliday')?.addEventListener('click', () => openBulkHolidayModal());
  $('attendRefreshBtn').addEventListener('click', async () => {
    const btn = $('attendRefreshBtn');
    btn.disabled = true; btn.style.opacity = '.5';
    try {

      if (typeof refreshCPTimesheetData === 'function') await refreshCPTimesheetData();
      toast?.('s', 'Refreshed', 'Attendance data is up to date.');
    } catch (err) {
      toast?.('e', 'Refresh failed', err.message);
    }
    renderAttendanceGrid();
    const freshBtn = $('attendRefreshBtn');
    if (freshBtn) { freshBtn.disabled = false; freshBtn.style.opacity = ''; }
  });

  renderAttendanceGrid();
}

function applyAttendMonth(monthKey) {
  CP_ATTEND_MONTH = monthKey;
  const [y, m] = monthKey.split('-').map(Number);
  const lastDayOfMonth = toLocalDateStr(new Date(y, m, 0));
  CP_ATTEND_FROM = `${monthKey}-01`;

  CP_ATTEND_TO = lastDayOfMonth;
}

function getAttendRangeLabel() {
  if (CP_ATTEND_MODE === 'month') {
    return new Date(CP_ATTEND_MONTH + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  const fromLabel = new Date(CP_ATTEND_FROM + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const toLabel   = new Date(CP_ATTEND_TO + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fromLabel} – ${toLabel}`;
}

function exportAttendanceToPDF() {
  const table = document.querySelector('#attendGridWrap table');
  if (!table) { toast?.('e', 'Nothing to export', 'The grid has not finished loading yet.'); return; }

  const rangeLabel = getAttendRangeLabel();
  const printWindow = window.open('', '_blank');
  if (!printWindow) { toast?.('e', 'Could not open print preview', 'Your browser may have blocked the pop-up.'); return; }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Attendance — ${esc(rangeLabel)}</title>
      <style>
        @page { size: landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 16px; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .sub { font-size: 11px; color: #555; margin-bottom: 14px; }
        table { border-collapse: collapse; width: 100%; font-size: 9px; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; white-space: nowrap; }
        th { background: #f0f0f0; text-transform: uppercase; font-size: 8px; color: #333; }
        td:first-child, th:first-child { text-align: left; font-weight: bold; position: static !important; }
        td, th { position: static !important; background: #fff !important; color: #111 !important; }
        th { background: #f0f0f0 !important; }
      </style>
    </head>
    <body>
      <h1>Attendance Report</h1>
      <div class="sub">${esc(rangeLabel)} · Generated ${new Date().toLocaleString('en-IN')}</div>
      ${table.outerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => printWindow.print();
  setTimeout(() => { if (!printWindow.closed) printWindow.print(); }, 400); 
}

function cpGetEmpDayAttendance(empId, date) {
  const entries = CP_TIMESHEET_DATA.filter(e => e.empId === empId && e.date === date).filter(isWorkedEntry);
  if (!entries.length) return { hasEntry: false, checkIn: null, checkOut: null, hours: 0 };
  const timesIn  = entries.map(e => e.timeIn).filter(Boolean).sort();
  const timesOut = entries.map(e => e.timeOut).filter(Boolean).sort();
  const hours    = entries.reduce((s, e) => s + parseH(e.hours), 0);
  return { hasEntry: true, checkIn: timesIn[0] || null, checkOut: timesOut[timesOut.length - 1] || null, hours };
}

function getEmpDayStatus(empId, date) {
  const rec = cpGetEmpDayAttendance(empId, date);
  const dayEntries = CP_TIMESHEET_DATA.filter(e => e.empId === empId && e.date === date);
  const hasLeave   = dayEntries.some(e => e.status === 'Leave');
  const hasHoliday   = dayEntries.some(e => e.status === 'Holiday');
  const holidayEntry = dayEntries.find(e => e.status === 'Holiday');
  const holidayName  = holidayEntry ? (holidayEntry.task || 'Holiday') : '';

  const biometricEntry = dayEntries.find(e => e.status === 'BiometricPunch');
  const biometric = biometricEntry ? { in: biometricEntry.timeIn || '', out: biometricEntry.timeOut || '' } : null;

  if (rec.hasEntry) return { kind: 'worked', hasLeave, hasHoliday, biometric, ...rec };
  if (hasLeave)   return { kind: 'leave', hasLeave: true, biometric };
  if (hasHoliday) return { kind: 'holiday', holidayName, biometric };
  return { kind: 'not_logged', biometric };
}

function renderAttendanceGrid() {
  const wrap = $('attendGridWrap');
  if (!wrap) return;

  const tod      = todayStr();
  const isHR     = getCPRole() === 'hr';

  const isTL     = getCPRole() === 'tl';

  const off = isHR ? [500, 400, 300, 200, 100, 0] : [400, 300, 200, 100, 0];

  const cappedTo = CP_ATTEND_MODE === 'last15' && CP_ATTEND_TO > tod ? tod : CP_ATTEND_TO;
  const CAP = 60; 
  const startDate   = new Date(CP_ATTEND_FROM + 'T00:00:00');
  const endDate     = new Date(cappedTo + 'T00:00:00');
  const totalDaysInRange = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const renderStart = totalDaysInRange > CAP ? new Date(endDate.getTime() - (CAP - 1) * 86400000) : startDate;

  const days = [];
  for (let d = new Date(renderStart); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push(toLocalDateStr(d));
  }

  const truncNote = totalDaysInRange > CAP
    ? `<div style="font-size:10px;color:var(--txt2);margin-bottom:8px;">Showing most recent ${CAP} of ${totalDaysInRange} days in range</div>`
    : '';

  wrap.innerHTML = `
    ${truncNote}
    <div id="attendScrollBox" tabindex="0" class="attend-scrollbox" style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
      max-height:70vh;overflow-x:auto;overflow-y:auto;outline:none;" title="Click here, then use arrow keys to scroll — or Shift + mouse wheel to scroll sideways.">
      <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:9px 12px;background:var(--surface2);color:var(--txt2);
              font-size:10.5px;text-transform:uppercase;white-space:nowrap;position:sticky;top:0;left:0;z-index:3;">Employee</th>
            ${days.map(d => `<th style="text-align:center;padding:9px 8px;background:var(--surface2);color:var(--txt2);
              font-size:10px;white-space:nowrap;position:sticky;top:0;z-index:1;">${new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</th>`).join('')}
            <th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;border-left:2px solid var(--border);
              position:sticky;top:0;right:${off[0]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;">Leave<br/>Days</th>
            <th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;
              position:sticky;top:0;right:${off[1]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;">Permission<br/>Hrs</th>
            <th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;
              position:sticky;top:0;right:${off[2]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;">Working<br/>Days</th>
            <th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;
              position:sticky;top:0;right:${off[3]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;">Total<br/>Hours</th>
            <th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;
              position:sticky;top:0;right:${off[4]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;">Overtime</th>
            ${isHR ? `<th style="text-align:center;padding:9px 6px;background:var(--surface2);color:var(--txt2);
              font-size:10px;text-transform:uppercase;white-space:nowrap;
              position:sticky;top:0;right:${off[5]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;z-index:2;" title="Total hours computed from recorded biometric punch times, not self-logged hours.">Biometric<br/>Hours</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${(() => {

            const activeEmployees = (CP_EMPLOYEES || []).filter(emp => emp.active !== false);
            if (!activeEmployees.length) {
              return `<tr><td colspan="${isHR ? 10 : 9}" style="text-align:center;padding:2rem;color:var(--txt2);">No employees found.</td></tr>`;
            }
            const FULL_DAY_HOURS = 9; 
            return activeEmployees.map(emp => {
              let leaveDays = 0, workingDays = 0, totalHours = 0, permissionHours = 0, overtimeHours = 0, biometricHours = 0;

              const dayCellsHtml = days.map(d => {
                const dow = new Date(d + 'T00:00:00').getDay();
                const isWeekend = dow === 0 || dow === 6;
                const status = getEmpDayStatus(emp.id, d);
                let cell, clickable = false;
                if (status.kind === 'worked') {
                  const halfDayLeave = status.hasLeave;
                  const timesLine = (status.checkIn || status.checkOut)
                    ? `<br/><span style="font-size:9px;color:var(--txt2);font-weight:500;">${status.checkIn ? fmt12(status.checkIn) : '—'} → ${status.checkOut ? fmt12(status.checkOut) : '—'}</span>`
                    : '';
                  cell = `<span style="color:#34d399;font-weight:700;" title="In ${fmt12(status.checkIn)} → Out ${fmt12(status.checkOut)}${halfDayLeave ? ' (half-day leave also recorded this date)' : ''}">${fh(status.hours)}${halfDayLeave ? ' <span style="color:#fbbf24;" title="Half-day leave">🏖</span>' : ''}${timesLine}</span>`;
                  workingDays++;
                  totalHours += status.hours;
                  if (status.hours < FULL_DAY_HOURS) permissionHours += (FULL_DAY_HOURS - status.hours);
                  if (status.hours > FULL_DAY_HOURS) overtimeHours   += (status.hours - FULL_DAY_HOURS);
                  if (halfDayLeave) leaveDays++;
                } else if (status.kind === 'leave') {
                  cell = `<span style="color:#fbbf24;font-weight:700;" title="On approved leave">🏖 Leave</span>`;
                  leaveDays++;
                } else if (status.kind === 'holiday') {
                  cell = `<span style="color:#9ca3af;font-weight:700;" title="Public Holiday: ${esc(status.holidayName)}">⚫ ${esc(status.holidayName)}</span>`;
                } else if (isWeekend) {
                  cell = `<span style="color:var(--txt2);">—</span>`;
                } else if (d > tod) {
                  cell = `<span style="color:var(--txt2);">·</span>`;
                } else {
                  cell = `<span style="color:#f87171;font-weight:700;">✕ No Entry</span>`;
                  clickable = true;
                }

                if (status.biometric) {
                  let bioDurationText = '';
                  let bioMins = 0;
                  if (status.biometric.in && status.biometric.out) {
                    const [inH, inM]   = status.biometric.in.split(':').map(Number);
                    const [outH, outM] = status.biometric.out.split(':').map(Number);
                    bioMins = (outH * 60 + outM) - (inH * 60 + inM);
                    if (bioMins > 0) bioDurationText = ` (${fh(bioMins / 60)})`;
                  }
                  cell += `<br/><span style="font-size:9px;color:#818cf8;font-weight:600;" title="Biometric punch (HR-recorded reference, not counted toward Total Hours above)">🔒 ${status.biometric.in ? fmt12(status.biometric.in) : '—'} → ${status.biometric.out ? fmt12(status.biometric.out) : '—'}${bioDurationText}</span>`;

                  if (bioMins > 0) biometricHours += bioMins / 60;
                }

                if (isHR) {
                  return `<td class="attend-biometric-cell" data-emp-id="${esc(emp.id)}" data-emp-name="${esc(emp.name)}" data-date="${d}"
                      data-bio-in="${esc(status.biometric?.in || '')}" data-bio-out="${esc(status.biometric?.out || '')}"
                      style="padding:8px;text-align:center;white-space:nowrap;cursor:pointer;" title="Click to record/edit biometric punch">${cell}</td>`;
                }
                if (isTL) {
                  return `<td class="attend-tl-any-cell" data-emp-id="${esc(emp.id)}" data-emp-name="${esc(emp.name)}" data-date="${d}"
                      style="padding:8px;text-align:center;white-space:nowrap;cursor:pointer;" title="Click to Force Entry or Force Leave">${cell}</td>`;
                }
                return clickable
                  ? `<td class="attend-no-entry-cell" data-emp-id="${esc(emp.id)}" data-emp-name="${esc(emp.name)}" data-date="${d}"
                      style="padding:8px;text-align:center;white-space:nowrap;cursor:pointer;" title="Click to Force Entry or Force Leave">${cell}</td>`
                  : `<td style="padding:8px;text-align:center;white-space:nowrap;">${cell}</td>`;
              }).join('');

              return `
              <tr style="border-top:1px solid var(--border);">
                <td class="attend-emp-cell" data-emp-id="${esc(emp.id)}" data-emp-name="${esc(emp.name)}"
                  style="padding:8px 12px;color:var(--txt1);font-weight:600;white-space:nowrap;cursor:pointer;
                  position:sticky;left:0;background:var(--surface1);" title="Click to view ${esc(emp.name)}'s details">
                  ${esc(emp.name)}<br/><span style="font-size:10px;color:var(--txt2);font-weight:500;">${esc(emp.id)}</span>
                </td>
                ${dayCellsHtml}
                <td style="padding:8px 6px;text-align:center;color:${leaveDays > 0 ? '#fbbf24' : 'var(--txt2)'};font-weight:700;
                  border-left:2px solid var(--border);position:sticky;right:${off[0]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${leaveDays}</td>
                <td style="padding:8px 6px;text-align:center;color:${permissionHours > 0 ? '#a78bfa' : 'var(--txt2)'};font-weight:700;
                  position:sticky;right:${off[1]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${permissionHours > 0 ? fh(permissionHours) : '—'}</td>
                <td style="padding:8px 6px;text-align:center;color:var(--txt1);font-weight:700;
                  position:sticky;right:${off[2]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${workingDays}</td>
                <td style="padding:8px 6px;text-align:center;color:var(--a1);font-weight:700;
                  position:sticky;right:${off[3]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${fh(totalHours)}</td>
                <td style="padding:8px 6px;text-align:center;color:${overtimeHours > 0 ? '#f87171' : 'var(--txt2)'};font-weight:700;
                  position:sticky;right:${off[4]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${overtimeHours > 0 ? fh(overtimeHours) : '—'}</td>
                ${isHR ? `<td style="padding:8px 6px;text-align:center;color:${biometricHours > 0 ? '#818cf8' : 'var(--txt2)'};font-weight:700;
                  position:sticky;right:${off[5]}px;width:100px;min-width:100px;max-width:100px;box-sizing:border-box;background:var(--surface1);">${biometricHours > 0 ? fh(biometricHours) : '—'}</td>` : ''}
              </tr>`;
            }).join('');
          })()}
        </tbody>
      </table>
    </div>`;

  wrap.querySelectorAll('.attend-no-entry-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      openAttendanceCellMenu(cell, cell.dataset.empId, cell.dataset.empName, cell.dataset.date);
    });
  });

  wrap.querySelectorAll('.attend-tl-any-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      openAttendanceCellMenu(cell, cell.dataset.empId, cell.dataset.empName, cell.dataset.date);
    });
  });

  wrap.querySelectorAll('.attend-biometric-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      openHRCellMenu(cell, cell.dataset.empId, cell.dataset.empName, cell.dataset.date, cell.dataset.bioIn, cell.dataset.bioOut);
    });
  });

  wrap.querySelectorAll('.attend-emp-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (typeof openEmpDetail === 'function') openEmpDetail(cell.dataset.empId, cell.dataset.empName);
    });
  });

  const scrollBox = $('attendScrollBox');
  if (scrollBox && !scrollBox.dataset.scrollWired) {
    scrollBox.dataset.scrollWired = '1';
    const STEP_X = 120, STEP_Y = 60;
    scrollBox.addEventListener('keydown', e => {
      switch (e.key) {
        case 'ArrowLeft':  scrollBox.scrollLeft -= STEP_X; e.preventDefault(); break;
        case 'ArrowRight': scrollBox.scrollLeft += STEP_X; e.preventDefault(); break;
        case 'ArrowUp':    scrollBox.scrollTop  -= STEP_Y; e.preventDefault(); break;
        case 'ArrowDown':  scrollBox.scrollTop  += STEP_Y; e.preventDefault(); break;
        case 'PageUp':     scrollBox.scrollTop  -= scrollBox.clientHeight; e.preventDefault(); break;
        case 'PageDown':   scrollBox.scrollTop  += scrollBox.clientHeight; e.preventDefault(); break;
        case 'Home':       scrollBox.scrollLeft = 0; e.preventDefault(); break;
        case 'End':        scrollBox.scrollLeft = scrollBox.scrollWidth; e.preventDefault(); break;
      }
    });
    scrollBox.addEventListener('wheel', e => {
      if (e.shiftKey) {
        scrollBox.scrollLeft += e.deltaY;
        e.preventDefault();
      }

    }, { passive: false });
  }
}

function closeAttendanceCellMenu() {
  document.getElementById('attendCellMenu')?.remove();
  document.removeEventListener('click', closeAttendanceCellMenuOnOutsideClick, true);
}

function closeAttendanceCellMenuOnOutsideClick(e) {
  const menu = document.getElementById('attendCellMenu');
  if (menu && !menu.contains(e.target)) closeAttendanceCellMenu();
}

function openAttendanceCellMenu(cellEl, empId, empName, date) {
  closeAttendanceCellMenu();

  const rect = cellEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'attendCellMenu';
  menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:10000;
    background:var(--surface1);border:1px solid var(--border-md);border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.4);padding:6px;display:flex;flex-direction:column;gap:2px;min-width:150px;`;
  menu.innerHTML = `
    <button id="attendMenuForceEntry" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">⚡ Force Entry</button>
    <button id="attendMenuForceLeave" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">🟠 Force Leave</button>
  `;
  document.body.appendChild(menu);
  menu.querySelectorAll('button').forEach(b => {
    b.addEventListener('mouseenter', () => b.style.background = 'var(--surface2)');
    b.addEventListener('mouseleave', () => b.style.background = 'none');
  });

  menu.querySelector('#attendMenuForceEntry').addEventListener('click', () => {
    closeAttendanceCellMenu();
    if (typeof openForceEntry !== 'function') { toast?.('e', 'Force Entry module not loaded'); return; }

    const portalRoot = cellEl.closest('#mgrApp, #tlApp');
    const portalId   = portalRoot ? portalRoot.id : 'mgrApp';

    openForceEntry(empId, empName, date, () => {
      if (portalId === 'tlApp' && typeof renderTLPortal === 'function') renderTLPortal();
      else if (typeof renderManagerPortal === 'function') renderManagerPortal();
    }, portalId);
  });

  menu.querySelector('#attendMenuForceLeave').addEventListener('click', () => {
    closeAttendanceCellMenu();
    openAttendanceForceLeaveModal(empId, empName, date);
  });

  setTimeout(() => document.addEventListener('click', closeAttendanceCellMenuOnOutsideClick, true), 0);
}

function openHRCellMenu(cellEl, empId, empName, date, bioIn, bioOut) {
  closeAttendanceCellMenu();

  const rect = cellEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'attendCellMenu';
  menu.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:10000;
    background:var(--surface1);border:1px solid var(--border-md);border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,.4);padding:6px;display:flex;flex-direction:column;gap:2px;min-width:170px;`;
  menu.innerHTML = `
    <button id="attendMenuForceEntryHR" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">⚡ Force Entry</button>
    <button id="attendMenuForceLeaveHR" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">🟠 Force Leave</button>
    <button id="attendMenuForceHoliday" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">🎉 Force Holiday</button>
    <button id="attendMenuBiometric" style="text-align:left;background:none;border:none;color:var(--txt1);
      padding:8px 10px;border-radius:7px;font-size:12.5px;cursor:pointer;">🔒 Biometric Punch</button>
  `;
  document.body.appendChild(menu);
  menu.querySelectorAll('button').forEach(b => {
    b.addEventListener('mouseenter', () => b.style.background = 'var(--surface2)');
    b.addEventListener('mouseleave', () => b.style.background = 'none');
  });

  menu.querySelector('#attendMenuForceEntryHR').addEventListener('click', () => {
    closeAttendanceCellMenu();
    if (typeof openForceEntry !== 'function') { toast?.('e', 'Force Entry module not loaded'); return; }
    openForceEntry(empId, empName, date, () => {
      if (typeof renderHRPortal === 'function') renderHRPortal();
    }, 'hrApp');
  });

  menu.querySelector('#attendMenuForceLeaveHR').addEventListener('click', () => {
    closeAttendanceCellMenu();
    openAttendanceForceLeaveModal(empId, empName, date);
  });

  menu.querySelector('#attendMenuForceHoliday').addEventListener('click', () => {
    closeAttendanceCellMenu();
    openForceHolidayModal(empId, empName, date);
  });

  menu.querySelector('#attendMenuBiometric').addEventListener('click', () => {
    closeAttendanceCellMenu();
    openBiometricPunchModal(empId, empName, date, bioIn, bioOut);
  });

  setTimeout(() => document.addEventListener('click', closeAttendanceCellMenuOnOutsideClick, true), 0);
}

function openForceHolidayModal(empId, empName, date) {
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999;`;
  overlay.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border-md);border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🎉 Force Holiday</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">${esc(empName)} · ${dateLabel}. Only this employee, only this date — overwrites whatever's already logged that day.</div>
      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">
        Holiday Name <span style="color:#f87171;">(required)</span>
      </label>
      <input type="text" id="fhName" placeholder="e.g. Approved festival leave" style="width:100%;box-sizing:border-box;
        background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
        font-size:12.5px;padding:8px 10px;"/>
      <div id="fhErr" style="display:none;font-size:11.5px;color:#f87171;margin-top:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="fhCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="fhSubmit" style="background:#fbbf24;border:none;
          color:#1a1a2e;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Apply Holiday</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#fhCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#fhSubmit').addEventListener('click', async () => {
    const name  = overlay.querySelector('#fhName').value.trim();
    const errEl = overlay.querySelector('#fhErr');
    errEl.style.display = 'none';

    if (!name) { errEl.textContent = 'Holiday name is required.'; errEl.style.display = 'block'; return; }
    if (typeof buildManagerEntry !== 'function' || typeof apiSaveSlot !== 'function') {
      toast?.('e', 'Required module not loaded');
      return;
    }

    const submitBtn = overlay.querySelector('#fhSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Applying…';

    try {
      const fields = { slot: 'extended', client: 'Holiday', clientId: '', project: 'Holiday', projectId: '', task: name, hours: 0, status: 'Holiday', tag: 'FORCE_HOLIDAY' };
      const entry  = buildManagerEntry(empId, empName, date, fields, name);
      await apiSaveSlot(entry);

      for (let i = CP_TIMESHEET_DATA.length - 1; i >= 0; i--) {
        const e = CP_TIMESHEET_DATA[i];
        if (e.empId === empId && e.date === date) CP_TIMESHEET_DATA.splice(i, 1);
      }
      CP_TIMESHEET_DATA.push({ ...entry, empId, empName, status: 'Holiday', date, hours: '0h' });

      toast?.('s', 'Holiday applied', `${empName} · ${dateLabel}`);
      overlay.remove();
      renderAttendanceGrid();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Apply Holiday';
      toast?.('e', 'Failed to save', err.message);
    }
  });
}

function openAttendanceForceLeaveModal(empId, empName, date) {
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999;`;
  overlay.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border-md);border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🟠 Apply Force Leave</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:10px;">${esc(empName)} · ${dateLabel}</div>
      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">
        Notes <span style="color:#f87171;">(required)</span>
      </label>
      <textarea id="attendForceLeaveNotes" placeholder="Reason for this manual action…" style="width:100%;min-height:64px;
        background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
        font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;resize:vertical;"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="attendForceLeaveCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="attendForceLeaveSubmit" style="background:var(--a1);border:none;
          color:#fff;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Submit</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#attendForceLeaveCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#attendForceLeaveSubmit').addEventListener('click', async () => {
    const notes = overlay.querySelector('#attendForceLeaveNotes').value.trim();
    if (!notes) { overlay.querySelector('#attendForceLeaveNotes').style.borderColor = '#f87171'; return; }

    if (typeof buildManagerEntry !== 'function' || typeof apiSaveSlot !== 'function') {
      toast?.('e', 'Employee Detail module not loaded');
      return;
    }

    const submitBtn = overlay.querySelector('#attendForceLeaveSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const fields = { slot: 'extended', client: 'Leave', clientId: '', project: 'Leave', projectId: '', task: 'Leave', hours: 0, status: 'Leave', tag: 'FORCE_LEAVE' };
      const entry  = buildManagerEntry(empId, empName, date, fields, notes);
      await apiSaveSlot(entry);

      CP_TIMESHEET_DATA.push({ ...entry, empId, empName, status: 'Leave', date, hours: '0h' });

      toast?.('s', 'Force Leave recorded', `${dateLabel} for ${empName}`);
      overlay.remove();
      renderAttendanceGrid();
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      toast?.('e', 'Failed to save', err.message);
    }
  });
}

function openBiometricPunchModal(empId, empName, date, existingIn, existingOut) {
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999;`;
  overlay.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border-md);border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🔒 Biometric Punch</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">${esc(empName)} · ${dateLabel}. Reference only — doesn't affect hours, leave, or overtime.</div>
      <div style="display:flex;gap:10px;">
        <div style="flex:1;">
          <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">In</label>
          <input type="time" id="bioInTime" value="${esc(existingIn || '')}" style="width:100%;box-sizing:border-box;
            background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
            font-size:12.5px;padding:8px 10px;"/>
        </div>
        <div style="flex:1;">
          <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">Out</label>
          <input type="time" id="bioOutTime" value="${esc(existingOut || '')}" style="width:100%;box-sizing:border-box;
            background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
            font-size:12.5px;padding:8px 10px;"/>
        </div>
      </div>
      <div id="bioErr" style="display:none;font-size:11.5px;color:#f87171;margin-top:8px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="bioCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="bioSubmit" style="background:#818cf8;border:none;
          color:#fff;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#bioCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#bioSubmit').addEventListener('click', async () => {
    const bioIn  = overlay.querySelector('#bioInTime').value;
    const bioOut = overlay.querySelector('#bioOutTime').value;
    const errEl  = overlay.querySelector('#bioErr');
    errEl.style.display = 'none';

    if (!bioIn && !bioOut) { errEl.textContent = 'Enter at least one time.'; errEl.style.display = 'block'; return; }
    if (typeof apiSaveBiometricPunch !== 'function') { toast?.('e', 'Required module not loaded'); return; }

    const submitBtn = overlay.querySelector('#bioSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      await apiSaveBiometricPunch({
        role: 'hr', uid: empId, date, bioIn, bioOut,
        enteredByName: (typeof USER !== 'undefined' && USER?.name) || 'HR',
      });

      for (let i = CP_TIMESHEET_DATA.length - 1; i >= 0; i--) {
        const e = CP_TIMESHEET_DATA[i];
        if (e.empId === empId && e.date === date && e.status === 'BiometricPunch') CP_TIMESHEET_DATA.splice(i, 1);
      }
      CP_TIMESHEET_DATA.push({ empId, empName, date, status: 'BiometricPunch', timeIn: bioIn, timeOut: bioOut, hours: '0h', slot: 'biometric' });

      toast?.('s', 'Biometric punch saved', `${empName} · ${dateLabel}`);
      overlay.remove();
      renderAttendanceGrid();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save';
      toast?.('e', 'Failed to save', err.message);
    }
  });
}

function openBulkHolidayModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.55);
    display:flex;align-items:center;justify-content:center;z-index:9999;`;
  overlay.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border-md);border-radius:14px;padding:1.25rem;width:380px;max-width:92vw;">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">📅 Push Public Holiday</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">Applies to every active employee. Pick any date — not limited to the range currently shown.</div>
      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">Date</label>
      <input type="date" id="holidayDate" style="width:100%;box-sizing:border-box;margin-bottom:10px;
        background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
        font-size:12.5px;padding:8px 10px;"/>
      <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">
        Holiday Name <span style="color:#f87171;">(required)</span>
      </label>
      <input type="text" id="holidayName" placeholder="e.g. Independence Day" style="width:100%;box-sizing:border-box;
        background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--txt1);
        font-size:12.5px;padding:8px 10px;"/>
      <div id="holidayErr" style="display:none;font-size:11.5px;color:#f87171;margin-top:6px;"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="holidayCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="holidaySubmit" style="background:#fbbf24;border:none;
          color:#1a1a2e;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Push to All</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#holidayCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#holidaySubmit').addEventListener('click', async () => {
    const date = overlay.querySelector('#holidayDate').value;
    const name = overlay.querySelector('#holidayName').value.trim();
    const errEl = overlay.querySelector('#holidayErr');
    errEl.style.display = 'none';

    if (!date) { errEl.textContent = 'Pick a date.'; errEl.style.display = 'block'; return; }
    if (!name) { errEl.textContent = 'Holiday name is required.'; errEl.style.display = 'block'; return; }
    if (typeof buildManagerEntry !== 'function' || typeof apiSaveSlot !== 'function') {
      toast?.('e', 'Required module not loaded');
      return;
    }

    const submitBtn = overlay.querySelector('#holidaySubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Pushing…';

    try {
      const activeEmployees = (CP_EMPLOYEES || []).filter(emp => emp.active !== false);
      if (!activeEmployees.length) {
        errEl.textContent = 'No active employees loaded — try reopening the Attendance tab first.';
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Push to All';
        return;
      }

      let applied = 0, skipped = 0;
      const errors = []; 

      for (const emp of activeEmployees) {
        let status;
        try {
          status = getEmpDayStatus(emp.id, date);
        } catch (statusErr) {
          errors.push({ empName: emp.name, message: 'Status check failed: ' + statusErr.message });
          continue;
        }

        if (status.kind !== 'not_logged') { skipped++; continue; } 

        try {
          const fields = { slot: 'extended', client: 'Holiday', clientId: '', project: 'Holiday', projectId: '', task: name, hours: 0, status: 'Holiday', tag: 'PUBLIC_HOLIDAY' };
          const entry  = buildManagerEntry(emp.id, emp.name, date, fields, name);
          await apiSaveSlot(entry);
          CP_TIMESHEET_DATA.push({ ...entry, empId: emp.id, empName: emp.name, status: 'Holiday', date, hours: '0h' });
          applied++;
        } catch (err) {
          console.warn('[Bulk Holiday] failed for', emp.id, err.message);
          errors.push({ empName: emp.name, message: err.message });
        }
      }

      const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

      if (applied === 0 && errors.length) {

        errEl.innerHTML = `Failed for all ${errors.length} employee${errors.length === 1 ? '' : 's'}. First error (${esc(errors[0].empName)}): ${esc(errors[0].message)}`;
        errEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Push to All';
        toast?.('e', 'Push failed', errors[0].message);
        return;
      }

      if (applied === 0 && skipped === activeEmployees.length) {
        toast?.('i', 'Nothing to push', `Every active employee already has an entry on ${dateLabel} — none were overwritten.`);
        overlay.remove();
        renderAttendanceGrid();
        return;
      }

      toast?.('s', 'Public Holiday pushed', `${dateLabel} — applied to ${applied} employee${applied === 1 ? '' : 's'}${skipped ? `, skipped ${skipped} with existing entries` : ''}${errors.length ? `, ${errors.length} failed` : ''}.`);
      overlay.remove();
      renderAttendanceGrid();
    } catch (outerErr) {

      console.error('[Bulk Holiday] unexpected failure:', outerErr);
      errEl.textContent = 'Unexpected error: ' + outerErr.message;
      errEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Push to All';
      toast?.('e', 'Push failed', outerErr.message);
    }
  });
}

async function renderOldProjectsTab(content) {
  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading historical projects…</span></div>`;

  let projects;
  try {
    projects = await sheetGET({ action: 'getHistoricalProjectsSummary' });
  } catch(err) {
    content.innerHTML = `<div class="slot-error">Failed to load historical projects: ${esc(err.message)}</div>`;
    return;
  }

  content.innerHTML = `
    <div style="margin-bottom:1.1rem;">
      <div style="font-size:16px;font-weight:700;color:var(--txt1);">📜 OLD Projects</div>
      <div style="font-size:12px;color:var(--txt2);">
        Legacy projects entered by Team Leaders via Historical Import — total hours per employee per month only, no daily entries. View only here.
      </div>
    </div>
    ${!projects.length
      ? `<div class="chart-empty">No historical registers have been entered yet.</div>`
      : `<div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr>
                ${['Client → Project', 'Months', 'Employees', 'Total Hours', 'Status'].map(h =>
                  `<th style="text-align:${['Months','Employees','Total Hours'].includes(h) ? 'right' : 'left'};padding:9px 12px;
                    background:var(--surface2);color:var(--txt2);font-size:10.5px;text-transform:uppercase;
                    letter-spacing:.04em;white-space:nowrap;">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${projects.map(p => `
                <tr style="border-top:1px solid var(--border);">
                  <td style="padding:9px 12px;color:var(--txt1);font-weight:600;white-space:nowrap;">${esc(p.clientName)} → ${esc(p.projectName)}</td>
                  <td style="padding:9px 12px;text-align:right;color:var(--txt1);">${p.monthCount}</td>
                  <td style="padding:9px 12px;text-align:right;color:var(--txt1);">${p.employeeCount}</td>
                  <td style="padding:9px 12px;text-align:right;color:var(--a1);font-weight:700;">${fmtOldProjHours(p.totalHours)}</td>
                  <td style="padding:9px 12px;white-space:nowrap;">
                    ${p.isFinal
                      ? `<span style="background:rgba(52,211,153,.12);color:#34d399;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;">Final</span>`
                      : `<span style="background:rgba(251,191,36,.12);color:#fbbf24;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;">Draft</span>`}
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
  `;
}

function fmtOldProjHours(h) {
  const n = parseFloat(h) || 0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 }) + 'h';
}

Object.assign(window.ClientProjectAPI, {
  getAllClients:      () => CP_CLIENTS.slice(),
  getAllProjects:      () => CP_PROJECTS.slice(),
  getProjectById:      (projectId) => CP_PROJECTS.find(p => p.projectId === projectId) || null,
  computeProjectCost:  async (projectId) => {
    const project = CP_PROJECTS.find(p => p.projectId === projectId);
    return project ? await calculateProjectCost(project) : null;
  },
  getProjectTeamActivity: (projectId) => {
    const project = CP_PROJECTS.find(p => p.projectId === projectId);
    return project ? getProjectTeamActivity(project) : null;
  },
  reloadClients: loadClientData,
  reloadProjects: loadProjectData,
});

// HISTORICAL-IMPORT
const HIST_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

let HIST_CURRENT = null;

function renderHistoricalImportTab(content) {
  if (typeof TL_MODE === 'undefined' || !TL_MODE) {
    content.innerHTML = `<div class="chart-empty">Historical Import is only available to Team Leaders.</div>`;
    return;
  }
  if (typeof ensureCPStyles === 'function') ensureCPStyles(); 

  HIST_CURRENT = null;
  renderHistoricalLanding(content);
}

function renderHistoricalLanding(content) {
  content.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:1.25rem;">
      <div>
        <div style="font-weight:700;font-size:16px;color:var(--txt1);margin-bottom:.2rem;">📜 Historical Timesheet Import</div>
        <div style="font-size:12px;color:var(--txt2);">
          Enter old monthly total hours from before this system existed — a quick register, not a file import.
          Only one total-hours number per employee per month is stored; no daily entries are ever created.
        </div>
      </div>
      <button id="histRefreshBtn" title="Refresh this tab's data" style="background:var(--elevated);
        border:1px solid var(--border-md);border-radius:6px;color:var(--txt2);cursor:pointer;
        padding:7px 10px;font-size:13px;line-height:1;display:flex;align-items:center;flex-shrink:0;">🔄</button>
    </div>

    <div class="cp-card" style="margin-bottom:1.25rem;max-width:640px;">
      <div style="font-weight:700;font-size:13px;color:var(--txt1);margin-bottom:.9rem;">Start a New Register</div>
      <div class="cp-form-grid">
        <div class="cp-form-field">
          <label class="cp-flabel">Client</label>
          <select class="cp-finput" id="histNewClient">
            <option value="">— Select client —</option>
            ${(TL_CLIENTS || []).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cp-form-field">
          <label class="cp-flabel">Project</label>
          <select class="cp-finput" id="histNewProject" disabled>
            <option value="">— Select client first —</option>
          </select>
        </div>
        <div class="cp-form-field">
          <label class="cp-flabel">Start Month</label>
          <input class="cp-finput" type="month" id="histNewStart"/>
        </div>
        <div class="cp-form-field">
          <label class="cp-flabel">End Month</label>
          <input class="cp-finput" type="month" id="histNewEnd"/>
        </div>
      </div>
      <button id="histCreateBtn" class="cp-btn-primary" style="margin-top:.4rem;">Create Historical Sheet →</button>
    </div>

    <div class="cp-card" style="margin-bottom:1.25rem;">
      <div style="font-weight:700;font-size:13px;color:var(--txt1);margin-bottom:.9rem;">Continue an Existing Register</div>
      <div id="histExistingList"><div style="font-size:12px;color:var(--txt2);">Loading…</div></div>
    </div>

    <div class="cp-card">
      <div style="font-weight:700;font-size:13px;color:var(--txt1);margin-bottom:.9rem;">🔍 Search Historical Records</div>
      <div class="cp-form-grid">
        <div class="cp-form-field">
          <label class="cp-flabel">Month</label>
          <select class="cp-finput" id="histSearchMonth">
            <option value="">All months</option>
            ${HIST_MONTHS.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="cp-form-field">
          <label class="cp-flabel">Client</label>
          <select class="cp-finput" id="histSearchClient">
            <option value="">All clients</option>
            ${(TL_CLIENTS || []).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="cp-form-field">
          <label class="cp-flabel">Employee</label>
          <select class="cp-finput" id="histSearchEmployee">
            <option value="">All employees</option>
            ${(TL_EMPLOYEES || []).map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <button id="histSearchBtn" class="cp-btn-ghost" style="margin-top:.8rem;">Search</button>
      <div id="histSearchResults" style="margin-top:1rem;"></div>
    </div>
  `;

  content.querySelector('#histNewClient').addEventListener('change', e => {
    const clientId = e.target.value;
    const projSel = content.querySelector('#histNewProject');
    const projects = (TL_PROJECTS || []).filter(p => p.cid === clientId);
    if (!clientId) {
      projSel.innerHTML = `<option value="">— Select client first —</option>`;
      projSel.disabled = true;
    } else {
      projSel.innerHTML = `<option value="">— Select project —</option>` +
        projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
      projSel.disabled = false;
    }
  });

  content.querySelector('#histCreateBtn').addEventListener('click', createHistoricalSheet);
  content.querySelector('#histSearchBtn').addEventListener('click', runHistoricalSearch);

  content.querySelector('#histRefreshBtn').addEventListener('click', () => {
    toast?.('s', 'Refreshed', 'Historical Import data is up to date.');
    renderHistoricalLanding(content);
  });

  loadHistoricalExistingList();
}

async function loadHistoricalExistingList() {
  const el = $('histExistingList');
  if (!el) return;
  try {
    const projects = await sheetGET({ action: 'getHistoricalProjectsSummary' });
    if (!projects.length) {
      el.innerHTML = `<div style="font-size:12px;color:var(--txt2);">No historical registers started yet.</div>`;
      return;
    }
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <thead><tr style="background:var(--surface2);">
          <th style="text-align:left;padding:6px 9px;border:1px solid var(--border);">Client → Project</th>
          <th style="text-align:right;padding:6px 9px;border:1px solid var(--border);">Months</th>
          <th style="text-align:right;padding:6px 9px;border:1px solid var(--border);">Employees</th>
          <th style="text-align:right;padding:6px 9px;border:1px solid var(--border);">Total Hours</th>
          <th style="text-align:left;padding:6px 9px;border:1px solid var(--border);">Status</th>
          <th style="padding:6px 9px;border:1px solid var(--border);"></th>
        </tr></thead>
        <tbody>
          ${projects.map(p => `
            <tr>
              <td style="padding:6px 9px;border:1px solid var(--border);color:var(--txt1);">${esc(p.clientName)} → ${esc(p.projectName)}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);text-align:right;color:var(--txt1);">${p.monthCount}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);text-align:right;color:var(--txt1);">${p.employeeCount}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);text-align:right;color:var(--a1);font-weight:600;">${esc(fmtHistHours(p.totalHours))}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);">
                ${p.isFinal
                  ? `<span style="background:rgba(52,211,153,.12);color:#34d399;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;">Final</span>`
                  : `<span style="background:rgba(251,191,36,.12);color:#fbbf24;border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;">Draft</span>`}
              </td>
              <td style="padding:6px 9px;border:1px solid var(--border);text-align:center;">
                <button class="hist-resume-btn" data-client-id="${esc(p.clientId)}" data-project-id="${esc(p.projectId)}"
                  style="background:var(--a1);color:#fff;border:none;border-radius:6px;padding:5px 12px;
                  font-size:10.5px;font-weight:700;cursor:pointer;">Open →</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    el.querySelectorAll('.hist-resume-btn').forEach(btn => {
      btn.addEventListener('click', () => resumeHistoricalSheet(btn.dataset.clientId, btn.dataset.projectId));
    });
  } catch (err) {
    el.innerHTML = `<div class="slot-error">Failed to load: ${esc(err.message)}</div>`;
  }
}

async function runHistoricalSearch() {
  const resultsEl = $('histSearchResults');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div style="font-size:12px;color:var(--txt2);">Searching…</div>`;

  const filters = {
    month:      $('histSearchMonth')?.value || '',
    clientId:   $('histSearchClient')?.value || '',
    employeeId: $('histSearchEmployee')?.value || '',
  };

  try {
    const records = await sheetGET({ action: 'getHistoricalRecords', filters: encodeURIComponent(JSON.stringify(filters)) });
    if (!records.length) {
      resultsEl.innerHTML = `<div style="font-size:12px;color:var(--txt2);">No matching records.</div>`;
      return;
    }
    resultsEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <thead><tr style="background:var(--surface2);">
          <th style="text-align:left;padding:6px 9px;border:1px solid var(--border);">Month</th>
          <th style="text-align:left;padding:6px 9px;border:1px solid var(--border);">Employee</th>
          <th style="text-align:left;padding:6px 9px;border:1px solid var(--border);">Project</th>
          <th style="text-align:right;padding:6px 9px;border:1px solid var(--border);">Hours</th>
        </tr></thead>
        <tbody>
          ${records.map(r => `
            <tr>
              <td style="padding:6px 9px;border:1px solid var(--border);color:var(--txt1);">${esc(r.month)} ${esc(r.year)}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);color:var(--txt1);">${esc(r.employeeName)}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);color:var(--txt1);">${esc(r.projectName)}</td>
              <td style="padding:6px 9px;border:1px solid var(--border);text-align:right;color:var(--a1);font-weight:600;">${esc(fmtHistHours(r.totalHours))}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    resultsEl.innerHTML = `<div class="slot-error">Search failed: ${esc(err.message)}</div>`;
  }
}

function buildHistMonthRange(startVal, endVal) {
  const [sy, sm] = startVal.split('-').map(Number);
  const [ey, em] = endVal.split('-').map(Number);
  const months = [];
  let y = sy, m = sm;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 120) {
    months.push({ month: HIST_MONTHS[m - 1], year: String(y), collapsed: false, records: [] });
    m++; if (m > 12) { m = 1; y++; }
    guard++;
  }
  return months;
}

async function createHistoricalSheet() {
  const clientId  = $('histNewClient')?.value;
  const projectId = $('histNewProject')?.value;
  const startVal  = $('histNewStart')?.value;
  const endVal    = $('histNewEnd')?.value;

  if (!clientId || !projectId) { toast?.('e', 'Select a Client and Project'); return; }
  if (!startVal || !endVal)    { toast?.('e', 'Select a Start Month and End Month'); return; }
  if (endVal < startVal)       { toast?.('e', 'End Month must be on or after Start Month'); return; }

  const client  = (TL_CLIENTS || []).find(c => c.id === clientId);
  const project = (TL_PROJECTS || []).find(p => p.id === projectId);

  const btn = $('histCreateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {

    const existing = await sheetGET({ action: 'getHistoricalSheetData', clientId, projectId });
    const wantedRange = buildHistMonthRange(startVal, endVal);

    const months = wantedRange.map(wm => {
      const found = existing.months.find(em => em.month === wm.month && em.year === wm.year);
      return found
        ? { month: wm.month, year: wm.year, collapsed: false, records: found.records.map(r => ({ ...r })) }
        : wm;
    });

    HIST_CURRENT = {
      clientId, clientName: client?.name || '',
      projectId, projectName: project?.name || '',
      isFinal: existing.isFinal,
      months,
    };

    renderHistoricalRegister($('tlTabContent'));
  } catch (err) {
    toast?.('e', 'Failed to create sheet', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Create Historical Sheet →'; }
  }
}

async function resumeHistoricalSheet(clientId, projectId) {
  const content = $('tlTabContent');
  content.innerHTML = `<div class="slot-loading"><div class="slot-spinner"></div><span>Loading…</span></div>`;

  try {
    const client  = (TL_CLIENTS || []).find(c => c.id === clientId);
    const project = (TL_PROJECTS || []).find(p => p.id === projectId);
    const existing = await sheetGET({ action: 'getHistoricalSheetData', clientId, projectId });

    if (!existing.months.length) {
      toast?.('e', 'No data found for this project');
      renderHistoricalLanding(content);
      return;
    }

    HIST_CURRENT = {
      clientId, clientName: client?.name || '',
      projectId, projectName: project?.name || '',
      isFinal: existing.isFinal,
      months: existing.months
        .slice()
        .sort((a, b) => (a.year + a.month).localeCompare(b.year + b.month))
        .map(m => ({ ...m, collapsed: false })),
    };

    renderHistoricalRegister(content);
  } catch (err) {
    toast?.('e', 'Failed to load', err.message);
    renderHistoricalLanding(content);
  }
}

function renderHistoricalRegister(content) {
  if (!HIST_CURRENT) { renderHistoricalLanding(content); return; }
  const c = HIST_CURRENT;

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:10px;">
      <div>
        <button id="histBackBtn" class="cp-back-btn" style="margin-bottom:6px;">← Back</button>
        <div style="font-weight:800;font-size:17px;color:var(--txt1);">${esc(c.clientName)} → ${esc(c.projectName)}</div>
        <div style="font-size:11.5px;color:var(--txt2);">
          ${c.isFinal
            ? `<span style="color:#34d399;font-weight:700;">✓ Finalized</span> — locked from further edits`
            : 'Draft — editable'}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${c.isFinal
          ? `<button id="histReopenBtn" class="cp-btn-ghost">🔓 Reopen for Editing</button>`
          : `<button id="histSaveDraftBtn" class="cp-btn-ghost">💾 Save Draft (all months)</button>
             <button id="histFinalSubmitBtn" class="cp-btn-primary" style="background:#34d399;">✓ Final Submit</button>`}
      </div>
    </div>

    <div id="histMonthsContainer"></div>
  `;

  content.querySelector('#histBackBtn').addEventListener('click', () => {
    HIST_CURRENT = null;
    renderHistoricalLanding(content);
  });
  content.querySelector('#histSaveDraftBtn')?.addEventListener('click', saveHistoricalDraftAll);
  content.querySelector('#histFinalSubmitBtn')?.addEventListener('click', finalSubmitHistoricalProject);
  content.querySelector('#histReopenBtn')?.addEventListener('click', reopenHistoricalProject);

  renderHistoricalMonths();
}

function renderHistoricalMonths() {
  const container = $('histMonthsContainer');
  if (!container || !HIST_CURRENT) return;

  const locked = HIST_CURRENT.isFinal;

  container.innerHTML = HIST_CURRENT.months.map((m, i) => buildHistMonthCard(m, i)).join('')
    + (!locked ? `
      <button id="histAddMonthBtn" style="background:none;border:1px dashed var(--border-md);color:var(--a1);
        border-radius:8px;padding:9px 16px;font-size:12px;font-weight:600;cursor:pointer;width:100%;margin-top:.4rem;">
        + Add Month
      </button>
      <div id="histAddMonthForm" style="display:none;margin-top:.6rem;padding:.9rem 1rem;background:var(--surface1);
        border:1px solid var(--border);border-radius:10px;align-items:center;gap:10px;flex-wrap:wrap;">
        <input id="histAddMonthInput" type="month" class="cp-finput" style="font-size:12.5px;padding:6px 8px;width:auto;"/>
        <button id="histAddMonthConfirm" class="cp-btn-primary" style="padding:6px 14px;font-size:11.5px;">Add</button>
        <button id="histAddMonthCancel" class="cp-btn-ghost" style="padding:6px 14px;font-size:11.5px;">Cancel</button>
      </div>` : '');

  HIST_CURRENT.months.forEach((m, i) => wireHistMonthCard(i));
  if (!locked) wireHistAddMonth();
}

function wireHistAddMonth() {
  const btn = $('histAddMonthBtn');
  const form = $('histAddMonthForm');
  const input = $('histAddMonthInput');
  if (!btn || !form || !input) return;

  btn.addEventListener('click', () => {
    form.style.display = 'flex';
    btn.style.display = 'none';
    input.focus();
  });

  $('histAddMonthCancel')?.addEventListener('click', () => {
    form.style.display = 'none';
    btn.style.display = 'block';
    input.value = '';
  });

  $('histAddMonthConfirm')?.addEventListener('click', () => {
    const val = input.value; 
    if (!val) { toast?.('e', 'Pick a month first'); return; }
    const [y, m] = val.split('-').map(Number);
    const monthName = HIST_MONTHS[m - 1];
    const year = String(y);

    const already = HIST_CURRENT.months.some(mo => mo.month === monthName && mo.year === year);
    if (already) {
      toast?.('i', `${monthName} ${year} is already in this register`);
      form.style.display = 'none';
      btn.style.display = 'block';
      input.value = '';
      return;
    }

    HIST_CURRENT.months.push({ month: monthName, year, collapsed: false, records: [] });
    HIST_CURRENT.months.sort((a, b) => (a.year + String(HIST_MONTHS.indexOf(a.month) + 1).padStart(2, '0'))
      .localeCompare(b.year + String(HIST_MONTHS.indexOf(b.month) + 1).padStart(2, '0')));

    renderHistoricalMonths();
    toast?.('s', `${monthName} ${year} added`, 'Add employees, then Save Draft to persist it.');
  });
}

function buildHistMonthCard(m, index) {
  const totalHours = m.records.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  const locked = HIST_CURRENT.isFinal;

  return `
    <details class="cp-card" style="margin-bottom:1rem;padding:0;" ${m.collapsed ? '' : 'open'} data-month-index="${index}">
      <summary style="cursor:pointer;list-style:none;padding:1rem 1.2rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-weight:700;font-size:14px;color:var(--txt1);">${esc(m.month)} ${esc(m.year)}</span>
          <span style="font-size:11px;color:var(--txt2);">${m.records.length} Employee${m.records.length !== 1 ? 's' : ''}</span>
          <span style="font-size:11px;color:var(--a1);font-weight:700;">${esc(fmtHistHours(totalHours))}</span>
        </div>
        ${!locked ? `<button class="hist-save-month-btn" data-month-index="${index}"
          style="background:var(--a1);color:#fff;border:none;border-radius:6px;padding:6px 14px;
          font-size:11px;font-weight:700;cursor:pointer;" onclick="event.preventDefault(); saveHistoricalMonth(${index});">💾 Save Month</button>` : ''}
      </summary>
      <div style="padding:0 1.2rem 1.2rem;">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:.8rem;">
          <thead><tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:6px 4px;color:var(--txt2);font-size:10.5px;text-transform:uppercase;">Employee</th>
            <th style="text-align:left;padding:6px 4px;color:var(--txt2);font-size:10.5px;text-transform:uppercase;width:140px;">Total Hours</th>
            <th style="width:40px;"></th>
          </tr></thead>
          <tbody id="histMonthRows-${index}">
            ${m.records.map((r, ri) => buildHistEmployeeRow(index, ri, r, locked)).join('')}
          </tbody>
        </table>
        ${!locked ? `<button class="hist-add-emp-btn" data-month-index="${index}"
          style="background:none;border:1px dashed var(--border-md);color:var(--a1);border-radius:8px;
          padding:7px 16px;font-size:11.5px;font-weight:600;cursor:pointer;width:100%;">+ Add Employee</button>` : ''}
      </div>
    </details>`;
}

function buildHistEmployeeRow(monthIndex, rowIndex, rec, locked) {
  const employees = TL_EMPLOYEES || [];
  return `
    <tr data-row-index="${rowIndex}">
      <td style="padding:5px 4px;">
        <select class="cp-finput hist-emp-select" data-month-index="${monthIndex}" data-row-index="${rowIndex}" ${locked ? 'disabled' : ''} style="font-size:12.5px;padding:6px 8px;">
          <option value="">— Employee —</option>
          ${employees.map(e => `<option value="${esc(e.id)}" ${e.id === rec.employeeId ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
        </select>
      </td>
      <td style="padding:5px 4px;">
        <input class="cp-finput hist-hours-input" data-month-index="${monthIndex}" data-row-index="${rowIndex}"
          type="text" placeholder="HH:MM e.g. 81:05" value="${esc(fmtHistHoursColon(rec.hours))}" ${locked ? 'disabled' : ''}
          style="font-size:12.5px;padding:6px 8px;"/>
      </td>
      <td style="padding:5px 4px;text-align:center;">
        ${!locked ? `<button class="hist-del-row-btn" data-month-index="${monthIndex}" data-row-index="${rowIndex}"
          style="background:none;border:none;color:#f87171;cursor:pointer;font-size:15px;padding:2px 6px;" title="Delete row">🗑</button>` : ''}
      </td>
    </tr>`;
}

function fmtHistHoursColon(h) {
  if (h === undefined || h === null || h === '') return '';
  const totalMins = Math.round(Number(h) * 60);
  const hrs = Math.floor(totalMins / 60), mins = totalMins % 60;
  return hrs + ':' + String(mins).padStart(2, '0');
}

function wireHistMonthCard(index) {
  const container = $('histMonthsContainer');
  if (!container) return;

  container.querySelectorAll(`.hist-emp-select[data-month-index="${index}"]`).forEach(sel => {
    sel.addEventListener('change', e => {
      const ri = parseInt(e.target.dataset.rowIndex, 10);
      const emp = (TL_EMPLOYEES || []).find(x => x.id === e.target.value);
      HIST_CURRENT.months[index].records[ri].employeeId   = e.target.value;
      HIST_CURRENT.months[index].records[ri].employeeName = emp ? emp.name : '';
    });
  });

  container.querySelectorAll(`.hist-hours-input[data-month-index="${index}"]`).forEach(inp => {
    inp.addEventListener('input', e => {
      const ri = parseInt(e.target.dataset.rowIndex, 10);
      HIST_CURRENT.months[index].records[ri].hoursRaw = e.target.value;
    });
  });

  container.querySelectorAll(`.hist-del-row-btn[data-month-index="${index}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const ri = parseInt(btn.dataset.rowIndex, 10);
      HIST_CURRENT.months[index].records.splice(ri, 1);
      rerenderHistMonth(index);
    });
  });

  const addBtn = container.querySelector(`.hist-add-emp-btn[data-month-index="${index}"]`);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      HIST_CURRENT.months[index].records.push({ employeeId: '', employeeName: '', hours: 0, remarks: '' });
      rerenderHistMonth(index);
    });
  }
}

function rerenderHistMonth(index) {
  const container = $('histMonthsContainer');
  const details = container.querySelector(`details[data-month-index="${index}"]`);
  const wasOpen = details ? details.open : true;
  const html = buildHistMonthCard(HIST_CURRENT.months[index], index);
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const newEl = temp.firstElementChild;
  newEl.open = wasOpen;
  details.replaceWith(newEl);
  wireHistMonthCard(index);
}

function validateHistMonthClientSide(monthIndex) {
  const m = HIST_CURRENT.months[monthIndex];
  const errors = [];
  const seen = {};

  m.records.forEach((r, i) => {
    const rowLabel = 'Row ' + (i + 1);
    if (!r.employeeId) { errors.push(rowLabel + ': select an employee.'); return; }
    if (seen[r.employeeId]) { errors.push(rowLabel + ': ' + r.employeeName + ' is already in this month.'); return; }
    seen[r.employeeId] = true;

    const raw = r.hoursRaw !== undefined ? r.hoursRaw : fmtHistHoursColon(r.hours);
    if (!/^\d+:[0-5]?\d$/.test(String(raw).trim())) {
      errors.push(rowLabel + ': hours must be HH:MM, e.g. 81:05.');
    }
  });

  return errors;
}

function histColonToDecimal(raw) {
  const m = /^(\d+):([0-5]?\d)$/.exec(String(raw).trim());
  if (!m) return null;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

async function saveHistoricalMonth(monthIndex) {
  const m = HIST_CURRENT.months[monthIndex];
  const errors = validateHistMonthClientSide(monthIndex);
  if (errors.length) {
    toast?.('e', 'Fix these before saving', errors.join(' '));
    return;
  }

  const records = m.records.map(r => ({
    employeeId: r.employeeId,
    hours: r.hoursRaw !== undefined ? histColonToDecimal(r.hoursRaw) : r.hours,
    remarks: r.remarks || '',
  }));

  try {
    await sheetGET({
      action: 'saveHistoricalMonth',
      data: encodeURIComponent(JSON.stringify({
        role: 'tl',
        importedByName: (typeof USER !== 'undefined' && USER?.name) || 'Team Leader',
        clientId: HIST_CURRENT.clientId, projectId: HIST_CURRENT.projectId,
        month: m.month, year: m.year, records,
      })),
    });
    toast?.('s', 'Saved', `${m.month} ${m.year} — ${records.length} record(s).`);
  } catch (err) {
    toast?.('e', 'Save failed', err.message);
  }
}

async function saveHistoricalDraftAll() {
  const allErrors = [];
  HIST_CURRENT.months.forEach((m, i) => {
    const errs = validateHistMonthClientSide(i);
    if (errs.length) allErrors.push(m.month + ' ' + m.year + ': ' + errs.join(' '));
  });
  if (allErrors.length) {
    toast?.('e', 'Fix these before saving', allErrors.join(' '));
    return;
  }

  const btn = $('histSaveDraftBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    const months = HIST_CURRENT.months.map(m => ({
      month: m.month, year: m.year,
      records: m.records.map(r => ({
        employeeId: r.employeeId,
        hours: r.hoursRaw !== undefined ? histColonToDecimal(r.hoursRaw) : r.hours,
        remarks: r.remarks || '',
      })),
    }));

    await sheetGET({
      action: 'saveHistoricalDraft',
      data: encodeURIComponent(JSON.stringify({
        role: 'tl',
        importedByName: (typeof USER !== 'undefined' && USER?.name) || 'Team Leader',
        clientId: HIST_CURRENT.clientId, projectId: HIST_CURRENT.projectId,
        months,
      })),
    });
    toast?.('s', 'Draft saved', `${months.length} month(s) saved.`);
  } catch (err) {
    toast?.('e', 'Save failed', err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Draft (all months)'; }
  }
}

async function finalSubmitHistoricalProject() {
  if (!confirm('Final Submit locks every month for this project from further edits. Save any unsaved changes first — continue?')) return;

  const btn = $('histFinalSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Finalizing…'; }

  try {
    await sheetGET({
      action: 'finalizeHistoricalProject',
      data: encodeURIComponent(JSON.stringify({ role: 'tl', clientId: HIST_CURRENT.clientId, projectId: HIST_CURRENT.projectId })),
    });
    toast?.('s', 'Finalized', 'This project is now locked.');
    resumeHistoricalSheet(HIST_CURRENT.clientId, HIST_CURRENT.projectId);
  } catch (err) {
    toast?.('e', 'Finalize failed', err.message);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Final Submit'; }
  }
}

async function reopenHistoricalProject() {
  if (!confirm('Reopen this project for editing?')) return;
  try {
    await sheetGET({
      action: 'reopenHistoricalProject',
      data: encodeURIComponent(JSON.stringify({ role: 'tl', clientId: HIST_CURRENT.clientId, projectId: HIST_CURRENT.projectId })),
    });
    toast?.('s', 'Reopened', 'This project is editable again.');
    resumeHistoricalSheet(HIST_CURRENT.clientId, HIST_CURRENT.projectId);
  } catch (err) {
    toast?.('e', 'Reopen failed', err.message);
  }
}

function fmtHistHours(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hrs = Math.floor(totalMins / 60), mins = totalMins % 60;
  if (hrs === 0)  return mins + 'm';
  if (mins === 0) return hrs + 'h';
  return hrs + 'h ' + mins + 'm';
}

// GANTT
let GANTT_CONTAINER   = null;  
let GANTT_CLIENTS     = [];
let GANTT_PROJECTS    = [];    
let GANTT_ALL_ENTRIES = [];    

let GANTT_FILTER_CLIENT   = '';
let GANTT_FILTER_PROJECT  = '';
let GANTT_FILTER_EMPLOYEE = '';

let GANTT_TIMELINE    = null;  
let GANTT_MONTH_WIDTH = 34;    
const GANTT_MONTH_WIDTH_MIN = 14;     
const GANTT_MONTH_WIDTH_FIT_MIN = 3;  
const GANTT_MONTH_WIDTH_MAX = 90;
const GANTT_ROW_HEIGHT       = 40;   
const GANTT_LABEL_WIDTH      = 240;  
const GANTT_HEADER_HEIGHT    = 44;   

const GANTT_COST_CACHE = {}; 

function ensureGanttStyles() {
  if (document.getElementById('gantt-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'gantt-global-styles';
  style.textContent = `
    .gantt-bar {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,.35);
      transition: all .2s ease;
      cursor: pointer;
    }
    .gantt-bar:hover {
      filter: brightness(1.18);
      box-shadow: 0 4px 14px rgba(0,0,0,.5), 0 0 10px var(--gantt-glow, rgba(255,255,255,.3));
      transform: scaleY(1.08);
    }
  `;
  document.head.appendChild(style);
}

const GANTT_PROJECT_PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#7c3aed', '#b45309', '#4338ca',
  '#0f766e', '#6d28d9', '#1d4ed8', '#15803d', '#a16207', '#0369a1',
  '#6b21a8', '#0e7490', '#475569', '#92400e',
];

function getGanttProjectColor(projectId) {
  const str = 'gantt-proj:' + String(projectId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return GANTT_PROJECT_PALETTE[hash % GANTT_PROJECT_PALETTE.length];
}

const GANTT_STATUS_COLOR = {
  'In Progress': { bg: '#34d399', label: 'Active',    dot: '🟢' },
  'Completed':   { bg: '#4f8ef7', label: 'Completed', dot: '🔵' },
  'On Hold':     { bg: '#fb923c', label: 'On Hold',   dot: '🟠' },
};

async function initGantt(content) {
  GANTT_CONTAINER = content;
  ensureGanttStyles();

  if (typeof MANAGER_MODE !== 'undefined' && !MANAGER_MODE) {
    content.innerHTML = `<div class="chart-empty">Project Timeline is only available to the Manager.</div>`;
    return;
  }

  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading project timeline…</span></div>`;

  try {
    await loadProjects();
  } catch (err) {
    content.innerHTML = `<div class="slot-error">Failed to load timeline: ${esc(err.message)}</div>`;
    return;
  }

  if (!GANTT_PROJECTS.length) {
    content.innerHTML = `
      <div style="font-size:16px;font-weight:700;color:var(--txt1);margin-bottom:.3rem;">📊 Project Timeline</div>
      <div class="chart-empty">No projects with timesheet activity yet.</div>`;
    return;
  }

  calculateTimeline();
  renderGanttShell(content);
}

const GANTT_HIST_MONTH_NUM = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

function histMonthToDateRange(monthName, year) {
  const monthNum = GANTT_HIST_MONTH_NUM[monthName];
  if (!monthNum || !year) return null;
  const y = parseInt(year, 10);
  const lastDay = new Date(y, monthNum, 0).getDate();
  return {
    start: `${y}-${String(monthNum).padStart(2, '0')}-01`,
    end:   `${y}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

async function loadProjects() {
  let clients  = (typeof CP_CLIENTS !== 'undefined' && CP_CLIENTS.length) ? CP_CLIENTS : null;
  let projects = (typeof CP_PROJECTS !== 'undefined' && CP_PROJECTS.length) ? CP_PROJECTS : null;

  if (!clients)  clients  = await sheetGET({ action: 'getClientMasterList' });
  if (!projects) {
    const role = (typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE) ? 'manager' : 'tl';
    projects = await sheetGET({ action: 'getProjectMasterList', role });
  }

  GANTT_CLIENTS     = clients || [];
  GANTT_ALL_ENTRIES = (typeof CP_TIMESHEET_DATA !== 'undefined') ? CP_TIMESHEET_DATA : [];

  const histRows = CP_DATA_LOADED ? CP_HISTORICAL_DATA : await sheetGET({ action: 'getHistoricalRecords', filters: encodeURIComponent('{}') });
  const histByProject = {};
  (histRows || []).forEach(r => {
    if (!histByProject[r.projectId]) histByProject[r.projectId] = [];
    histByProject[r.projectId].push(r);
  });

  const clientNameById = {};
  GANTT_CLIENTS.forEach(c => { clientNameById[c.id] = c.name; });

  GANTT_PROJECTS = (projects || [])
    .map(p => {
      const entries     = GANTT_ALL_ENTRIES.filter(e => e.project === p.projectName && e.status !== 'Leave');
      const histRecords  = histByProject[p.projectId] || [];
      const histRanges   = histRecords.map(r => histMonthToDateRange(r.month, r.year)).filter(Boolean);

      const liveDates       = entries.map(e => e.date).filter(Boolean);
      const startCandidates = [...liveDates, ...histRanges.map(r => r.start)];
      const endCandidates   = [...liveDates, ...histRanges.map(r => r.end)];

      if (!startCandidates.length && !p.createdDate) return null; 

      const startDate    = startCandidates.length ? startCandidates.slice().sort()[0] : toLocalDateStr(new Date(p.createdDate || Date.now()));
      const lastActivity = endCandidates.length   ? endCandidates.slice().sort().slice(-1)[0] : startDate;

      const activeMonths = new Set();
      const monthlyHours = {}; 
      entries.forEach(e => {
        if (!e.date) return;
        const key = e.date.slice(0, 7);
        activeMonths.add(key);
        monthlyHours[key] = (monthlyHours[key] || 0) + parseH(e.hours);
      });
      histRecords.forEach(r => {
        const mn = GANTT_HIST_MONTH_NUM[r.month];
        if (!mn || !r.year) return;
        const key = `${r.year}-${String(mn).padStart(2, '0')}`;
        activeMonths.add(key);
        monthlyHours[key] = (monthlyHours[key] || 0) + (parseFloat(r.totalHours) || 0);
      });

      const liveHours = entries.reduce((s, e) => s + parseH(e.hours), 0);
      const histHours = histRecords.reduce((s, r) => s + (parseFloat(r.totalHours) || 0), 0);
      const totalHours = liveHours + histHours;

      const employeeCount = new Set([...entries.map(e => e.empId), ...histRecords.map(r => r.employeeId)]).size;

      const barColor = getGanttProjectColor(p.projectId);
      const statusMeta = GANTT_STATUS_COLOR[p.status] || GANTT_STATUS_COLOR['In Progress'];

      return {
        ...p,
        clientName: clientNameById[p.clientId] || p.clientId || '—',
        startDate, lastActivity, totalHours, employeeCount, activeMonths, monthlyHours,
        barColor, statusLabel: statusMeta.label, statusDotColor: statusMeta.bg, statusDot: statusMeta.dot,
      };
    })
    .filter(Boolean);
}

function getMonthlyViewsDelivered(p, monthKey) {
  const hours = p.monthlyHours?.[monthKey] || 0;
  const totalHours = p.totalHours || 0;
  const completedViews = parseFloat(p.completedViews) || 0;
  if (hours <= 0 || totalHours <= 0 || completedViews <= 0) return { hours, weight: 0, views: 0 };
  const weight = hours / totalHours;
  return { hours, weight, views: completedViews * weight };
}

function findEarliestProject() {
  return GANTT_PROJECTS.reduce((min, p) => (!min || p.startDate < min) ? p.startDate : min, null);
}

function findLatestActivity() {
  return GANTT_PROJECTS.reduce((max, p) => (!max || p.lastActivity > max) ? p.lastActivity : max, null);
}

const GANTT_TIMELINE_FLOOR_YEAR = 2020;

function calculateTimeline() {
  const earliest = findEarliestProject();
  const tod = todayStr();

  const latest = tod;

  const earliestYear = Math.min(parseInt(earliest.slice(0, 4), 10), GANTT_TIMELINE_FLOOR_YEAR);
  const paddedStart = `${earliestYear}-01-01`;

  GANTT_TIMELINE = { months: buildMonthHeaders(paddedStart, latest), startKey: paddedStart.slice(0, 7), endKey: latest.slice(0, 7) };
}

function buildMonthHeaders(startDateStr, endDateStr) {
  const months = [];
  const [sy, sm] = startDateStr.slice(0, 7).split('-').map(Number);
  const [ey, em] = endDateStr.slice(0, 7).split('-').map(Number);
  let y = sy, m = sm;
  let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 1200) {
    const key   = `${y}-${String(m).padStart(2, '0')}`;
    const label = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
    months.push({ year: y, month: m, key, label });
    m++; if (m > 12) { m = 1; y++; }
    guard++;
  }
  return months;
}

function monthIndexOf(monthKey) {
  return GANTT_TIMELINE.months.findIndex(m => m.key === monthKey);
}

function getFilteredGanttProjects() {
  return GANTT_PROJECTS.filter(p => {
    if (GANTT_FILTER_CLIENT && p.clientId !== GANTT_FILTER_CLIENT) return false;
    if (GANTT_FILTER_PROJECT && p.projectId !== GANTT_FILTER_PROJECT) return false;
    if (GANTT_FILTER_EMPLOYEE) {
      const worked = GANTT_ALL_ENTRIES.some(e => e.project === p.projectName && e.empId === GANTT_FILTER_EMPLOYEE && e.status !== 'Leave');
      if (!worked) return false;
    }
    return true;
  }).reverse(); 
}

function renderGanttShell(content) {
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--txt1);">📊 Project Timeline</div>
        <div style="font-size:12px;color:var(--txt2);">When each project existed and was active — click a bar for full details.</div>
      </div>
      <div id="ganttTotalViewsBadge" style="background:var(--elevated);border:1px solid var(--border-md);border-radius:8px;
        padding:6px 14px;text-align:center;">
        <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Total Number of Views</div>
        <div style="font-size:16px;font-weight:800;color:var(--a1);">0</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <button id="ganttZoomOut" class="cp-nav-btn" title="Zoom out">−</button>
        <button id="ganttZoomIn"  class="cp-nav-btn" title="Zoom in">+</button>
        <button id="ganttFitAll"  style="background:var(--elevated);color:var(--txt1);border:1px solid var(--border-md);
          border-radius:6px;padding:6px 12px;font-size:11.5px;font-weight:600;cursor:pointer;">Fit All</button>
        <button id="ganttToday"   style="background:var(--elevated);color:var(--txt1);border:1px solid var(--border-md);
          border-radius:6px;padding:6px 12px;font-size:11.5px;font-weight:600;cursor:pointer;">Today</button>
      </div>
    </div>

    <div id="ganttFilterWrap">${renderFilters()}</div>

    <div id="ganttBodyWrap" style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
      overflow:hidden;position:relative;"></div>

    <div style="margin-top:8px;font-size:11px;color:var(--txt2);display:flex;gap:14px;flex-wrap:wrap;align-items:center;">
      <span>🎨 <b style="color:var(--txt1);">Project Colors</b> — each bar color represents an individual project (hover a project for full details)</span>
      <span>📐 Each month block shows effort-weighted <b style="color:var(--txt1);">Views Delivered</b> — hover a block for the full monthly breakdown</span>
      <span>🟢 Active · 🔵 Completed · 🟠 On Hold</span>
      <span><span style="display:inline-block;width:2px;height:9px;background:#f87171;margin-right:5px;"></span>Today</span>
    </div>
  `;

  wireFilters(content);
  $('ganttZoomOut').addEventListener('click', () => zoomOut());
  $('ganttZoomIn').addEventListener('click', () => zoomIn());
  $('ganttFitAll').addEventListener('click', () => fitAll());
  $('ganttToday').addEventListener('click', () => scrollToToday());

  renderTimeline();

  requestAnimationFrame(() => fitAll());
}

function renderFilters() {
  const clientProjects = GANTT_FILTER_CLIENT
    ? GANTT_PROJECTS.filter(p => p.clientId === GANTT_FILTER_CLIENT)
    : GANTT_PROJECTS;

  const employeesWithActivity = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : [])
    .filter(e => GANTT_ALL_ENTRIES.some(en => en.empId === e.id && en.status !== 'Leave'));

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:.6rem;">
      <select id="ganttFilterClient" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
        color:var(--txt1);font-size:12px;padding:6px 8px;cursor:pointer;">
        <option value="">All Clients</option>
        ${GANTT_CLIENTS.map(c => `<option value="${esc(c.id)}" ${c.id === GANTT_FILTER_CLIENT ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
      </select>
      <select id="ganttFilterProject" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
        color:var(--txt1);font-size:12px;padding:6px 8px;cursor:pointer;">
        <option value="">All Projects</option>
        ${clientProjects.map(p => `<option value="${esc(p.projectId)}" ${p.projectId === GANTT_FILTER_PROJECT ? 'selected' : ''}>${esc(p.projectName)}</option>`).join('')}
      </select>
      <select id="ganttFilterEmployee" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
        color:var(--txt1);font-size:12px;padding:6px 8px;cursor:pointer;">
        <option value="">All Employees</option>
        ${employeesWithActivity.map(e => `<option value="${esc(e.id)}" ${e.id === GANTT_FILTER_EMPLOYEE ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
      </select>
    </div>
  `;
}

function wireFilters(content) {
  content.querySelector('#ganttFilterClient').addEventListener('change', e => filterByClient(e.target.value));
  content.querySelector('#ganttFilterProject').addEventListener('change', e => filterByProject(e.target.value));
  content.querySelector('#ganttFilterEmployee').addEventListener('change', e => filterByEmployee(e.target.value));
}

function filterByClient(clientId) {
  GANTT_FILTER_CLIENT  = clientId;
  GANTT_FILTER_PROJECT = ''; 
  refreshGantt();
}
function filterByProject(projectId) {
  GANTT_FILTER_PROJECT = projectId;
  refreshGantt();
}
function filterByEmployee(empId) {
  GANTT_FILTER_EMPLOYEE = empId;
  refreshGantt();
}

function refreshGantt() {
  if (!GANTT_CONTAINER) return;
  const filterHost = $('ganttFilterWrap');
  if (filterHost) {
    filterHost.innerHTML = renderFilters();
    wireFilters(GANTT_CONTAINER);
  }
  renderTimeline();
}

function renderTimeline() {
  const wrap = $('ganttBodyWrap');
  if (!wrap || !GANTT_TIMELINE) return;

  const projects = getFilteredGanttProjects();
  const months = GANTT_TIMELINE.months;
  const totalWidth = months.length * GANTT_MONTH_WIDTH;
  const bodyHeight = Math.min(projects.length * GANTT_ROW_HEIGHT, 560);

  const yearGroups = [];
  months.forEach((m, i) => {
    const last = yearGroups[yearGroups.length - 1];
    if (last && last.year === m.year) last.count++;
    else yearGroups.push({ year: m.year, count: 1 });
  });

  const monthTotals = months.map(m =>
    projects.reduce((s, p) => s + getMonthlyViewsDelivered(p, m.key).views, 0)
  );
  const TOTAL_ROW_HEIGHT = 26;

  const grandTotal = projects.reduce((s, p) => s + (parseFloat(p.completedViews) || 0), 0);
  const badgeVal = document.querySelector('#ganttTotalViewsBadge > div:last-child');
  if (badgeVal) badgeVal.textContent = grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 1 });

  wrap.innerHTML = `
    <div id="ganttScroll" style="overflow:auto;max-height:${bodyHeight + GANTT_HEADER_HEIGHT + TOTAL_ROW_HEIGHT}px;position:relative;">
      <div style="width:${GANTT_LABEL_WIDTH + totalWidth}px;">

        <!-- Header: corner + year row + month row -->
        <div style="display:flex;position:sticky;top:0;z-index:3;">
          <div style="position:sticky;left:0;top:0;width:${GANTT_LABEL_WIDTH}px;flex-shrink:0;height:${GANTT_HEADER_HEIGHT}px;
            background:var(--surface2);border-right:1px solid var(--border);border-bottom:1px solid var(--border);z-index:4;
            display:flex;align-items:center;padding:0 12px;font-size:10.5px;color:var(--txt2);text-transform:uppercase;
            letter-spacing:.04em;">Client / Project</div>
          <div>
            <div style="display:flex;height:20px;">
              ${yearGroups.map(g => `<div style="width:${g.count * GANTT_MONTH_WIDTH}px;flex-shrink:0;background:var(--surface2);
                border-right:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;align-items:center;
                justify-content:center;font-size:10px;font-weight:700;color:var(--txt1);">${g.year}</div>`).join('')}
            </div>
            <div style="display:flex;height:${GANTT_HEADER_HEIGHT - 20}px;">
              ${months.map(m => `<div style="width:${GANTT_MONTH_WIDTH}px;flex-shrink:0;background:var(--surface2);
                border-right:1px solid var(--border);border-bottom:1px solid var(--border);display:flex;align-items:center;
                justify-content:center;font-size:9px;color:var(--txt2);white-space:nowrap;overflow:hidden;">${GANTT_MONTH_WIDTH > 20 ? m.label : ''}</div>`).join('')}
            </div>
          </div>
        </div>

        <!-- Total row — sum of Views Delivered per month, across
             every currently-visible project. Sticky just below the
             header so it stays visible while scrolling down through
             many project rows. -->
        <div style="display:flex;position:sticky;top:${GANTT_HEADER_HEIGHT}px;z-index:3;">
          <div style="position:sticky;left:0;width:${GANTT_LABEL_WIDTH}px;flex-shrink:0;height:${TOTAL_ROW_HEIGHT}px;
            background:var(--surface2);border-right:1px solid var(--border);border-bottom:2px solid var(--border-md);z-index:4;
            display:flex;align-items:center;padding:0 12px;font-size:10.5px;font-weight:700;color:var(--txt1);">Total</div>
          <div style="display:flex;">
            ${months.map((m, i) => `<div style="width:${GANTT_MONTH_WIDTH}px;flex-shrink:0;height:${TOTAL_ROW_HEIGHT}px;
              background:var(--surface2);border-right:1px solid var(--border);border-bottom:2px solid var(--border-md);
              display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:var(--a1);
              white-space:nowrap;overflow:hidden;">${monthTotals[i] > 0 && GANTT_MONTH_WIDTH >= 26 ? monthTotals[i].toFixed(1) : ''}</div>`).join('')}
          </div>
        </div>

        <!-- Rows -->
        <div id="ganttRows" style="position:relative;">
          ${projects.length === 0
            ? `<div style="padding:2rem;text-align:center;color:var(--txt2);font-size:12.5px;">No projects match these filters.</div>`
            : projects.map(p => buildGanttRow(p)).join('')}
          ${drawTodayMarker(projects.length)}
        </div>
      </div>
    </div>
  `;

  drawProjectBars(projects);
  wireGanttRows(projects);
  wireGanttPanAndWheel();
}

function buildGanttRow(p) {

  const monthGridBg = `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${GANTT_MONTH_WIDTH}px)`;
  return `
    <div class="gantt-row" data-project-id="${esc(p.projectId)}" style="display:flex;height:${GANTT_ROW_HEIGHT}px;
      border-bottom:1px solid var(--border);cursor:pointer;">
      <div style="position:sticky;left:0;width:${GANTT_LABEL_WIDTH}px;flex-shrink:0;background:var(--surface1);
        border-right:1px solid var(--border);z-index:2;padding:2px 12px;display:flex;flex-direction:column;
        justify-content:center;overflow:hidden;">
        <div style="font-size:10px;line-height:11px;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.clientName)}</div>
        <div style="font-size:11px;line-height:12px;font-weight:700;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${esc(p.projectName)} <span style="font-size:7px;" title="${esc(p.statusLabel)}">${p.statusDot}</span>
        </div>
        <div style="font-size:8.5px;line-height:10px;color:var(--txt2);font-family:var(--fm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.projectId)}</div>
      </div>
      <div class="gantt-row-bar-track" style="position:relative;flex:1;background-image:${monthGridBg};"></div>
    </div>`;
}

function drawProjectBars(projects) {
  const rows = document.querySelectorAll('#ganttRows .gantt-row');
  const GAP = 3; 

  const MIN_WIDTH_FOR_LABEL = 30;

  rows.forEach(row => {
    const projectId = row.dataset.projectId;
    const p = projects.find(x => x.projectId === projectId);
    if (!p) return;
    const track = row.querySelector('.gantt-row-bar-track');
    if (!track) return;

    const startKey = p.startDate.slice(0, 7);
    const endKey   = p.lastActivity.slice(0, 7);

    const startIdx = monthIndexOf(startKey);
    const endIdx   = monthIndexOf(endKey);
    if (startIdx === -1 || endIdx === -1) return;

    for (let i = startIdx; i <= endIdx; i++) {
      const monthKey = GANTT_TIMELINE.months[i]?.key;
      if (!monthKey || !p.activeMonths || !p.activeMonths.has(monthKey)) continue; 

      const left  = i * GANTT_MONTH_WIDTH + GAP / 2;
      const width = Math.max(GANTT_MONTH_WIDTH - GAP, 4);

      const { hours, views } = getMonthlyViewsDelivered(p, monthKey);
      const showLabel = width >= MIN_WIDTH_FOR_LABEL && hours > 0;

      const seg = document.createElement('div');
      seg.className = 'gantt-bar';
      seg.dataset.projectId = p.projectId;
      seg.dataset.monthKey = monthKey;
      seg.style.cssText = `position:absolute;left:${left}px;top:8px;width:${width}px;height:${GANTT_ROW_HEIGHT - 16}px;
        background:${p.barColor};--gantt-glow:${p.barColor};display:flex;flex-direction:column;align-items:center;
        justify-content:center;overflow:hidden;line-height:1.1;`;
      if (showLabel) {
        seg.innerHTML = `
          <span style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);white-space:nowrap;pointer-events:none;">${views.toFixed(1)} Views</span>`;
      }
      track.appendChild(seg);
    }
  });
}

function drawTodayMarker(projectCount) {
  const tod = todayStr().slice(0, 7);
  const idx = monthIndexOf(tod);
  if (idx === -1) return '';
  const left = GANTT_LABEL_WIDTH + idx * GANTT_MONTH_WIDTH + GANTT_MONTH_WIDTH / 2;
  const height = Math.max(projectCount * GANTT_ROW_HEIGHT, GANTT_ROW_HEIGHT);
  return `
    <div style="position:absolute;left:${left}px;top:0;width:2px;height:${height}px;background:#f87171;z-index:1;pointer-events:none;">
      <div style="position:absolute;top:-2px;left:4px;font-size:9px;font-weight:700;color:#f87171;white-space:nowrap;">TODAY</div>
    </div>`;
}

function wireGanttRows(projects) {
  document.querySelectorAll('#ganttRows .gantt-row').forEach(row => {
    const p = projects.find(x => x.projectId === row.dataset.projectId);
    if (!p) return;

    row.addEventListener('mouseenter', e => showGanttTooltip(e, p));
    row.addEventListener('mousemove', e => positionGanttTooltip(e));
    row.addEventListener('mouseleave', hideGanttTooltip);
    row.addEventListener('click', () => openGanttProjectDetail(p.projectId));

    row.querySelectorAll('.gantt-bar').forEach(seg => {
      seg.addEventListener('mouseenter', e => { e.stopPropagation(); showGanttSegmentTooltip(e, p, seg.dataset.monthKey); });
      seg.addEventListener('mousemove', e => { e.stopPropagation(); positionGanttTooltip(e); });
      seg.addEventListener('mouseleave', e => { e.stopPropagation(); showGanttTooltip(e, p); });
    });
  });
}

function showGanttSegmentTooltip(evt, p, monthKey) {
  hideGanttTooltip();
  const { hours, weight, views } = getMonthlyViewsDelivered(p, monthKey);
  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const tip = document.createElement('div');
  tip.id = 'ganttTooltip';
  tip.style.cssText = `position:fixed;z-index:10001;background:var(--surface1);border:1px solid var(--border-md);
    border-radius:10px;padding:10px 12px;font-size:11.5px;color:var(--txt1);box-shadow:0 8px 24px rgba(0,0,0,.4);
    max-width:260px;pointer-events:none;`;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${esc(p.projectName)}</div>
    <div style="color:var(--txt2);margin-bottom:6px;">${esc(monthLabel)}</div>
    <div>Views Delivered: <b>${views.toFixed(1)}</b></div>
    <div>Contribution: <b>${(weight * 100).toFixed(1)}%</b></div>
  `;
  document.body.appendChild(tip);
  positionGanttTooltip(evt);
}

async function showGanttTooltip(evt, p) {
  hideGanttTooltip();
  const tip = document.createElement('div');
  tip.id = 'ganttTooltip';
  tip.style.cssText = `position:fixed;z-index:10001;background:var(--surface1);border:1px solid var(--border-md);
    border-radius:10px;padding:10px 12px;font-size:11.5px;color:var(--txt1);box-shadow:0 8px 24px rgba(0,0,0,.4);
    max-width:260px;pointer-events:none;`;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:4px;">${esc(p.projectName)} <span style="font-size:9px;">${p.statusDot}</span></div>
    <div style="color:var(--txt2);margin-bottom:6px;">${esc(p.clientName)} · ${esc(p.projectId)} · ${esc(p.statusLabel)}</div>
    <div>Start: <b>${esc(fmtGanttDate(p.startDate))}</b></div>
    <div>Latest Activity: <b>${esc(fmtGanttDate(p.lastActivity))}</b></div>
    <div>Total Hours: <b>${p.totalHours.toFixed(1)}h</b></div>
    <div>Total Employees: <b>${p.employeeCount}</b></div>
    <div id="ganttTipCost">Cost/Profit: <b>Loading…</b></div>
  `;
  document.body.appendChild(tip);
  positionGanttTooltip(evt);

  if (GANTT_COST_CACHE[p.projectId] === undefined) {
    try {
      GANTT_COST_CACHE[p.projectId] = await ClientProjectAPI.computeProjectCost(p.projectId);
    } catch (e) {
      GANTT_COST_CACHE[p.projectId] = null;
    }
  }
  const costEl = document.getElementById('ganttTipCost');
  if (!costEl) return; 
  const cost = GANTT_COST_CACHE[p.projectId];
  if (!cost) { costEl.innerHTML = `Cost/Profit: <b>—</b>`; return; }
  const isProfit = cost.profit >= 0;
  costEl.innerHTML = `Cost: <b>${cost.totalCost.toFixed(1)}</b> · ${isProfit ? 'Profit' : 'Loss'}: 
    <b style="color:${isProfit ? '#34d399' : '#f87171'};">${isProfit ? '+' : '-'}${Math.abs(cost.profit).toFixed(1)}</b>`;
}

function positionGanttTooltip(evt) {
  const tip = document.getElementById('ganttTooltip');
  if (!tip) return;
  const pad = 14;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + 260 > window.innerWidth) x = evt.clientX - 260 - pad;
  if (y + 140 > window.innerHeight) y = evt.clientY - 140 - pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideGanttTooltip() {
  document.getElementById('ganttTooltip')?.remove();
}

function fmtGanttDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function openGanttProjectDetail(projectId) {

  hideGanttTooltip();

  const portalRoot = GANTT_CONTAINER.closest('#mgrApp, #tlApp');
  const portalId    = portalRoot ? portalRoot.id : 'mgrApp';
  const tabContent  = portalRoot ? portalRoot.querySelector('#mgrTabContent, #tlTabContent') : GANTT_CONTAINER;
  if (typeof openProjectDetail !== 'function') { toast?.('e', 'Project Detail module not loaded'); return; }
  openProjectDetail(tabContent, projectId, {
    containerId: portalId,
    onBack: () => initGantt(tabContent),
  });
}

function zoomIn()  { setGanttMonthWidth(GANTT_MONTH_WIDTH + 8); }
function zoomOut() { setGanttMonthWidth(GANTT_MONTH_WIDTH - 8); }

function setGanttMonthWidth(px) {
  GANTT_MONTH_WIDTH = Math.max(GANTT_MONTH_WIDTH_MIN, Math.min(GANTT_MONTH_WIDTH_MAX, px));
  renderTimeline();
}

function fitAll() {
  const scrollEl = $('ganttBodyWrap');
  if (!scrollEl || !GANTT_TIMELINE) return;
  const availableWidth = Math.max(scrollEl.clientWidth - GANTT_LABEL_WIDTH, 100);

  const realEarliest  = findEarliestProject();
  const realStartIdx  = realEarliest ? monthIndexOf(realEarliest.slice(0, 7)) : -1;
  const todayIdx      = monthIndexOf(todayStr().slice(0, 7));
  const hasRealRange  = realStartIdx !== -1 && todayIdx !== -1 && todayIdx >= realStartIdx;

  const monthCount = hasRealRange
    ? Math.max(todayIdx - realStartIdx + 1, 1)
    : Math.max(GANTT_TIMELINE.months.length, 1); 

  const idealWidth = Math.floor(availableWidth / monthCount);
  GANTT_MONTH_WIDTH = Math.max(GANTT_MONTH_WIDTH_FIT_MIN, Math.min(GANTT_MONTH_WIDTH_MAX, idealWidth));
  renderTimeline();

  if (hasRealRange) {
    requestAnimationFrame(() => {
      const scroller = $('ganttScroll');
      if (scroller) scroller.scrollLeft = Math.max(realStartIdx * GANTT_MONTH_WIDTH - 20, 0);
    });
  }
}

function scrollToToday() {
  const scroller = $('ganttScroll');
  if (!scroller || !GANTT_TIMELINE) return;
  const idx = monthIndexOf(todayStr().slice(0, 7));
  if (idx === -1) return;
  const targetLeft = idx * GANTT_MONTH_WIDTH - (scroller.clientWidth - GANTT_LABEL_WIDTH) / 2;
  requestAnimationFrame(() => { scroller.scrollLeft = Math.max(targetLeft, 0); });
}

function wireGanttPanAndWheel() {
  const scroller = $('ganttScroll');
  if (!scroller) return;

  let isDragging = false, startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;

  scroller.addEventListener('mousedown', e => {
    if (e.target.closest('.gantt-bar') || e.target.closest('select')) return; 
    isDragging = true;
    startX = e.clientX; startY = e.clientY;
    startScrollLeft = scroller.scrollLeft; startScrollTop = scroller.scrollTop;
    scroller.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    requestAnimationFrame(() => {
      scroller.scrollLeft = startScrollLeft - (e.clientX - startX);
      scroller.scrollTop  = startScrollTop  - (e.clientY - startY);
    });
  });
  window.addEventListener('mouseup', () => { isDragging = false; scroller.style.cursor = ''; });

  scroller.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroller.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
}
