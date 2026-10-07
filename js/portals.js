// MANAGER
let MGR_DATA           = [];
let MGR_EMPLOYEES      = [];

let MGR_TAB            = 'dashboard'; 
let MGR_RANGE          = 'week';
let MGR_DAY_OFFSET     = 0;
let MGR_SELECTED_MONTH = '';

let MGR_TS_RANGE          = 'day15';
let MGR_TS_DAY_OFFSET     = 0;
let MGR_TS_SELECTED_MONTH = '';
let MGR_TS_MONTH_DAY      = ''; 
let MGR_TS_EMP_FILTER     = '';
let MGR_TS_SEARCH         = '';
let MGR_TS_PAGE           = 0;
const MGR_TS_PAGE_SIZE    = 10; 

const MGR_PALETTE = [
  '#4f8ef7','#7c5cfc','#34d399','#fbbf24',
  '#5eead4','#22d3ee','#fb923c','#a78bfa',
  '#f472b6','#84cc16','#38bdf8','#4ade80',
];

async function initManager() {
  const container = $('mgrApp');
  if (!container) return;
  const session = APP_SESSION;
  container.innerHTML = '<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading team data…</span></div>';
  try {
    const data = await apiGetTeamData({ fresh: true });
    if (session !== APP_SESSION) return;
    MGR_EMPLOYEES = data.employees; MGR_DATA = data.entries;
    MGR_SELECTED_MONTH = todayStr().slice(0,7); MGR_TS_SELECTED_MONTH = MGR_SELECTED_MONTH;
    ClientProjectAPI.ingestMasterData(data);
    ClientProjectAPI.ingestTimesheetData(data.entries);
    renderManagerPortal();
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(container, 'Could not load team data: ' + error.message, initManager);
  }
}

function renderManagerPortal() {
  const container = $('mgrApp');
  if (!container) return;

  container.innerHTML = `
    <!-- Top nav tabs -->
    <div style="display:flex;gap:4px;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0;">
      ${[
        { id:'dashboard', icon:'🏠', label:'Dashboard' },
        { id:'project',   icon:'📁', label:'Projects & Clients' },
        { id:'employees', icon:'👥', label:'Employees' },
        { id:'timesheet', icon:'🕐', label:'Timesheet' },
        { id:'attendance',icon:'🕒', label:'Attendance' },
        { id:'timeline',   icon:'📊', label:'Project Timeline' },
        { id:'salary',    icon:'💼', label:'Salary'    },
      ].map(t => `
        <button class="mgr-tab${MGR_TAB===t.id?' active':''}" data-tab="${t.id}" style="
          padding:8px 16px;border:none;background:none;cursor:pointer;
          font-size:13px;font-weight:600;
          color:${MGR_TAB===t.id ? 'var(--a1)' : 'var(--txt2)'};
          border-bottom:2px solid ${MGR_TAB===t.id ? 'var(--a1)' : 'transparent'};
          margin-bottom:-1px;transition:all .2s;
        ">${t.icon} ${t.label}</button>
      `).join('')}
    </div>
    <div id="mgrTabContent"></div>
  `;

  container.querySelectorAll('.mgr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      MGR_TAB = btn.dataset.tab;
      container.querySelectorAll('.mgr-tab').forEach(b => {
        const active = b === btn;
        b.style.color       = active ? 'var(--a1)' : 'var(--txt2)';
        b.style.borderBottom= active ? '2px solid var(--a1)' : '2px solid transparent';
      });
      renderMgrTab();
    });
  });

  renderMgrTab();
}

function renderMgrTab() {
  const content = $('mgrTabContent');
  if (!content) return;

  if (MGR_TAB === 'dashboard') {
    if (typeof renderManagerDashboard === 'function') renderManagerDashboard(content);
    else content.innerHTML = `<div class="chart-empty">Dashboard module (dashboard.js) is not loaded.</div>`;
    return;
  }

  if (MGR_TAB === 'project') {
    if (typeof renderProjectTab === 'function') renderProjectTab(content);
    else content.innerHTML = `<div class="chart-empty">Project module (client-project.js) is not loaded.</div>`;
    return;
  }

  if (MGR_TAB === 'employees') { renderEmployeesTab(content); return; }

  if (MGR_TAB === 'timesheet') { renderMgrTimesheetTab(content); return; }

  if (MGR_TAB === 'attendance') {
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab(content);
    else content.innerHTML = `<div class="chart-empty">Attendance module (client-project.js) is not loaded.</div>`;
    return;
  }

  if (MGR_TAB === 'timeline') {
    if (typeof initGantt === 'function') initGantt(content);
    else content.innerHTML = `<div class="chart-empty">Project Timeline module (gantt.js) is not loaded.</div>`;
    return;
  }

  if (MGR_TAB === 'salary') {
    if (typeof renderSalaryTab === 'function') renderSalaryTab(content);
    else content.innerHTML = `<div class="chart-empty">Salary module (salary.js) is not loaded.</div>`;
    return;
  }

}

function renderEmployeesTab(content) {
  const filtered = getMgrFiltered();
  const worked   = filtered.filter(isWorkedEntry);
  const totHours = calcHours(worked);

  content.innerHTML = `
    <!-- Summary strip -->
    <div class="strip" style="margin-bottom:1.25rem">
      <div class="sitem"><span class="slbl">Total Hours</span><span class="sval hi" id="mTot">${fh(totHours)}</span></div>
      <div class="sitem"><span class="slbl">Employees</span><span class="sval" id="mEmpCnt">${new Set(filtered.map(e=>e.empId)).size}</span></div>
      <div class="sitem"><span class="slbl">Active Projects</span><span class="sval" id="mProjCnt">${new Set(worked.filter(e=>e.project).map(e=>e.project)).size}</span></div>
      <div class="sitem"><span class="slbl">Clients</span><span class="sval" id="mCliCnt">${new Set(worked.filter(e=>e.client&&e.client!=='Leave').map(e=>e.client)).size}</span></div>
    </div>

    <!-- Range controls -->
    <div class="mgr-controls">
      <div class="chart-range" id="mgrRange">
        <button class="rbtn${MGR_RANGE==='day15'?' active':''}"  data-range="day15">15 Days</button>
        <button class="rbtn${MGR_RANGE==='week'?' active':''}"   data-range="week">This Week</button>
        <button class="rbtn${MGR_RANGE==='month'?' active':''}"  data-range="month">This Month</button>
        <button class="rbtn${MGR_RANGE==='all'?' active':''}"    data-range="all">All Time</button>
      </div>
    </div>

    <!-- 15-day scroll -->
    <div id="mgrDayScroll" style="display:${MGR_RANGE==='day15'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;"></div>

    <!-- Month picker -->
    <div id="mgrMonthPicker" style="display:${MGR_RANGE==='month'?'flex':'none'};
      gap:8px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;"></div>

    <div id="mgrEmpContent"></div>
  `;

  $('mgrRange').addEventListener('click', e => {
    const btn = e.target.closest('.rbtn');
    if (!btn) return;
    MGR_RANGE = btn.dataset.range;
    MGR_DAY_OFFSET = 0;
    $('mgrRange').querySelectorAll('.rbtn').forEach(b => b.classList.toggle('active', b===btn));
    $('mgrDayScroll').style.display   = MGR_RANGE === 'day15'  ? 'flex' : 'none';
    $('mgrMonthPicker').style.display = MGR_RANGE === 'month'  ? 'flex' : 'none';
    if (MGR_RANGE === 'day15')  buildDayScrollBar();
    if (MGR_RANGE === 'month')  buildMonthPicker();
    renderEmpContent();
  });

  if (MGR_RANGE === 'day15') buildDayScrollBar();
  if (MGR_RANGE === 'month') buildMonthPicker();
  renderEmpContent();
}

function renderEmpContent() {
  const content = $('mgrEmpContent');
  if (!content) return;
  const filtered = getMgrFiltered();
  const worked   = filtered.filter(isWorkedEntry);

  const mTot = $('mTot'); if (mTot) mTot.textContent = fh(calcHours(worked));
  const mEmpCnt  = $('mEmpCnt');  if (mEmpCnt)  mEmpCnt.textContent  = new Set(filtered.map(e=>e.empId)).size;
  const mProjCnt = $('mProjCnt'); if (mProjCnt) mProjCnt.textContent = new Set(worked.filter(e=>e.project).map(e=>e.project)).size;
  const mCliCnt  = $('mCliCnt');  if (mCliCnt)  mCliCnt.textContent  = new Set(worked.filter(e=>e.client&&e.client!=='Leave').map(e=>e.client)).size;

  renderEmpCards(content, worked, filtered);
}

function renderEmpCards(content, worked, all) {
  const empMap = {};
  MGR_EMPLOYEES.forEach((emp, idx) => {
    empMap[emp.id] = {
      id: emp.id, name: emp.name, team: emp.team, entryIndex: idx,
      hours: 0, days: new Set(), leaves: 0,
      projectMap: {}, missedDays: [],
      monthHours: 0, monthDays: 0, monthLeaves: 0, monthNotLogged: 0,
      monthProjectMap: {}, todayHours: 0, todayStatus: 'Working', lastActivityDate: '',
    };
  });

  worked.forEach(e => {
    if (!empMap[e.empId]) return;
    const h = parseH(e.hours);
    empMap[e.empId].hours += h;
    empMap[e.empId].days.add(e.date);
    if (e.project) empMap[e.empId].projectMap[e.project] = (empMap[e.empId].projectMap[e.project]||0) + h;
  });

  all.filter(e => e.status==='Leave').forEach(e => {
    if (empMap[e.empId]) { empMap[e.empId].leaves++; empMap[e.empId].days.add(e.date); }
  });

  const rangeDates = getWorkingDaysInRange();
  Object.values(empMap).forEach(emp => {
    emp.missedDays = rangeDates.filter(d => !emp.days.has(d));
  });

  const curMonth  = todayStr().slice(0,7);
  const tod       = todayStr();
  const todayDow  = new Date().getDay(); 

  const monthWorkingDaysSoFar = (() => {
    const [y, m] = curMonth.split('-').map(Number);
    const days = [];
    for (let d = 1; d <= new Date().getDate(); d++) {
      const dt = new Date(y, m - 1, d);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) continue;
      days.push(toLocalDateStr(dt));
    }
    return days;
  })();

  Object.values(empMap).forEach(emp => {
    const me = MGR_DATA.filter(e => e.empId === emp.id && e.date && e.date.startsWith(curMonth));
    const mw = me.filter(isWorkedEntry);
    emp.monthHours  = mw.reduce((s,e) => s + parseH(e.hours), 0);
    emp.monthDays   = new Set(mw.map(e => e.date)).size;

    emp.monthLeaves = new Set(me.filter(e => e.status === 'Leave').map(e => e.date)).size;

    mw.forEach(e => {
      if (e.project) emp.monthProjectMap[e.project] = (emp.monthProjectMap[e.project]||0) + parseH(e.hours);
    });

    const loggedDatesThisMonth = new Set(me.map(e => e.date));
    emp.monthNotLogged = monthWorkingDaysSoFar.filter(d => !loggedDatesThisMonth.has(d)).length;

    const todayEntries = MGR_DATA.filter(e => e.empId === emp.id && e.date === tod);
    const todayLeave    = todayEntries.some(e => e.status === 'Leave');
    const todayWorked   = todayEntries.filter(isWorkedEntry);
    emp.todayHours = todayWorked.reduce((s,e) => s + parseH(e.hours), 0);

    if (todayLeave)                              emp.todayStatus = 'Leave';
    else if (todayDow === 0 || todayDow === 6)   emp.todayStatus = 'Weekend';
    else                                          emp.todayStatus = 'Working';

    emp.lastActivityDate = MGR_DATA
      .filter(e => e.empId === emp.id)
      .reduce((max, e) => (e.date > max ? e.date : max), '');
  });

  const rows = Object.values(empMap).sort((a, b) => {
    if (a.lastActivityDate !== b.lastActivityDate) return b.lastActivityDate.localeCompare(a.lastActivityDate);
    return b.hours - a.hours;
  });
  if (!rows.length) { content.innerHTML = `<div class="chart-empty">No employees found.</div>`; return; }

  content.innerHTML = `
    <div style="margin-top:.5rem;">
      ${rows.map(emp => buildEmpCard(emp)).join('')}
    </div>`;

  content.querySelectorAll('.view-emp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openEmpDetail(btn.dataset.empId, btn.dataset.empName);
    });
  });
}

function buildEmpCard(emp) {
  const initials      = emp.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const monthProjects = Object.entries(emp.monthProjectMap).sort((a,b) => b[1]-a[1]);
  const curMonthLabel = new Date(todayStr().slice(0,7)+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  const STATUS_STYLE = {
    Working: { bg:'rgba(52,211,153,0.12)',  fg:'#34d399', label:'Working'  },
    Leave:   { bg:'rgba(251,191,36,0.12)',  fg:'#fbbf24', label:'On Leave' },
    Weekend: { bg:'rgba(124,92,252,0.12)',  fg:'#a78bfa', label:'Weekend'  },
  };
  const st = STATUS_STYLE[emp.todayStatus] || STATUS_STYLE.Working;

  const sliderHtml = monthProjects.length === 0
    ? `<div style="font-size:11px;color:var(--txt2);padding:6px 2px;">No projects logged this month</div>`
    : `<div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;">
        ${monthProjects.map(([proj,hrs],i) => `
          <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;
            background:var(--surface2);border:1px solid var(--border);border-radius:20px;
            padding:6px 12px;white-space:nowrap;">
            <span style="width:7px;height:7px;border-radius:50%;background:${MGR_PALETTE[i%MGR_PALETTE.length]};flex-shrink:0;"></span>
            <span style="font-size:11px;color:var(--txt1);font-weight:600;max-width:130px;
              overflow:hidden;text-overflow:ellipsis;" title="${esc(proj)}">${esc(proj)}</span>
            <span style="font-size:11px;color:var(--txt2);">— ${fh(hrs)}</span>
          </div>`).join('')}
      </div>`;

  return `
    <div class="emp-card" style="background:var(--surface1);
      border:1px solid var(--border);border-radius:14px;padding:1.1rem 1.3rem;margin-bottom:1.1rem;">

      <!-- Identity + status + quick stats + View Details, all in one row -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:20px;">
        <div style="display:flex;align-items:center;gap:10px;flex:0 0 auto;min-width:170px;">
          <div style="width:38px;height:38px;border-radius:50%;
            background:linear-gradient(135deg,var(--a1),#7c5cfc);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">${initials}</div>
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:14px;color:var(--txt1);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(emp.name)}</div>
            <div style="font-size:11px;color:var(--txt2);">${esc(emp.id)}</div>
          </div>
        </div>

        <span style="display:inline-flex;align-items:center;gap:5px;background:${st.bg};color:${st.fg};
          border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;flex-shrink:0;">
          <span style="width:6px;height:6px;border-radius:50%;background:${st.fg};"></span>${st.label}
        </span>

        <div style="display:flex;gap:22px;flex-wrap:wrap;flex:1;">
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Today</div>
            <div style="font-size:14px;font-weight:800;color:var(--txt1);">${fh(emp.todayHours)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">This Month</div>
            <div style="font-size:14px;font-weight:800;color:var(--a1);">${fh(emp.monthHours)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Leaves</div>
            <div style="font-size:14px;font-weight:800;color:#fbbf24;">${emp.monthLeaves}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Not Logged</div>
            <div style="font-size:14px;font-weight:800;color:${emp.monthNotLogged > 0 ? '#f87171' : 'var(--txt1)'};">${emp.monthNotLogged}</div>
          </div>
        </div>

        <button class="view-emp-btn" data-emp-id="${emp.id}" data-emp-name="${esc(emp.name)}"
          style="background:var(--a1);color:#fff;border:none;border-radius:6px;
            padding:8px 16px;font-size:11px;font-weight:600;cursor:pointer;
            white-space:nowrap;flex-shrink:0;">
          View Details →
        </button>
      </div>

      <!-- Projects -->
      <div style="margin-top:1rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
          <span style="font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;">Projects · ${esc(curMonthLabel)}</span>
          <span style="font-size:10px;color:var(--txt1);font-weight:700;background:var(--surface2);
            border-radius:10px;padding:2px 8px;">${monthProjects.length} total</span>
        </div>
        ${sliderHtml}
      </div>
    </div>`;
}

function getMgrTimesheetFiltered() {
  let rows;
  if (MGR_TS_RANGE === 'month') {
    rows = MGR_TS_MONTH_DAY
      ? MGR_DATA.filter(e => e.date === MGR_TS_MONTH_DAY)
      : MGR_DATA.filter(e => e.date.startsWith(MGR_TS_SELECTED_MONTH));
  } else {

    const d = getLast15Days()[MGR_TS_DAY_OFFSET];
    rows = MGR_DATA.filter(e => e.date === d);
  }

  if (MGR_TS_EMP_FILTER) rows = rows.filter(e => e.empId === MGR_TS_EMP_FILTER);

  if (MGR_TS_SEARCH) {
    const q = MGR_TS_SEARCH.toLowerCase();
    rows = rows.filter(e =>
      [e.empName, e.project, e.client, e.task, e.notes].some(v => v && String(v).toLowerCase().includes(q))
    );
  }

  return rows;
}

const MGR_TS_RANGE_COLORS = {
  day15: { bg: 'linear-gradient(135deg,#4f8ef7,#38bdf8)', fg: '#4f8ef7' },
  month: { bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', fg: '#f59e0b' },
};

function renderMgrTimesheetTab(content) {
  content.innerHTML = `
    <div class="mgr-controls">
      <div style="display:flex;gap:6px;flex-wrap:wrap;" id="mgrTsRange">
        ${[
          { id:'day15', label:'📅 15 Days' },
          { id:'month', label:'📆 This Month' },
        ].map(r => {
          const active = MGR_TS_RANGE === r.id;
          const c = MGR_TS_RANGE_COLORS[r.id];
          return `<button class="mgr-ts-rbtn" data-range="${r.id}" style="padding:7px 14px;border-radius:20px;
            border:1px solid ${active ? 'transparent' : 'var(--border-md)'};
            background:${active ? c.bg : 'var(--surface2)'};
            color:${active ? '#fff' : 'var(--txt2)'};
            font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s;">${r.label}</button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="mgrTsEmpFilter" class="filt">
          <option value="">All Employees</option>
          ${MGR_EMPLOYEES.filter(emp => emp.active).map(emp => `<option value="${esc(emp.id)}" ${MGR_TS_EMP_FILTER===emp.id?'selected':''}>${esc(emp.name)}</option>`).join('')}
        </select>
        <input type="search" id="mgrTsSearch" class="srch" placeholder="Search project, notes…" value="${esc(MGR_TS_SEARCH)}"/>
      </div>
    </div>

    <div id="mgrTsDayScroll" style="display:${MGR_TS_RANGE==='day15'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;min-width:0;"></div>

    <div id="mgrTsMonthPicker" style="display:${MGR_TS_RANGE==='month'?'flex':'none'};
      gap:8px;margin-bottom:1rem;align-items:center;min-width:0;"></div>

    <div id="mgrTsMonthDayScroll" style="display:${MGR_TS_RANGE==='month'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;min-width:0;"></div>

    <div id="mgrTsContent"></div>
  `;

  $('mgrTsRange').addEventListener('click', e => {
    const btn = e.target.closest('.mgr-ts-rbtn');
    if (!btn) return;
    MGR_TS_RANGE = btn.dataset.range;
    MGR_TS_DAY_OFFSET = 0;
    MGR_TS_MONTH_DAY = '';
    MGR_TS_PAGE = 0;
    renderMgrTimesheetTab(content); 
  });

  $('mgrTsEmpFilter').addEventListener('change', e => {
    MGR_TS_EMP_FILTER = e.target.value;
    MGR_TS_PAGE = 0;
    renderMgrTsContent();
  });

  $('mgrTsSearch').addEventListener('input', e => {
    MGR_TS_SEARCH = e.target.value;
    MGR_TS_PAGE = 0;
    renderMgrTsContent();
  });

  if (MGR_TS_RANGE === 'day15') buildMgrTsDayScrollBar();
  if (MGR_TS_RANGE === 'month') { buildMgrTsMonthPicker(); buildMgrTsMonthDayScrollBar(); }
  renderMgrTsContent();
}

function buildMgrTsDayScrollBar() {
  const bar = $('mgrTsDayScroll'); if (!bar) return;
  const days = getLast15Days();
  bar.innerHTML = days.map((d,i) => {
    const isActive  = i===MGR_TS_DAY_OFFSET;
    const isWeekend = new Date(d+'T00:00:00').getDay()%6===0;

    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : fmtDateShort(d);
    return `<button data-offset="${i}" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
      border:1px solid ${isActive?'transparent':'var(--border)'};
      background:${isActive?'linear-gradient(135deg,#4f8ef7,#38bdf8)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">${label}</button>`;
  }).join('');
  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      MGR_TS_DAY_OFFSET = parseInt(btn.dataset.offset);
      MGR_TS_PAGE = 0;
      buildMgrTsDayScrollBar();
      renderMgrTsContent();
    });
  });

  if (!bar.dataset.wheelWired) {
    bar.dataset.wheelWired = '1';
    bar.addEventListener('wheel', e => {
      if (e.deltaY === 0) return; 
      e.preventDefault();
      bar.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

function stepMgrTsMonth(dir) {
  const [y, m] = MGR_TS_SELECTED_MONTH.split('-').map(Number);
  const next = new Date(y, (m - 1) + dir, 1);
  const nextVal = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  if (nextVal > todayStr().slice(0, 7)) return; 
  MGR_TS_SELECTED_MONTH = nextVal;
  MGR_TS_MONTH_DAY = ''; 
  MGR_TS_PAGE = 0;
  buildMgrTsMonthPicker();
  buildMgrTsMonthDayScrollBar();
  renderMgrTsContent();
}

function buildMgrTsMonthPicker() {
  const picker = $('mgrTsMonthPicker'); if (!picker) return;
  const isCurrentMonth = MGR_TS_SELECTED_MONTH >= todayStr().slice(0, 7);

  picker.innerHTML = `
    <button id="mgrTsMonthPrev" class="pbtn" title="Previous month">‹</button>
    <input type="month" id="mgrTsMonthInput" value="${esc(MGR_TS_SELECTED_MONTH)}" max="${esc(todayStr().slice(0,7))}"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
      color:var(--txt1);font-size:13px;padding:8px 12px;cursor:pointer;"/>
    <button id="mgrTsMonthNext" class="pbtn" ${isCurrentMonth ? 'disabled' : ''} title="Next month">›</button>`;

  const input = $('mgrTsMonthInput');
  input.addEventListener('change', e => {
    MGR_TS_SELECTED_MONTH = e.target.value || todayStr().slice(0,7);
    MGR_TS_MONTH_DAY = ''; 
    MGR_TS_PAGE = 0;
    buildMgrTsMonthPicker();
    buildMgrTsMonthDayScrollBar();
    renderMgrTsContent();
  });

  $('mgrTsMonthPrev').addEventListener('click', () => stepMgrTsMonth(-1));
  $('mgrTsMonthNext').addEventListener('click', () => stepMgrTsMonth(1));

  input.addEventListener('wheel', e => {
    e.preventDefault();
    stepMgrTsMonth(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}

function buildMgrTsMonthDayScrollBar() {
  const bar = $('mgrTsMonthDayScroll'); if (!bar) return;

  const [y, m] = MGR_TS_SELECTED_MONTH.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayStr();
  const isCurrentMonth = MGR_TS_SELECTED_MONTH === today.slice(0, 7);
  const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth; 

  const allChip = `<button data-day="" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
    border:1px solid ${!MGR_TS_MONTH_DAY?'transparent':'var(--border)'};
    background:${!MGR_TS_MONTH_DAY?'linear-gradient(135deg,#f59e0b,#fbbf24)':'var(--surface2)'};
    color:${!MGR_TS_MONTH_DAY?'#fff':'var(--txt1)'};
    font-size:11px;font-weight:${!MGR_TS_MONTH_DAY?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">All Month</button>`;

  const dayChips = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${MGR_TS_SELECTED_MONTH}-${String(d).padStart(2,'0')}`;
    const isActive  = MGR_TS_MONTH_DAY === dateStr;
    const weekday   = new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
    const isWeekend = new Date(dateStr+'T00:00:00').getDay() % 6 === 0;
    const isToday   = dateStr === today;
    const label     = isToday ? 'Today' : `${weekday} ${d}`;
    dayChips.push(`<button data-day="${dateStr}" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
      border:1px solid ${isActive?'transparent':isToday?'#4f8ef7':'var(--border)'};
      background:${isActive?'linear-gradient(135deg,#f59e0b,#fbbf24)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">${label}</button>`);
  }

  bar.innerHTML = allChip + dayChips.join('');

  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      MGR_TS_MONTH_DAY = btn.dataset.day;
      MGR_TS_PAGE = 0;
      buildMgrTsMonthDayScrollBar();
      renderMgrTsContent();
    });
  });

  if (!bar.dataset.wheelWired) {
    bar.dataset.wheelWired = '1';
    bar.addEventListener('wheel', e => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      bar.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

function renderMgrTsContent() {
  const content = $('mgrTsContent');
  if (!content) return;

  const rows = getMgrTimesheetFiltered();

  const byDate = {};
  rows.forEach(e => {
    if (!e.date) return;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a)); 

  if (!dates.length) {
    content.innerHTML = `<div class="chart-empty">No timesheet entries for this range.</div>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(dates.length / MGR_TS_PAGE_SIZE));
  if (MGR_TS_PAGE >= totalPages) MGR_TS_PAGE = totalPages - 1;
  const pageDates = dates.slice(MGR_TS_PAGE * MGR_TS_PAGE_SIZE, (MGR_TS_PAGE + 1) * MGR_TS_PAGE_SIZE);

  content.innerHTML = `
    <div class="card" style="padding:1.25rem;">
      ${pageDates.map(d => buildMgrTsDateSection(d, byDate[d])).join('')}
    </div>
    <div id="mgrTsPager" style="margin-top:1rem;"></div>
  `;

  renderMgrTsPager(totalPages);

  if (!content.dataset.wired) {
    content.dataset.wired = '1';
    content.addEventListener('click', e => {
      const entryBtn = e.target.closest('.mgr-ts-force-entry');
      if (entryBtn) {
        openForceEntry(entryBtn.dataset.empId, entryBtn.dataset.empName, entryBtn.dataset.date, () => renderManagerPortal());
        return;
      }
      const leaveBtn = e.target.closest('.mgr-ts-force-leave');
      if (leaveBtn) {
        applyMgrTsForceLeave(leaveBtn, leaveBtn.dataset.empId, leaveBtn.dataset.empName, leaveBtn.dataset.date);
      }
    });
  }
}

async function applyMgrTsForceLeave(btn, empId, empName, dateStr) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = '…';
  try {
    await sheetGET({ action: 'forceLeave', data: encodeURIComponent(JSON.stringify({ uid: empId, date: dateStr })) });
    MGR_DATA.push({ empId, empName, date: dateStr, status: 'Leave', hours: '0h', slot: '', project: '', notes: 'Force leave applied by manager' });
    toast?.('s', 'Leave applied', `${empName} marked on leave for ${dateStr}`);
    renderMgrTsContent();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    toast?.('e', 'Failed', err.message);
  }
}

function mgrColorForKey(key) {
  const str = String(key || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return MGR_PALETTE[hash % MGR_PALETTE.length];
}

function buildMgrTsDateSection(dateStr, entries) {
  const dateLabel = new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN',
    { weekday:'long', day:'numeric', month:'short', year:'numeric' });
  const totalHours = calcHours(entries);
  const empCount = new Set(entries.map(e => e.empId)).size;

  const byEmp = {};
  entries.forEach(e => {
    if (!byEmp[e.empId]) byEmp[e.empId] = { empName: e.empName || e.empId, rows: [] };
    byEmp[e.empId].rows.push(e);
  });

  let displayEmpIds;
  if (MGR_TS_EMP_FILTER) {
    displayEmpIds = Object.keys(byEmp);
  } else {
    displayEmpIds = MGR_EMPLOYEES.filter(emp => emp.active).map(emp => emp.id);
    Object.keys(byEmp).forEach(id => { if (!displayEmpIds.includes(id)) displayEmpIds.push(id); }); 
  }

  const empNameFor = empId => {
    if (byEmp[empId]) return byEmp[empId].empName;
    const emp = MGR_EMPLOYEES.find(e => e.id === empId);
    return emp ? emp.name : empId;
  };

  const sortedEmpIds = displayEmpIds.slice().sort((a,b) => empNameFor(a).localeCompare(empNameFor(b)));

  const rowsHtml = sortedEmpIds.map(empId => {
    const empName  = empNameFor(empId);
    const empColor = mgrColorForKey(empName);
    const initials = empName.trim().slice(0, 2).toUpperCase();
    const entryData = byEmp[empId];

    if (!entryData) {
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);opacity:.75;min-width:0;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;">
            <div style="width:26px;height:26px;border-radius:50%;background:${empColor};flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">${esc(initials)}</div>
            <span style="font-size:13px;font-weight:700;color:var(--txt1);flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(empName)}</span>
            <span style="font-size:11px;font-style:italic;color:var(--txt2);flex-shrink:0;">No entries logged</span>
            <button class="pbtn mgr-ts-force-entry" data-emp-id="${esc(empId)}" data-emp-name="${esc(empName)}" data-date="${esc(dateStr)}" style="flex-shrink:0;">Force Entry</button>
            <button class="pbtn mgr-ts-force-leave" data-emp-id="${esc(empId)}" data-emp-name="${esc(empName)}" data-date="${esc(dateStr)}" style="flex-shrink:0;">Force Leave</button>
          </div>
        </div>`;
    }

    const { rows } = entryData;
    const empHours = calcHours(rows);

    const slotHourTotals = {};
    rows.forEach(e => {
      if (e.status === 'Leave' || e.status === 'Holiday') return;
      if (!(e.timeIn && e.timeOut)) return; 
      const key = e.slot;
      if (!key) return;
      slotHourTotals[key] = (slotHourTotals[key] || 0) + parseH(e.hours);
    });

    const slotSummaryHtml = Object.keys(slotHourTotals).length > 1
      ? ['morning', 'afternoon', 'extended']
          .filter(key => slotHourTotals[key] > 0)
          .map(key => {
            const meta = { morning: { icon: '🌅', label: 'Morning' }, afternoon: { icon: '☀️', label: 'Afternoon' }, extended: { icon: '🌙', label: 'Extended' } }[key];
            return `<span style="white-space:nowrap;">${meta.icon} ${meta.label}: <strong style="color:var(--txt1);">${fh(slotHourTotals[key])}</strong></span>`;
          }).join('<span style="color:var(--border-md);">·</span>')
      : '';

    const entryRows = rows.map(e => {
      const isLeave   = e.status === 'Leave';
      const isHoliday = e.status === 'Holiday';
      const projectLabel = isLeave ? '🏖️ Leave' : isHoliday ? '🎉 Holiday' : (e.project || '—');
      const projectColor = isLeave ? '#fbbf24' : isHoliday ? '#9ca3af' : mgrColorForKey(e.project || '—');
      const hasRealTimes = !!(e.timeIn && e.timeOut);
      const slotMeta = hasRealTimes ? { morning: { icon: '🌅', label: 'Morning' }, afternoon: { icon: '☀️', label: 'Afternoon' }, extended: { icon: '🌙', label: 'Extended' } }[e.slot] : null;
      const slotBadge = slotMeta
        ? `<span style="flex:0 0 auto;font-size:9.5px;font-weight:700;color:var(--txt2);background:var(--surface2);
            border:1px solid var(--border);border-radius:10px;padding:2px 8px;white-space:nowrap;">${slotMeta.icon} ${slotMeta.label}</span>`
        : '';
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:4px 0;font-size:12px;flex-wrap:wrap;">
          ${slotBadge}
          <span style="flex:0 1 170px;min-width:80px;color:${projectColor};font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(projectLabel)}</span>
          <span style="flex:0 0 70px;color:var(--txt2);text-align:right;">${(isLeave||isHoliday) ? '—' : fh(parseH(e.hours))}</span>
          <span style="flex:1;min-width:0;color:var(--txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(e.notes||'')}">${e.notes ? esc(e.notes) : ''}</span>
        </div>`;
    }).join('');

    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${slotSummaryHtml ? '2px' : '4px'};">
          <div style="width:26px;height:26px;border-radius:50%;background:${empColor};flex-shrink:0;
            display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">${esc(initials)}</div>
          <span style="font-size:13px;font-weight:700;color:var(--txt1);flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(empName)}</span>
          <span style="font-size:12px;font-weight:700;color:var(--a1);">${fh(empHours)}</span>
        </div>
        ${slotSummaryHtml ? `<div style="padding-left:36px;margin-bottom:6px;font-size:11px;color:var(--txt2);display:flex;gap:8px;flex-wrap:wrap;">${slotSummaryHtml}</div>` : ''}
        <div style="padding-left:36px;">${entryRows}</div>
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid var(--border-md);">
        <span style="display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:#38bdf8;
          background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);
          border-radius:8px;padding:4px 12px;">${esc(dateLabel)}</span>
        <span style="font-size:12px;color:var(--txt2);">${empCount} employee${empCount!==1?'s':''} · ${fh(totalHours)} total</span>
      </div>
      ${rowsHtml}
    </div>`;
}

function renderMgrTsPager(totalPages) {
  const pagerEl = $('mgrTsPager');
  if (!pagerEl) return;
  if (totalPages <= 1) { pagerEl.innerHTML = ''; return; }

  const pageNums = [];
  for (let p = 0; p < totalPages; p++) pageNums.push(p);

  pagerEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">
      <button class="pbtn" id="mgrTsPagePrev" ${MGR_TS_PAGE===0?'disabled':''}>‹ Prev</button>
      ${pageNums.map(p => `<button class="pbtn${p===MGR_TS_PAGE?' cur':''}" data-page="${p}">${p+1}</button>`).join('')}
      <button class="pbtn" id="mgrTsPageNext" ${MGR_TS_PAGE===totalPages-1?'disabled':''}>Next ›</button>
    </div>`;

  $('mgrTsPagePrev')?.addEventListener('click', () => { if (MGR_TS_PAGE>0) { MGR_TS_PAGE--; renderMgrTsContent(); } });
  $('mgrTsPageNext')?.addEventListener('click', () => { if (MGR_TS_PAGE<totalPages-1) { MGR_TS_PAGE++; renderMgrTsContent(); } });
  pagerEl.querySelectorAll('.pbtn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { MGR_TS_PAGE = parseInt(btn.dataset.page, 10); renderMgrTsContent(); });
  });
}

function buildDayScrollBar() {
  const bar = $('mgrDayScroll'); if (!bar) return;
  const days = getLast15Days();
  bar.innerHTML = days.map((d,i) => {
    const isActive  = i===MGR_DAY_OFFSET;
    const isWeekend = new Date(d+'T00:00:00').getDay()%6===0;
    return `<button data-offset="${i}" style="flex-shrink:0;padding:5px 14px;border-radius:20px;
      border:1px solid ${isActive?'var(--a1)':'var(--border)'};
      background:${isActive?'var(--a1)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;cursor:pointer;white-space:nowrap;">${fmtDateShort(d)}</button>`;
  }).join('');
  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', ()=>{ MGR_DAY_OFFSET=parseInt(btn.dataset.offset); buildDayScrollBar(); renderEmpContent(); });
  });
}

function buildMonthPicker() {
  const picker = $('mgrMonthPicker'); if (!picker) return;
  const months = [];
  const now = new Date();
  for (let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({val:toLocalDateStr(d).slice(0,7),label:d.toLocaleDateString('en-IN',{month:'short',year:'numeric'})});
  }
  picker.innerHTML = `
    <div style="display:flex;gap:6px;overflow-x:auto;flex:1;padding-bottom:2px;">
      ${months.map(m=>`<button data-month="${m.val}" style="flex-shrink:0;padding:5px 14px;border-radius:20px;
        border:1px solid ${m.val===MGR_SELECTED_MONTH?'var(--a1)':'var(--border)'};
        background:${m.val===MGR_SELECTED_MONTH?'var(--a1)':'var(--surface2)'};
        color:${m.val===MGR_SELECTED_MONTH?'#fff':'var(--txt1)'};
        font-size:11px;cursor:pointer;white-space:nowrap;">${m.label}</button>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px;">
      <span style="font-size:11px;color:var(--txt2);white-space:nowrap;">Pick date:</span>
      <input type="date" id="mgrDatePicker" max="${todayStr()}" value="${MGR_SELECTED_MONTH+'-01'}"
        style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
        color:var(--txt1);font-size:11px;padding:4px 8px;cursor:pointer;"/>
    </div>`;

  picker.querySelectorAll('button[data-month]').forEach(btn => {
    btn.addEventListener('click', ()=>{ MGR_SELECTED_MONTH=btn.dataset.month; buildMonthPicker(); renderEmpContent(); });
  });

  const dp = document.getElementById('mgrDatePicker');
  if (dp) {
    dp.addEventListener('change', ()=>{
      const picked = dp.value; if (!picked) return;
      MGR_RANGE='day15';
      $('mgrRange')?.querySelectorAll('.rbtn').forEach(b=>b.classList.toggle('active',b.dataset.range==='day15'));
      const diffDays=Math.round((new Date().setHours(0,0,0,0)-new Date(picked+'T00:00:00').getTime())/86400000);
      MGR_DAY_OFFSET=Math.max(0,Math.min(14,diffDays));
      $('mgrMonthPicker').style.display='none';
      $('mgrDayScroll').style.display='flex';
      buildDayScrollBar(); renderEmpContent();
    });
  }
}

function getMgrFiltered() {
  const tod=todayStr(), ws=weekStart();
  if (MGR_RANGE==='day15') { const s=getLast15Days()[MGR_DAY_OFFSET]; return MGR_DATA.filter(e=>e.date===s); }
  if (MGR_RANGE==='week')  return MGR_DATA.filter(e=>e.date>=ws&&e.date<=tod);
  if (MGR_RANGE==='month') return MGR_DATA.filter(e=>e.date.startsWith(MGR_SELECTED_MONTH));
  return MGR_DATA;
}

function getMgrRangeLabel() {
  if (MGR_RANGE==='day15') return fmtDateShort(getLast15Days()[MGR_DAY_OFFSET]);
  if (MGR_RANGE==='week')  return 'This Week';
  if (MGR_RANGE==='month') {
    const [y,m]=MGR_SELECTED_MONTH.split('-');
    return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('en-IN',{month:'short',year:'numeric'});
  }
  return 'All Time';
}

function getWorkingDaysInRange() {
  const tod=todayStr(); let start,end;
  if (MGR_RANGE==='day15') return [getLast15Days()[MGR_DAY_OFFSET]];
  if (MGR_RANGE==='week')  { start=weekStart(); end=tod; }
  else if (MGR_RANGE==='month') {
    const [y,m]=MGR_SELECTED_MONTH.split('-').map(Number);
    start=MGR_SELECTED_MONTH+'-01';
    end=MGR_SELECTED_MONTH+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');
    if (end>tod) end=tod;
  } else { const d=new Date(); d.setDate(d.getDate()-90); start=toLocalDateStr(d); end=tod; }
  const dates=[]; const cur=new Date(start+'T00:00:00'); const endDate=new Date(end+'T00:00:00');
  while(cur<=endDate){ const day=cur.getDay(); if(day!==0&&day!==6) dates.push(toLocalDateStr(cur)); cur.setDate(cur.getDate()+1); }
  return dates;
}

function getLast15Days() {
  const dates=[];
  for(let i=0;i<15;i++){ const d=new Date(); d.setDate(d.getDate()-i); dates.push(toLocalDateStr(d)); }
  return dates;
}

function isWorkedEntry(e) { return e.status !== 'Leave' && e.status !== 'Holiday'; }

function calcHours(arr) { return arr.filter(isWorkedEntry).reduce((s,e)=>s+parseH(e.hours),0); }

function parseH(val) {
  if(!val) return 0;
  const s=String(val).trim();
  const h=(s.match(/(\d+)h/)||[])[1], m=(s.match(/(\d+)m/)||[])[1];
  if(!h&&!m) return parseFloat(s)||0;
  return (parseInt(h||0)*60+parseInt(m||0))/60;
}

function fmtDateShort(dateStr) {
  return new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

function fmtNum(n) {
  return Number(n).toLocaleString('en-IN',{maximumFractionDigits:0});
}

function toMinutes(t) {
  if(!t) return 0;
  const [h,m]=t.split(':').map(Number);
  return h*60+m;
}

function fmt12(t) {
  if(!t) return '--:--';
  const [h,m]=t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

// EMP-DETAIL
let EMP_DETAIL_DATA   = null;
let EMP_DETAIL_EMP    = null;

let DETAIL_MONTH        = '';  
let DETAIL_MONTH_CACHE  = {};  

const DETAIL_PALETTE = [
  '#4f8ef7','#7c5cfc','#34d399','#fbbf24',
  '#5eead4','#22d3ee','#fb923c','#a78bfa',
  '#f472b6','#84cc16','#38bdf8','#4ade80',
];

const PROJECT_COLOR_CACHE = {};
function getDetailProjectColor(name) {
  const key = name || 'Unassigned';
  if (PROJECT_COLOR_CACHE[key]) return PROJECT_COLOR_CACHE[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const color = DETAIL_PALETTE[hash % DETAIL_PALETTE.length];
  PROJECT_COLOR_CACHE[key] = color;
  return color;
}

const STATUS_META = {
  worked:      { icon: '🟢', label: 'Worked',      fg: '#34d399', bg: 'rgba(52,211,153,0.10)'  },
  leave:       { icon: '🟡', label: 'Leave',       fg: '#fbbf24', bg: 'rgba(251,191,36,0.10)'  },
  holiday:     { icon: '⚫', label: 'Holiday',     fg: '#9ca3af', bg: 'rgba(156,163,175,0.10)' },
  not_logged:  { icon: '🔴', label: 'Not Logged',  fg: '#f87171', bg: 'rgba(248,113,113,0.10)' },
  force_leave: { icon: '🟠', label: 'Force Leave', fg: '#fb923c', bg: 'rgba(251,146,60,0.10)'  },
  force_entry: { icon: '🟣', label: 'Force Entry', fg: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
  upcoming:    { icon: '⚪', label: 'Upcoming',     fg: 'var(--txt2)', bg: 'var(--surface2)'    },
};

function getEmpDetailContainer() {
  if (typeof TL_MODE !== 'undefined' && TL_MODE) return $('tlApp');
  if (typeof HR_MODE !== 'undefined' && HR_MODE) return $('hrApp');
  return $('mgrApp');
}
function returnToPortalHome() {
  if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof renderTLPortal === 'function') { renderTLPortal(); return; }
  if (typeof HR_MODE !== 'undefined' && HR_MODE && typeof renderHRPortal === 'function') { renderHRPortal(); return; }
  if (typeof renderManagerPortal === 'function') renderManagerPortal();
}

async function refreshTLEmployeeThenOpenDetail(empId, empName) {
  if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof TL_DATA !== 'undefined' && Array.isArray(TL_DATA)) {
    try {
      const fresh = await apiGetAllHistory(empId);
      for (let i = TL_DATA.length - 1; i >= 0; i--) {
        if (TL_DATA[i].empId === empId) TL_DATA.splice(i, 1);
      }
      fresh.forEach(e => TL_DATA.push({ ...e, empId, empName, empTeam: EMP_DETAIL_EMP?.team || '' }));
      if (typeof rebuildTLEmployeeIndex === 'function') rebuildTLEmployeeIndex();
    } catch(err) {
      toast?.('e', "Could not refresh this employee's data", err.message);

    }
  }
  openEmpDetail(empId, empName);
}

async function openEmpDetail(empId, empName) {
  EMP_DETAIL_EMP     = { id: empId, name: empName };
  DETAIL_MONTH       = todayStr().slice(0, 7);
  DETAIL_MONTH_CACHE = {};

  const toStr   = todayStr();
  const fromStr = '2020-01-01';

  const container = getEmpDetailContainer();
  if (!container) return;

  container.innerHTML = `
    <div id="empDetailPage" style="animation: fadeIn .25s ease;">
      <!-- Back button -->
      <div style="margin-bottom:1rem;">
        <button id="empDetailBack" style="
          display:flex;align-items:center;gap:6px;
          padding:7px 14px;border-radius:8px;
          border:1px solid var(--border-md);background:var(--elevated);
          color:var(--txt2);font-size:13px;font-weight:600;cursor:pointer;
          transition:all .16s ease;
        ">← Back</button>
      </div>

      <!-- Identity -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-size:20px;font-weight:800;color:var(--txt1);">${esc(empName)}</div>
        <div style="font-size:12.5px;color:var(--txt2);font-family:var(--fm);">${esc(empId)}</div>
      </div>

      <!-- Date range picker -->
      <div style="
        display:flex;align-items:center;gap:10px;flex-wrap:wrap;
        background:var(--surface1);border:1px solid var(--border);
        border-radius:10px;padding:10px 14px;margin-bottom:1.1rem;
      ">
        <span style="font-size:12px;color:var(--txt2);font-weight:600;">Date Range:</span>

        <div style="display:flex;gap:6px;flex-wrap:wrap;" id="quickRanges">
          <button class="qr-btn active" data-days="0">All Time</button>
        </div>

        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;color:var(--txt2);">🗓️ Month</span>
          <input type="month" id="empDetailMonthPicker"
            style="background:var(--surface2);border:1px solid var(--border);
            border-radius:6px;color:var(--txt1);font-size:12px;padding:5px 8px;cursor:pointer;"/>
        </div>
      </div>
      <input type="date" id="empDetailFrom" value="${fromStr}" style="display:none;"/>
      <input type="date" id="empDetailTo" value="${toStr}" style="display:none;"/>

      <!-- Specific Date — horizontally scrollable strip of day chips
           (day name + date), not a native date input. Click one to
           jump straight to that single day. Populated for a rolling
           window ending today (see buildSpecificDateStrip). -->
      <div style="margin-bottom:1.1rem;">
        <div style="font-size:11px;color:var(--txt2);font-weight:600;margin-bottom:6px;">📅 Specific Date</div>
        <div id="empDetailDateStrip" style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;"></div>
      </div>

      <!-- Content area -->
      <div id="empDetailContent">
        <div class="mgr-loading">
          <div class="slot-spinner"></div>
          <span>Loading employee data…</span>
        </div>
      </div>
    </div>

    <style>
      @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
      .qr-btn {
        padding:4px 12px;border-radius:20px;border:1px solid var(--border);
        background:var(--surface2);color:var(--txt2);font-size:11px;
        cursor:pointer;transition:all .16s ease;white-space:nowrap;
      }
      .qr-btn:hover { border-color:var(--a1);color:var(--a1); }
      .qr-btn.active { background:var(--a1);border-color:var(--a1);color:#fff; }
      .det-stat-card {
        background:var(--surface1);border:1px solid var(--border);
        border-radius:12px;padding:.9rem 1rem;text-align:center;
      }
      #empDetailBack:hover { color:var(--txt1);background:var(--hover); }

      /* ── Attendance & Activity (merged) ── */
      .tl-nav-btn {
        width:30px;height:30px;border-radius:50%;border:1px solid var(--border-md);
        background:var(--elevated);color:var(--txt1);font-size:13px;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;
      }
      .tl-nav-btn:disabled { opacity:.3;cursor:default; }
      .tl-resbtn {
        border:none;border-radius:6px;padding:4px 8px;font-size:9.5px;font-weight:700;
        cursor:pointer;color:#fff;white-space:nowrap;
      }
      .act-row {
        display:flex;align-items:center;gap:10px;padding:9px 10px;
        border-bottom:1px solid var(--border);flex-wrap:wrap;
      }
      .act-row:last-child { border-bottom:none; }
      .act-date-pill {
        flex-shrink:0;font-size:11px;font-weight:700;color:#38bdf8;
        background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);
        border-radius:8px;padding:3px 9px;white-space:nowrap;min-width:64px;text-align:center;
      }
      .act-status-pill {
        flex-shrink:0;display:inline-flex;align-items:center;gap:4px;
        font-size:10.5px;font-weight:700;border-radius:20px;padding:3px 10px;white-space:nowrap;
      }
      .act-bar { flex:1;display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--surface2);min-width:60px; }
      .act-total { font-size:11.5px;font-weight:700;color:var(--txt1);white-space:nowrap;min-width:56px;text-align:right;flex-shrink:0; }
      .act-row-clickable { cursor:pointer; }
      .act-row-clickable:hover { background:var(--hover); }

      /* ── Modal ── */
      .det-modal-overlay {
        position:fixed;inset:0;background:rgba(0,0,0,.55);
        display:flex;align-items:center;justify-content:center;z-index:9999;
        animation:fadeIn .15s ease;
      }
      .det-modal {
        background:var(--surface1);border:1px solid var(--border-md);
        border-radius:14px;padding:1.25rem;width:380px;max-width:92vw;
        max-height:85vh;overflow-y:auto;
      }
      .det-modal label { font-size:11px;color:var(--txt2);font-weight:600;display:block;margin:10px 0 4px; }
      .det-modal input, .det-modal select, .det-modal textarea {
        width:100%;background:var(--surface2);border:1px solid var(--border);
        border-radius:7px;color:var(--txt1);font-size:12.5px;padding:7px 9px;
        box-sizing:border-box;font-family:inherit;
      }
      .det-modal textarea { resize:vertical;min-height:64px; }
    </style>
  `;

  $('empDetailBack').addEventListener('click', () => {
    EMP_DETAIL_DATA = null;
    EMP_DETAIL_EMP  = null;
    returnToPortalHome();
  });

  $('quickRanges').querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $('quickRanges').querySelectorAll('.qr-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clearActiveDateChip(); 
      $('empDetailMonthPicker').value  = '';
      const days = parseInt(btn.dataset.days);
      const tod  = new Date();
      $('empDetailTo').value = toLocalDateStr(tod);
      if (days === 0) {
        $('empDetailFrom').value = '2020-01-01'; 
      } else {
        const f = new Date(); f.setDate(tod.getDate() - (days - 1));
        $('empDetailFrom').value = toLocalDateStr(f);
      }
      loadEmpDetail($('empDetailFrom').value, $('empDetailTo').value);
    });
  });

  $('empDetailMonthPicker').addEventListener('change', e => {
    const val = e.target.value; 
    if (!val) return;
    const [y, m] = val.split('-').map(Number);
    const first = `${val}-01`;
    const lastDayNum = new Date(y, m, 0).getDate(); 
    const lastOfMonth = `${val}-${String(lastDayNum).padStart(2, '0')}`;
    const tod = toLocalDateStr(new Date());
    const to  = lastOfMonth > tod ? tod : lastOfMonth;

    $('quickRanges').querySelectorAll('.qr-btn').forEach(b => b.classList.remove('active'));
    clearActiveDateChip();
    $('empDetailFrom').value = first;
    $('empDetailTo').value   = to;
    loadEmpDetail(first, to);
  });

  buildSpecificDateStrip();

  await loadEmpDetail(fromStr, toStr);
}

const EMP_DETAIL_DATE_STRIP_DAYS = 60;

function buildSpecificDateStrip(selectedDate) {
  const strip = $('empDetailDateStrip');
  if (!strip) return;

  const tod = new Date();
  const chips = [];
  for (let i = 0; i < EMP_DETAIL_DATE_STRIP_DAYS; i++) {
    const d = new Date(tod); d.setDate(tod.getDate() - i);
    chips.push(d);
  }

  strip.innerHTML = chips.map(d => {
    const dateStr   = toLocalDateStr(d);
    const dayName   = d.toLocaleDateString('en-IN', { weekday: 'short' });
    const dayNum    = d.toLocaleDateString('en-IN', { day: '2-digit' });
    const monthName = d.toLocaleDateString('en-IN', { month: 'short' });
    const isToday   = dateStr === toLocalDateStr(tod);
    const active    = dateStr === selectedDate;
    return `
      <button class="emp-date-chip" data-date="${dateStr}" style="flex-shrink:0;display:flex;flex-direction:column;
        align-items:center;gap:1px;min-width:52px;padding:6px 8px;border-radius:8px;cursor:pointer;
        border:1px solid ${active ? 'var(--a1)' : 'var(--border)'};
        background:${active ? 'var(--a1)' : 'var(--surface2)'};
        color:${active ? '#fff' : 'var(--txt1)'};">
        <span style="font-size:9.5px;font-weight:600;opacity:.85;">${esc(dayName)}${isToday ? ' •' : ''}</span>
        <span style="font-size:13px;font-weight:800;">${esc(dayNum)}</span>
        <span style="font-size:9px;opacity:.85;">${esc(monthName)}</span>
      </button>`;
  }).join('');

  strip.querySelectorAll('.emp-date-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const d = chip.dataset.date;
      $('quickRanges').querySelectorAll('.qr-btn').forEach(b => b.classList.remove('active'));
      $('empDetailMonthPicker').value = '';
      $('empDetailFrom').value = d;
      $('empDetailTo').value   = d;
      buildSpecificDateStrip(d); 
      loadEmpDetail(d, d);
    });
  });
}

function clearActiveDateChip() {
  const strip = $('empDetailDateStrip');
  if (!strip) return;
  strip.querySelectorAll('.emp-date-chip').forEach(chip => {
    chip.style.border = '1px solid var(--border)';
    chip.style.background = 'var(--surface2)';
    chip.style.color = 'var(--txt1)';
  });
}

function buildLocalEmpDetail(empId, empName, fromDate, toDate) {
  const all = TL_EMPLOYEE_INDEX[empId] || [];
  let entries = all.filter(e => e.date && e.date >= fromDate && e.date <= toDate);
  entries = entries.slice().sort((a, b) => b.date.localeCompare(a.date) || (a.slot || '').localeCompare(b.slot || ''));

  const worked = entries.filter(e => e.status !== 'Leave');
  const leaves = entries.filter(e => e.status === 'Leave');
  const totalH = worked.reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const projMap = {};
  worked.forEach(e => {
    const k = e.project || 'Unassigned';
    if (!projMap[k]) projMap[k] = { name: k, hours: 0, entries: 0 };
    projMap[k].hours   += Number(e.hours) || 0;
    projMap[k].entries += 1;
  });

  const cliMap = {};
  worked.forEach(e => {
    const k = e.client || 'Unknown';
    if (!cliMap[k]) cliMap[k] = { name: k, hours: 0 };
    cliMap[k].hours += Number(e.hours) || 0;
  });

  const dayMap = {};
  entries.forEach(e => {
    if (!dayMap[e.date]) dayMap[e.date] = { date: e.date, day: e.day, hours: 0, isLeave: false };
    if (e.status === 'Leave') dayMap[e.date].isLeave = true;
    else dayMap[e.date].hours += Number(e.hours) || 0;
  });

  const dayDetails = {};
  entries.forEach(e => {
    if (!dayDetails[e.date]) dayDetails[e.date] = { timeIns: [], timeOuts: [] };
    if (e.timeIn)  dayDetails[e.date].timeIns.push(e.timeIn);
    if (e.timeOut) dayDetails[e.date].timeOuts.push(e.timeOut);
  });

  const days = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date)).map(d => ({
    ...d,
    checkIn:  (dayDetails[d.date]?.timeIns  || []).sort()[0]  || null,
    checkOut: (dayDetails[d.date]?.timeOuts || []).sort().pop() || null,
    hoursStr: fh(d.hours),
  }));

  const uniqueDays = new Set(worked.map(e => e.date)).size;

  const nowMonth = todayStr().slice(0, 7);
  const monthWorked = all.filter(e => e.date && e.date.startsWith(nowMonth) && e.status !== 'Leave');
  const monthH    = monthWorked.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const monthDays = new Set(monthWorked.map(e => e.date)).size;

  const leaveDatesSet = [...new Set(leaves.map(e => e.date))].sort().reverse();
  const leaveDates = leaveDatesSet.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return { date: d, display: dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) };
  });

  return {
    emp: { id: empId, name: empName },
    entries,
    summary: {
      totalHours:    fh(totalH),
      totalHoursRaw: totalH,
      totalDays:     uniqueDays,
      totalLeaves:   leaveDatesSet.length,
      leaveDates,
      totalEntries:  worked.length,
      monthHours:    fh(monthH),
      monthDays,
      projects: Object.values(projMap).sort((a, b) => b.hours - a.hours).map(p => ({ ...p, hoursStr: fh(p.hours) })),
      clients:  Object.values(cliMap).sort((a, b) => b.hours - a.hours).map(c => ({ ...c, hoursStr: fh(c.hours) })),
      days,
    },
  };
}

let EMP_DETAIL_REQUEST_ID = 0;

async function loadEmpDetail(fromDate, toDate) {
  const content = $('empDetailContent');
  if (!content) return;

  if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof TL_EMPLOYEE_INDEX !== 'undefined') {
    const data = buildLocalEmpDetail(EMP_DETAIL_EMP.id, EMP_DETAIL_EMP.name, fromDate, toDate);
    EMP_DETAIL_DATA = data;
    renderEmpDetail(data);
    return;
  }

  const requestId = ++EMP_DETAIL_REQUEST_ID;
  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading…</span></div>`;

  try {
    const data = await sheetGET({
      action: 'getEmployeeDetail',
      uid:    EMP_DETAIL_EMP.id,
      from:   fromDate,
      to:     toDate,
    });
    if (requestId !== EMP_DETAIL_REQUEST_ID) return; 
    EMP_DETAIL_DATA = data;
    renderEmpDetail(data);
  } catch(err) {
    if (requestId !== EMP_DETAIL_REQUEST_ID) return;
    content.innerHTML = `<div class="slot-error">Failed to load employee details: ${esc(err.message)}</div>`;
  }
}

function getEmpProjectsList(empId) {
  const data = typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : [];
  const projects = typeof CP_PROJECTS !== 'undefined' ? CP_PROJECTS : [];
  const myProjectNames = new Set(
    data.filter(e => e.empId === empId && e.status !== 'Leave' && e.project).map(e => e.project)
  );
  return projects.filter(p => myProjectNames.has(p.projectName));
}

function getEmpHoursOnProject(empId, projectName) {
  const data = typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : [];
  return data
    .filter(e => e.empId === empId && e.project === projectName && e.status !== 'Leave')
    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
}

function getEmpProjectPoints(empId, empName, project) {
  const data = typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : [];
  const byMonth = {};
  data
    .filter(e => e.empId === empId && e.project === project.projectName && e.status !== 'Leave' && e.date)
    .forEach(e => {
      const month = e.date.slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + (Number(e.hours) || 0);
    });

  let cost = 0;
  Object.entries(byMonth).forEach(([month, hrs]) => {
    if (typeof getMonthlyPointsForEmployee === 'function') {
      cost += hrs * getMonthlyPointsForEmployee(empId, month, empName);
    }
  });
  return cost;
}

function buildEmpProjectCard(empId, empName, p) {
  const clients = typeof CP_CLIENTS !== 'undefined' ? CP_CLIENTS : [];
  const client = clients.find(c => c.id === p.clientId);

  let totalCost = 0;
  try {
    if (typeof getProjectCostBreakdown === 'function') totalCost = getProjectCostBreakdown(p).totalCost;
  } catch (err) {
    console.warn('[emp-detail] Cost calc failed for', p.projectId, ':', err.message);
  }

  const budget = parseFloat(p.projectConstant) || 0;
  const hasBudget = budget > 0;
  const isOverBudget = hasBudget && totalCost > budget;
  const fillPct = hasBudget ? Math.min((totalCost / budget) * 100, 100) : (totalCost > 0 ? 100 : 0);

  let barHtml, labelText, labelColor;
  if (!totalCost) {
    barHtml = `<div style="width:100%;height:100%;background:var(--border-md);"></div>`;
    labelText = 'No hours logged yet'; labelColor = 'var(--txt1)';
  } else if (isOverBudget) {
    barHtml = `<div style="width:100%;height:100%;background:#f87171;"></div>`;
    labelText = 'Over budget'; labelColor = '#f87171';
  } else {
    barHtml = `<div style="width:${fillPct}%;height:100%;background:#34d399;"></div>`;
    labelText = hasBudget ? 'Within budget' : 'No budget set'; labelColor = hasBudget ? '#34d399' : 'var(--txt1)';
  }

  const myHours  = getEmpHoursOnProject(empId, p.projectName);
  const myPoints = getEmpProjectPoints(empId, empName, p);
  const profit   = budget - totalCost;
  const isProfit = profit >= 0;
  const moneyFmt = typeof fmtCPMoney === 'function' ? fmtCPMoney : (n => Math.round(Number(n) || 0).toLocaleString('en-IN'));
  const dateFmt  = typeof fmtCPDateShort === 'function' ? fmtCPDateShort : (d => d || '—');
  const firstName = (empName || '').split(' ')[0] || 'Their';

  return `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:14px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px;">
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:14px;color:var(--txt1);">${esc(p.projectName || p.projectId)}</div>
          <div style="font-size:11px;color:var(--txt2);">${esc(p.projectId)} · ${esc(client?.name || p.clientId || '—')}</div>
        </div>
        <span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(79,142,247,0.12);
          color:#4f8ef7;white-space:nowrap;">${esc(p.status || 'In Progress')}</span>
      </div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:.4rem;">
        Start: <strong style="color:var(--txt1);">${esc(dateFmt(p.startDate))}</strong>
        · End: <strong style="color:var(--txt1);">${esc(dateFmt(p.endDate))}</strong>
      </div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:.5rem;">${esc(firstName)}'s hours: <strong style="color:var(--txt1);">${fmtH(myHours)}</strong></div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:.5rem;font-size:11px;">
        <div><span style="color:var(--txt2);">Project Budget:</span> <strong style="color:var(--txt1);">${hasBudget ? esc(moneyFmt(budget)) : 'Not set'}</strong></div>
        <div><span style="color:var(--txt2);">Total Points Used:</span> <strong style="color:var(--txt1);">${esc(moneyFmt(totalCost))}</strong></div>
        ${hasBudget ? `<div><span style="color:var(--txt2);">${isProfit ? 'Profit Points' : 'Loss Points'}:</span> <strong style="color:${isProfit ? '#34d399' : '#f87171'};">${esc(moneyFmt(Math.abs(profit)))}</strong></div>` : ''}
        <div><span style="color:var(--txt2);">${esc(firstName)}'s Points Used:</span> <strong style="color:#4f8ef7;">${esc(moneyFmt(myPoints))}</strong></div>
      </div>
      <div style="font-size:9px;font-weight:700;margin-bottom:4px;color:${labelColor};">${labelText}</div>
      <div style="height:6px;background:var(--surface2);border-radius:4px;overflow:hidden;">${barHtml}</div>
    </div>`;
}

function buildEmpProjectsSection(empId, empName) {
  let projects = [];
  try {
    projects = getEmpProjectsList(empId);
  } catch (err) {
    console.warn('[emp-detail] Failed to build projects list:', err.message);
  }

  const header = `
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:.6rem;flex-wrap:wrap;">
      <div style="font-weight:700;font-size:14px;color:var(--txt1);">📁 Projects</div>
      <div style="font-size:10.5px;color:var(--txt2);">— all-time, not affected by the date range above</div>
    </div>`;

  if (!projects.length) {
    return `<div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
      padding:1rem 1.1rem;margin-bottom:1.1rem;">
      ${header}
      <div style="font-size:12.5px;color:var(--txt2);">No projects logged yet.</div>
    </div>`;
  }

  const cardsHtml = projects.map(p => buildEmpProjectCard(empId, empName, p)).join('');
  return `<div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
    padding:1rem 1.1rem;margin-bottom:1.1rem;">
    ${header}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:12px;">${cardsHtml}</div>
  </div>`;
}

function renderEmpDetail(data) {
  const content = $('empDetailContent');
  if (!content) return;

  const s        = data.summary;
  const fromDate = $('empDetailFrom')?.value || todayStr();
  const toDate   = $('empDetailTo')?.value   || todayStr();

  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.9rem;margin-bottom:1.1rem;">
      <div class="det-stat-card">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:4px;">⏱ Total Hours</div>
        <div style="font-size:21px;font-weight:800;background:var(--grad);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;">${s.totalHours}</div>
      </div>
      <div class="det-stat-card">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:4px;">📅 Working Days</div>
        <div style="font-size:21px;font-weight:800;color:var(--txt1);">${s.totalDays}</div>
      </div>
      <div class="det-stat-card">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:4px;">🏖 Leaves</div>
        <div style="font-size:21px;font-weight:800;color:#fbbf24;">${s.totalLeaves}</div>
      </div>
      <div class="det-stat-card">
        <div style="font-size:10px;color:var(--txt2);margin-bottom:4px;">📆 Current Month Hours</div>
        <div style="font-size:21px;font-weight:800;color:var(--a1);">${s.monthHours}</div>
      </div>
    </div>`;

  content.innerHTML = `
    ${statsHtml}

    ${(typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE) ? buildEmpProjectsSection(data.emp.id, data.emp.name) : ''}

    <!-- Attendance & Activity (merged: daily status + hours breakdown + resolution) -->
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
      padding:1rem 1.1rem;margin-bottom:1.1rem;">
      <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.6rem;">📆 Attendance &amp; Activity</div>
      ${buildAttendanceActivityHtml(data, fromDate, toDate)}
    </div>

    <!-- Monthly Project Contribution -->
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;
      padding:1rem 1.1rem;">
      <div style="font-weight:700;font-size:14px;color:var(--txt1);margin-bottom:.6rem;">📁 Monthly Project Contribution</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:.75rem;">
        <button id="monthPrevBtn" class="tl-nav-btn">◀</button>
        <span id="monthLabel" style="font-size:13px;font-weight:700;color:var(--txt1);min-width:150px;text-align:center;"></span>
        <button id="monthNextBtn" class="tl-nav-btn">▶</button>
      </div>
      <div id="monthlyContribBody"></div>
    </div>
  `;

  $('monthPrevBtn').addEventListener('click', () => { DETAIL_MONTH = shiftMonth(DETAIL_MONTH, -1); renderMonthlyContrib(); });
  $('monthNextBtn').addEventListener('click', () => {
    if (DETAIL_MONTH < todayStr().slice(0, 7)) { DETAIL_MONTH = shiftMonth(DETAIL_MONTH, 1); renderMonthlyContrib(); }
  });
  renderMonthlyContrib();

  content.addEventListener('click', e => {
    const empId   = data.emp.id   || EMP_DETAIL_EMP?.id;
    const empName = data.emp.name || EMP_DETAIL_EMP?.name;

    const btn = e.target.closest('.det-resolve-btn');
    if (btn) {
      if (btn.dataset.action === 'force_entry') {
        if (typeof openForceEntry === 'function') {
          openForceEntry(empId, empName, btn.dataset.date, () => refreshTLEmployeeThenOpenDetail(empId, empName));
        } else {
          toast?.('e', 'Force Entry unavailable', 'forceentry.js is not loaded on this page.');
        }
      } else {
        openResolutionModal(btn.dataset.action, empId, empName, btn.dataset.date);
      }
      return;
    }

    const auditRow = e.target.closest('.act-row-clickable');
    if (auditRow) openForceEntryAuditView(auditRow.dataset.auditDate);
  });
}

function buildActivityRow(day) {
  const meta = STATUS_META[day.statusKey];

  if (day.statusKey === 'not_logged') {
    return `
      <div class="act-row">
        <span class="act-date-pill">${day.dateLabel}</span>
        <span class="act-status-pill" style="background:${meta.bg};color:${meta.fg};">${meta.icon} ${meta.label}</span>
        <div style="flex:1;"></div>
        <div style="display:flex;gap:4px;">
          <button class="tl-resbtn det-resolve-btn" data-action="holiday" data-date="${day.dateStr}" style="background:#6b7280;">Holiday</button>
          <button class="tl-resbtn det-resolve-btn" data-action="force_leave" data-date="${day.dateStr}" style="background:#fb923c;">Force Leave</button>
          <button class="tl-resbtn det-resolve-btn" data-action="force_entry" data-date="${day.dateStr}" style="background:#a78bfa;">Force Entry</button>
        </div>
      </div>`;
  }

  const barHtml = day.totalHours > 0
    ? `<div class="act-bar">${day.projects.map(([proj, hrs]) =>
        `<div style="width:${(hrs / day.totalHours) * 100}%;background:${getDetailProjectColor(proj)};" title="${esc(proj)}: ${fmtH(hrs)}"></div>`
      ).join('')}</div>`
    : `<div class="act-bar"></div>`;

  const checkTimesHtml = (day.checkIn || day.checkOut)
    ? `<span class="act-checktimes" style="font-size:11px;color:var(--txt2);white-space:nowrap;">
         <b style="color:var(--txt1);">${fmt12Time(day.checkIn)}</b> → <b style="color:var(--txt1);">${fmt12Time(day.checkOut)}</b>
       </span>`
    : '';

  const isForceEntry = day.statusKey === 'force_entry';
  const rowClass = isForceEntry ? 'act-row act-row-clickable' : 'act-row';

  const rowStyle = [
    'flex-direction:column;align-items:stretch;',
    day.isToday ? 'background:rgba(79,142,247,.05);' : '',
  ].join('');
  const rowAttrs = [
    isForceEntry ? `data-audit-date="${day.dateStr}"` : '',
    `style="${rowStyle}"`,
  ].filter(Boolean).join(' ');
  const infoIcon = isForceEntry ? ` <span title="Tap to view audit trail" style="opacity:.7;">ℹ️</span>` : '';

  return `
    <div class="${rowClass}" ${rowAttrs}>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span class="act-date-pill">${day.dateLabel}</span>
        <span class="act-status-pill" style="background:${meta.bg};color:${meta.fg};">${meta.icon} ${meta.label}${infoIcon}</span>
        ${checkTimesHtml}
        ${barHtml}
        <span class="act-total">${day.totalHours > 0 ? fmtH(day.totalHours) : '—'}</span>
      </div>
      ${day.notes ? `<div style="font-size:11px;color:var(--txt2);margin-top:4px;padding-left:2px;">📝 ${esc(day.notes)}</div>` : ''}
    </div>`;
}

function buildAttendanceActivityHtml(data, fromDate, toDate) {
  const cappedTo = toDate > todayStr() ? todayStr() : toDate;
  const CAP   = 60; 
  const start = new Date(fromDate + 'T00:00:00');
  const end   = new Date(cappedTo + 'T00:00:00');
  const totalDays   = Math.round((end - start) / 86400000) + 1;
  const renderStart = totalDays > CAP ? new Date(end.getTime() - (CAP - 1) * 86400000) : start;

  const rows = [];
  for (let d = new Date(end); d >= renderStart; d.setDate(d.getDate() - 1)) {
    const dateStr    = toLocalDateStr(d);
    const dayEntries = data.entries.filter(e => e.date === dateStr);
    const worked     = dayEntries.filter(e => e.status !== 'Leave' && e.status !== 'Holiday');
    const totalHours = worked.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

    const projMap = {};
    worked.forEach(e => {
      if (!e.project) return;
      projMap[e.project] = (projMap[e.project] || 0) + (parseFloat(e.hours) || 0);
    });
    const projects = Object.entries(projMap).sort((a, b) => b[1] - a[1]);

    const timesIn  = worked.map(e => e.timeIn).filter(Boolean).sort();
    const timesOut = worked.map(e => e.timeOut).filter(Boolean).sort();
    const checkIn   = timesIn[0] || null;
    const checkOut  = timesOut[timesOut.length - 1] || null;

    const notes = [...new Set(worked.map(e => (e.notes || '').trim()).filter(Boolean))].join(' · ');

    rows.push(buildActivityRow({
      dateStr,
      dateLabel: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      isToday:   dateStr === todayStr(),
      statusKey: getDayStatus(dateStr, dayEntries),
      totalHours,
      projects,
      checkIn,
      checkOut,
      notes,
    }));
  }

  const truncNote = totalDays > CAP
    ? `<div style="font-size:10px;color:var(--txt2);text-align:center;padding:6px 0 0;">Showing most recent ${CAP} of ${totalDays} days in range</div>`
    : '';

  return `<div style="max-height:420px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;">${rows.join('')}</div>${truncNote}`;
}

function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toLocalDateStr(d).slice(0, 7);
}

async function getMonthEntries(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const from   = `${monthKey}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  let to = `${monthKey}-${String(lastDay).padStart(2, '0')}`;
  if (to > todayStr()) to = todayStr();

  if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof TL_EMPLOYEE_INDEX !== 'undefined') {
    return (TL_EMPLOYEE_INDEX[EMP_DETAIL_EMP.id] || []).filter(e => e.date && e.date.startsWith(monthKey));
  }

  const curFrom = $('empDetailFrom')?.value;
  const curTo   = $('empDetailTo')?.value;
  if (EMP_DETAIL_DATA && curFrom && curTo && curFrom <= from && to <= curTo) {
    return EMP_DETAIL_DATA.entries.filter(e => e.date && e.date.startsWith(monthKey));
  }

  if (DETAIL_MONTH_CACHE[monthKey]) return DETAIL_MONTH_CACHE[monthKey];

  const data = await sheetGET({ action: 'getEmployeeDetail', uid: EMP_DETAIL_EMP.id, from, to });
  DETAIL_MONTH_CACHE[monthKey] = data.entries || [];
  return DETAIL_MONTH_CACHE[monthKey];
}

async function renderMonthlyContrib() {
  const label = $('monthLabel');
  if (label) label.textContent = new Date(DETAIL_MONTH + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const nextBtn = $('monthNextBtn');
  if (nextBtn) nextBtn.disabled = DETAIL_MONTH >= todayStr().slice(0, 7);

  const body = $('monthlyContribBody');
  if (!body) return;
  body.innerHTML = `<div class="mgr-loading" style="padding:1rem 0;"><div class="slot-spinner"></div></div>`;

  let entries = [];
  try {
    entries = await getMonthEntries(DETAIL_MONTH);
  } catch(err) {
    body.innerHTML = `<div class="slot-error">Failed to load month: ${esc(err.message)}</div>`;
    return;
  }

  const projMap = {};
  entries.filter(e => e.status !== 'Leave' && e.status !== 'Holiday').forEach(e => {
    if (!e.project) return;
    projMap[e.project] = (projMap[e.project] || 0) + (parseFloat(e.hours) || 0);
  });
  const rows = Object.entries(projMap).sort((a, b) => b[1] - a[1]);

  if (!rows.length) {
    body.innerHTML = `<div style="text-align:center;color:var(--txt2);font-size:12px;padding:.75rem 0;">No projects logged this month.</div>`;
    return;
  }

  if (rows.length <= 6) {
    body.innerHTML = `<div style="display:flex;flex-direction:column;gap:9px;">
      ${rows.map(([proj, hrs]) => {
        const color = getDetailProjectColor(proj);
        return `<div style="display:flex;align-items:center;gap:8px;">
          <span style="width:9px;height:9px;border-radius:2px;background:${color};flex-shrink:0;"></span>
          <span style="font-size:12.5px;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;" title="${esc(proj)}">${esc(proj)}</span>
          <span style="flex:1;border-bottom:1px dotted var(--border);height:0;align-self:center;margin:0 2px;"></span>
          <span style="font-size:13px;font-weight:800;color:var(--txt1);white-space:nowrap;">${fmtH(hrs)}</span>
        </div>`;
      }).join('')}
    </div>`;
  } else {
    body.innerHTML = `<div style="display:flex;gap:8px;overflow-x:auto;padding:2px 2px 6px;">
      ${rows.map(([proj, hrs]) => {
        const color = getDetailProjectColor(proj);
        return `<div style="flex-shrink:0;min-width:120px;background:var(--surface2);border:1px solid var(--border);
          border-radius:12px;padding:8px 12px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>
            <span style="font-size:11px;color:var(--txt1);font-weight:600;white-space:nowrap;overflow:hidden;
              text-overflow:ellipsis;max-width:90px;" title="${esc(proj)}">${esc(proj)}</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:var(--txt1);">${fmtH(hrs)}</div>
        </div>`;
      }).join('')}
    </div>`;
  }
}

function detectManualTag(entry) {
  const n = (entry.notes || '');
  if (n.startsWith('[FORCE_ENTRY')) return 'force_entry';
  if (n.startsWith('[HOLIDAY'))     return 'holiday';
  if (n.startsWith('[FORCE_LEAVE')) return 'force_leave';
  return null;
}

function parseForceEntryTag(notes) {
  const m = (notes || '').match(
    /^\[FORCE_ENTRY by (.+?) \((.+?)\)\s*·\s*(.+?)\]\s*Reason:\s*(.*?)\s*\|\s*Manager Notes:\s*(.*?)\s*\|\s*Employee notes:\s*(.*)$/
  );
  if (!m) return null;
  return { enteredBy: m[1], role: m[2], timestamp: m[3], reason: m[4], managerNotes: m[5], employeeNotes: m[6] };
}

function openForceEntryAuditView(dateStr) {
  if (!EMP_DETAIL_DATA || !dateStr) return;
  const feEntry = EMP_DETAIL_DATA.entries.find(e => e.date === dateStr && detectManualTag(e) === 'force_entry');
  if (!feEntry) return;
  const parsed = parseForceEntryTag(feEntry.notes) || {};

  const overlay = document.createElement('div');
  overlay.className = 'det-modal-overlay';
  overlay.innerHTML = `
    <div class="det-modal">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🟣 Force Entry — ${fmtDetailDate(dateStr)}</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:14px;">Permanent audit record for this manual entry</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div>
          <div style="font-size:10.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;">Entered By</div>
          <div style="font-size:13px;color:var(--txt1);font-weight:600;">${esc(parsed.enteredBy || '—')} (${esc(parsed.role || '—')})</div>
        </div>
        <div>
          <div style="font-size:10.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;">Date &amp; Time</div>
          <div style="font-size:13px;color:var(--txt1);">${esc(parsed.timestamp || feEntry.savedAt || '—')}</div>
        </div>
        <div>
          <div style="font-size:10.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;">Reason</div>
          <div style="font-size:13px;color:var(--txt1);">${esc(parsed.reason || '—')}</div>
        </div>
        <div>
          <div style="font-size:10.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em;">Manager Notes</div>
          <div style="font-size:13px;color:var(--txt1);">${esc(parsed.managerNotes || '—')}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <button id="feAuditClose" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#feAuditClose').addEventListener('click', () => overlay.remove());
}

function getDayStatus(dateStr, dayEntries) {
  const dow    = new Date(dateStr + 'T00:00:00').getDay(); 
  const future = dateStr > todayStr();

  if (dayEntries.length === 0) {
    if (future)               return 'upcoming';
    if (dow === 0 || dow===6) return 'holiday'; 
    return 'not_logged';
  }

  const tags = dayEntries.map(detectManualTag);
  if (tags.includes('force_entry')) return 'force_entry';
  if (tags.includes('holiday'))     return 'holiday';
  if (tags.includes('force_leave')) return 'force_leave';
  if (dayEntries.some(e => e.status === 'Leave'))   return 'leave';
  if (dayEntries.some(e => e.status === 'Holiday')) return 'holiday';
  return 'worked';
}

function openResolutionModal(action, empId, empName, dateStr) {
  const dateLabel = fmtDetailDate(dateStr);
  const titles = {
    holiday:     { icon: '⚫', title: 'Mark as Holiday' },
    force_leave: { icon: '🟠', title: 'Apply Force Leave' },
  };
  const t = titles[action];
  if (!t) return; 

  const overlay = document.createElement('div');
  overlay.className = 'det-modal-overlay';
  overlay.innerHTML = `
    <div class="det-modal">
      <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">${t.icon} ${t.title}</div>
      <div style="font-size:12px;color:var(--txt2);">${esc(empName)} · ${dateLabel}</div>
      <label>Notes <span style="color:#f87171;">(required)</span></label>
      <textarea id="detModalNotes" placeholder="Reason for this manual action…"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
        <button id="detModalCancel" style="background:none;border:1px solid var(--border-md);
          color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
        <button id="detModalSubmit" style="background:var(--a1);border:none;
          color:#fff;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Submit</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#detModalCancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#detModalSubmit').addEventListener('click', async () => {
    const notes = overlay.querySelector('#detModalNotes').value.trim();
    if (!notes) {
      overlay.querySelector('#detModalNotes').style.borderColor = '#f87171';
      return;
    }

    const fields = action === 'holiday'
      ? { slot: 'extended', client: 'Holiday', clientId: '', project: 'Holiday', projectId: '', task: 'Holiday', hours: 0, status: 'Holiday', tag: 'HOLIDAY' }
      : { slot: 'extended', client: 'Leave', clientId: '', project: 'Leave', projectId: '', task: 'Leave', hours: 0, status: 'Leave', tag: 'FORCE_LEAVE' };

    const submitBtn = overlay.querySelector('#detModalSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const entry = buildManagerEntry(empId, empName, dateStr, fields, notes);
      await apiSaveSlot(entry);
      toast?.('s', 'Recorded', `${t.title} saved for ${fmtDetailDate(dateStr)}.`);
      overlay.remove();

      if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof TL_DATA !== 'undefined' && Array.isArray(TL_DATA)) {
        for (let i = TL_DATA.length - 1; i >= 0; i--) {
          if (TL_DATA[i].empId === empId && TL_DATA[i].date === dateStr) TL_DATA.splice(i, 1);
        }
        TL_DATA.push({ ...entry, empId, empName, date: dateStr, hours: 0 });
        if (typeof rebuildTLEmployeeIndex === 'function') rebuildTLEmployeeIndex();
      }

      await loadEmpDetail($('empDetailFrom').value, $('empDetailTo').value);
    } catch(err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      toast?.('e', 'Failed to save', err.message);
    }
  });
}

function buildManagerEntry(empId, empName, dateStr, fields, userNotes) {
  const now = new Date();
  const savedAt = now.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });
  const enteredBy   = (typeof getEnteredByInfo === 'function') ? getEnteredByInfo() : { name: (typeof USER !== 'undefined' && USER?.name) || 'Manager' };
  const entryNum     = Date.now() % 1000000;
  const tag          = `[${fields.tag} by ${enteredBy.name} · ${savedAt}]`;

  return {
    id:      `${empId}-${dateStr}-${fields.slot}-${entryNum}`,
    uid:     empId,
    empName: empName,
    date:    dateStr,
    day:     new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' }),
    slot:    fields.slot,
    entryNum,
    timeIn:  fields.timeIn  || '',
    timeOut: fields.timeOut || '',
    client:    fields.client,
    clientId:  fields.clientId,
    project:   fields.project,
    projectId: fields.projectId,
    task:      fields.task,
    hours:     fields.hours,
    notes:     `${tag} ${userNotes || ''}`.trim(),
    status:    fields.status,
    savedAt,
  };
}

function fmtDetailDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN',
    { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtH(h) {
  const mins = Math.round(Number(h) * 60);
  const hr   = Math.floor(mins / 60);
  const mn   = mins % 60;
  if (hr === 0) return `${mn}m`;
  if (mn === 0) return `${hr}h`;
  return `${hr}h ${mn}m`;
}

function fmt12Time(t) {
  if (!t) return '--:--';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// TEAMLEADER
let TL_DATA        = [];
let TL_EMPLOYEES   = [];
let TL_CLIENTS     = [];
let TL_PROJECTS    = [];

let TL_TAB         = 'employees';  
let TL_RANGE       = 'week';
let TL_DAY_OFFSET  = 0;
let TL_MONTH       = '';

let TL_TS_RANGE          = 'day15';
let TL_TS_DAY_OFFSET     = 0;
let TL_TS_SELECTED_MONTH = '';
let TL_TS_MONTH_DAY      = ''; 
let TL_TS_EMP_FILTER     = '';
let TL_TS_SEARCH         = '';
let TL_TS_PAGE           = 0;
const TL_TS_PAGE_SIZE    = 10; 

const TL_PALETTE = [
  '#4f8ef7','#7c5cfc','#34d399','#fbbf24',
  '#5eead4','#22d3ee','#fb923c','#a78bfa',
  '#f472b6','#84cc16','#38bdf8','#4ade80',
];

async function initTeamLeader() {
  const container = $('tlApp');
  if (!container) return;
  const session = APP_SESSION;
  container.innerHTML = '<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading team data…</span></div>';
  try {
    const data = await apiGetTeamData({ fresh: true });
    if (session !== APP_SESSION) return;
    TL_EMPLOYEES = data.employees; TL_DATA = data.entries;
    TL_CLIENTS = data.clients; TL_PROJECTS = data.projects; TL_MONTH = todayStr().slice(0,7); TL_TS_SELECTED_MONTH = TL_MONTH; rebuildTLEmployeeIndex();
    ClientProjectAPI.ingestMasterData(data);
    ClientProjectAPI.ingestTimesheetData(data.entries);
    renderTLPortal();
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(container, 'Could not load team data: ' + error.message, initTeamLeader);
  }
}

let TL_EMPLOYEE_INDEX = {};
function rebuildTLEmployeeIndex() {
  TL_EMPLOYEE_INDEX = {};
  (TL_DATA || []).forEach(e => {
    if (!TL_EMPLOYEE_INDEX[e.empId]) TL_EMPLOYEE_INDEX[e.empId] = [];
    TL_EMPLOYEE_INDEX[e.empId].push(e);
  });
}

function renderTLPortal() {
  const container = $('tlApp');
  if (!container) return;

  container.innerHTML = `
    <!-- Top nav tabs -->
    <div style="display:flex;gap:4px;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0;">
      ${[
        { id:'project',      icon:'📁', label:'Projects & Clients' },
        { id:'employees',    icon:'👥', label:'Employees'  },
        { id:'timesheet',    icon:'🕐', label:'Timesheet' },
        { id:'attendance',   icon:'🕒', label:'Attendance' },
        { id:'historical',   icon:'📜', label:'Historical Import' },
      ].map(t => `
        <button class="tl-tab${TL_TAB===t.id?' active':''}" data-tab="${t.id}" style="
          padding:8px 16px;border:none;background:none;cursor:pointer;
          font-size:13px;font-weight:600;
          color:${TL_TAB===t.id?'var(--a1)':'var(--txt2)'};
          border-bottom:2px solid ${TL_TAB===t.id?'var(--a1)':'transparent'};
          margin-bottom:-1px;transition:all .2s;
        ">${t.icon} ${t.label}</button>
      `).join('')}
    </div>
    <div id="tlTabContent"></div>
  `;

  container.querySelectorAll('.tl-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      TL_TAB = btn.dataset.tab;
      container.querySelectorAll('.tl-tab').forEach(b => {
        const active = b === btn;
        b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
        b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
      });
      renderTLTab();
    });
  });

  renderTLTab();
}

function renderTLTab() {
  const content = $('tlTabContent');
  if (!content) return;

  if (TL_TAB === 'project') {
    if (typeof renderProjectTab === 'function') renderProjectTab(content);
    else content.innerHTML = `<div class="chart-empty">Project module (client-project.js) is not loaded.</div>`;
    return;
  }

  if (TL_TAB === 'employees') { renderTLEmployeesTab(content); return; }

  if (TL_TAB === 'timesheet') { renderTLTimesheetTab(content); return; }

  if (TL_TAB === 'attendance') {
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab(content);
    else content.innerHTML = `<div class="chart-empty">Attendance module (client-project.js) is not loaded.</div>`;
    return;
  }

  if (TL_TAB === 'historical') {
    if (typeof renderHistoricalImportTab === 'function') renderHistoricalImportTab(content);
    else content.innerHTML = `<div class="chart-empty">Historical Import module (historical-import.js) is not loaded.</div>`;
    return;
  }
}

function renderTLEmployeesTab(content) {
  const filtered = getTLFiltered();
  const worked   = filtered.filter(isWorkedEntry);
  const totHours = tlCalcHours(worked);

  content.innerHTML = `
    <!-- Summary strip -->
    <div class="strip" style="margin-bottom:1.25rem">
      <div class="sitem"><span class="slbl">Total Hours</span><span class="sval hi" id="tlTot">${fh(totHours)}</span></div>
      <div class="sitem"><span class="slbl">Employees</span><span class="sval" id="tlEmpCnt">${new Set(filtered.map(e=>e.empId)).size}</span></div>
      <div class="sitem"><span class="slbl">Active Projects</span><span class="sval" id="tlProjCnt">${new Set(worked.filter(e=>e.project).map(e=>e.project)).size}</span></div>
      <div class="sitem"><span class="slbl">Clients</span><span class="sval" id="tlCliCnt">${new Set(worked.filter(e=>e.client&&e.client!=='Leave').map(e=>e.client)).size}</span></div>
    </div>

    <!-- Range controls -->
    <div class="mgr-controls" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div class="chart-range" id="tlRange">
        <button class="rbtn${TL_RANGE==='day15'?' active':''}"  data-range="day15">15 Days</button>
        <button class="rbtn${TL_RANGE==='week'?' active':''}"   data-range="week">This Week</button>
        <button class="rbtn${TL_RANGE==='month'?' active':''}"  data-range="month">This Month</button>
        <button class="rbtn${TL_RANGE==='all'?' active':''}"    data-range="all">All Time</button>
      </div>
      <button id="tlEmpRefreshBtn" title="Refresh this tab's data" style="background:var(--elevated);
        border:1px solid var(--border-md);border-radius:6px;color:var(--txt2);cursor:pointer;
        padding:7px 10px;font-size:13px;line-height:1;display:flex;align-items:center;">🔄</button>
    </div>

    <!-- 15-day scroll -->
    <div id="tlDayScroll" style="display:${TL_RANGE==='day15'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;"></div>

    <!-- Month picker -->
    <div id="tlMonthPicker" style="display:${TL_RANGE==='month'?'flex':'none'};
      gap:8px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;"></div>

    <!-- Employee cards -->
    <div id="tlEmpCards"></div>
  `;

  $('tlEmpRefreshBtn').addEventListener('click', async () => {
    const btn = $('tlEmpRefreshBtn');
    btn.disabled = true; btn.style.opacity = '.5';
    try {
      await initTeamLeader();
      toast?.('s', 'Refreshed', 'Employee data is up to date.');
    } catch (err) {
      toast?.('e', 'Refresh failed', err.message);
      btn.disabled = false; btn.style.opacity = '';
    }
  });

  $('tlRange').addEventListener('click', e => {
    const btn = e.target.closest('.rbtn');
    if (!btn) return;
    TL_RANGE = btn.dataset.range;
    TL_DAY_OFFSET = 0;
    $('tlRange').querySelectorAll('.rbtn').forEach(b => b.classList.toggle('active', b===btn));
    $('tlDayScroll').style.display   = TL_RANGE==='day15' ? 'flex' : 'none';
    $('tlMonthPicker').style.display = TL_RANGE==='month' ? 'flex' : 'none';
    if (TL_RANGE==='day15') buildTLDayScroll();
    if (TL_RANGE==='month') buildTLMonthPicker();
    renderTLEmpCards();
  });

  if (TL_RANGE==='day15') buildTLDayScroll();
  if (TL_RANGE==='month') buildTLMonthPicker();
  renderTLEmpCards();
}

function renderTLEmpCards() {
  const content  = $('tlEmpCards');
  if (!content) return;
  const filtered = getTLFiltered();
  const worked   = filtered.filter(isWorkedEntry);

  const tlTot     = $('tlTot');     if (tlTot)     tlTot.textContent     = fh(tlCalcHours(worked));
  const tlEmpCnt  = $('tlEmpCnt');  if (tlEmpCnt)  tlEmpCnt.textContent  = new Set(filtered.map(e=>e.empId)).size;
  const tlProjCnt = $('tlProjCnt'); if (tlProjCnt) tlProjCnt.textContent = new Set(worked.filter(e=>e.project).map(e=>e.project)).size;
  const tlCliCnt  = $('tlCliCnt');  if (tlCliCnt)  tlCliCnt.textContent  = new Set(worked.filter(e=>e.client&&e.client!=='Leave').map(e=>e.client)).size;

  const empMap = {};
  TL_EMPLOYEES.forEach((emp, idx) => {
    empMap[emp.id] = {
      id: emp.id, name: emp.name, team: emp.team, entryIndex: idx,
      hours: 0, days: new Set(), leaves: 0,
      projectMap: {}, missedDays: [],
      monthHours: 0, monthDays: 0, monthLeaves: 0, lastActivityDate: '',
    };
  });

  worked.forEach(e => {
    if (!empMap[e.empId]) return;
    const h = tlParseH(e.hours);
    empMap[e.empId].hours += h;
    empMap[e.empId].days.add(e.date);
    if (e.project) empMap[e.empId].projectMap[e.project] = (empMap[e.empId].projectMap[e.project]||0) + h;
  });

  filtered.filter(e=>e.status==='Leave').forEach(e => {
    if (empMap[e.empId]) { empMap[e.empId].leaves++; empMap[e.empId].days.add(e.date); }
  });

  const rangeDates = getTLWorkingDays();
  Object.values(empMap).forEach(emp => {
    emp.missedDays = rangeDates.filter(d => !emp.days.has(d));
  });

  const curMonth  = todayStr().slice(0,7);
  Object.values(empMap).forEach(emp => {
    const me = TL_DATA.filter(e => e.empId===emp.id && e.date.startsWith(curMonth));
    const mw = me.filter(isWorkedEntry);
    emp.monthHours  = mw.reduce((s,e) => s+tlParseH(e.hours), 0);
    emp.monthDays   = new Set(mw.map(e=>e.date)).size;

    emp.monthLeaves = new Set(me.filter(e=>e.status==='Leave').map(e => e.date)).size;

    emp.lastActivityDate = TL_DATA
      .filter(e => e.empId === emp.id)
      .reduce((max, e) => (e.date > max ? e.date : max), '');
  });

  const rows = Object.values(empMap).sort((a, b) => {
    if (a.lastActivityDate !== b.lastActivityDate) return b.lastActivityDate.localeCompare(a.lastActivityDate);
    return b.hours - a.hours;
  });
  if (!rows.length) { content.innerHTML = `<div class="chart-empty">No employees found.</div>`; return; }

  content.innerHTML = `
    <div style="margin-top:.5rem;">
      ${rows.map(emp => buildTLEmpCard(emp)).join('')}
    </div>`;

  content.querySelectorAll('.tl-leave-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await applyTLLeave(btn, btn.dataset.empId, btn.dataset.date, btn.dataset.empName);
    });
  });

  content.querySelectorAll('.view-emp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof openEmpDetail === 'function') openEmpDetail(btn.dataset.empId, btn.dataset.empName);
      else toast?.('e', 'Employee Detail unavailable', 'emp-detail.js is not loaded.');
    });
  });
}

function buildTLEmpCard(emp) {
  const projects   = Object.entries(emp.projectMap).sort((a,b)=>b[1]-a[1]);
  const totalHours = emp.hours;
  const hasMissed  = emp.missedDays.length > 0;
  const initials   = emp.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const rangeLabel = getTLRangeLabel();
  const curMonth   = new Date(todayStr().slice(0,7)+'-01')
    .toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  const legendHtml = projects.length === 0
    ? `<div style="font-size:12px;color:var(--txt2);">No projects logged</div>`
    : projects.slice(0,5).map(([proj,hrs],i) => `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${TL_PALETTE[i%TL_PALETTE.length]};flex-shrink:0;"></span>
          <span style="font-size:11px;color:var(--txt2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(proj)}">${esc(proj)}</span>
          <span style="font-size:11px;color:var(--txt1);font-weight:600;">${fh(hrs)}</span>
        </div>`).join('') +
      (projects.length>5?`<div style="font-size:10px;color:var(--txt2);">+${projects.length-5} more</div>`:'');

  const missedSection = hasMissed ? `
    <div class="missed-section" style="margin-top:10px;border-top:1px solid rgba(239,68,68,0.25);padding-top:10px;">
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:7px;">
        <span>⚠️</span>
        <span class="tl-missed-count" style="color:#ef4444;font-size:11px;font-weight:600;">
          ${emp.missedDays.length} day${emp.missedDays.length>1?'s':''} not logged
        </span>
      </div>
      ${emp.missedDays.map(date=>`
        <div class="tl-missed-row" style="display:flex;align-items:center;justify-content:space-between;
          padding:5px 10px;margin-bottom:5px;background:rgba(239,68,68,0.07);
          border:1px solid rgba(239,68,68,0.2);border-radius:7px;gap:8px;">
          <span style="font-size:11px;color:var(--txt1);white-space:nowrap;">${tlFmtDate(date)}</span>
          <button class="tl-leave-btn"
            data-emp-id="${emp.id}" data-emp-name="${esc(emp.name)}" data-date="${date}"
            style="background:#ef4444;color:#fff;border:none;border-radius:5px;
              padding:4px 12px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
            Force Leave</button>
        </div>`).join('')}
    </div>` : '';

  const isDayView = TL_RANGE === 'day15';
  let dayInfoHtml = '';
  if (isDayView && totalHours > 0) {
    const selDate  = getTL15Days()[TL_DAY_OFFSET];
    const dayEnts  = TL_DATA.filter(e=>e.empId===emp.id&&e.date===selDate).filter(isWorkedEntry);
    const timesIn  = dayEnts.map(e=>e.timeIn).filter(Boolean).sort();
    const timesOut = dayEnts.map(e=>e.timeOut).filter(Boolean).sort();
    const tIn      = timesIn[0] || null;
    const tOut     = timesOut[timesOut.length-1] || null;
    const outMins  = tOut ? tlToMins(tOut) : 0;
    const isExt    = outMins > tlToMins('19:30');
    const extH     = isExt ? (outMins - tlToMins('19:30'))/60 : 0;

    dayInfoHtml = `
      <div style="margin-top:10px;padding:10px 12px;background:var(--surface2);border-radius:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span>🕘</span>
            <span style="font-size:11px;color:var(--txt2);">Check In</span>
            <span style="font-size:12px;font-weight:700;color:var(--txt1);">${tlFmt12(tIn)}</span>
          </div>
          <span style="font-size:11px;color:var(--txt2);">→</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span>🕔</span>
            <span style="font-size:11px;color:var(--txt2);">Check Out</span>
            <span style="font-size:12px;font-weight:700;color:var(--txt1);">${tlFmt12(tOut)}</span>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:8px;display:flex;gap:14px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span>🍽</span><span style="font-size:11px;color:var(--txt2);">Lunch</span>
            <span style="font-size:12px;font-weight:700;color:var(--txt1);">45m</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <span>⏱</span><span style="font-size:11px;color:var(--txt2);">Worked</span>
            <span style="font-size:12px;font-weight:700;color:var(--txt1);">${fh(totalHours)}</span>
          </div>
          ${isExt?`<div style="display:flex;align-items:center;gap:4px;">
            <span>🌙</span><span style="font-size:11px;color:var(--txt2);">Extended</span>
            <span style="font-size:12px;font-weight:700;color:#a78bfa;">${fh(extH)}</span>
          </div>`:''}
        </div>
        ${isExt?`<div style="margin-top:6px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.3);
          border-radius:6px;padding:4px 8px;font-size:10px;color:#a78bfa;font-weight:600;">
          🌙 Extended: stayed until ${tlFmt12(tOut)}</div>`:''}
      </div>`;
  }

  const donutSvg = buildTLDonut(projects, totalHours);

  return `
    <div class="emp-card" style="background:var(--surface1);
      border:1px solid ${hasMissed?'rgba(239,68,68,0.4)':'var(--border)'};border-radius:14px;padding:1.1rem 1.3rem;margin-bottom:1.1rem;">

      <!-- Identity + monthly quick stats + View Details, all in one row -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:20px;">
        <div style="display:flex;align-items:center;gap:10px;flex:0 0 auto;min-width:170px;">
          <div style="width:36px;height:36px;border-radius:50%;
            background:linear-gradient(135deg,var(--a1),#7c5cfc);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:13px;color:#fff;flex-shrink:0;">${initials}</div>
          <div style="min-width:0;">
            <div style="font-weight:600;font-size:14px;color:var(--txt1);
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(emp.name)}</div>
            <div style="font-size:11px;color:var(--txt2);">${esc(emp.team)}</div>
          </div>
        </div>

        <div style="display:flex;gap:22px;flex-wrap:wrap;flex:1;align-items:center;">
          <span style="font-size:10.5px;color:var(--txt2);font-weight:600;white-space:nowrap;">📅 ${curMonth}</span>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Worked</div>
            <div style="font-size:14px;font-weight:800;color:var(--a1);">${fh(emp.monthHours)}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Days</div>
            <div style="font-size:14px;font-weight:800;color:var(--txt1);">${emp.monthDays}</div>
          </div>
          <div>
            <div style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.4px;">Leaves</div>
            <div style="font-size:14px;font-weight:800;color:#fbbf24;">${emp.monthLeaves}</div>
          </div>
        </div>

        <button class="view-emp-btn" data-emp-id="${emp.id}" data-emp-name="${esc(emp.name)}"
          style="background:var(--a1);color:#fff;border:none;border-radius:6px;
            padding:8px 16px;font-size:11px;font-weight:600;cursor:pointer;
            white-space:nowrap;flex-shrink:0;">
          View Details →
        </button>
      </div>

      <!-- Donut LEFT + Legend RIGHT -->
      <div style="display:flex;align-items:center;gap:1.2rem;margin-top:1rem;">
        <div style="position:relative;width:160px;height:160px;flex-shrink:0;">
          ${donutSvg}
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;
            align-items:center;justify-content:center;pointer-events:none;">
            <span style="font-size:18px;font-weight:800;color:var(--txt1);line-height:1.1;">${fh(totalHours)}</span>
            <span style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.6px;margin-top:3px;">${rangeLabel}</span>
          </div>
        </div>
        <div style="flex:1;min-width:0;">${legendHtml}</div>
      </div>

      ${dayInfoHtml}
      ${missedSection}
    </div>`;
}

async function applyTLLeave(btn, empId, date, empName) {
  btn.disabled=true; btn.textContent='…';
  try {
    await sheetGET({ action:'forceLeave', data: encodeURIComponent(JSON.stringify({ uid:empId, date })) });
    const row=btn.closest('.tl-missed-row');
    if(row){ row.style.opacity='.4'; btn.textContent='✓ Done'; btn.style.background='#34d399'; }
    TL_DATA.push({empId,date,status:'Leave',hours:'0h',empName,empTeam:''});
    const card=btn.closest('.emp-card');
    if(card){
      const rem=card.querySelectorAll('.tl-leave-btn:not([disabled])').length-1;
      const badge=card.querySelector('.tl-missed-count');
      if(badge){
        if(rem<=0){ card.querySelector('.missed-section')?.remove(); card.style.borderColor='var(--border)'; }
        else badge.textContent=`${rem} day${rem>1?'s':''} not logged`;
      }
    }
    tlToast(`✅ Leave applied — ${empName} on ${tlFmtDate(date)}`);
  } catch(err) {
    btn.disabled=false; btn.textContent='Force Leave';
    tlToast(`❌ Failed: ${err.message}`, true);
  }
}

function getTLTimesheetFiltered() {
  let rows;
  if (TL_TS_RANGE === 'month') {
    rows = TL_TS_MONTH_DAY
      ? TL_DATA.filter(e => e.date === TL_TS_MONTH_DAY)
      : TL_DATA.filter(e => e.date.startsWith(TL_TS_SELECTED_MONTH));
  } else {

    const d = getTL15Days()[TL_TS_DAY_OFFSET];
    rows = TL_DATA.filter(e => e.date === d);
  }

  if (TL_TS_EMP_FILTER) rows = rows.filter(e => e.empId === TL_TS_EMP_FILTER);

  if (TL_TS_SEARCH) {
    const q = TL_TS_SEARCH.toLowerCase();
    rows = rows.filter(e =>
      [e.empName, e.project, e.client, e.task, e.notes].some(v => v && String(v).toLowerCase().includes(q))
    );
  }

  return rows;
}

const TL_TS_RANGE_COLORS = {
  day15: { bg: 'linear-gradient(135deg,#4f8ef7,#38bdf8)', fg: '#4f8ef7' },
  month: { bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)', fg: '#f59e0b' },
};

function renderTLTimesheetTab(content) {
  content.innerHTML = `
    <div class="mgr-controls">
      <div style="display:flex;gap:6px;flex-wrap:wrap;" id="tlTsRange">
        ${[
          { id:'day15', label:'📅 15 Days' },
          { id:'month', label:'📆 This Month' },
        ].map(r => {
          const active = TL_TS_RANGE === r.id;
          const c = TL_TS_RANGE_COLORS[r.id];
          return `<button class="tl-ts-rbtn" data-range="${r.id}" style="padding:7px 14px;border-radius:20px;
            border:1px solid ${active ? 'transparent' : 'var(--border-md)'};
            background:${active ? c.bg : 'var(--surface2)'};
            color:${active ? '#fff' : 'var(--txt2)'};
            font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:all .15s;">${r.label}</button>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <select id="tlTsEmpFilter" class="filt">
          <option value="">All Employees</option>
          ${TL_EMPLOYEES.filter(emp => emp.active).map(emp => `<option value="${esc(emp.id)}" ${TL_TS_EMP_FILTER===emp.id?'selected':''}>${esc(emp.name)}</option>`).join('')}
        </select>
        <input type="search" id="tlTsSearch" class="srch" placeholder="Search project, notes…" value="${esc(TL_TS_SEARCH)}"/>
      </div>
    </div>

    <div id="tlTsDayScroll" style="display:${TL_TS_RANGE==='day15'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;min-width:0;"></div>

    <div id="tlTsMonthPicker" style="display:${TL_TS_RANGE==='month'?'flex':'none'};
      gap:8px;margin-bottom:1rem;align-items:center;min-width:0;"></div>

    <div id="tlTsMonthDayScroll" style="display:${TL_TS_RANGE==='month'?'flex':'none'};
      gap:6px;margin-bottom:1rem;overflow-x:auto;padding-bottom:4px;min-width:0;"></div>

    <div id="tlTsContent"></div>
  `;

  $('tlTsRange').addEventListener('click', e => {
    const btn = e.target.closest('.tl-ts-rbtn');
    if (!btn) return;
    TL_TS_RANGE = btn.dataset.range;
    TL_TS_DAY_OFFSET = 0;
    TL_TS_MONTH_DAY = '';
    TL_TS_PAGE = 0;
    renderTLTimesheetTab(content); 
  });

  $('tlTsEmpFilter').addEventListener('change', e => {
    TL_TS_EMP_FILTER = e.target.value;
    TL_TS_PAGE = 0;
    renderTLTsContent();
  });

  $('tlTsSearch').addEventListener('input', e => {
    TL_TS_SEARCH = e.target.value;
    TL_TS_PAGE = 0;
    renderTLTsContent();
  });

  if (TL_TS_RANGE === 'day15') buildTLTsDayScrollBar();
  if (TL_TS_RANGE === 'month') { buildTLTsMonthPicker(); buildTLTsMonthDayScrollBar(); }
  renderTLTsContent();
}

function buildTLTsDayScrollBar() {
  const bar = $('tlTsDayScroll'); if (!bar) return;
  const days = getTL15Days();
  bar.innerHTML = days.map((d,i) => {
    const isActive  = i===TL_TS_DAY_OFFSET;
    const isWeekend = new Date(d+'T00:00:00').getDay()%6===0;
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : tlFmtDate(d);
    return `<button data-offset="${i}" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
      border:1px solid ${isActive?'transparent':'var(--border)'};
      background:${isActive?'linear-gradient(135deg,#4f8ef7,#38bdf8)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">${label}</button>`;
  }).join('');
  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      TL_TS_DAY_OFFSET = parseInt(btn.dataset.offset);
      TL_TS_PAGE = 0;
      buildTLTsDayScrollBar();
      renderTLTsContent();
    });
  });

  if (!bar.dataset.wheelWired) {
    bar.dataset.wheelWired = '1';
    bar.addEventListener('wheel', e => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      bar.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

function stepTLTsMonth(dir) {
  const [y, m] = TL_TS_SELECTED_MONTH.split('-').map(Number);
  const next = new Date(y, (m - 1) + dir, 1);
  const nextVal = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  if (nextVal > todayStr().slice(0, 7)) return; 
  TL_TS_SELECTED_MONTH = nextVal;
  TL_TS_MONTH_DAY = '';
  TL_TS_PAGE = 0;
  buildTLTsMonthPicker();
  buildTLTsMonthDayScrollBar();
  renderTLTsContent();
}

function buildTLTsMonthPicker() {
  const picker = $('tlTsMonthPicker'); if (!picker) return;
  const isCurrentMonth = TL_TS_SELECTED_MONTH >= todayStr().slice(0, 7);

  picker.innerHTML = `
    <button id="tlTsMonthPrev" class="pbtn" title="Previous month">‹</button>
    <input type="month" id="tlTsMonthInput" value="${esc(TL_TS_SELECTED_MONTH)}" max="${esc(todayStr().slice(0,7))}"
      style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;
      color:var(--txt1);font-size:13px;padding:8px 12px;cursor:pointer;"/>
    <button id="tlTsMonthNext" class="pbtn" ${isCurrentMonth ? 'disabled' : ''} title="Next month">›</button>`;

  const input = $('tlTsMonthInput');
  input.addEventListener('change', e => {
    TL_TS_SELECTED_MONTH = e.target.value || todayStr().slice(0,7);
    TL_TS_MONTH_DAY = '';
    TL_TS_PAGE = 0;
    buildTLTsMonthPicker();
    buildTLTsMonthDayScrollBar();
    renderTLTsContent();
  });

  $('tlTsMonthPrev').addEventListener('click', () => stepTLTsMonth(-1));
  $('tlTsMonthNext').addEventListener('click', () => stepTLTsMonth(1));

  input.addEventListener('wheel', e => {
    e.preventDefault();
    stepTLTsMonth(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}

function buildTLTsMonthDayScrollBar() {
  const bar = $('tlTsMonthDayScroll'); if (!bar) return;

  const [y, m] = TL_TS_SELECTED_MONTH.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayStr();
  const isCurrentMonth = TL_TS_SELECTED_MONTH === today.slice(0, 7);
  const lastDay = isCurrentMonth ? Number(today.slice(8, 10)) : daysInMonth;

  const allChip = `<button data-day="" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
    border:1px solid ${!TL_TS_MONTH_DAY?'transparent':'var(--border)'};
    background:${!TL_TS_MONTH_DAY?'linear-gradient(135deg,#f59e0b,#fbbf24)':'var(--surface2)'};
    color:${!TL_TS_MONTH_DAY?'#fff':'var(--txt1)'};
    font-size:11px;font-weight:${!TL_TS_MONTH_DAY?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">All Month</button>`;

  const dayChips = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${TL_TS_SELECTED_MONTH}-${String(d).padStart(2,'0')}`;
    const isActive  = TL_TS_MONTH_DAY === dateStr;
    const weekday   = new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
    const isWeekend = new Date(dateStr+'T00:00:00').getDay() % 6 === 0;
    const isToday   = dateStr === today;
    const label     = isToday ? 'Today' : `${weekday} ${d}`;
    dayChips.push(`<button data-day="${dateStr}" style="flex-shrink:0;padding:6px 14px;border-radius:20px;
      border:1px solid ${isActive?'transparent':isToday?'#4f8ef7':'var(--border)'};
      background:${isActive?'linear-gradient(135deg,#f59e0b,#fbbf24)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap;transition:all .15s;">${label}</button>`);
  }

  bar.innerHTML = allChip + dayChips.join('');

  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      TL_TS_MONTH_DAY = btn.dataset.day;
      TL_TS_PAGE = 0;
      buildTLTsMonthDayScrollBar();
      renderTLTsContent();
    });
  });

  if (!bar.dataset.wheelWired) {
    bar.dataset.wheelWired = '1';
    bar.addEventListener('wheel', e => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      bar.scrollLeft += e.deltaY;
    }, { passive: false });
  }
}

function renderTLTsContent() {
  const content = $('tlTsContent');
  if (!content) return;

  const rows = getTLTimesheetFiltered();

  const byDate = {};
  rows.forEach(e => {
    if (!e.date) return;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });
  const dates = Object.keys(byDate).sort((a,b) => b.localeCompare(a));

  if (!dates.length) {
    content.innerHTML = `<div class="chart-empty">No timesheet entries for this range.</div>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(dates.length / TL_TS_PAGE_SIZE));
  if (TL_TS_PAGE >= totalPages) TL_TS_PAGE = totalPages - 1;
  const pageDates = dates.slice(TL_TS_PAGE * TL_TS_PAGE_SIZE, (TL_TS_PAGE + 1) * TL_TS_PAGE_SIZE);

  content.innerHTML = `
    <div class="card" style="padding:1.25rem;">
      ${pageDates.map(d => buildTLTsDateSection(d, byDate[d])).join('')}
    </div>
    <div id="tlTsPager" style="margin-top:1rem;"></div>
  `;

  renderTLTsPager(totalPages);

  if (!content.dataset.wired) {
    content.dataset.wired = '1';
    content.addEventListener('click', e => {
      const entryBtn = e.target.closest('.tl-ts-force-entry');
      if (entryBtn) {
        openForceEntry(entryBtn.dataset.empId, entryBtn.dataset.empName, entryBtn.dataset.date, () => renderTLPortal());
        return;
      }
      const leaveBtn = e.target.closest('.tl-ts-force-leave');
      if (leaveBtn) {
        applyTLTsForceLeave(leaveBtn, leaveBtn.dataset.empId, leaveBtn.dataset.empName, leaveBtn.dataset.date);
      }
    });
  }
}

async function applyTLTsForceLeave(btn, empId, empName, dateStr) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = '…';
  try {
    await sheetGET({ action: 'forceLeave', data: encodeURIComponent(JSON.stringify({ uid: empId, date: dateStr })) });
    TL_DATA.push({ empId, empName, date: dateStr, status: 'Leave', hours: '0h', slot: '', project: '', notes: 'Force leave applied by team leader' });
    toast?.('s', 'Leave applied', `${empName} marked on leave for ${dateStr}`);
    renderTLTsContent();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    toast?.('e', 'Failed', err.message);
  }
}

function tlColorForKey(key) {
  const str = String(key || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return TL_PALETTE[hash % TL_PALETTE.length];
}

function buildTLTsDateSection(dateStr, entries) {
  const dateLabel = new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN',
    { weekday:'long', day:'numeric', month:'short', year:'numeric' });
  const totalHours = tlCalcHours(entries);
  const empCount = new Set(entries.map(e => e.empId)).size;

  const byEmp = {};
  entries.forEach(e => {
    if (!byEmp[e.empId]) byEmp[e.empId] = { empName: e.empName || e.empId, rows: [] };
    byEmp[e.empId].rows.push(e);
  });

  let displayEmpIds;
  if (TL_TS_EMP_FILTER) {
    displayEmpIds = Object.keys(byEmp);
  } else {
    displayEmpIds = TL_EMPLOYEES.filter(emp => emp.active).map(emp => emp.id);
    Object.keys(byEmp).forEach(id => { if (!displayEmpIds.includes(id)) displayEmpIds.push(id); });
  }

  const empNameFor = empId => {
    if (byEmp[empId]) return byEmp[empId].empName;
    const emp = TL_EMPLOYEES.find(e => e.id === empId);
    return emp ? emp.name : empId;
  };

  const sortedEmpIds = displayEmpIds.slice().sort((a,b) => empNameFor(a).localeCompare(empNameFor(b)));

  const rowsHtml = sortedEmpIds.map(empId => {
    const empName  = empNameFor(empId);
    const empColor = tlColorForKey(empName);
    const initials = empName.trim().slice(0, 2).toUpperCase();
    const entryData = byEmp[empId];

    if (!entryData) {
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);opacity:.75;min-width:0;overflow:hidden;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0;">
            <div style="width:26px;height:26px;border-radius:50%;background:${empColor};flex-shrink:0;
              display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">${esc(initials)}</div>
            <span style="font-size:13px;font-weight:700;color:var(--txt1);flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(empName)}</span>
            <span style="font-size:11px;font-style:italic;color:var(--txt2);flex-shrink:0;">No entries logged</span>
            <button class="pbtn tl-ts-force-entry" data-emp-id="${esc(empId)}" data-emp-name="${esc(empName)}" data-date="${esc(dateStr)}" style="flex-shrink:0;">Force Entry</button>
            <button class="pbtn tl-ts-force-leave" data-emp-id="${esc(empId)}" data-emp-name="${esc(empName)}" data-date="${esc(dateStr)}" style="flex-shrink:0;">Force Leave</button>
          </div>
        </div>`;
    }

    const { rows } = entryData;
    const empHours = tlCalcHours(rows);

    const slotHourTotals = {};
    rows.forEach(e => {
      if (e.status === 'Leave' || e.status === 'Holiday') return;
      if (!(e.timeIn && e.timeOut)) return;
      const key = e.slot;
      if (!key) return;
      slotHourTotals[key] = (slotHourTotals[key] || 0) + tlParseH(e.hours);
    });
    const slotSummaryHtml = Object.keys(slotHourTotals).length > 1
      ? ['morning', 'afternoon', 'extended']
          .filter(key => slotHourTotals[key] > 0)
          .map(key => {
            const meta = { morning: { icon: '🌅', label: 'Morning' }, afternoon: { icon: '☀️', label: 'Afternoon' }, extended: { icon: '🌙', label: 'Extended' } }[key];
            return `<span style="white-space:nowrap;">${meta.icon} ${meta.label}: <strong style="color:var(--txt1);">${fh(slotHourTotals[key])}</strong></span>`;
          }).join('<span style="color:var(--border-md);">·</span>')
      : '';

    const entryRows = rows.map(e => {
      const isLeave   = e.status === 'Leave';
      const isHoliday = e.status === 'Holiday';
      const projectLabel = isLeave ? '🏖️ Leave' : isHoliday ? '🎉 Holiday' : (e.project || '—');
      const projectColor = isLeave ? '#fbbf24' : isHoliday ? '#9ca3af' : tlColorForKey(e.project || '—');
      const hasRealTimes = !!(e.timeIn && e.timeOut);
      const slotMeta = hasRealTimes ? { morning: { icon: '🌅', label: 'Morning' }, afternoon: { icon: '☀️', label: 'Afternoon' }, extended: { icon: '🌙', label: 'Extended' } }[e.slot] : null;
      const slotBadge = slotMeta
        ? `<span style="flex:0 0 auto;font-size:9.5px;font-weight:700;color:var(--txt2);background:var(--surface2);
            border:1px solid var(--border);border-radius:10px;padding:2px 8px;white-space:nowrap;">${slotMeta.icon} ${slotMeta.label}</span>`
        : '';
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:4px 0;font-size:12px;flex-wrap:wrap;">
          ${slotBadge}
          <span style="flex:0 1 170px;min-width:80px;color:${projectColor};font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(projectLabel)}</span>
          <span style="flex:0 0 70px;color:var(--txt2);text-align:right;">${(isLeave||isHoliday) ? '—' : fh(tlParseH(e.hours))}</span>
          <span style="flex:1;min-width:0;color:var(--txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(e.notes||'')}">${e.notes ? esc(e.notes) : ''}</span>
        </div>`;
    }).join('');

    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:${slotSummaryHtml ? '2px' : '4px'};">
          <div style="width:26px;height:26px;border-radius:50%;background:${empColor};flex-shrink:0;
            display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;">${esc(initials)}</div>
          <span style="font-size:13px;font-weight:700;color:var(--txt1);flex:1 1 auto;min-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(empName)}</span>
          <span style="font-size:12px;font-weight:700;color:var(--a1);">${fh(empHours)}</span>
        </div>
        ${slotSummaryHtml ? `<div style="padding-left:36px;margin-bottom:6px;font-size:11px;color:var(--txt2);display:flex;gap:8px;flex-wrap:wrap;">${slotSummaryHtml}</div>` : ''}
        <div style="padding-left:36px;">${entryRows}</div>
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:1.5rem;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid var(--border-md);">
        <span style="display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:#38bdf8;
          background:rgba(56,189,248,.12);border:1px solid rgba(56,189,248,.3);
          border-radius:8px;padding:4px 12px;">${esc(dateLabel)}</span>
        <span style="font-size:12px;color:var(--txt2);">${empCount} employee${empCount!==1?'s':''} · ${fh(totalHours)} total</span>
      </div>
      ${rowsHtml}
    </div>`;
}

function renderTLTsPager(totalPages) {
  const pagerEl = $('tlTsPager');
  if (!pagerEl) return;
  if (totalPages <= 1) { pagerEl.innerHTML = ''; return; }

  const pageNums = [];
  for (let p = 0; p < totalPages; p++) pageNums.push(p);

  pagerEl.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">
      <button class="pbtn" id="tlTsPagePrev" ${TL_TS_PAGE===0?'disabled':''}>‹ Prev</button>
      ${pageNums.map(p => `<button class="pbtn${p===TL_TS_PAGE?' cur':''}" data-page="${p}">${p+1}</button>`).join('')}
      <button class="pbtn" id="tlTsPageNext" ${TL_TS_PAGE===totalPages-1?'disabled':''}>Next ›</button>
    </div>`;

  $('tlTsPagePrev')?.addEventListener('click', () => { if (TL_TS_PAGE>0) { TL_TS_PAGE--; renderTLTsContent(); } });
  $('tlTsPageNext')?.addEventListener('click', () => { if (TL_TS_PAGE<totalPages-1) { TL_TS_PAGE++; renderTLTsContent(); } });
  pagerEl.querySelectorAll('.pbtn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { TL_TS_PAGE = parseInt(btn.dataset.page, 10); renderTLTsContent(); });
  });
}

function buildTLDayScroll() {
  const bar = $('tlDayScroll'); if (!bar) return;
  const days = getTL15Days();
  bar.innerHTML = days.map((d,i) => {
    const isActive  = i===TL_DAY_OFFSET;
    const isWeekend = new Date(d+'T00:00:00').getDay()%6===0;
    return `<button data-offset="${i}" style="flex-shrink:0;padding:5px 14px;border-radius:20px;
      border:1px solid ${isActive?'var(--a1)':'var(--border)'};
      background:${isActive?'var(--a1)':'var(--surface2)'};
      color:${isActive?'#fff':isWeekend?'#a78bfa':'var(--txt1)'};
      font-size:11px;cursor:pointer;white-space:nowrap;">${tlFmtDate(d)}</button>`;
  }).join('');
  bar.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click',()=>{ TL_DAY_OFFSET=parseInt(btn.dataset.offset); buildTLDayScroll(); renderTLEmpCards(); });
  });
}

function buildTLMonthPicker() {
  const picker = $('tlMonthPicker'); if (!picker) return;
  const months=[];
  const now=new Date();
  for(let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({val:toLocalDateStr(d).slice(0,7),label:d.toLocaleDateString('en-IN',{month:'short',year:'numeric'})});
  }
  picker.innerHTML=months.map(m=>`<button data-month="${m.val}" style="flex-shrink:0;padding:5px 14px;border-radius:20px;
    border:1px solid ${m.val===TL_MONTH?'var(--a1)':'var(--border)'};
    background:${m.val===TL_MONTH?'var(--a1)':'var(--surface2)'};
    color:${m.val===TL_MONTH?'#fff':'var(--txt1)'};
    font-size:11px;cursor:pointer;white-space:nowrap;">${m.label}</button>`).join('');
  picker.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{ TL_MONTH=btn.dataset.month; buildTLMonthPicker(); renderTLEmpCards(); });
  });
}

function getTLFiltered() {
  const tod=todayStr(), ws=weekStart();
  if (TL_RANGE==='day15') { const s=getTL15Days()[TL_DAY_OFFSET]; return TL_DATA.filter(e=>e.date===s); }
  if (TL_RANGE==='week')  return TL_DATA.filter(e=>e.date>=ws&&e.date<=tod);
  if (TL_RANGE==='month') return TL_DATA.filter(e=>e.date.startsWith(TL_MONTH));
  return TL_DATA;
}

function getTLRangeLabel() {
  if (TL_RANGE==='day15') return tlFmtDate(getTL15Days()[TL_DAY_OFFSET]);
  if (TL_RANGE==='week')  return 'This Week';
  if (TL_RANGE==='month') {
    const [y,m]=TL_MONTH.split('-');
    return new Date(parseInt(y),parseInt(m)-1,1).toLocaleDateString('en-IN',{month:'short',year:'numeric'});
  }
  return 'All Time';
}

function getTLWorkingDays() {
  const tod=todayStr(); let start,end;
  if (TL_RANGE==='day15') return [getTL15Days()[TL_DAY_OFFSET]];
  if (TL_RANGE==='week')  { start=weekStart(); end=tod; }
  else if (TL_RANGE==='month') {
    const [y,m]=TL_MONTH.split('-').map(Number);
    start=TL_MONTH+'-01';
    end=TL_MONTH+'-'+String(new Date(y,m,0).getDate()).padStart(2,'0');
    if (end>tod) end=tod;
  } else { const d=new Date(); d.setDate(d.getDate()-90); start=toLocalDateStr(d); end=tod; }
  const dates=[]; const cur=new Date(start+'T00:00:00'); const endDate=new Date(end+'T00:00:00');
  while(cur<=endDate){ const day=cur.getDay(); if(day!==0&&day!==6) dates.push(toLocalDateStr(cur)); cur.setDate(cur.getDate()+1); }
  return dates;
}

function getTL15Days() {
  const dates=[];
  for(let i=0;i<15;i++){ const d=new Date(); d.setDate(d.getDate()-i); dates.push(toLocalDateStr(d)); }
  return dates;
}

function buildTLDonut(projects, total) {
  const size=160, cx=80, cy=80, r=66, innerR=44;
  if (!total||!projects.length) return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface2,#2a2a3e)" stroke-width="18"/></svg>`;
  let a=-90;
  const slices=projects.map(([proj,hrs],i)=>{
    const end=a+(hrs/total)*360;
    const path=tlDonutPath(cx,cy,r,innerR,a,end);
    a=end;
    return `<path d="${path}" fill="${TL_PALETTE[i%TL_PALETTE.length]}" stroke="var(--surface1)" stroke-width="2"><title>${esc(proj)}: ${fh(hrs)}</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
}

function tlDonutPath(cx,cy,ro,ri,s,e) {
  if((e-s)>=359.999) e=s+359.999;
  const sO=tlPt(cx,cy,ro,s),eO=tlPt(cx,cy,ro,e),sI=tlPt(cx,cy,ri,e),eI=tlPt(cx,cy,ri,s);
  const lg=(e-s)>180?1:0;
  return [`M ${sO.x} ${sO.y}`,`A ${ro} ${ro} 0 ${lg} 1 ${eO.x} ${eO.y}`,`L ${sI.x} ${sI.y}`,`A ${ri} ${ri} 0 ${lg} 0 ${eI.x} ${eI.y}`,'Z'].join(' ');
}
function tlPt(cx,cy,r,deg){ const rad=deg*Math.PI/180; return {x:+(cx+r*Math.cos(rad)).toFixed(3),y:+(cy+r*Math.sin(rad)).toFixed(3)}; }

function tlCalcHours(arr) { return arr.filter(isWorkedEntry).reduce((s,e)=>s+tlParseH(e.hours),0); }

function tlParseH(val) {
  if(!val) return 0;
  const s=String(val).trim();
  const h=(s.match(/(\d+)h/)||[])[1], m=(s.match(/(\d+)m/)||[])[1];
  if(!h&&!m) return parseFloat(s)||0;
  return (parseInt(h||0)*60+parseInt(m||0))/60;
}

function tlFmtDate(dateStr) {
  return new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
}

function tlToMins(t) { if(!t) return 0; const [h,m]=t.split(':').map(Number); return h*60+m; }

function tlFmt12(t) {
  if(!t) return '--:--';
  const [h,m]=t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

function tlToast(msg, isError=false) {
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${isError?'#ef4444':'#1e293b'};color:#fff;padding:10px 20px;
    border-radius:8px;font-size:13px;z-index:99999;
    box-shadow:0 4px 20px rgba(0,0,0,.4);white-space:nowrap;`;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// FORCEENTRY
let FE_EMP         = null;   
let FE_DATE        = '';     
let FE_RETURN_TO   = null;   

let FE_EXISTING     = { morning: [], afternoon: [] };

const FE_MAX_ENTRIES_PER_SLOT = 4;
const FE_MIN_NOTES_LENGTH     = 25;

const FE_SLOT_META = {
  morning:   { label: 'Morning',   icon: '🌅', defaultIn: '09:30', defaultOut: '13:00', minTime: '08:30', maxTime: '13:00', displayMin: '09:30' },
  afternoon: { label: 'Afternoon', icon: '☀️',  defaultIn: '13:45', defaultOut: '19:30', minTime: '13:30', maxTime: '20:00', displayMin: '13:45' },
};

const FE_TASKS = ['Modelling & Texturing','lighting & Rendering', 'Web Development','2D FloorPlan', 'Editing & Grading', 'Unreal App Development', 'Training R&D'];

function getEnteredByInfo() {
  if (typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE) {
    return { name: (typeof USER !== 'undefined' && USER?.name) || 'Manager', role: 'Manager' };
  }
  if (typeof TL_MODE !== 'undefined' && TL_MODE) {
    return { name: (typeof USER !== 'undefined' && USER?.name) || 'Team Leader', role: 'Team Leader' };
  }
  if (typeof HR_MODE !== 'undefined' && HR_MODE) {
    return { name: (typeof USER !== 'undefined' && USER?.name) || 'HR', role: 'HR' };
  }
  return { name: (typeof USER !== 'undefined' && USER?.name) || 'Manager', role: 'Manager' };
}

function openForceEntry(empId, empName, dateStr, onDone) {
  FE_EMP       = { id: empId, name: empName };
  FE_DATE      = dateStr;
  FE_RETURN_TO = typeof onDone === 'function' ? onDone : null;
  FE_EXISTING  = { morning: [], afternoon: [] }; 

  const container = (typeof TL_MODE !== 'undefined' && TL_MODE) ? $('tlApp')
    : (typeof HR_MODE !== 'undefined' && HR_MODE) ? $('hrApp')
    : $('mgrApp');
  if (!container) return;

  const enteredBy = getEnteredByInfo();
  const dateLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN',
    { day: 'numeric', month: 'short', year: 'numeric' });

  container.innerHTML = `
    <div id="forceEntryPage" style="animation: feFadeIn .2s ease;">
      <!-- Back -->
      <div style="margin-bottom:1rem;">
        <button id="feBack" style="
          display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;
          border:1px solid var(--border-md);background:var(--elevated);
          color:var(--txt2);font-size:13px;font-weight:600;cursor:pointer;">← Back</button>
      </div>

      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.1rem;">
        <span style="font-size:22px;">🟣</span>
        <div>
          <div style="font-size:20px;font-weight:800;color:var(--txt1);">Force Entry</div>
          <div style="font-size:12px;color:var(--txt2);">Submitting a timesheet on behalf of an employee</div>
        </div>
      </div>

      <!-- Identity strip -->
      <div class="fe-info-grid">
        <div class="fe-info-item"><span>Employee</span><strong>${esc(empName)}</strong></div>
        <div class="fe-info-item"><span>Employee ID</span><strong>${esc(empId)}</strong></div>
        <div class="fe-info-item"><span>Date</span><strong>${dateLabel}</strong></div>
        <div class="fe-info-item"><span>Entered By</span><strong>${esc(enteredBy.role)}</strong></div>
      </div>

      <!-- Morning / Afternoon sessions -->
      <div id="feSlotsContainer"></div>

      <!-- Force Entry Information (audit fields) -->
      <div class="fe-audit-block">
        <div class="fe-audit-title">🛠 Force Entry Information</div>

        <div class="fg">
          <label class="flabel">Entered By</label>
          <input class="fc" id="feEnteredByName" value="${esc(enteredBy.role)}" readonly />
        </div>
        <div class="fg" style="margin-top:.6rem;">
          <label class="flabel">Reason <span class="req">*</span></label>
          <textarea class="fc ta" id="feReason" rows="2" maxlength="200"
            placeholder="Why is this being entered manually? e.g. Employee forgot to submit timesheet."></textarea>
        </div>
      </div>

      <!-- Save -->
      <div style="display:flex;justify-content:flex-end;margin-top:1rem;">
        <button class="btn bpri save-btn" id="feSaveAllBtn" onclick="saveForceEntryAll()">
          <span class="bl">Save Force Entry</span>
          <svg class="bi" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <div class="bspin"></div>
        </button>
      </div>
    </div>

    <style>
      @keyframes feFadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
      .fe-info-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1.1rem; }
      .fe-info-item {
        background:var(--surface1);border:1px solid var(--border);border-radius:10px;
        padding:.7rem .9rem;display:flex;flex-direction:column;gap:2px;
      }
      .fe-info-item span { font-size:10px;color:var(--txt2);text-transform:uppercase;letter-spacing:.05em; }
      .fe-info-item strong { font-size:13.5px;color:var(--txt1); }
      .fe-audit-block {
        background:var(--surface1);border:1px solid rgba(167,139,250,0.35);
        border-radius:12px;padding:1.1rem;margin-top:1.1rem;
      }
      .fe-audit-title { font-weight:700;font-size:14px;color:#a78bfa;margin-bottom:.6rem; }
      .fe-audit-block input[readonly] { opacity:.75;cursor:default; }
      #feBack:hover { color:var(--txt1);background:var(--hover); }
    </style>
  `;

  $('feBack').addEventListener('click', () => {
    if (FE_RETURN_TO) FE_RETURN_TO();
    else if (typeof openEmpDetail === 'function') openEmpDetail(empId, empName);
  });

  loadFeExistingAndRender();
}

async function loadFeExistingAndRender() {
  const container = $('feSlotsContainer');
  if (container) container.innerHTML = `<div class="slot-loading"><div class="slot-spinner"></div><span>Loading this day's existing entries…</span></div>`;

  try {
    const data = await apiGetDaySlots(FE_EMP.id, FE_DATE);
    const grouped = { morning: [], afternoon: [] };
    (data.entries || []).forEach(e => {
      if (grouped[e.slot]) grouped[e.slot].push(e);
    });
    Object.keys(grouped).forEach(s => grouped[s].sort((a, b) => a.entryNum - b.entryNum));
    FE_EXISTING = grouped;
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div class="slot-error">
          <div>Failed to load this day's existing entries: ${esc(err.message)}</div>
          <button id="feRetryLoadExisting" class="btn bghost" style="margin-top:.75rem">↻ Retry</button>
        </div>`;
      $('feRetryLoadExisting')?.addEventListener('click', () => loadFeExistingAndRender());
    }
    return;
  }

  renderForceEntrySlots();
}

function renderForceEntrySlots() {
  const container = $('feSlotsContainer');
  if (!container) return;
  container.innerHTML = `
    ${renderFeSlotBlock('morning')}
    ${renderFeLunchBlock()}
    ${renderFeSlotBlock('afternoon')}
  `;
}

function renderFeSlotBlock(slotKey) {
  const meta = FE_SLOT_META[slotKey];
  const existingAll = FE_EXISTING[slotKey] || [];

  const editable = existingAll.filter(e => e.status !== 'Leave');
  const leaveEntries = existingAll.filter(e => e.status === 'Leave');
  const maxEntryNum = existingAll.reduce((m, e) => Math.max(m, e.entryNum), 0);
  const atMax = existingAll.length >= FE_MAX_ENTRIES_PER_SLOT;

  const rowsHtml = editable.length
    ? editable.map(e => renderFeEntryRow(slotKey, e.entryNum, e)).join('')
    : renderFeEntryRow(slotKey, maxEntryNum + 1, null);

  const leaveNote = leaveEntries.length ? `
    <div style="font-size:11px;color:#fbbf24;margin:2px 0 10px;">
      🏖 Entry ${leaveEntries.map(e => e.entryNum).join(', ')} in this slot ${leaveEntries.length > 1 ? 'are' : 'is'} already marked Leave —
      use Force Leave on the Attendance grid to change ${leaveEntries.length > 1 ? 'them' : 'it'} instead.
    </div>` : '';

  return `
  <div class="slot-block" id="feSlot-${slotKey}">
    <div class="slot-header">
      <div class="slot-title">
        <span class="slot-icon">${meta.icon}</span>
        <span class="slot-label">${meta.label}</span>
        <span class="slot-time-range">${meta.defaultIn} – ${meta.defaultOut}</span>
      </div>
      <button class="add-entry-btn" onclick="addFeEntry('${slotKey}')" title="Add another project in this slot"
        ${atMax ? 'style="display:none;"' : ''}>
        + Add Project
      </button>
    </div>
    ${leaveNote}
    <div class="slot-entries" id="feEntries-${slotKey}">
      ${rowsHtml}
    </div>
  </div>`;
}

function renderFeLunchBlock() {
  return `
  <div class="lunch-block">
    <span>🍽️</span>
    <span class="lunch-label">Lunch Break</span>
    <span class="lunch-time">1:00 PM – 1:45 PM</span>
    <span class="lunch-badge">45 min</span>
  </div>`;
}

function renderFeEntryRow(slotKey, entryNum, existing) {
  const meta = FE_SLOT_META[slotKey];
  const id   = `fe-${slotKey}-${entryNum}`;

  const timeIn    = existing?.timeIn  || meta.defaultIn;
  const timeOut   = existing?.timeOut || meta.defaultOut;
  const clientId  = existing?.clientId  || '';
  const projectId = existing?.projectId || '';
  const task      = existing?.task  || '';
  const notes     = existing?.notes || '';
  const hours     = existing?.hours || '';

  const projectOptions = clientId
    ? PROJECTS.filter(p => p.cid === clientId).map(p =>
        `<option value="${p.id}" data-n="${p.name}"${p.id === projectId ? ' selected' : ''}>${p.name}</option>`
      ).join('')
    : '';

  const noteCounter = notes.length >= FE_MIN_NOTES_LENGTH
    ? `${notes.length}/300`
    : `${notes.length}/${FE_MIN_NOTES_LENGTH} minimum`;

  return `
  <div class="entry-row" id="feEntry-${id}" data-slot="${slotKey}" data-num="${entryNum}">
    <div class="entry-row-header">
      <span class="entry-num">Entry ${entryNum}</span>
      ${entryNum > 1
        ? `<button class="remove-entry-btn" onclick="removeFeEntry('${slotKey}', ${entryNum})" title="Remove">✕</button>`
        : ''}
    </div>

    <div class="entry-times">
      <div class="fg">
        <label class="flabel">Time In</label>
        <input type="time" class="fc time-inp" id="fetin-${id}" value="${timeIn}"
          min="${meta.displayMin}" max="${meta.maxTime}" onchange="calcFeHours('${id}')" />
      </div>
      <div class="time-arrow">→</div>
      <div class="fg">
        <label class="flabel">Time Out</label>
        <input type="time" class="fc time-inp" id="fetout-${id}" value="${timeOut}"
          min="${meta.displayMin}" max="${meta.maxTime}" onchange="calcFeHours('${id}')" />
      </div>
      <div class="fg hours-display">
        <label class="flabel">Hours</label>
        <div class="hours-badge" id="fehrs-${id}">${hours ? fmtFeHours(hours) : '—'}</div>
      </div>
    </div>
    <div class="slot-time-hint">Allowed range: ${meta.displayMin} – ${meta.maxTime}</div>

    <div class="frow">
      <div class="fg">
        <label class="flabel">Client <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc client-sel" id="fecsel-${id}" onchange="onFeClientChange('${id}')">
            <option value="">— Client —</option>
            ${CLIENTS.map(c => `<option value="${c.id}" data-n="${c.name}"${c.id === clientId ? ' selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="fg">
        <label class="flabel">Project <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc project-sel" id="fepsel-${id}" ${clientId ? '' : 'disabled'}>
            <option value="">— ${clientId ? 'Project' : 'Select client first'} —</option>
            ${projectOptions}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="fg">
        <label class="flabel">Task <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc" id="fetsel-${id}">
            <option value="">— Task —</option>
            ${FE_TASKS.map(t => `<option${t === task ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>

    <div class="fg" style="margin-top:.6rem">
      <label class="flabel">Notes <span class="req">*</span></label>
      <textarea class="fc ta" id="fenotes-${id}" rows="2"
        placeholder="What did the employee work on? (min ${FE_MIN_NOTES_LENGTH} characters)" maxlength="300"
        oninput="updateFeNotesCount('${id}')">${notes}</textarea>
      <div class="tafoot"><span class="cc" id="fecc-${id}">${noteCounter}</span></div>
    </div>
  </div>`;
}

function fmtFeHours(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hh = Math.floor(totalMins / 60);
  const mm = totalMins % 60;
  if (hh === 0) return `${mm}m`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h ${mm}m`;
}

function addFeEntry(slotKey) {
  const container = $(`feEntries-${slotKey}`);
  if (!container) return;
  const domRows = container.querySelectorAll('.entry-row');
  const existingAll = FE_EXISTING[slotKey] || [];

  const totalCount = Math.max(domRows.length, existingAll.length);
  if (totalCount >= FE_MAX_ENTRIES_PER_SLOT) {
    toast?.('i', 'Max 4 entries per slot');
    return;
  }

  const domMaxNum = Array.from(domRows).reduce((m, r) => Math.max(m, parseInt(r.dataset.num, 10) || 0), 0);
  const existingMaxNum = existingAll.reduce((m, e) => Math.max(m, e.entryNum), 0);
  const newNum = Math.max(domMaxNum, existingMaxNum) + 1;

  const div = document.createElement('div');
  div.innerHTML = renderFeEntryRow(slotKey, newNum, null);
  container.appendChild(div.firstElementChild);

  const addBtn = document.querySelector(`#feSlot-${slotKey} .add-entry-btn`);
  if (addBtn && (totalCount + 1) >= FE_MAX_ENTRIES_PER_SLOT) addBtn.style.display = 'none';
}

function removeFeEntry(slotKey, entryNum) {
  const el = $(`feEntry-fe-${slotKey}-${entryNum}`);
  if (el) el.remove();
  const addBtn = document.querySelector(`#feSlot-${slotKey} .add-entry-btn`);
  if (addBtn) addBtn.style.display = '';
}

function onFeClientChange(id) {
  const csel = $(`fecsel-${id}`);
  const psel = $(`fepsel-${id}`);
  if (!csel || !psel) return;
  const cid = csel.value;
  psel.innerHTML = '<option value="">— Project —</option>';
  if (cid) {
    PROJECTS.filter(p => p.cid === cid).forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name; o.dataset.n = p.name;
      psel.appendChild(o);
    });
    psel.disabled = false;
  } else {
    psel.innerHTML = '<option value="">— Select client first —</option>';
    psel.disabled = true;
  }
}

function calcFeHours(id) {
  const tin   = $(`fetin-${id}`)?.value;
  const tout  = $(`fetout-${id}`)?.value;
  const hrsEl = $(`fehrs-${id}`);
  if (!tin || !tout || !hrsEl) return;
  const [ih, im] = tin.split(':').map(Number);
  const [oh, om] = tout.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  if (mins <= 0) { hrsEl.textContent = '—'; return; }
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  hrsEl.textContent = hh === 0 ? `${mm}m` : mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

function updateFeNotesCount(id) {
  const ta = $(`fenotes-${id}`);
  const cc = $(`fecc-${id}`);
  if (!ta || !cc) return;
  const len = ta.value.trim().length;
  cc.textContent = len >= FE_MIN_NOTES_LENGTH ? `${len}/300` : `${len}/${FE_MIN_NOTES_LENGTH} minimum`;
  cc.style.color = len >= FE_MIN_NOTES_LENGTH ? 'var(--ok)' : 'var(--err)';
  ta.classList.remove('bad');
}

async function saveForceEntryAll() {
  const btn      = $('feSaveAllBtn');
  const reasonEl = $('feReason');
  const reason   = reasonEl.value.trim();

  if (!reason) {
    toast?.('e', 'Reason required', 'Explain why this entry is being force-entered.');
    reasonEl.classList.add('bad'); reasonEl.focus();
    return;
  }
  reasonEl.classList.remove('bad');

  const toMinutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const collected = [];

  for (const slotKey of ['morning', 'afternoon']) {
    const rows = document.querySelectorAll(`#feEntries-${slotKey} .entry-row`);
    for (const row of rows) {
      const entryNum = parseInt(row.dataset.num, 10);
      const id    = `fe-${slotKey}-${entryNum}`;
      const csel  = $(`fecsel-${id}`), psel = $(`fepsel-${id}`), tsel = $(`fetsel-${id}`);
      const tin   = $(`fetin-${id}`),  tout = $(`fetout-${id}`), notesInp = $(`fenotes-${id}`);

      const touched = !!(csel.value || psel.value || tsel.value || notesInp.value.trim());
      if (!touched) continue; 

      const label = FE_SLOT_META[slotKey].label;
      if (!csel.value)  { toast?.('e', `${label} #${entryNum}: select a client`);  csel.classList.add('bad'); return; }
      if (!psel.value)  { toast?.('e', `${label} #${entryNum}: select a project`); psel.classList.add('bad'); return; }
      if (!tsel.value)  { toast?.('e', `${label} #${entryNum}: select a task`);    tsel.classList.add('bad'); return; }
      if (!tin.value)   { toast?.('e', `${label} #${entryNum}: enter time in`);  return; }
      if (!tout.value)  { toast?.('e', `${label} #${entryNum}: enter time out`); return; }

      const meta = FE_SLOT_META[slotKey];
      const minM = toMinutes(meta.minTime), maxM = toMinutes(meta.maxTime);
      const inM  = toMinutes(tin.value),    outM = toMinutes(tout.value);

      if (inM < minM || inM > maxM) {
        toast?.('e', 'Time In out of range', `${label} allows ${meta.displayMin}–${meta.maxTime}`);
        tin.classList.add('bad'); return;
      }
      if (outM < minM || outM > maxM) {
        toast?.('e', 'Time Out out of range', `${label} allows ${meta.displayMin}–${meta.maxTime}`);
        tout.classList.add('bad'); return;
      }
      if (outM <= inM) {
        toast?.('e', 'Time Out must be after Time In');
        tout.classList.add('bad'); return;
      }
      tin.classList.remove('bad'); tout.classList.remove('bad');

      const notesVal = notesInp.value.trim();
      if (notesVal.length < FE_MIN_NOTES_LENGTH) {
        toast?.('e', 'Notes too short', `Write at least ${FE_MIN_NOTES_LENGTH} characters (currently ${notesVal.length})`);
        notesInp.classList.add('bad'); notesInp.focus();
        return;
      }
      notesInp.classList.remove('bad');
      csel.classList.remove('bad'); psel.classList.remove('bad'); tsel.classList.remove('bad');

      let hours = 0;
      const mins = outM - inM;
      if (mins > 0) hours = Math.round((mins / 60) * 100) / 100;

      const cOpt = csel.options[csel.selectedIndex];
      const pOpt = psel.options[psel.selectedIndex];

      collected.push(buildForceEntry(slotKey, entryNum, {
        timeIn: tin.value, timeOut: tout.value, hours,
        clientId:  csel.value, client:  cOpt?.dataset?.n || cOpt?.text || '',
        projectId: psel.value, project: pOpt?.dataset?.n || pOpt?.text || '',
        task: tsel.value, notes: notesVal,
      }, reason));
    }
  }

  if (!collected.length) {
    toast?.('e', 'Nothing to save', 'Fill in at least one Morning or Afternoon entry.');
    return;
  }

  if (btn) { btn.classList.add('ld'); btn.disabled = true; }
  toast?.('i', 'Saving force entry…', 'Please wait', 18000);

  const results = await Promise.allSettled(collected.map(entry => apiSaveSlot(entry)));
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results
    .map((r, i) => ({ r, entry: collected[i] }))
    .filter(x => x.r.status === 'rejected');

  if (btn) { btn.classList.remove('ld'); btn.disabled = false; }

  if (failed.length === 0) {
    toast?.('s', 'Force Entry saved', `${succeeded} session${succeeded > 1 ? 's' : ''} recorded for ${FE_EMP.name}.`);
    if (FE_RETURN_TO) FE_RETURN_TO();
    else if (typeof openEmpDetail === 'function') await openEmpDetail(FE_EMP.id, FE_EMP.name);
    return;
  }

  if (succeeded > 0) {

    const reasons = failed.map(x => `${x.entry.slot} #${x.entry.entryNum}: ${x.r.reason.message}`).join(' · ');
    toast?.('e', `${succeeded} of ${collected.length} saved`, reasons, 10000);
  } else {
    toast?.('e', 'Save failed', failed[0].r.reason.message);
  }
}

function buildForceEntry(slotKey, entryNum, fields, reason) {
  const enteredBy = getEnteredByInfo();
  const now = new Date();
  const savedAt = now.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  const tag = `[FORCE_ENTRY by ${enteredBy.name} (${enteredBy.role}) · ${savedAt}] `
    + `Reason: ${reason} | Employee notes: ${fields.notes}`;

  return {
    id:      `${FE_EMP.id}-${FE_DATE}-${slotKey}-${entryNum}`,
    uid:     FE_EMP.id,
    empName: FE_EMP.name,
    date:    FE_DATE,
    day:     new Date(FE_DATE + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' }),
    slot:    slotKey,
    entryNum,
    timeIn:  fields.timeIn,
    timeOut: fields.timeOut,
    hours:   fields.hours,
    clientId:  fields.clientId,
    client:    fields.client,
    projectId: fields.projectId,
    project:   fields.project,
    task:      fields.task,
    notes:     tag,
    status:    'Worked',
    savedAt,

    forceEntry:     true,
    empId:          FE_EMP.id,
    enteredBy:      enteredBy.name,
    enteredByRole:  enteredBy.role,
    entryDate:      FE_DATE,
    timestamp:      savedAt,
    reason,
  };
}

// DASHBOARD
let DASH_CONTAINER    = null;
let DASH_CACHE        = null;  
let DASH_FINGERPRINT  = '';    

let DASH_LEVEL   = 'all';  
let DASH_YEAR    = null;
let DASH_QUARTER = null;   

const DASH_QUARTER_MONTHS = {
  Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12],
};
const DASH_MONTH_NAME = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ensureDashStyles() {
  if (document.getElementById('dash-global-styles')) return;
  const style = document.createElement('style');
  style.id = 'dash-global-styles';
  style.textContent = `
    .dash-candle { cursor:pointer; transition:filter .15s ease, transform .15s ease; border-radius:4px 4px 2px 2px; }
    .dash-candle:hover { filter:brightness(1.2); transform:scaleY(1.02); }
    .dash-candle-disabled { cursor:default; }
    .dash-fade-in { animation:dashFadeIn .25s ease; }
    @keyframes dashFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
    .dash-crumb { cursor:pointer; color:var(--a1); }
    .dash-crumb:hover { text-decoration:underline; }
    .dash-kpi-card:hover { transform:translateY(-3px); box-shadow:0 14px 34px rgba(0,0,0,.10); }
  `;
  document.head.appendChild(style);
}

async function renderManagerDashboard(content) {
  DASH_CONTAINER = content;
  ensureDashStyles();

  if (typeof MANAGER_MODE !== 'undefined' && !MANAGER_MODE) {
    content.innerHTML = `<div class="chart-empty">The Dashboard is only available to the Manager.</div>`;
    return;
  }

  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading dashboard…</span></div>`;

  try {

    await Promise.all([loadProjectBundle(), ensureSalaryDataLoaded()]);

    if (typeof loadProjects === 'function' && (typeof GANTT_PROJECTS === 'undefined' || !GANTT_PROJECTS.length)) {
      await loadProjects();
    }
  } catch (err) {
    content.innerHTML = `<div class="slot-error">Failed to load: ${esc(err.message)}</div>`;
    return;
  }

  buildTeamPerformanceCache();

  const currentYear = String(new Date().getFullYear());
  if (DASH_CACHE.years[currentYear]) {
    DASH_LEVEL = 'year'; DASH_YEAR = currentYear; DASH_QUARTER = null;
  } else {
    DASH_LEVEL = 'all'; DASH_YEAR = null; DASH_QUARTER = null;
  }

  content.innerHTML = `
    <div id="dashKpiWrap" style="margin-bottom:22px;"></div>
    <div style="display:flex;gap:10px;align-items:stretch;">
      <div style="flex:0 0 330px;" id="dashNotLoggedWrap"></div>
      <div style="flex:0 0 600px;" id="dashTeamPerfWrap"></div>
      <div style="flex:1;min-width:280px;" id="dashClientRollupWrap"></div>
    </div>`;
  renderDashboardKpiRow($('dashKpiWrap'));
  renderDashboardNotLoggedPanel($('dashNotLoggedWrap'));
  renderDashboardShell($('dashTeamPerfWrap'));
  renderDashboardClientRollup($('dashClientRollupWrap'));
}

function buildTeamPerformanceCache(force = false) {
  const fingerprint = [
    (typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA.length : 0),
    (typeof CP_HISTORICAL_DATA !== 'undefined' ? CP_HISTORICAL_DATA.length : 0),
    (typeof CP_PROJECTS !== 'undefined' ? CP_PROJECTS.length : 0),
    (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES.length : 0),
  ].join(':');

  if (!force && fingerprint === DASH_FINGERPRINT && DASH_CACHE) return; 

  const projectIdByName = {};
  (typeof CP_PROJECTS !== 'undefined' ? CP_PROJECTS : []).forEach(p => { projectIdByName[p.projectName] = p.projectId; });

  const years = {};
  function bucket(dateYear, monthNum, hours, empId, projectKey) {
    if (!dateYear || !monthNum) return;
    const quarterKey = 'Q' + Math.ceil(monthNum / 3);
    const monthKey = `${dateYear}-${String(monthNum).padStart(2, '0')}`;

    if (!years[dateYear]) years[dateYear] = { hours: 0, employees: new Set(), projects: new Set(), quarters: {} };
    const y = years[dateYear];
    y.hours += hours; if (empId) y.employees.add(empId); if (projectKey) y.projects.add(projectKey);

    if (!y.quarters[quarterKey]) y.quarters[quarterKey] = { hours: 0, employees: new Set(), projects: new Set(), months: {} };
    const q = y.quarters[quarterKey];
    q.hours += hours; if (empId) q.employees.add(empId); if (projectKey) q.projects.add(projectKey);

    if (!q.months[monthKey]) q.months[monthKey] = { hours: 0, employees: new Set(), projects: new Set(), monthNum };
    const m = q.months[monthKey];
    m.hours += hours; if (empId) m.employees.add(empId); if (projectKey) m.projects.add(projectKey);
  }

  (typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : [])
    .filter(e => typeof isWorkedEntry !== 'function' || isWorkedEntry(e))
    .forEach(e => {
      if (!e.date) return;
      const [y, m] = e.date.split('-').map(Number);
      const hours = typeof parseH === 'function' ? parseH(e.hours) : (Number(e.hours) || 0);
      const projectKey = projectIdByName[e.project] || e.project;
      bucket(y, m, hours, e.empId, projectKey);
    });

  (typeof CP_HISTORICAL_DATA !== 'undefined' ? CP_HISTORICAL_DATA : []).forEach(r => {
    const monthNum = (typeof HIST_MONTH_NUM !== 'undefined' ? HIST_MONTH_NUM[r.month] : null);
    if (!monthNum || !r.year) return;
    bucket(parseInt(r.year, 10), monthNum, parseFloat(r.totalHours) || 0, r.employeeId, r.projectId);
  });

  DASH_CACHE = { years };
  DASH_FINGERPRINT = fingerprint;
}

function dashTotalViews(monthKeys) {
  if (typeof GANTT_PROJECTS === 'undefined' || typeof getMonthlyViewsDelivered !== 'function') return null;
  let total = 0;
  GANTT_PROJECTS.forEach(p => {
    monthKeys.forEach(mk => { total += getMonthlyViewsDelivered(p, mk).views; });
  });
  return total;
}

function dashStatsFor(bucket) {
  if (!bucket) return { hours: 0, employees: 0, projects: 0, avgPerEmployee: 0 };
  const employees = bucket.employees.size;
  return {
    hours: bucket.hours,
    employees,
    projects: bucket.projects.size,
    avgPerEmployee: employees > 0 ? bucket.hours / employees : 0,
  };
}

const DASH_KPI_CARDS = [

  { label: 'Active Projects in 3D',           count: 24, deltaPct: 12, color: '#4f8ef7', bg: 'rgba(79,142,247,.12)', icon: '📦' },
  { label: 'Active Projects in Unreal Engine', count: 16, deltaPct: 8,  color: '#7c5cfc', bg: 'rgba(124,92,252,.12)', icon: '🎮' },
  { label: 'Active Projects in the Web',       count: 32, deltaPct: 15, color: '#34d399', bg: 'rgba(52,211,153,.12)', icon: '🌐' },
];

function renderDashboardKpiRow(wrap) {
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;">
      ${DASH_KPI_CARDS.map(dashBuildKpiCard).join('')}
    </div>`;
}

function renderDashboardNotLoggedPanel(wrap) {
  if (!wrap) return;
  wrap.innerHTML = dashBuildNotLoggedInCard();
  wireDashNotLoggedIn(wrap);
}

function dashBuildKpiCard(card) {
  const up = card.deltaPct >= 0;

  const points = Array.from({ length: 12 }, (_, i) => {
    const seed = (card.label.length * 7 + i * 13) % 10;
    return 18 - seed * 1.4 + (i > 6 ? (i - 6) * 2.2 : 0);
  });
  const pathD = points.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 8} ${20 - y}`).join(' ');

  return `
    <div class="dash-kpi-card" style="background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.06);
      padding:24px;transition:transform .18s ease, box-shadow .18s ease;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;">
        <div style="width:44px;height:44px;border-radius:12px;background:${card.bg};display:flex;align-items:center;
          justify-content:center;font-size:20px;">${card.icon}</div>
      </div>
      <div style="margin-top:14px;font-size:13px;font-weight:600;color:var(--txt2);">${esc(card.label)}</div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:2px;">
        <div>
          <div style="font-size:30px;font-weight:800;color:${card.color};line-height:1.1;">${card.count}</div>
          <div style="font-size:12px;font-weight:600;color:${up ? '#34d399' : '#f87171'};margin-top:4px;">
            ${up ? '↑' : '↓'} ${Math.abs(card.deltaPct)}% vs last month
          </div>
        </div>
        <svg width="96" height="32" viewBox="0 0 96 32" style="overflow:visible;">
          <path d="${pathD}" fill="none" stroke="${card.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
        </svg>
      </div>
    </div>`;
}

function dashComputeNotLoggedIn() {
  const employees = typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : [];
  const entries   = typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : [];
  const today = todayStr();

  const loggedTodayIds = new Set(entries.filter(e => e.date === today).map(e => e.empId));
  const lastActivityByEmp = {};
  entries.forEach(e => {
    if (!e.date) return;
    if (!lastActivityByEmp[e.empId] || e.date > lastActivityByEmp[e.empId]) lastActivityByEmp[e.empId] = e.date;
  });

  return employees
    .filter(emp => emp.active !== false) 
    .filter(emp => !loggedTodayIds.has(emp.id))
    .map(emp => ({ emp, lastActivity: lastActivityByEmp[emp.id] || null }))
    .sort((a, b) => (a.lastActivity || '').localeCompare(b.lastActivity || '')); 
}

function dashRelativeDays(dateStr) {
  if (!dateStr) return 'No activity logged';
  const today = new Date(todayStr() + 'T00:00:00');
  const then  = new Date(dateStr + 'T00:00:00');
  const days = Math.round((today - then) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

const DASH_AVATAR_COLORS = ['#fca5a5', '#fdba74', '#fcd34d', '#86efac', '#93c5fd', '#c4b5fd', '#f9a8d4'];
function dashAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return DASH_AVATAR_COLORS[hash % DASH_AVATAR_COLORS.length];
}

function dashBuildNotLoggedInCard() {
  const list = dashComputeNotLoggedIn();
  const shown = list.slice(0, 5);

  const rowsHtml = shown.length ? shown.map(({ emp, lastActivity }) => {
    const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="width:38px;height:38px;border-radius:50%;background:${dashAvatarColor(emp.name)};
          display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#3a2a1a;flex-shrink:0;">${esc(initials)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(emp.name)}</div>
          <div style="font-size:11.5px;color:var(--txt2);">${esc(emp.team || '—')}</div>
        </div>
        <div style="font-size:11.5px;font-weight:600;color:#f87171;white-space:nowrap;">${esc(dashRelativeDays(lastActivity))}</div>
      </div>`;
  }).join('') : `<div style="padding:20px 0;text-align:center;color:var(--txt2);font-size:12.5px;">Everyone has logged in today. 🎉</div>`;

  return `
    <div style="background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.06);padding:24px;
      height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="font-size:15px;font-weight:700;color:var(--txt1);margin-bottom:14px;">Not Logged In <span style="font-size:11px;color:var(--txt2);font-weight:500;">— no entry today</span></div>
      <div style="flex:1;overflow-y:auto;">${rowsHtml}</div>
      ${list.length > 5 ? `<button id="dashNotLoggedViewAll" style="margin-top:14px;width:100%;background:none;
        border:1px solid var(--border-md);border-radius:8px;padding:9px;font-size:12.5px;font-weight:700;
        color:var(--a1);cursor:pointer;">View all (${list.length})</button>` : ''}
    </div>`;
}

function wireDashNotLoggedIn(wrap) {
  wrap.querySelector('#dashNotLoggedViewAll')?.addEventListener('click', () => {

    if (typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE && typeof MGR_TAB !== 'undefined' && typeof renderMgrTab === 'function') {
      MGR_TAB = 'attendance';
      document.querySelectorAll('.mgr-tab').forEach(b => {
        const active = b.dataset.tab === 'attendance';
        b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
        b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
      });
      renderMgrTab();
    } else if (typeof HR_MODE !== 'undefined' && HR_MODE && typeof HR_TAB !== 'undefined' && typeof renderHRTab === 'function') {
      HR_TAB = 'attendance';
      document.querySelectorAll('.hr-tab').forEach(b => {
        const active = b.dataset.tab === 'attendance';
        b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
        b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
      });
      renderHRTab();
    } else {
      dashOpenNotLoggedInAll(); 
    }
  });
}

function dashOpenNotLoggedInAll() {
  const list = dashComputeNotLoggedIn();
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:24px;width:420px;max-width:92vw;max-height:80vh;overflow-y:auto;">
      <div style="font-size:15px;font-weight:700;color:var(--txt1);margin-bottom:14px;">Not Logged In Today (${list.length})</div>
      ${list.map(({ emp, lastActivity }) => {
        const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        return `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
            <div style="width:38px;height:38px;border-radius:50%;background:${dashAvatarColor(emp.name)};
              display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#3a2a1a;flex-shrink:0;">${esc(initials)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#1a1a2e;">${esc(emp.name)}</div>
              <div style="font-size:11.5px;color:#6b7280;">${esc(emp.team || '—')}</div>
            </div>
            <div style="font-size:11.5px;font-weight:600;color:#f87171;white-space:nowrap;">${esc(dashRelativeDays(lastActivity))}</div>
          </div>`;
      }).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <button id="dashNotLoggedClose" style="background:none;border:1px solid var(--border-md);color:var(--txt2);
          border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#dashNotLoggedClose').addEventListener('click', () => overlay.remove());
}

function renderDashboardShell(content) {
  content.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1.4rem;height:100%;box-sizing:border-box;">
      <div style="margin-bottom:1.2rem;">
        <div style="font-size:16px;font-weight:700;color:var(--txt1);">📊 Team Performance</div>
        <div style="font-size:12px;color:var(--txt2);">The complete productivity history of the company — click a bar to drill down.</div>
      </div>
      <div id="dashBreadcrumb" style="font-size:12.5px;color:var(--txt2);margin-bottom:1.1rem;"></div>
      <div id="dashChartArea"></div>
    </div>`;

  renderDashboardChart();
}

function dashBreadcrumbHtml() {
  const parts = [`<span class="${DASH_LEVEL === 'all' ? '' : 'dash-crumb'}" id="dashCrumbAll">All Time</span>`];
  if (DASH_YEAR) parts.push(`<span class="${DASH_LEVEL === 'year' ? '' : 'dash-crumb'}" id="dashCrumbYear">${DASH_YEAR}</span>`);
  if (DASH_QUARTER) parts.push(`<span>${esc(DASH_QUARTER)}</span>`);
  return parts.join(' <span style="color:var(--txt2);">›</span> ');
}

function renderDashboardChart() {
  const area = $('dashChartArea');
  const crumb = $('dashBreadcrumb');
  if (!area || !crumb) return;

  crumb.innerHTML = dashBreadcrumbHtml();
  $('dashCrumbAll')?.addEventListener('click', () => { DASH_LEVEL = 'all'; DASH_YEAR = null; DASH_QUARTER = null; renderDashboardChart(); });
  $('dashCrumbYear')?.addEventListener('click', () => { DASH_LEVEL = 'year'; DASH_QUARTER = null; renderDashboardChart(); });

  let bars = [];
  if (DASH_LEVEL === 'all') {
    const yearKeys = Object.keys(DASH_CACHE.years).sort();
    bars = yearKeys.map(y => {
      const yearMonthKeys = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, '0')}`);
      return { key: y, label: y, bucket: DASH_CACHE.years[y], clickable: true, viewsTotal: dashTotalViews(yearMonthKeys) };
    });
  } else if (DASH_LEVEL === 'year') {
    const y = DASH_CACHE.years[DASH_YEAR];
    bars = Array.from({ length: 12 }, (_, i) => i + 1).map(mn => {
      const quarterKey = 'Q' + Math.ceil(mn / 3);
      const monthKey = `${DASH_YEAR}-${String(mn).padStart(2, '0')}`;
      const bucket = y?.quarters[quarterKey]?.months[monthKey] || null;

      return { key: monthKey, label: DASH_MONTH_NAME[mn].slice(0, 3), bucket, clickable: true, drillTo: quarterKey, viewsTotal: dashTotalViews([monthKey]) };
    });
  } else if (DASH_LEVEL === 'quarter') {
    const y = DASH_CACHE.years[DASH_YEAR];
    const q = y?.quarters[DASH_QUARTER];
    bars = (DASH_QUARTER_MONTHS[DASH_QUARTER] || []).map(mn => {
      const monthKey = `${DASH_YEAR}-${String(mn).padStart(2, '0')}`;
      return { key: monthKey, label: DASH_MONTH_NAME[mn].slice(0, 3), bucket: q?.months[monthKey] || null, clickable: false, viewsTotal: dashTotalViews([monthKey]) };
    });
  }

  if (!bars.length) {
    area.innerHTML = `<div class="chart-empty">No timesheet or historical activity yet.</div>`;
    return;
  }

  const maxHours = Math.max(...bars.map(b => b.bucket?.hours || 0), 0.01);
  const CHART_HEIGHT = 220;

  area.innerHTML = `
    <div class="dash-fade-in" style="display:grid;grid-template-columns:repeat(${bars.length}, 1fr);align-items:end;
      height:${CHART_HEIGHT + 34}px;padding-top:10px;">
      ${bars.map(b => {
        const h = b.bucket ? Math.max((b.bucket.hours / maxHours) * CHART_HEIGHT, b.bucket.hours > 0 ? 4 : 0) : 0;
        const isEmpty = !b.bucket || b.bucket.hours <= 0;
        const viewsLabel = b.viewsTotal !== null && b.viewsTotal !== undefined ? b.viewsTotal.toFixed(1) : null;
        return `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="height:${CHART_HEIGHT}px;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
              ${!isEmpty && viewsLabel !== null ? `<div style="font-size:11px;font-weight:700;color:var(--txt1);margin-bottom:5px;white-space:nowrap;">${esc(viewsLabel)}</div>` : ''}
              <div class="dash-candle ${b.clickable ? '' : 'dash-candle-disabled'}" data-key="${esc(b.key)}"
                style="width:70%;max-width:80px;height:${h}px;background:${isEmpty ? 'var(--border-md)' : 'var(--a1)'};"></div>
            </div>
            <div style="margin-top:8px;font-size:11.5px;font-weight:700;color:var(--txt1);">${esc(b.label)}</div>
          </div>`;
      }).join('')}
    </div>`;

  area.querySelectorAll('.dash-candle').forEach((el, i) => {
    const b = bars[i];
    el.addEventListener('mouseenter', e => showDashTooltip(e, b));
    el.addEventListener('mousemove', e => positionDashTooltip(e));
    el.addEventListener('mouseleave', hideDashTooltip);
    if (b.clickable) {
      el.addEventListener('click', () => {
        hideDashTooltip();
        if (DASH_LEVEL === 'all') { DASH_YEAR = b.key; DASH_LEVEL = 'year'; }
        else if (DASH_LEVEL === 'year') { DASH_QUARTER = b.drillTo; DASH_LEVEL = 'quarter'; }
        renderDashboardChart();
      });
    }
  });
}

function dashPeriodLabel(bar) {
  if (DASH_LEVEL === 'all') return bar.key;
  return `${bar.label} ${DASH_YEAR}`;
}

function showDashTooltip(evt, bar) {
  hideDashTooltip();
  const stats = dashStatsFor(bar.bucket);
  const viewsLine = bar.viewsTotal !== null && bar.viewsTotal !== undefined
    ? `<div>Total Views: <b>${bar.viewsTotal.toFixed(1)}</b></div>` : '';
  const tip = document.createElement('div');
  tip.id = 'dashTooltip';
  tip.style.cssText = `position:fixed;z-index:10001;background:var(--surface1);border:1px solid var(--border-md);
    border-radius:10px;padding:10px 12px;font-size:11.5px;color:var(--txt1);box-shadow:0 8px 24px rgba(0,0,0,.4);
    max-width:240px;pointer-events:none;`;
  tip.innerHTML = `
    <div style="font-weight:700;margin-bottom:6px;">${esc(dashPeriodLabel(bar))}</div>
    <div>Total Team Hours: <b>${fh(stats.hours)}</b></div>
    ${viewsLine}
    <div>Active Employees: <b>${stats.employees}</b></div>
    <div>Projects Worked: <b>${stats.projects}</b></div>
    <div>Avg. Hours / Employee: <b>${fh(stats.avgPerEmployee)}</b></div>
  `;
  document.body.appendChild(tip);
  positionDashTooltip(evt);
}

function positionDashTooltip(evt) {
  const tip = document.getElementById('dashTooltip');
  if (!tip) return;
  const pad = 14;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + 240 > window.innerWidth) x = evt.clientX - 240 - pad;
  if (y + 130 > window.innerHeight) y = evt.clientY - 130 - pad;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideDashTooltip() {
  document.getElementById('dashTooltip')?.remove();
}

function renderDashboardClientRollup(wrap) {
  if (!wrap) return;
  wrap.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1rem;height:100%;box-sizing:border-box;display:flex;flex-direction:column;">
      <div style="font-size:14px;font-weight:700;color:var(--txt1);margin-bottom:2px;">🏢 Clients Overview</div>
      <div style="font-size:11px;color:var(--txt2);margin-bottom:12px;">Constant, Employee Points spent, and Completed Views — summed across each client's projects. Showing top 5 by Points Spent — scroll for more.</div>
      <div id="dashClientRollupList" style="max-height:365px;overflow-y:auto;"><div class="mgr-loading"><div class="slot-spinner"></div><span>Loading…</span></div></div>
    </div>`;

  (async () => {
    const clients  = (typeof CP_CLIENTS  !== 'undefined' ? CP_CLIENTS  : []);
    const projects = (typeof CP_PROJECTS !== 'undefined' ? CP_PROJECTS : []);
    const listEl = document.getElementById('dashClientRollupList');
    if (!listEl) return;

    if (!clients.length || !projects.length) {
      listEl.innerHTML = `<div class="chart-empty">No clients/projects yet.</div>`;
      return;
    }

    let costs;
    try {
      costs = await Promise.all(projects.map(p => calculateProjectCost(p)));
    } catch (ex) {
      listEl.innerHTML = `<div class="slot-error">Failed to load: ${esc(ex.message)}</div>`;
      return;
    }
    if (!document.body.contains(listEl)) return; 

    const rollup = {}; 
    projects.forEach((p, i) => {
      const cid = p.clientId;
      if (!rollup[cid]) rollup[cid] = { constant: 0, pointsSpent: 0, completedViews: 0, projectCount: 0 };
      rollup[cid].constant       += parseFloat(p.projectConstant) || 0;
      rollup[cid].pointsSpent    += costs[i]?.totalCost || 0;
      rollup[cid].completedViews += parseFloat(p.completedViews) || 0;
      rollup[cid].projectCount   += 1;
    });

    const rows = clients
      .map(c => ({ client: c, r: rollup[c.id] }))
      .filter(x => x.r) 
      .sort((a, b) => b.r.pointsSpent - a.r.pointsSpent);

    if (!rows.length) {
      listEl.innerHTML = `<div class="chart-empty">No clients with projects yet.</div>`;
      return;
    }

    listEl.innerHTML = rows.map(({ client, r }) => `
      <div class="dash-client-rollup-row" data-client-id="${esc(client.id)}" style="padding:10px 0;border-bottom:1px solid var(--border);cursor:pointer;border-radius:6px;transition:background .15s;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-size:12.5px;font-weight:700;color:var(--txt1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(client.name)}</div>
          <div style="font-size:10px;color:var(--txt2);flex-shrink:0;">${r.projectCount} project${r.projectCount === 1 ? '' : 's'}</div>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <div>
            <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Constant</div>
            <div style="font-size:12px;font-weight:700;color:var(--txt1);">${esc(fmtCPConstant(r.constant))}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Points Spent</div>
            <div style="font-size:12px;font-weight:700;color:var(--a1);">${esc(fmtCPConstant(r.pointsSpent))}</div>
          </div>
          <div>
            <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Completed Views</div>
            <div style="font-size:12px;font-weight:700;color:#34d399;">${esc(r.completedViews.toFixed(1))}</div>
          </div>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('.dash-client-rollup-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.background = 'var(--elevated)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', () => goToClientInProjectsTab(row.dataset.clientId));
    });
  })();
}

function goToClientInProjectsTab(clientId) {
  CP_PC_CLIENT     = clientId || '';
  CP_PC_PROJECT_ID = '';

  if (typeof MANAGER_MODE !== 'undefined' && MANAGER_MODE && typeof MGR_TAB !== 'undefined') {
    MGR_TAB = 'project';
    const container = $('mgrApp');
    container?.querySelectorAll('.mgr-tab').forEach(b => {
      const active = b.dataset.tab === 'project';
      b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
      b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
    });
    if (typeof renderMgrTab === 'function') renderMgrTab();
  } else if (typeof TL_MODE !== 'undefined' && TL_MODE && typeof TL_TAB !== 'undefined') {
    TL_TAB = 'project';
    const container = $('tlApp');
    container?.querySelectorAll('.tl-tab').forEach(b => {
      const active = b.dataset.tab === 'project';
      b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
      b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
    });
    if (typeof renderTLTab === 'function') renderTLTab();
  }
}

// HUMANRESOURCE
let HR_DATA      = [];
let HR_EMPLOYEES = [];
let HR_TAB       = 'dashboard'; 

async function initHR() {
  const container = $('hrApp');
  if (!container) return;
  const session = APP_SESSION;
  container.innerHTML = '<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading team data…</span></div>';
  try {
    const data = await apiGetTeamData({ fresh: true });
    if (session !== APP_SESSION) return;
    HR_EMPLOYEES = data.employees; HR_DATA = data.entries;

    ClientProjectAPI.ingestMasterData(data);
    ClientProjectAPI.ingestTimesheetData(data.entries);
    renderHRPortal();
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(container, 'Could not load team data: ' + error.message, initHR);
  }
}

function renderHRPortal() {
  const container = $('hrApp');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;gap:4px;margin-bottom:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0;">
      ${[
        { id:'dashboard',    icon:'🏠', label:'Dashboard' },
        { id:'attendance',   icon:'🕒', label:'Attendance' },
        { id:'contribution', icon:'📊', label:'Project Contribution' },
        { id:'addEmployee',  icon:'➕', label:'Add Employee' },
        { id:'manageEmployees', icon:'✏️', label:'Manage Employees' },
      ].map(t => `
        <button class="hr-tab${HR_TAB===t.id?' active':''}" data-tab="${t.id}" style="
          padding:8px 16px;border:none;background:none;cursor:pointer;
          font-size:13px;font-weight:600;
          color:${HR_TAB===t.id ? 'var(--a1)' : 'var(--txt2)'};
          border-bottom:2px solid ${HR_TAB===t.id ? 'var(--a1)' : 'transparent'};
          margin-bottom:-1px;transition:all .2s;
        ">${t.icon} ${t.label}</button>
      `).join('')}
    </div>
    <div id="hrTabContent"></div>
  `;

  container.querySelectorAll('.hr-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      HR_TAB = btn.dataset.tab;
      container.querySelectorAll('.hr-tab').forEach(b => {
        const active = b === btn;
        b.style.color        = active ? 'var(--a1)' : 'var(--txt2)';
        b.style.borderBottom = active ? '2px solid var(--a1)' : '2px solid transparent';
      });
      renderHRTab();
    });
  });

  renderHRTab();
}

function renderHRTab() {
  const content = $('hrTabContent');
  if (!content) return;

  if (HR_TAB === 'dashboard') {
    if (typeof renderHRDashboard === 'function') renderHRDashboard(content);
    else content.innerHTML = `<div class="chart-empty">Dashboard module (dashboard.js) is not loaded.</div>`;
    return;
  }
  if (HR_TAB === 'attendance') {
    if (typeof renderAttendanceTab === 'function') renderAttendanceTab(content);
    else content.innerHTML = `<div class="chart-empty">Attendance module (client-project.js) is not loaded.</div>`;
    return;
  }
  if (HR_TAB === 'contribution') { renderHRContributionTab(content); return; }
  if (HR_TAB === 'addEmployee')  { renderHRAddEmployeeTab(content);  return; }
  if (HR_TAB === 'manageEmployees') { renderHRManageEmployeesTab(content); return; }
}

async function renderHRDashboard(content) {
  content.innerHTML = `<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading dashboard…</span></div>`;

  content.innerHTML = `
    <div id="hrEotmWrap" style="margin-bottom:22px;"></div>
    <div id="hrHeadcountWrap" style="margin-bottom:22px;"></div>
    <div style="display:flex;gap:10px;align-items:stretch;">
      <div style="flex:0 0 330px;" id="hrNotLoggedWrap"></div>
      <div style="flex:1;min-width:280px;" id="hrTeamPerfWrap"></div>
    </div>`;

  renderHREmployeeOfMonth($('hrEotmWrap'));
  renderHRHeadcountRow($('hrHeadcountWrap'));
  if (typeof renderDashboardNotLoggedPanel === 'function') renderDashboardNotLoggedPanel($('hrNotLoggedWrap'));
  renderHREmployeeCountChart($('hrTeamPerfWrap'));
}

const HR_EOTM_OVERTIME_THRESHOLD_HOURS  = 9;

const HR_EOTM_FULL_DAY_THRESHOLD_HOURS = 9;

function buildHREotmStats(monthKey, onlyWithActivity = true) {
  const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES).filter(e => e.active !== false);
  const entries = (typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : HR_DATA)
    .filter(e => e.date && e.date.startsWith(monthKey));

  const stats = employees.map(emp => {
    const own = entries.filter(e => e.empId === emp.id);
    const worked = own.filter(e => e.status !== 'Leave');

    const projects = new Set(worked.map(e => e.project).filter(Boolean));
    const dayTotals = {};
    worked.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + (parseFloat(e.hours) || 0); });
    const dayHours = Object.values(dayTotals);
    const workingDays = dayHours.filter(h => h >= HR_EOTM_FULL_DAY_THRESHOLD_HOURS).length;
    const shortDays = dayHours.length - workingDays;
    const overtimeDays = dayHours.filter(h => h > HR_EOTM_OVERTIME_THRESHOLD_HOURS).length;
    const leaveDays = new Set(own.filter(e => e.status === 'Leave').map(e => e.date)).size;

    return { emp, projects: projects.size, workingDays, shortDays, overtimeDays, leaveDays };
  });

  return onlyWithActivity ? stats.filter(s => s.workingDays > 0) : stats;
}

function scoreHREotm(stats) {
  const active = stats.filter(s => s.workingDays > 0);
  const maxProjects = Math.max(1, ...active.map(s => s.projects));
  const maxDays      = Math.max(1, ...active.map(s => s.workingDays));
  const maxOvertime  = Math.max(1, ...active.map(s => s.overtimeDays));
  const maxLeaves    = Math.max(1, ...active.map(s => s.leaveDays));

  return stats.map(s => {
    if (s.workingDays === 0) return { ...s, score: null };
    const projectsScore = s.projects / maxProjects;
    const attendanceScore = s.workingDays / maxDays;
    const overtimeScore = 1 - (s.overtimeDays / maxOvertime);
    const leaveScore = 1 - (s.leaveDays / maxLeaves);
    const score = (projectsScore + attendanceScore + overtimeScore + leaveScore) / 4;
    return { ...s, score };
  }).sort((a, b) => {
    if (a.score === null && b.score === null) return (a.emp.name || '').localeCompare(b.emp.name || '');
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    return b.score - a.score || b.workingDays - a.workingDays;
  });
}

function renderHREmployeeOfMonth(wrap) {
  if (!wrap) return;
  const monthKey = todayStr().slice(0, 7);
  const monthLabel = new Date(monthKey + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  const stats = buildHREotmStats(monthKey);
  const ranked = scoreHREotm(stats);

  if (!ranked.length) {
    wrap.innerHTML = `
      <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1.4rem;max-width:680px;">
        <div style="font-size:14px;font-weight:700;color:var(--txt1);">🏆 Employee of the Month — ${esc(monthLabel)}</div>
        <div style="font-size:12px;color:var(--txt2);margin-top:6px;">No logged hours yet this month.</div>
      </div>`;
    return;
  }

  const winner = ranked[0];
  const runnersUp = ranked.slice(1, 4);

  const metricChip = (label, value, good) => `
    <div style="text-align:center;">
      <div style="font-size:15px;font-weight:700;color:${good ? '#34d399' : 'var(--txt1)'};">${value}</div>
      <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;margin-top:1px;">${label}</div>
    </div>`;

  wrap.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1rem 1.2rem;max-width:680px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--txt1);">🏆 Employee of the Month — ${esc(monthLabel)}</div>
          <div style="font-size:11px;color:var(--txt2);margin-top:1px;">Scored on projects handled, attendance, overtime, and leaves.</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:10px;padding:10px 14px;
        background:var(--elevated);border-radius:10px;">
        <div style="display:flex;align-items:center;gap:10px;min-width:160px;">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#fb923c);
            display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">
            ${esc((winner.emp.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}
          </div>
          <div>
            <div style="font-size:13.5px;font-weight:700;color:var(--txt1);">${esc(winner.emp.name)}</div>
            <div style="font-size:10.5px;color:var(--txt2);">${esc(winner.emp.id)} · ${esc(winner.emp.team || '—')}</div>
          </div>
        </div>
        ${metricChip('Projects', winner.projects, true)}
        ${metricChip('Full Days', winner.workingDays, true)}
        ${metricChip('Overtime Days', winner.overtimeDays, winner.overtimeDays === 0)}
        ${metricChip('Leave Days', winner.leaveDays, winner.leaveDays === 0)}
      </div>
      <div style="font-size:10px;color:var(--txt2);margin-top:6px;">Full Day = ${HR_EOTM_FULL_DAY_THRESHOLD_HOURS}h logged that day. Under that doesn't count toward attendance; over that counts as overtime.</div>
      ${runnersUp.length ? `
        <div style="margin-top:10px;">
          <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">Runners-up</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${runnersUp.map((r, i) => `
              <div style="display:flex;align-items:center;gap:6px;background:var(--elevated);border-radius:8px;padding:4px 10px;">
                <span style="font-size:10.5px;color:var(--muted);font-weight:700;">#${i + 2}</span>
                <span style="font-size:11px;color:var(--txt1);font-weight:600;">${esc(r.emp.name)}</span>
                <span style="font-size:10px;color:var(--txt2);">${r.projects} proj · ${r.workingDays}d · ${r.overtimeDays} OT · ${r.leaveDays} leave</span>
              </div>`).join('')}
          </div>
        </div>` : ''}
    </div>`;
}

let HR_LEADERBOARD_MONTH = todayStr().slice(0, 7);

function renderHREmployeeCountChart(wrap) {
  if (!wrap) return;
  const year = new Date().getFullYear();
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const label = new Date(key + '-01').toLocaleDateString('en-IN', { month: 'long' });
    return { key, label };
  });

  wrap.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1.4rem;height:100%;box-sizing:border-box;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:1.1rem;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--txt1);">👥 Employee Leaderboard</div>
          <div style="font-size:12px;color:var(--txt2);">Ranked by projects handled, attendance, overtime, and leaves.</div>
        </div>
        <select id="hrLeaderboardMonth" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
          color:var(--txt1);font-size:12px;padding:6px 10px;cursor:pointer;">
          ${monthOptions.map(m => `<option value="${m.key}" ${m.key === HR_LEADERBOARD_MONTH ? 'selected' : ''}>${m.label} ${year}</option>`).join('')}
        </select>
      </div>
      <div id="hrLeaderboardChart"></div>
    </div>`;

  $('hrLeaderboardMonth').addEventListener('change', e => {
    HR_LEADERBOARD_MONTH = e.target.value;
    renderHRLeaderboardList();
  });

  renderHRLeaderboardList();
}

function renderHRLeaderboardChart(ranked) {
  const chartEl = $('hrLeaderboardChart');
  if (!chartEl) return;

  if (!ranked.length) { chartEl.innerHTML = `<div class="chart-empty">No active employees.</div>`; return; }

  const top = ranked[0];
  const topJustification = top.score !== null
    ? `🏆 <b>${esc(top.emp.name)}</b> leads this month — ${top.projects} project${top.projects === 1 ? '' : 's'},
       ${top.workingDays} full day${top.workingDays === 1 ? '' : 's'} (9h+), ${top.overtimeDays} overtime day${top.overtimeDays === 1 ? '' : 's'},
       ${top.leaveDays} leave day${top.leaveDays === 1 ? '' : 's'}.`
    : '';

  chartEl.innerHTML = `
    ${topJustification ? `<div style="font-size:11.5px;color:var(--txt2);margin-bottom:14px;">${topJustification}</div>` : ''}
    <div style="display:flex;align-items:flex-end;justify-content:${ranked.length > 18 ? 'flex-start' : 'space-evenly'};
      gap:18px;height:280px;padding:12px 4px 0;${ranked.length > 18 ? 'overflow-x:auto;' : ''}">
      ${ranked.map((r, i) => {
        const pct = r.score !== null ? Math.round(r.score * 100) : 0;
        const barColor = i === 0 && r.score !== null ? '#fbbf24' : 'var(--a1)';
        const firstName = (r.emp.name || '').split(' ')[0];
        const tooltip = r.score !== null
          ? `${r.emp.name} — ${pct}% | ${r.projects} projects · ${r.workingDays} full days · ${r.overtimeDays} overtime · ${r.leaveDays} leaves`
          : `${r.emp.name} — no activity this month`;
        return `
          <div style="flex:1 1 0;min-width:22px;max-width:38px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
            <div style="font-size:10px;font-weight:700;color:var(--txt1);margin-bottom:4px;">${r.score !== null ? pct : '—'}</div>
            <div style="width:100%;background:${barColor};border-radius:3px 3px 1px 1px;
              height:${r.score !== null ? Math.max(3, pct * 2.2) : 2}px;transition:height .3s ease;"
              title="${esc(tooltip)}"></div>
            <div style="font-size:9.5px;color:var(--txt2);margin-top:6px;white-space:nowrap;overflow:hidden;
              text-overflow:ellipsis;max-width:38px;" title="${esc(tooltip)}">${esc(firstName)}</div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderHRLeaderboardList() {
  const stats = buildHREotmStats(HR_LEADERBOARD_MONTH, false); 
  const ranked = scoreHREotm(stats);
  renderHRLeaderboardChart(ranked);
}

function renderHRHeadcountRow(wrap) {
  if (!wrap) return;
  const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES);
  const active   = employees.filter(e => e.active !== false).length;
  const inactive = employees.length - active;

  wrap.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1rem 1.4rem;min-width:140px;">
        <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Active Employees</div>
        <div style="font-size:22px;font-weight:700;color:var(--txt1);margin-top:2px;">${active}</div>
      </div>
      <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:1rem 1.4rem;min-width:140px;">
        <div style="font-size:9px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;">Inactive</div>
        <div style="font-size:22px;font-weight:700;color:var(--txt1);margin-top:2px;">${inactive}</div>
      </div>
    </div>`;
}

let HR_CONTRIB_SEARCH   = '';
let HR_CONTRIB_SORT     = 'hours'; 
let HR_CONTRIB_EXPANDED = new Set();

function buildHRContributionRows() {
  const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES);
  const entries    = (typeof CP_TIMESHEET_DATA !== 'undefined' ? CP_TIMESHEET_DATA : HR_DATA)
    .filter(e => e.status !== 'Leave' && e.project);

  return employees.map(emp => {
    const empEntries = entries.filter(e => e.empId === emp.id);
    const byProject = {};
    empEntries.forEach(e => {
      byProject[e.project] = (byProject[e.project] || 0) + (parseFloat(e.hours) || 0);
    });
    const projects = Object.entries(byProject)
      .map(([project, hours]) => ({ project, hours }))
      .sort((a, b) => b.hours - a.hours);
    const totalHours = projects.reduce((s, p) => s + p.hours, 0);
    return { emp, projects, totalHours };
  });
}

function renderHRContributionTab(content) {
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.1rem;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--txt1);">📊 Project Contribution</div>
        <div style="font-size:12px;color:var(--txt2);">Hours each employee has logged, broken down by project.</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input id="hrContribSearch" type="text" placeholder="🔍 Search employee…" value="${esc(HR_CONTRIB_SEARCH)}" style="
          background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);
          font-size:12px;padding:6px 10px;min-width:200px;"/>
        <div class="chart-range" id="hrContribSortBtns">
          <button class="rbtn${HR_CONTRIB_SORT==='hours'?' active':''}" data-sort="hours">Most Hours</button>
          <button class="rbtn${HR_CONTRIB_SORT==='name'?' active':''}" data-sort="name">Name A→Z</button>
        </div>
      </div>
    </div>
    <div id="hrContribList"></div>
  `;

  $('hrContribSearch').addEventListener('input', e => {
    HR_CONTRIB_SEARCH = e.target.value;
    renderHRContribList();
  });
  $('hrContribSortBtns').addEventListener('click', e => {
    const btn = e.target.closest('.rbtn');
    if (!btn) return;
    HR_CONTRIB_SORT = btn.dataset.sort;
    $('hrContribSortBtns').querySelectorAll('.rbtn').forEach(b => b.classList.toggle('active', b === btn));
    renderHRContribList();
  });

  renderHRContribList();
}

function renderHRContribList() {
  const listEl = $('hrContribList');
  if (!listEl) return;

  let rows = buildHRContributionRows();
  const q = HR_CONTRIB_SEARCH.trim().toLowerCase();
  if (q) rows = rows.filter(r => (r.emp.name || '').toLowerCase().includes(q) || (r.emp.id || '').toLowerCase().includes(q));

  rows.sort((a, b) => HR_CONTRIB_SORT === 'name'
    ? (a.emp.name || '').localeCompare(b.emp.name || '')
    : b.totalHours - a.totalHours);

  if (!rows.length) {
    listEl.innerHTML = `<div class="chart-empty">No employees match.</div>`;
    return;
  }

  listEl.innerHTML = `
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      ${rows.map((r, i) => {
        const expanded = HR_CONTRIB_EXPANDED.has(r.emp.id);
        return `
        <div class="hr-contrib-row" data-emp="${esc(r.emp.id)}" style="${i > 0 ? 'border-top:1px solid var(--border);' : ''}">
          <div class="hr-contrib-head" data-emp="${esc(r.emp.id)}" style="padding:12px 16px;cursor:pointer;
            display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:12px;color:var(--txt2);width:14px;display:inline-block;">${expanded ? '▾' : '▸'}</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--txt1);">${esc(r.emp.name)}</div>
                <div style="font-size:10.5px;color:var(--txt2);">${esc(r.emp.id)} · ${esc(r.emp.team || '—')}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
              <div style="font-size:10.5px;color:var(--txt2);">${r.projects.length} project${r.projects.length===1?'':'s'}</div>
              <div style="font-size:13px;font-weight:700;color:var(--a1);">${fh(r.totalHours)}</div>
            </div>
          </div>
          ${expanded ? `
            <div style="padding:0 16px 14px 40px;">
              ${r.projects.length ? r.projects.map(p => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);">
                  <div style="font-size:12px;color:var(--txt1);">${esc(p.project)}</div>
                  <div style="font-size:12px;font-weight:600;color:var(--txt1);">${fh(p.hours)}</div>
                </div>`).join('') : `<div style="font-size:11.5px;color:var(--txt2);padding:6px 0;">No project hours logged yet.</div>`}
            </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;

  listEl.querySelectorAll('.hr-contrib-head').forEach(head => {
    head.addEventListener('click', () => {
      const id = head.dataset.emp;
      if (HR_CONTRIB_EXPANDED.has(id)) HR_CONTRIB_EXPANDED.delete(id);
      else HR_CONTRIB_EXPANDED.add(id);
      renderHRContribList();
    });
  });
}

function nextHREmployeeId() {
  const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES);
  const nums = employees
    .map(e => (String(e.id || '').match(/^E(\d+)$/) || [])[1])
    .filter(Boolean)
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'E' + String(next).padStart(2, '0');
}

function renderHRAddEmployeeTab(content) {
  const suggestedId = nextHREmployeeId();
  const teams = [...new Set((typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES).map(e => e.team).filter(Boolean))].sort();

  content.innerHTML = `
    <div style="max-width:480px;">
      <div style="font-size:16px;font-weight:700;color:var(--txt1);margin-bottom:2px;">➕ Add Employee</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:1.1rem;">Creates a new employee record and login for the timesheet portal.</div>

      <form id="hrAddEmpForm" style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;">Employee ID</label>
          <input id="hrEmpId" type="text" value="${esc(suggestedId)}" style="width:100%;box-sizing:border-box;margin-top:4px;
            background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:13px;padding:8px 10px;"/>
          <div style="font-size:10px;color:var(--txt2);margin-top:3px;">Auto-suggested — change if this ID is already taken.</div>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;">Full Name</label>
          <input id="hrEmpName" type="text" placeholder="e.g. Priya Kumar" style="width:100%;box-sizing:border-box;margin-top:4px;
            background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:13px;padding:8px 10px;"/>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;">Team</label>
          <input id="hrEmpTeam" list="hrTeamOptions" type="text" placeholder="e.g. 3D, Design, Development…" style="width:100%;box-sizing:border-box;margin-top:4px;
            background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:13px;padding:8px 10px;"/>
          <datalist id="hrTeamOptions">${teams.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        </div>
        <div>
          <label style="font-size:11px;font-weight:700;color:var(--txt2);text-transform:uppercase;letter-spacing:.04em;">Login Password</label>
          <input id="hrEmpPw" type="text" placeholder="e.g. pass133" style="width:100%;box-sizing:border-box;margin-top:4px;
            background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:13px;padding:8px 10px;"/>
        </div>
        <div id="hrAddEmpErr" style="display:none;font-size:12px;color:#f87171;"></div>
        <button type="submit" id="hrAddEmpBtn" style="background:var(--a1);color:#fff;border:none;border-radius:8px;
          padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;margin-top:4px;">Create Employee</button>
      </form>
    </div>
  `;

  $('hrAddEmpForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const id   = $('hrEmpId').value.trim();
    const name = $('hrEmpName').value.trim();
    const team = $('hrEmpTeam').value.trim();
    const pw   = $('hrEmpPw').value.trim();
    const err  = $('hrAddEmpErr'), btn = $('hrAddEmpBtn');
    err.style.display = 'none';

    if (!id || !name || !team || !pw) {
      err.textContent = 'Please fill in every field.';
      err.style.display = 'block';
      return;
    }
    const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES);
    if (employees.some(e => e.id === id)) {
      err.textContent = `Employee ID "${id}" already exists.`;
      err.style.display = 'block';
      return;
    }

    btn.disabled = true; btn.textContent = 'Creating…';
    try {
      await sheetGET({
        action: 'createEmployee',
        data:   encodeURIComponent(JSON.stringify({ id, name, team, pw })),
      });

      const newEmp = { id, name, team, pw };
      HR_EMPLOYEES.push(newEmp);
      if (typeof CP_EMPLOYEES !== 'undefined') CP_EMPLOYEES.push(newEmp);

      if (typeof clearMasterDataCache === 'function') clearMasterDataCache();

      toast('s', 'Employee created', `${name} (${id}) can now log in.`);
      renderHRAddEmployeeTab($('hrTabContent')); 
    } catch(e) {
      err.textContent = e.message || 'Failed to create employee.';
      err.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Create Employee';
    }
  });
}

function renderHRManageEmployeesTab(content) {
  const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES)
    .slice()
    .sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1) || (a.name || '').localeCompare(b.name || ''));

  content.innerHTML = `
    <div style="margin-bottom:1.1rem;">
      <div style="font-size:16px;font-weight:700;color:var(--txt1);">✏️ Manage Employees</div>
      <div style="font-size:12px;color:var(--txt2);">Edit team or toggle Active / In-Active. Reactivating a row with no Employee ID/Password on file will ask you to set one.</div>
    </div>
    <div style="background:var(--surface1);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      ${employees.map((emp, i) => `
        <div class="hr-manage-row" data-name="${esc(emp.name)}" style="padding:12px 16px;${i > 0 ? 'border-top:1px solid var(--border);' : ''}
          display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
          <div style="min-width:160px;flex:1 1 160px;">
            <div style="font-size:13px;font-weight:700;color:var(--txt1);">${esc(emp.name)}</div>
            <div style="font-size:10.5px;color:var(--txt2);">${esc(emp.id)}</div>
          </div>
          <div style="flex:0 0 140px;">
            <label style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;">Team</label>
            <input type="text" class="hr-manage-team" value="${esc(emp.team || '')}" style="width:100%;box-sizing:border-box;
              background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12px;padding:6px 8px;"/>
          </div>
          <div style="flex:0 0 130px;">
            <label style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;">Status</label>
            <select class="hr-manage-status" style="width:100%;box-sizing:border-box;
              background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12px;padding:6px 8px;">
              <option value="Active" ${emp.active !== false ? 'selected' : ''}>Active</option>
              <option value="Inactive" ${emp.active === false ? 'selected' : ''}>In-Active</option>
            </select>
          </div>
          <div style="flex:0 0 120px;">
            <label style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;">Employee ID</label>
            <input type="text" class="hr-manage-newid" value="${esc(emp.id && !String(emp.id).startsWith('INACTIVE-') ? emp.id : '')}" placeholder="required to activate" style="width:100%;box-sizing:border-box;
              background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12px;padding:6px 8px;"/>
          </div>
          <div style="flex:0 0 100px;">
            <label style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;" title="How many past days this employee can log/edit entries for. Default is 2 for everyone — raise it for someone who needs to catch up on a backlog.">Entry Window</label>
            <input type="number" min="1" max="60" class="hr-manage-daysback" value="${emp.extendedDaysBack ? emp.extendedDaysBack : ''}" placeholder="4 (default)" style="width:100%;box-sizing:border-box;
              background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12px;padding:6px 8px;"/>
          </div>
          <div style="flex:0 0 120px;">
            <label style="font-size:9.5px;color:var(--txt2);text-transform:uppercase;letter-spacing:.3px;display:block;margin-bottom:3px;">New Password</label>
            <input type="text" class="hr-manage-newpw" placeholder="optional" style="width:100%;box-sizing:border-box;
              background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--txt1);font-size:12px;padding:6px 8px;"/>
          </div>
          <button class="hr-manage-save" style="background:var(--a1);color:#fff;border:none;border-radius:6px;
            padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;align-self:flex-end;">Save</button>
          <div class="hr-manage-err" style="display:none;font-size:11px;color:#f87171;flex-basis:100%;"></div>
        </div>`).join('')}
    </div>
  `;

  content.querySelectorAll('.hr-manage-row').forEach(row => {
    row.querySelector('.hr-manage-save').addEventListener('click', async () => {
      const originalName = row.dataset.name;
      const team   = row.querySelector('.hr-manage-team').value.trim();
      const status = row.querySelector('.hr-manage-status').value;
      const newId  = row.querySelector('.hr-manage-newid').value.trim();
      const newPw  = row.querySelector('.hr-manage-newpw').value.trim();
      const extendedDaysBack = row.querySelector('.hr-manage-daysback').value.trim();
      const errEl  = row.querySelector('.hr-manage-err');
      const btn    = row.querySelector('.hr-manage-save');
      errEl.style.display = 'none';

      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        const result = await apiUpdateEmployeeRecord({
          role: 'hr', originalName, team, status, newId, newPw, extendedDaysBack,
        });

        const employees = (typeof CP_EMPLOYEES !== 'undefined' ? CP_EMPLOYEES : HR_EMPLOYEES);
        const localEmp = employees.find(e => e.name === originalName);
        if (localEmp) {
          localEmp.team = team;
          localEmp.active = status === 'Active';
          localEmp.extendedDaysBack = parseInt(extendedDaysBack, 10) || 0;
          if (result.name) localEmp.name = result.name;
        }

        if (typeof clearMasterDataCache === 'function') clearMasterDataCache();

        toast('s', 'Employee updated', `${originalName} · ${status === 'Active' ? 'Active' : 'In-Active'}`);
        renderHRManageEmployeesTab($('hrTabContent'));
      } catch (e) {
        errEl.textContent = e.message || 'Failed to update.';
        errEl.style.display = 'block';
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
  });
}
