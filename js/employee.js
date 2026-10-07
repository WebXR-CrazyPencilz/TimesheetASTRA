// FORM
let ENTRIES      = [];   
let DAY_ENTRIES  = {};   
let DAY_LOAD_SEQUENCE = 0;
let CURRENT_DATE = '';   

const MAX_ENTRIES_PER_SLOT = 5;

const SLOT_META = {

  morning:   { label: 'Morning',   icon: '🌅', defaultIn: '09:30', defaultOut: '13:00', minTime: '00:00', maxTime: '13:00', displayMin: '00:00', color: '#f59e0b' },

  afternoon: { label: 'Afternoon', icon: '☀️',  defaultIn: '13:45', defaultOut: '19:30', minTime: '13:30', maxTime: '23:59', displayMin: '13:45', color: '#3b82f6' },
};

function initForm() {
  CURRENT_DATE = todayStr();
  renderDateNav();
  loadAndRenderDay(CURRENT_DATE);
}

function getMaxDaysBack() {
  const raw = typeof USER !== 'undefined' && USER ? USER.extendedDaysBack : null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

function renderDateNav() {
  const nav = $('dateNav');
  if (!nav) return;

  const maxDaysBack = getMaxDaysBack();
  const days = [];
  for (let i = maxDaysBack; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(fmtDateObj(d));
  }

  nav.innerHTML = days.map(d => {
    const label    = new Date(d + 'T00:00:00').toLocaleDateString('en-IN',
      { weekday:'short', day:'numeric', month:'short' });
    const isActive = d === CURRENT_DATE;
    const isToday  = d === todayStr();
    return `<button class="daybtn${isActive?' active':''}${isToday?' today':''}"
      data-date="${d}" onclick="switchDay('${d}')">
      ${isToday ? '<span class="today-dot"></span>' : ''}
      ${label}
    </button>`;
  }).join('');

  const heading = $('dayHeading');
  if (heading) {
    const d = new Date(CURRENT_DATE + 'T00:00:00');
    heading.textContent = d.toLocaleDateString('en-IN',
      { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  }
}

function switchDay(date) {
  if (!isWithinEditableRange(date)) {
    toast('e', 'Date not editable', `You can only log entries for today and the past ${getMaxDaysBack()} days.`);
    return;
  }
  CURRENT_DATE = date;
  renderDateNav();
  loadAndRenderDay(date);   
}

function isWithinEditableRange(date) {
  const today    = new Date(todayStr() + 'T00:00:00');
  const target   = new Date(date + 'T00:00:00');
  const diffDays = Math.round((today - target) / 86400000);
  return diffDays >= 0 && diffDays <= getMaxDaysBack();
}

async function loadAndRenderDay(date) {
  const request = ++DAY_LOAD_SEQUENCE;
  const session = APP_SESSION;
  const container = $('slotsContainer');
  if (!container) return;

  container.innerHTML = `<div class="slot-loading">
    <div class="slot-spinner"></div>
    <span>Loading ${date}…</span>
  </div>`;

  try {
    const data = await apiGetDaySlots(USER.id, date);
    if (request !== DAY_LOAD_SEQUENCE || session !== APP_SESSION || date !== CURRENT_DATE) return;

    DAY_ENTRIES = { morning: [], afternoon: [] };
    const seen  = {};

    (data.entries || []).forEach(e => {
      const key = `${e.slot}-${e.entryNum}`;
      seen[key] = e;
    });

    Object.values(seen).forEach(e => {
      if (DAY_ENTRIES[e.slot]) DAY_ENTRIES[e.slot].push(e);
    });

    Object.keys(DAY_ENTRIES).forEach(s =>
      DAY_ENTRIES[s].sort((a, b) => a.entryNum - b.entryNum)
    );

    console.log('[FORM] Loaded from Sheet for', date, ':',
      JSON.stringify(Object.fromEntries(
        Object.entries(DAY_ENTRIES).map(([k, v]) => [k, v.length])
      ))
    );

    renderSlots();
  } catch (err) {
    if (request !== DAY_LOAD_SEQUENCE || session !== APP_SESSION) return;
    console.error('[FORM] loadAndRenderDay error:', err);

    container.innerHTML = `
      <div class="slot-error">
        <div>Failed to load: ${esc(err.message)}</div>
        <button id="feRetryLoadDay" class="btn bghost" style="margin-top:.75rem">↻ Retry</button>
      </div>`;
    $('feRetryLoadDay')?.addEventListener('click', () => loadAndRenderDay(date));
  }
}

function renderSlots() {
  const container = $('slotsContainer');
  if (!container) return;

  container.innerHTML = `
    ${renderRecentProjectsSlider()}
    ${renderSlotBlock('morning')}
    ${renderLunchBlock()}
    ${renderSlotBlock('afternoon')}
  `;
}

const RECENT_PROJ_PALETTE = ['#4f8ef7','#7c5cfc','#34d399','#fbbf24','#5eead4','#22d3ee','#fb923c','#a78bfa','#f472b6','#84cc16'];

function renderRecentProjectsSlider() {
  const worked = (ENTRIES || []).filter(e => e.status !== 'Leave' && e.project);
  if (!worked.length) return '';

  const map = {};
  worked.forEach(e => {
    if (!map[e.project]) map[e.project] = { hours: 0, lastDate: '' };
    map[e.project].hours += Number(e.hours) || 0;
    if (e.date > map[e.project].lastDate) map[e.project].lastDate = e.date;
  });

  const projects = Object.entries(map)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.hours - a.hours);

  const chips = projects.map((p, i) => `
    <div style="flex-shrink:0;display:flex;align-items:center;gap:6px;
      background:var(--surface2);border:1px solid var(--border);border-radius:20px;
      padding:7px 14px;white-space:nowrap;">
      <span style="width:7px;height:7px;border-radius:50%;background:${RECENT_PROJ_PALETTE[i % RECENT_PROJ_PALETTE.length]};flex-shrink:0;"></span>
      <span style="font-size:12px;color:var(--txt1);font-weight:600;max-width:170px;
        overflow:hidden;text-overflow:ellipsis;" title="${esc(p.name)}">${esc(p.name)}</span>
      <span style="font-size:11px;color:var(--txt2);">— ${fh(p.hours)}</span>
    </div>`).join('');

  return `
    <div style="width:100%;max-width:100%;box-sizing:border-box;margin-bottom:1.1rem;">
      <div style="font-size:11px;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
        Your Projects · Last 10 Days
      </div>
      <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch;">
        ${chips}
      </div>
    </div>`;
}

function renderSlotBlock(slotKey) {
  const meta    = SLOT_META[slotKey];
  const entries = DAY_ENTRIES[slotKey] || [];
  const rows    = entries.length > 0 ? entries : [null];
  const total   = entries.length;

  return `
  <div class="slot-block" id="slot-${slotKey}">
    <div class="slot-header">
      <div class="slot-title">
        <span class="slot-icon">${meta.icon}</span>
        <span class="slot-label">${meta.label}</span>
        <span class="slot-time-range">${meta.defaultIn} – ${meta.defaultOut}</span>
        ${total > 0 ? `<span class="slot-saved-badge">✓ ${total} saved</span>` : ''}
      </div>
      ${total < MAX_ENTRIES_PER_SLOT ? `
        <button class="add-entry-btn" onclick="addEntry('${slotKey}')"
          title="Add another project in this slot">
          + Add Project
        </button>` : ''}
    </div>
    <div class="slot-entries" id="entries-${slotKey}">
      ${rows.map((e, i) => renderEntryRow(slotKey, e?.entryNum ?? (i + 1), e)).join('')}
    </div>
  </div>`;
}

function renderEntryRow(slotKey, entryNum, entry) {
  const meta     = SLOT_META[slotKey];
  const isLeave  = entry?.status === 'Leave';
  const isSaved  = !!entry;

  const isValidTime = v => /^\d{1,2}:\d{2}$/.test(v || '');
  const timeIn    = isValidTime(entry?.timeIn)  ? entry.timeIn  : meta.defaultIn;
  const timeOut   = isValidTime(entry?.timeOut) ? entry.timeOut : meta.defaultOut;
  const clientId  = entry?.clientId  || '';
  const projectId = entry?.projectId || '';
  const task      = entry?.task      || '';
  const notes     = entry?.notes     || '';
  const hours     = entry?.hours     || '';

  const id = `${slotKey}-${entryNum}`;

  const projectOptions = clientId
    ? PROJECTS.filter(p => p.cid === clientId).map(p =>
        `<option value="${p.id}" data-n="${p.name}"${p.id === projectId ? ' selected' : ''}>${p.name}</option>`
      ).join('')
    : '';

  return `
  <div class="entry-row${isLeave ? ' on-leave' : ''}${isSaved ? ' is-saved' : ''}"
       id="entry-${id}" data-slot="${slotKey}" data-num="${entryNum}">

    <div class="entry-row-header">
      <span class="entry-num">Entry ${entryNum}</span>
      ${isSaved
        ? isLeave
          ? '<span class="leave-badge">🏖️ Leave</span>'
          : '<span class="saved-badge">✏️ Saved — editable</span>'
        : ''}
      ${entryNum > 1
        ? `<button class="remove-entry-btn" onclick="removeEntry('${slotKey}', ${entryNum})" title="Remove">✕</button>`
        : ''}
    </div>

    ${isLeave ? `
    <div class="leave-info">
      <span>Leave logged for ${meta.label} slot (${timeIn} – ${timeOut})</span>
      <button class="btn bghost" onclick="undoLeave('${id}', '${slotKey}', ${entryNum})">
        ✕ Remove Leave
      </button>
    </div>` : `

    <!-- Time In / Time Out -->
    <div class="entry-times">
      <div class="fg">
        <label class="flabel">Time In</label>
        <input type="time" class="fc time-inp" id="tin-${id}" value="${timeIn}"
          min="${meta.displayMin}" max="${meta.maxTime}"
          onchange="calcEntryHours('${id}')" />
      </div>
      <div class="time-arrow">→</div>
      <div class="fg">
        <label class="flabel">Time Out</label>
        <input type="time" class="fc time-inp" id="tout-${id}" value="${timeOut}"
          min="${meta.displayMin}" max="${meta.maxTime}"
          onchange="calcEntryHours('${id}')" />
      </div>
      <div class="fg hours-display">
        <label class="flabel">Hours</label>
        <div class="hours-badge" id="hrs-${id}">${hours ? fmtHoursDisplay(hours) : '—'}</div>
      </div>
    </div>
    <div class="slot-time-hint">Allowed range: ${meta.displayMin} – ${meta.maxTime}</div>

    <!-- Client / Project / Task -->
    <div class="frow">
      <div class="fg">
        <label class="flabel">Client <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc client-sel" id="csel-${id}" onchange="onClientChange('${id}')">
            <option value="">— Client —</option>
            ${CLIENTS.map(c =>
              `<option value="${c.id}" data-n="${c.name}"${c.id === clientId ? ' selected' : ''}>${c.name}</option>`
            ).join('')}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="fg">
        <label class="flabel">Project <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc project-sel" id="psel-${id}" ${clientId ? '' : 'disabled'}>
            <option value="">— ${clientId ? 'Project' : 'Select client first'} —</option>
            ${projectOptions}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
      <div class="fg">
        <label class="flabel">Task <span class="req">*</span></label>
        <div class="swrap">
          <select class="fc" id="tsel-${id}">
            <option value="">— Task —</option>
            ${['Modelling & Texturing','lighting & Rendering', 'Web Development','2D FloorPlan', 'Editing & Grading', 'Unreal App Development', 'Training R&D' ].map(t =>
              `<option${t === task ? ' selected' : ''}>${t}</option>`
            ).join('')}
          </select>
          <svg class="sarr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="fg" style="margin-top:.6rem">
      <label class="flabel">Notes <span class="req">*</span></label>
      <textarea class="fc ta" id="notes-${id}" rows="2"
        placeholder="What did you work on? (min ${MIN_NOTES_LENGTH} characters)" maxlength="300"
        oninput="updateNotesCount('${id}')">${notes}</textarea>
      <div class="tafoot">
        <span class="cc" id="cc-${id}">${notes.length >= MIN_NOTES_LENGTH ? `${notes.length}/300` : `${notes.length}/${MIN_NOTES_LENGTH} minimum`}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="entry-actions">
      <button class="btn bghost leave-btn"
        onclick="markLeave('${id}', '${slotKey}', ${entryNum})"
        title="Marks the Time In / Time Out set above as leave — set a short window (e.g. 2:00–3:00) for a permission, not the whole slot">
        🏖️ Mark Leave
      </button>
      <button class="btn bpri save-btn" id="savebtn-${id}"
        onclick="saveEntry('${id}', '${slotKey}', ${entryNum})">
        <span class="bl">${isSaved ? 'Update' : 'Save'}</span>
        <svg class="bi" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <div class="bspin"></div>
      </button>
    </div>
    <div class="slot-time-hint" style="margin-top:4px;">Tip: for a short permission (not a full day off), set just that time range above before clicking Mark Leave — then use "+ Add Project" to log the rest of the slot as worked.</div>`}
  </div>`;
}

function renderLunchBlock() {
  return `
  <div class="lunch-block">
    <span>🍽️</span>
    <span class="lunch-label">Lunch Break</span>
    <span class="lunch-time">1:00 PM – 1:45 PM</span>
    <span class="lunch-badge">45 min</span>
  </div>`;
}

function addEntry(slotKey) {
  const current = DAY_ENTRIES[slotKey] || [];
  if (current.length >= MAX_ENTRIES_PER_SLOT) {
    toast('i', 'Max 4 entries per slot');
    return;
  }
  const maxSaved   = current.reduce((m, e) => Math.max(m, e.entryNum), 0);
  const domRows    = document.querySelectorAll(`#entries-${slotKey} .entry-row`);
  const maxInDOM   = Math.max(maxSaved, domRows.length);
  const newNum     = maxInDOM + 1;

  const container = $(`entries-${slotKey}`);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = renderEntryRow(slotKey, newNum, null);
  container.appendChild(div.firstElementChild);

  const addBtn = document.querySelector(`#slot-${slotKey} .add-entry-btn`);
  if (addBtn && (current.length + 1) >= MAX_ENTRIES_PER_SLOT) addBtn.style.display = 'none';
}

function removeEntry(slotKey, entryNum) {
  const el = $(`entry-${slotKey}-${entryNum}`);
  if (el) el.remove();
  DAY_ENTRIES[slotKey] = (DAY_ENTRIES[slotKey] || []).filter(e => e.entryNum !== entryNum);
  const addBtn = document.querySelector(`#slot-${slotKey} .add-entry-btn`);
  if (addBtn) addBtn.style.display = '';
}

function onClientChange(id) {
  const csel = $(`csel-${id}`);
  const psel = $(`psel-${id}`);
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
    psel.disabled = true;
  }
}

function calcEntryHours(id) {
  const tin   = $(`tin-${id}`)?.value;
  const tout  = $(`tout-${id}`)?.value;
  const hrsEl = $(`hrs-${id}`);
  if (!tin || !tout || !hrsEl) return;
  const [ih, im] = tin.split(':').map(Number);
  const [oh, om] = tout.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  if (mins <= 0) { hrsEl.textContent = '—'; return; }
  const h    = Math.round((mins / 60) * 100) / 100;
  const hh   = Math.floor(mins / 60);
  const mm   = mins % 60;
  hrsEl.textContent = hh === 0 ? `${mm}m` : mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

const MIN_NOTES_LENGTH = 25;

function updateNotesCount(id) {
  const ta  = $(`notes-${id}`);
  const cc  = $(`cc-${id}`);
  if (!ta || !cc) return;
  const len = ta.value.trim().length;
  cc.textContent = len >= MIN_NOTES_LENGTH
    ? `${len}/300`
    : `${len}/${MIN_NOTES_LENGTH} minimum`;
  cc.style.color = len >= MIN_NOTES_LENGTH ? 'var(--ok)' : 'var(--err)';
  ta.classList.toggle('bad', false); 
}

const MIN_LEAVE_REASON_LENGTH = 10;

async function markLeave(id, slotKey, entryNum) {
  const meta   = SLOT_META[slotKey];
  const timeIn  = $(`tin-${id}`)?.value  || '';
  const timeOut = $(`tout-${id}`)?.value || '';

  if (!timeIn || !timeOut) {
    toast('e', 'Set a time range first', 'Pick the Time In / Time Out for the leave window above, then Mark Leave.');
    return;
  }

  const toMinutesLocal = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const minM = toMinutesLocal(meta.minTime), maxM = toMinutesLocal(meta.maxTime);
  const inM  = toMinutesLocal(timeIn),       outM = toMinutesLocal(timeOut);

  if (inM < minM || inM > maxM || outM < minM || outM > maxM) {
    toast('e', 'Time out of range', `${meta.label} allows ${meta.displayMin}–${meta.maxTime}`);
    return;
  }
  if (outM <= inM) {
    toast('e', 'Time Out must be after Time In');
    return;
  }

  const reason = await promptLeaveReason(meta.label, timeIn, timeOut);
  if (reason === null) return; 

  const hours = Math.round(((outM - inM) / 60) * 100) / 100;

  const entry = {
    ...buildEntryBase(slotKey, entryNum),
    timeIn, timeOut,
    client:    'Leave', clientId:  '',
    project:   'Leave', projectId: '',
    task:      'Leave', notes:     reason,
    hours,
    status:    'Leave',
  };

  const btn = $(`savebtn-${id}`);
  if (btn) { btn.classList.add('ld'); btn.disabled = true; }
  toast('i', 'Marking Leave…', 'Please wait', 18000);

  try {
    const session = APP_SESSION;
    await apiSaveSlot(entry);
    if (session !== APP_SESSION) return;
    updateSavedEntry(entry);
    if (CURRENT_DATE !== entry.date) { refreshStats(); refreshFilters(); refreshTable(); refreshChart(); return; }

    DAY_ENTRIES[slotKey] = DAY_ENTRIES[slotKey] || [];
    const idx = DAY_ENTRIES[slotKey].findIndex(e => e.entryNum === entryNum);
    if (idx >= 0) DAY_ENTRIES[slotKey][idx] = entry;
    else          DAY_ENTRIES[slotKey].push(entry);

    reRenderRow(id, slotKey, entryNum, entry);

    refreshStats(); refreshFilters(); refreshTable(); refreshChart();
    toast('i', 'Marked as Leave', `${SLOT_META[slotKey].label} · ${timeIn}–${timeOut} (${fmtHoursDisplay(hours)})`);
  } catch(err) {
    toast('e', 'Failed', err.message);
  } finally {
    if (btn) { btn.classList.remove('ld'); btn.disabled = false; }
  }
}

function promptLeaveReason(slotLabel, timeIn, timeOut) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);'
      + 'display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = `
      <div style="background:var(--surface1);border:1px solid var(--border-md);
        border-radius:14px;padding:1.25rem;width:360px;max-width:92vw;">
        <div style="font-weight:700;font-size:15px;color:var(--txt1);margin-bottom:2px;">🏖️ Reason for Leave</div>
        <div style="font-size:12px;color:var(--txt2);margin-bottom:12px;">${esc(slotLabel)} · ${timeIn} – ${timeOut}</div>
        <label style="font-size:11px;color:var(--txt2);font-weight:600;display:block;margin-bottom:4px;">
          Notes <span style="color:#f87171;">(required)</span>
        </label>
        <textarea id="leaveReasonInput" rows="3" maxlength="200"
          placeholder="Why are you taking this time off? (min ${MIN_LEAVE_REASON_LENGTH} characters)"
          style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;
            color:var(--txt1);font-size:12.5px;padding:8px 10px;box-sizing:border-box;font-family:inherit;resize:vertical;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">
          <button id="leaveReasonCancel" style="background:none;border:1px solid var(--border-md);
            color:var(--txt2);border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:600;cursor:pointer;">Cancel</button>
          <button id="leaveReasonSubmit" style="background:var(--a1);border:none;
            color:#fff;border-radius:7px;padding:7px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Submit</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cleanup = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) { cleanup(); resolve(null); } });
    overlay.querySelector('#leaveReasonCancel').addEventListener('click', () => { cleanup(); resolve(null); });
    overlay.querySelector('#leaveReasonSubmit').addEventListener('click', () => {
      const ta  = overlay.querySelector('#leaveReasonInput');
      const val = ta.value.trim();
      if (val.length < MIN_LEAVE_REASON_LENGTH) {
        ta.style.borderColor = '#f87171';
        toast('e', 'Reason too short', `Write at least ${MIN_LEAVE_REASON_LENGTH} characters (currently ${val.length}).`);
        return;
      }
      cleanup();
      resolve(val);
    });
  });
}

function undoLeave(id, slotKey, entryNum) {
  DAY_ENTRIES[slotKey] = (DAY_ENTRIES[slotKey] || []).filter(e => e.entryNum !== entryNum);
  reRenderRow(id, slotKey, entryNum, null);
}

async function saveEntry(id, slotKey, entryNum) {
  const btn  = $(`savebtn-${id}`);
  const csel = $(`csel-${id}`);
  const psel = $(`psel-${id}`);
  const tsel = $(`tsel-${id}`);
  const tin  = $(`tin-${id}`);
  const tout = $(`tout-${id}`);

  if (!csel?.value) { toast('e', 'Select a client');  csel?.classList.add('bad'); return; }
  if (!psel?.value) { toast('e', 'Select a project'); psel?.classList.add('bad'); return; }
  if (!tsel?.value) { toast('e', 'Select a task');    tsel?.classList.add('bad'); return; }
  if (!tin?.value)  { toast('e', 'Enter time in');  return; }
  if (!tout?.value) { toast('e', 'Enter time out'); return; }

  const meta = SLOT_META[slotKey];
  const toMinutes = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minM  = toMinutes(meta.minTime);
  const maxM  = toMinutes(meta.maxTime);
  const inM   = toMinutes(tin.value);
  const outM  = toMinutes(tout.value);

  if (inM < minM || inM > maxM) {
    toast('e', 'Time In out of range', `${meta.label} allows ${meta.displayMin}–${meta.maxTime}`);
    tin.classList.add('bad');
    return;
  }
  if (outM < minM || outM > maxM) {
    toast('e', 'Time Out out of range', `${meta.label} allows ${meta.displayMin}–${meta.maxTime}`);
    tout.classList.add('bad');
    return;
  }
  if (outM <= inM) {
    toast('e', 'Time Out must be after Time In');
    tout.classList.add('bad');
    return;
  }
  tin.classList.remove('bad'); tout.classList.remove('bad');

  const notesEl  = $(`notes-${id}`);
  const notesVal = notesEl?.value.trim() || '';
  if (notesVal.length < MIN_NOTES_LENGTH) {
    toast('e', 'Notes too short', `Write at least ${MIN_NOTES_LENGTH} characters (currently ${notesVal.length})`);
    notesEl?.classList.add('bad');
    notesEl?.focus();
    return;
  }
  notesEl.classList.remove('bad');

  const slotEntries = DAY_ENTRIES[slotKey] || [];
  const isExisting  = slotEntries.some(e => e.entryNum === entryNum);
  if (!isExisting && slotEntries.length >= MAX_ENTRIES_PER_SLOT) {
    toast('e', 'Max 4 entries per slot');
    return;
  }

  csel.classList.remove('bad'); psel.classList.remove('bad'); tsel.classList.remove('bad');

  const entry = buildEntry(id, slotKey, entryNum, 'Worked');

  if (btn) { btn.classList.add('ld'); btn.disabled = true; }
  toast('i', 'Saving…', 'Please wait', 18000); 
  try {
    const session = APP_SESSION;
    await apiSaveSlot(entry);
    if (session !== APP_SESSION) return;
    updateSavedEntry(entry);
    if (CURRENT_DATE !== entry.date) { refreshStats(); refreshFilters(); refreshTable(); refreshChart(); return; }

    DAY_ENTRIES[slotKey] = DAY_ENTRIES[slotKey] || [];
    const idx = DAY_ENTRIES[slotKey].findIndex(e => e.entryNum === entryNum);
    if (idx >= 0) DAY_ENTRIES[slotKey][idx] = entry;
    else          DAY_ENTRIES[slotKey].push(entry);

    reRenderRow(id, slotKey, entryNum, entry);

    refreshStats(); refreshFilters(); refreshTable(); refreshChart();
    toast('s', 'Saved!', `${SLOT_META[slotKey].label} entry ${entryNum}`);
  } catch(e) {
    toast('e', 'Save failed', e.message);
  } finally {
    if (btn) { btn.classList.remove('ld'); btn.disabled = false; }
  }
}

function reRenderRow(id, slotKey, entryNum, entry) {
  const existing = $(`entry-${id}`);
  if (!existing) return;
  const div = document.createElement('div');
  div.innerHTML = renderEntryRow(slotKey, entryNum, entry);
  existing.replaceWith(div.firstElementChild);
}

function buildEntry(id, slotKey, entryNum, status) {
  const csel  = $(`csel-${id}`);
  const psel  = $(`psel-${id}`);
  const tsel  = $(`tsel-${id}`);
  const tin   = $(`tin-${id}`)?.value  || '';
  const tout  = $(`tout-${id}`)?.value || '';
  const notes = $(`notes-${id}`)?.value.trim() || '';

  let hours = 0;
  if (tin && tout) {
    const [ih, im] = tin.split(':').map(Number);
    const [oh, om] = tout.split(':').map(Number);
    const mins = (oh * 60 + om) - (ih * 60 + im);
    if (mins > 0) hours = Math.round((mins / 60) * 100) / 100;
  }

  const cOpt = csel?.options[csel.selectedIndex];
  const pOpt = psel?.options[psel.selectedIndex];

  return {
    ...buildEntryBase(slotKey, entryNum),
    timeIn:    tin,
    timeOut:   tout,
    hours,
    clientId:  csel?.value || '',
    client:    cOpt?.dataset?.n || cOpt?.text || '',
    projectId: psel?.value || '',
    project:   pOpt?.dataset?.n || pOpt?.text || '',
    task:      tsel?.value || '',
    notes,
    status,
  };
}

function buildEntryBase(slotKey, entryNum) {
  const d   = new Date(CURRENT_DATE + 'T00:00:00');
  const now = new Date();

  const savedAt = now.toLocaleString('en-IN', {
    day:'2-digit', month:'short', year:'numeric',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
  });
  return {
    id:      `${USER.id}-${CURRENT_DATE}-${slotKey}-${entryNum}`,
    uid:     USER.id,
    empName: USER.name,
    date:    CURRENT_DATE,
    day:     d.toLocaleDateString('en-IN', { weekday:'long' }),
    slot:    slotKey,
    entryNum,
    savedAt, 
  };
}

function fmtDateObj(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function fmtHoursDisplay(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}
function updateSavedEntry(entry) {
  const upsert = entries => {
    const next = entries.filter(e => !(e.date === entry.date && e.slot === entry.slot && Number(e.entryNum) === Number(entry.entryNum)));
    next.push(entry);
    return next.sort((a,b) => b.date.localeCompare(a.date) || a.slot.localeCompare(b.slot) || a.entryNum - b.entryNum);
  };
  ENTRIES = upsert(ENTRIES);
  const dates = new Set([...new Set(ENTRIES.map(e => e.date))].sort().reverse().slice(0,10));
  ENTRIES = ENTRIES.filter(e => dates.has(e.date));
  if (EMP_DASH_FULL_HISTORY_LOADED) EMP_DASH_FULL_HISTORY = upsert(EMP_DASH_FULL_HISTORY);
  CHART_ALL_HISTORY_CACHE = null;
  EMP_DASHBOARD_DATA_LOADED = false;
}

// CHART
let CHART_RANGE = 'today';

const CHART_PALETTE = [
  '#4f8ef7', '#7c5cfc', '#34d399', '#fbbf24',
  '#5eead4', '#22d3ee', '#fb923c', '#a78bfa',
  '#f472b6', '#84cc16',
];

function initChart() {
  const rangeBox = $('chartRange');
  if (!rangeBox) return;
  rangeBox.addEventListener('click', e => {
    const btn = e.target.closest('.rbtn');
    if (!btn) return;
    CHART_RANGE = btn.dataset.range;
    rangeBox.querySelectorAll('.rbtn').forEach(b =>
      b.classList.toggle('active', b === btn)
    );
    refreshChart();
  });
}

function getChartEntries() {
  const tod = todayStr();
  const ws  = weekStart();
  const mo  = todayStr().slice(0, 7);

  return (ENTRIES || []).filter(e => {
    if (e.status === 'Leave') return false;
    if (CHART_RANGE === 'today') return e.date === tod;
    if (CHART_RANGE === 'week')  return e.date >= ws;
    if (CHART_RANGE === 'month') return e.date.startsWith(mo);
    return false;
  });
}

function aggregateByProject(entries) {
  const map = {};
  entries.forEach(e => {
    const key = e.project || 'Unassigned';
    if (!map[key]) map[key] = 0;
    map[key] += Number(e.hours || 0);
  });
  return Object.entries(map)
    .map(([name, hours]) => ({ name, hours }))
    .filter(d => d.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

function refreshChart() {
  const body = $('chartBody');
  if (!body) return;

  const entries = getChartEntries();
  const data    = aggregateByProject(entries);
  const total   = data.reduce((s, d) => s + d.hours, 0);

  if (!data.length) {
    body.innerHTML = `
      <div class="chart-empty">No hours logged ${rangeLabel()} yet.</div>
      ${buildChartRecentDaysSection()}
      ${buildMyProjectsPlaceholder()}
    `;
    wireChartDatePicker();
    renderMyProjectsSection();
    return;
  }

  const svg    = buildPieSVG(data, total);
  const legend = buildLegend(data, total);

  body.innerHTML = `
    <div class="chart-svg-wrap">
      ${svg}
      <div class="chart-center">
        <div class="chart-center-val">${fmtHours(total)}</div>
        <div class="chart-center-lbl">${rangeLabel()}</div>
      </div>
    </div>
    <div class="chart-legend">${legend}</div>
    ${buildChartRecentDaysSection()}
    ${buildMyProjectsPlaceholder()}
  `;
  wireChartDatePicker();
  renderMyProjectsSection();
}

function wireChartDatePicker() {
  const picker = $('chartDatePicker');
  if (!picker) return;
  picker.addEventListener('change', () => onChartDatePicked(picker.value));
}

let MY_PROJECTS_CACHE = null;

function buildMyProjectsPlaceholder() {
  return `
    <div style="width:100%;max-width:100%;box-sizing:border-box;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">
        My Projects — All Time
      </div>
      <div id="myProjectsSection">${MY_PROJECTS_CACHE ? buildMyProjectsHtml(MY_PROJECTS_CACHE) : `<div style="font-size:11px;color:var(--muted);">Loading…</div>`}</div>
    </div>`;
}

async function renderMyProjectsSection() {
  try {
    const all = await apiGetAllHistory(USER.id);
    MY_PROJECTS_CACHE = all;
    const el = $('myProjectsSection');
    if (el) el.innerHTML = buildMyProjectsHtml(all); 
  } catch(err) {
    const el = $('myProjectsSection');
    if (el && !MY_PROJECTS_CACHE) el.innerHTML = `<div style="font-size:11px;color:var(--muted);">Couldn't load project history.</div>`;
  }
}

function buildMyProjectsHtml(allEntries) {
  const worked = (allEntries || []).filter(e => e.status !== 'Leave' && e.project);
  if (!worked.length) return `<div style="font-size:11px;color:var(--muted);">No project history yet.</div>`;

  const map = {};
  worked.forEach(e => {
    if (!map[e.project]) map[e.project] = { hours: 0, days: new Set() };
    map[e.project].hours += Number(e.hours) || 0;
    map[e.project].days.add(e.date);
  });

  const projects = Object.entries(map)
    .map(([name, d]) => ({ name, hours: d.hours, days: d.days.size }))
    .sort((a, b) => b.hours - a.hours);

  const maxHours = Math.max(...projects.map(p => p.hours), 0.01);

  const candles = projects.map((p, i) => {
    const fillPct = Math.max((p.hours / maxHours) * 100, 5);
    const color   = CHART_PALETTE[i % CHART_PALETTE.length];
    return `
      <div style="flex:0 0 74px;display:flex;flex-direction:column;align-items:center;gap:5px;">
        <div style="width:26px;height:90px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;
          overflow:hidden;display:flex;flex-direction:column-reverse;" title="${esc(p.name)}: ${fmtHours(p.hours)} across ${p.days} day${p.days !== 1 ? 's' : ''}">
          <div style="width:100%;height:${fillPct}%;background:${color};"></div>
        </div>
        <div style="font-size:9.5px;color:var(--txt1);font-weight:600;text-align:center;max-width:74px;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(p.name)}">${esc(p.name)}</div>
        <div style="font-size:9px;color:var(--muted);">${fmtHours(p.hours)}</div>
        <div style="font-size:9px;color:var(--muted);">${p.days} day${p.days !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('');

  return `<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;align-items:flex-end;">${candles}</div>`;
}

function rangeLabel() {
  return CHART_RANGE === 'today' ? 'Today'
       : CHART_RANGE === 'week'  ? 'This Week'
       : 'This Month';
}

function fmtHours(h) {
  if (!h || h <= 0) return '0h';
  const totalMins = Math.round(h * 60);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0)  return mins + 'm';
  if (mins === 0) return hrs + 'h';
  return hrs + 'h ' + mins + 'm';
}

let CHART_ALL_HISTORY_CACHE = null;

function buildDaySegmentBar(projects, totalHours) {
  if (!projects.length) {
    return `<div style="font-size:11px;color:var(--muted);padding:2px 2px 0;">No entries</div>`;
  }
  const segments = projects.map(([proj, hrs], i) => {
    const pct = Math.max((hrs / totalHours) * 100, 2);
    return `<div style="width:${pct}%;height:100%;background:${CHART_PALETTE[i % CHART_PALETTE.length]};"
      title="${esc(proj)}: ${fmtHours(hrs)}"></div>`;
  }).join('');

  const legend = projects.map(([proj, hrs], i) => `
    <div style="display:flex;align-items:center;gap:5px;">
      <span style="width:7px;height:7px;border-radius:50%;background:${CHART_PALETTE[i % CHART_PALETTE.length]};flex-shrink:0;"></span>
      <span style="font-size:10.5px;color:var(--txt1);font-weight:600;max-width:120px;overflow:hidden;
        text-overflow:ellipsis;white-space:nowrap;" title="${esc(proj)}">${esc(proj)}</span>
      <span style="font-size:10.5px;color:var(--muted);">${fmtHours(hrs)}</span>
    </div>`).join('');

  return `
    <div style="display:flex;border-radius:6px;overflow:hidden;height:12px;margin-bottom:6px;">${segments}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px 12px;">${legend}</div>`;
}

function buildDayRow(dateStr, label, dayEntries) {
  const totalHours = dayEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const projMap = {};
  dayEntries.forEach(e => {
    if (!e.project) return;
    projMap[e.project] = (projMap[e.project] || 0) + (Number(e.hours) || 0);
  });
  const projects = Object.entries(projMap).sort((a, b) => b[1] - a[1]);

  return `
    <div style="padding:8px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;color:var(--txt1);font-weight:600;">${label}</span>
        <span style="font-size:12px;color:var(--a1);font-weight:700;">${totalHours > 0 ? fmtHours(totalHours) : '—'}</span>
      </div>
      ${buildDaySegmentBar(projects, totalHours)}
    </div>`;
}

function buildLast5DaysRows() {
  const days = [];
  for (let i = 1; i <= 5; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(toLocalDateStr(d));
  }
  return days.map(dateStr => {
    const dayEntries = (ENTRIES || []).filter(e => e.date === dateStr && e.status !== 'Leave');
    const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    return buildDayRow(dateStr, label, dayEntries);
  }).join('');
}

function buildChartRecentDaysSection() {
  return `
    <div style="width:100%;max-width:100%;box-sizing:border-box;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;">Last 5 Days</div>
        <input type="date" id="chartDatePicker" max="${todayStr()}"
          style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
          color:var(--txt1);font-size:10.5px;padding:3px 6px;cursor:pointer;"/>
      </div>
      <div id="chartLast5List">${buildLast5DaysRows()}</div>
    </div>`;
}

async function getDayEntriesForChart(dateStr) {
  const inRecentWindow = (ENTRIES || []).some(e => e.date === dateStr);
  if (inRecentWindow && !CHART_ALL_HISTORY_CACHE) {
    return (ENTRIES || []).filter(e => e.date === dateStr && e.status !== 'Leave');
  }
  if (!CHART_ALL_HISTORY_CACHE) {
    try { CHART_ALL_HISTORY_CACHE = await apiGetAllHistory(USER.id); }
    catch(e) { CHART_ALL_HISTORY_CACHE = []; }
  }
  return CHART_ALL_HISTORY_CACHE.filter(e => e.date === dateStr && e.status !== 'Leave');
}

async function onChartDatePicked(dateStr) {
  const listEl = $('chartLast5List');
  if (!listEl || !dateStr) return;

  listEl.innerHTML = `<div style="font-size:11px;color:var(--muted);padding:10px 0;">Loading…</div>`;
  const dayEntries = await getDayEntriesForChart(dateStr);
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  listEl.innerHTML = `
    ${buildDayRow(dateStr, label, dayEntries)}
    <button id="chartDateReset" style="margin-top:8px;background:none;border:none;color:var(--a1);
      font-size:10.5px;font-weight:600;cursor:pointer;padding:0;">← Back to Last 5 Days</button>`;

  $('chartDateReset')?.addEventListener('click', () => {
    const picker = $('chartDatePicker');
    if (picker) picker.value = '';
    listEl.innerHTML = buildLast5DaysRows();
  });
}

function buildPieSVG(data, total) {
  const cx = 85, cy = 85, r = 70, innerR = 44;
  let angleStart = -90; 

  const slices = data.map((d, i) => {
    const pct      = d.hours / total;
    const angleEnd = angleStart + pct * 360;
    const path     = donutSlicePath(cx, cy, r, innerR, angleStart, angleEnd);
    const color    = CHART_PALETTE[i % CHART_PALETTE.length];
    angleStart = angleEnd;
    return `<path class="chart-slice" d="${path}" fill="${color}">
      <title>${escSvg(d.name)}: ${fmtHours(d.hours)}</title>
    </path>`;
  }).join('');

  return `<svg viewBox="0 0 170 170" xmlns="http://www.w3.org/2000/svg">${slices}</svg>`;
}

function donutSlicePath(cx, cy, rOuter, rInner, startDeg, endDeg) {

  const span = endDeg - startDeg;
  if (span >= 359.999) endDeg = startDeg + 359.999;

  const sOuter = polarPoint(cx, cy, rOuter, startDeg);
  const eOuter = polarPoint(cx, cy, rOuter, endDeg);
  const sInner = polarPoint(cx, cy, rInner, endDeg);
  const eInner = polarPoint(cx, cy, rInner, startDeg);
  const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;

  return [
    `M ${sOuter.x} ${sOuter.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${eOuter.x} ${eOuter.y}`,
    `L ${sInner.x} ${sInner.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${eInner.x} ${eInner.y}`,
    'Z'
  ].join(' ');
}

function polarPoint(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildLegend(data, total) {
  return data.map((d, i) => {
    const color = CHART_PALETTE[i % CHART_PALETTE.length];
    const pct   = Math.round((d.hours / total) * 100);
    return `<div class="leg-row">
      <span class="leg-dot" style="background:${color}"></span>
      <span class="leg-name" title="${esc(d.name)}">${esc(d.name)}</span>
      <span class="leg-hrs">${fmtHours(d.hours)}</span>
      <span class="leg-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function escSvg(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// MYPROJECTS-TAB
let EMP_DASHBOARD_DATA_LOADED = false;
let EMP_DASH_ANCHOR_DATE = todayStr(); 
let EMP_ATTEND_RANGE = 'last15'; 
let EMP_ATTEND_MONTH = todayStr().slice(0, 7); 
let EMP_DASH_PROJECT_BY_NAME = {}; 

let EMP_DASH_FULL_HISTORY = [];
let EMP_DASH_FULL_HISTORY_LOADED = false;

async function ensureEmpFullHistoryLoaded() {
  if (EMP_DASH_FULL_HISTORY_LOADED) return;
  if (EMP_HISTORY_PROMISE) return EMP_HISTORY_PROMISE;
  const session = APP_SESSION;
  const promise = apiGetAllHistory(USER.id).then(data => {
    if (session !== APP_SESSION) return;
    EMP_DASH_FULL_HISTORY = data; EMP_DASH_FULL_HISTORY_LOADED = true;
  });
  EMP_HISTORY_PROMISE = promise;
  try { await promise; } finally { if (EMP_HISTORY_PROMISE === promise) EMP_HISTORY_PROMISE = null; }
}

function initMyProjectsTab() {
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchEmpTab(btn.dataset.empTab));
  });

}

function switchEmpTab(tab) {
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    const active = btn.dataset.empTab === tab;
    btn.classList.toggle('active', active);
    btn.style.color = active ? 'var(--a1)' : 'var(--muted)';
    btn.style.borderBottomColor = active ? 'var(--a1)' : 'transparent';
  });

  const containerByTab = {
    projects:   'empTabProjects',
    timesheet:  'empTabTimesheet',
    attendance: 'empTabAttendance',
  };
  Object.entries(containerByTab).forEach(([key, id]) => {
    const el = $(id);
    if (el) el.style.display = key === tab ? '' : 'none';
  });

  if (tab === 'projects') renderMyDashboardTab();
  if (tab === 'attendance') renderMyAttendanceTab();
}

async function ensureEmpDashboardDataLoaded() {
  if (EMP_DASHBOARD_DATA_LOADED) return;
  if (EMP_DASHBOARD_PROMISE) return EMP_DASHBOARD_PROMISE;
  const session = APP_SESSION;
  const promise = apiGetEmployeeDashboard(USER.id).then(data => {
    if (session !== APP_SESSION) return;
    CP_PROJECTS = data.projects.map((p, entryIndex) => ({ ...p, entryIndex }));
    CP_CLIENTS = data.clients.map((c, entryIndex) => ({ ...c, entryIndex }));
    CP_EMPLOYEES = data.employees; CP_TIMESHEET_DATA = data.entries;
    CP_HISTORICAL_DATA = data.historicalRecords;
    SAL_RECORDS = data.salaryRecords; SAL_LOADED = true;
    EMP_DASH_FULL_HISTORY = data.history; EMP_DASH_FULL_HISTORY_LOADED = true;
    EMP_DASHBOARD_DATA_LOADED = true;
  });
  EMP_DASHBOARD_PROMISE = promise;
  try { await promise; } finally { if (EMP_DASHBOARD_PROMISE === promise) EMP_DASHBOARD_PROMISE = null; }
}

function getMyWorkedProjects() {
  const myProjectNames = new Set(
    EMP_DASH_FULL_HISTORY.filter(e => e.status !== 'Leave' && e.project).map(e => e.project)
  );
  return CP_PROJECTS.filter(p => myProjectNames.has(p.projectName));
}

function getMyUnmatchedProjectNames() {
  const matchedNames = new Set(CP_PROJECTS.map(p => p.projectName));
  const allNames = new Set(
    EMP_DASH_FULL_HISTORY.filter(e => e.status !== 'Leave' && e.project).map(e => e.project)
  );
  return [...allNames].filter(n => !matchedNames.has(n));
}

function buildEmpUnmatchedProjectCard(name) {

  const pseudoProject = { projectId: '', projectName: name, clientId: '', status: '', projectConstant: 0 };
  return buildEmpDashboardCard(pseudoProject, { unmatched: true });
}

async function renderMyDashboardTab() {
  const session = APP_SESSION;
  const container = $('myProjCardsContainer');
  if (!container) return;

  if (typeof ensureCPStyles === 'function') ensureCPStyles();

  container.innerHTML = `<div class="slot-loading"><div class="slot-spinner"></div><span>Loading…</span></div>`;

  try {
    await ensureEmpDashboardDataLoaded();
    if (session !== APP_SESSION) return;
  } catch (err) {
    if (session !== APP_SESSION) return;
    showLoadError(container, 'Could not load your dashboard: ' + err.message, renderMyDashboardTab);
    return;
  }

  let myProjects, unmatchedNames;
  try {
    myProjects = getMyWorkedProjects();
    unmatchedNames = getMyUnmatchedProjectNames();
  } catch (err) {
    container.innerHTML = `<div class="slot-error">Failed to display your dashboard: ${esc(err.message)}</div>`;
    return;
  }

  const statsHtml = `
    <div style="display:flex;flex-direction:column;gap:1.25rem;margin-bottom:1.5rem;">
      ${buildTodayRingSection()}
      ${buildLast5DaysSection(EMP_DASH_ANCHOR_DATE)}
      ${buildAllTimeProjectsSection()}
    </div>`;

  const hasAnyCards = myProjects.length > 0 || unmatchedNames.length > 0;

  EMP_DASH_PROJECT_BY_NAME = {};
  myProjects.forEach(p => { EMP_DASH_PROJECT_BY_NAME[p.projectName] = p; });
  unmatchedNames.forEach(name => {
    EMP_DASH_PROJECT_BY_NAME[name] = { projectId: '', projectName: name, clientId: '', status: '', projectConstant: 0, __unmatched: true };
  });

  const projectsHtml = hasAnyCards
    ? `<div class="cp-card-grid" style="grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));">
        ${myProjects.map(p => buildEmpDashboardCard(p)).join('')}
        ${unmatchedNames.map(buildEmpUnmatchedProjectCard).join('')}
      </div>`
    : `<div class="chart-empty">You haven't logged hours on any project yet.</div>`;

  container.innerHTML = statsHtml + projectsHtml;

  container.querySelectorAll('.emp-proj-card').forEach(card => {
    card.addEventListener('click', () => openEmpProjectDetailPage(card.dataset.project));
  });

  $('empDashAnchorDate')?.addEventListener('change', e => {
    EMP_DASH_ANCHOR_DATE = e.target.value || todayStr();
    renderMyDashboardTab(); 
  });

  $('empDashViewAttendanceBtn')?.addEventListener('click', () => switchEmpTab('attendance'));
}

function empDashProjectColor(name) {
  const key = String(name || '').trim().toLowerCase();
  return typeof getColorForKey === 'function' ? getColorForKey('proj:' + key) : '#4f8ef7';
}

function buildTodayRingSVG(segments, totalHours) {
  if (!totalHours) {
    return `<svg viewBox="0 0 200 200" width="160" height="160"><circle cx="100" cy="100" r="80" fill="none" stroke="var(--border-md,#3a3f4b)" stroke-width="18"/></svg>`;
  }
  let angle = -90;
  const paths = segments.map(seg => {
    const end = angle + (seg.hours / totalHours) * 360;
    const d = buildReportDonutPath(100, 100, 80, 62, angle, end);
    const color = empDashProjectColor(seg.name);
    angle = end;
    return `<path d="${d}" fill="${color}"/>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" width="160" height="160" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

function buildTodayRingSection() {
  const recentDates = new Set(getEmpDashRecentDays(todayStr(), EMP_DASH_RECENT_DAYS_COUNT));
  const byProj = {};
  EMP_DASH_FULL_HISTORY
    .filter(e => recentDates.has(e.date) && e.status !== 'Leave' && e.project)
    .forEach(e => { byProj[e.project] = (byProj[e.project] || 0) + Number(e.hours || 0); });

  const segments = Object.entries(byProj)
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours);
  const totalHours = segments.reduce((s, x) => s + x.hours, 0);

  const legend = segments.length
    ? segments.map(seg => {
        const pct = totalHours ? Math.round((seg.hours / totalHours) * 100) : 0;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;">
            <span style="width:9px;height:9px;border-radius:50%;background:${empDashProjectColor(seg.name)};flex-shrink:0;"></span>
            <span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--txt1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(seg.name)}</span>
            <span style="font-size:12px;font-weight:700;color:var(--txt1);white-space:nowrap;">${esc(fh(seg.hours))}</span>
            <span style="font-size:11px;color:var(--txt2,var(--muted));width:36px;text-align:right;">${pct}%</span>
          </div>`;
      }).join('')
    : `<div style="font-size:12px;color:var(--txt2,var(--muted));">No hours logged in the last ${EMP_DASH_RECENT_DAYS_COUNT} days.</div>`;

  return `
    <div class="cp-card" style="display:flex;align-items:center;gap:28px;flex-wrap:wrap;">
      <div style="position:relative;width:160px;height:160px;flex-shrink:0;">
        ${buildTodayRingSVG(segments, totalHours)}
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 14px;text-align:center;">
          <div style="font-size:18px;font-weight:800;color:var(--txt1);line-height:1.1;white-space:nowrap;">${esc(fh(totalHours))}</div>
          <div style="font-size:8.5px;letter-spacing:.5px;color:var(--txt2,var(--muted));margin-top:2px;">LAST ${EMP_DASH_RECENT_DAYS_COUNT} DAYS</div>
        </div>
      </div>
      <div style="flex:1;min-width:220px;">${legend}</div>
    </div>`;
}

function getEmpDashRecentDays(anchor, count) {
  const dates = [];
  const base = new Date(anchor + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return dates;
}

const EMP_DASH_RECENT_DAYS_COUNT = 7;

function buildLast5DaysSection(anchor) {
  const dates = getEmpDashRecentDays(anchor, EMP_DASH_RECENT_DAYS_COUNT);

  const rows = dates.map(dateStr => {
    const dayEntries = EMP_DASH_FULL_HISTORY.filter(e => e.date === dateStr && e.status !== 'Leave' && e.project);
    const totalHours = dayEntries.reduce((s, e) => s + Number(e.hours || 0), 0);
    const byProj = {};
    dayEntries.forEach(e => { byProj[e.project] = (byProj[e.project] || 0) + Number(e.hours || 0); });
    const segs = Object.entries(byProj).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

    const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    if (!totalHours) {
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:13px;font-weight:700;color:var(--txt1);">${esc(label)}</span>
            <span style="font-size:13px;color:var(--txt2,var(--muted));">—</span>
          </div>
          <div style="font-size:11px;color:var(--txt2,var(--muted));margin-top:2px;">No entries</div>
        </div>`;
    }

    const otThreshold = typeof OVERTIME_THRESHOLD_HOURS === 'number' ? OVERTIME_THRESHOLD_HOURS : 9;
    const fillPct = Math.min((totalHours / otThreshold) * 100, 100);
    const isOTDay = totalHours >= otThreshold;

    const barHtml = segs.map(seg => {
      const pct = (seg.hours / totalHours) * fillPct;
      return `<div style="width:${pct}%;height:100%;background:${empDashProjectColor(seg.name)};" title="${esc(seg.name)}: ${esc(fh(seg.hours))}"></div>`;
    }).join('');

    const chips = segs.map(seg => {
      const dotColor = empDashProjectColor(seg.name);
      return `
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--txt2,var(--muted));margin:4px 10px 0 0;">
        <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
        <strong style="color:var(--txt1);">${esc(seg.name)}</strong> ${esc(fh(seg.hours))}
      </span>`;
    }).join('');

    return `
      <div style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:700;color:var(--txt1);">${esc(label)}</span>
          <span style="font-size:13px;font-weight:700;color:${isOTDay ? '#92400e' : 'var(--a1)'};">${esc(fh(totalHours))}${isOTDay ? ' · OT' : ''}</span>
        </div>
        <div style="height:6px;border-radius:4px;overflow:hidden;background:var(--surface2,#20242e);display:flex;">${barHtml}</div>
        <div>${chips}</div>
      </div>`;
  }).join('');

  return `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:8px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt2,var(--muted));">Last ${EMP_DASH_RECENT_DAYS_COUNT} Days</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <input type="date" id="empDashAnchorDate" value="${esc(anchor)}" max="${esc(todayStr())}"
            style="background:var(--surface2,#20242e);border:1px solid var(--border);border-radius:6px;
            color:var(--txt1);font-size:12px;padding:6px 8px;max-width:150px;"/>
          <button id="empDashViewAttendanceBtn" class="rbtn" style="white-space:nowrap;">View Attendance →</button>
        </div>
      </div>
      ${rows}
    </div>`;
}

function buildAllTimeProjectsSection() {
  const byProj = {}; 
  EMP_DASH_FULL_HISTORY
    .filter(e => e.status !== 'Leave' && e.project)
    .forEach(e => {
      if (!byProj[e.project]) byProj[e.project] = { hours: 0, days: new Set() };
      byProj[e.project].hours += Number(e.hours || 0);
      byProj[e.project].days.add(e.date);
    });

  const list = Object.entries(byProj)
    .map(([name, d]) => ({ name, hours: d.hours, days: d.days.size }))
    .sort((a, b) => b.hours - a.hours);

  const header = `<div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt2,var(--muted));margin-bottom:.9rem;">My Projects — All Time</div>`;

  if (!list.length) {
    return `<div class="cp-card">${header}<div style="font-size:12px;color:var(--txt2,var(--muted));">No hours logged yet.</div></div>`;
  }

  const maxHours = Math.max(...list.map(x => x.hours), 0.01);
  const bars = list.map(x => {
    const pct = Math.max((x.hours / maxHours) * 100, 4);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:76px;flex-shrink:0;">
        <div style="height:110px;width:22px;display:flex;align-items:flex-end;background:var(--surface2,#20242e);border-radius:6px;overflow:hidden;">
          <div style="width:100%;height:${pct}%;background:${empDashProjectColor(x.name)};"></div>
        </div>
        <div style="font-size:11px;font-weight:700;color:var(--txt1);margin-top:8px;text-align:center;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:76px;" title="${esc(x.name)}">${esc(x.name)}</div>
        <div style="font-size:10px;color:var(--txt2,var(--muted));">${esc(fh(x.hours))}</div>
        <div style="font-size:10px;color:var(--txt2,var(--muted));">${x.days} day${x.days !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('');

  return `<div class="cp-card">${header}<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:4px;">${bars}</div></div>`;
}

function getMyProjectCost(p) {
  const byMonth = {};
  EMP_DASH_FULL_HISTORY.forEach(e => {
    if (e.project !== p.projectName || e.status === 'Leave' || !e.date) return;
    const month = e.date.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + Number(e.hours || 0);
  });

  let cost = 0;
  Object.entries(byMonth).forEach(([month, hrs]) => {
    cost += hrs * getMonthlyPointsForEmployee(USER.id, month, USER.name);
  });
  return cost;
}

function buildEmpDashboardCard(p, opts = {}) {
  return buildEmpDashboardCardDetailed(p, opts);
}

function buildEmpDashboardCardDetailed(p, opts = {}) {
  const client = CP_CLIENTS.find(c => c.id === p.clientId);

  let totalCost = 0;
  try {
    totalCost = getProjectCostBreakdown(p).totalCost;
  } catch (err) {
    console.warn('[myprojects-tab] Cost calc failed for', p.projectId, ':', err.message);
  }

  let myCost = 0;
  try {
    myCost = getMyProjectCost(p);
  } catch (err) {
    console.warn('[myprojects-tab] My-cost calc failed for', p.projectId, ':', err.message);
  }

  const budget = parseFloat(p.projectConstant) || 0;
  const hasBudget = budget > 0;
  const isOverBudget = hasBudget && totalCost > budget;
  const fillPct = hasBudget
    ? Math.min((totalCost / budget) * 100, 100)
    : (totalCost > 0 ? 100 : 0);

  let barHtml, labelText, labelColor;
  if (!totalCost) {
    barHtml = `<div style="width:100%;height:100%;background:var(--border-md,#3a3f4b);"></div>`;
    labelText = 'No hours logged yet';
    labelColor = 'var(--txt1,var(--fg))';
  } else if (isOverBudget) {
    barHtml = `<div style="width:100%;height:100%;background:#f87171;"></div>`;
    labelText = 'Over budget';
    labelColor = '#f87171';
  } else {
    barHtml = `<div style="width:${fillPct}%;height:100%;background:#34d399;"></div>`;
    labelText = hasBudget ? 'Within budget' : 'No budget set';
    labelColor = hasBudget ? '#34d399' : 'var(--txt1,var(--fg))';
  }

  const myHours = EMP_DASH_FULL_HISTORY
    .filter(e => e.project === p.projectName && e.status !== 'Leave')
    .reduce((s, e) => s + Number(e.hours || 0), 0);

  const profit = budget - totalCost;
  const isProfit = profit >= 0;
  const moneyFmt = typeof fmtCPMoney === 'function' ? fmtCPMoney : (n => Math.round(Number(n) || 0).toLocaleString('en-IN'));

  const totalsHtml = `
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:.6rem;font-size:11px;">
      <div><span style="color:var(--muted);">Project Budget:</span> <strong style="color:var(--txt1);">${hasBudget ? esc(moneyFmt(budget)) : 'Not set'}</strong></div>
      <div><span style="color:var(--muted);">Total Points Used:</span> <strong style="color:var(--txt1);">${esc(moneyFmt(totalCost))}</strong></div>
      ${hasBudget ? `<div><span style="color:var(--muted);">${isProfit ? 'Profit Points' : 'Loss Points'}:</span> <strong style="color:${isProfit ? '#34d399' : '#f87171'};">${esc(moneyFmt(Math.abs(profit)))}</strong></div>` : ''}
      <div><span style="color:var(--muted);">My Points Used:</span> <strong style="color:#4f8ef7;">${esc(moneyFmt(myCost))}</strong></div>
    </div>`;

  const viewBtnHtml = `<button class="cp-view-btn" style="margin-top:0;">View Details →</button>`;

  const topRightHtml = opts.unmatched
    ? `<div style="position:absolute;top:14px;right:14px;">${viewBtnHtml}</div>`
    : `<div style="position:absolute;top:14px;right:14px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span class="cp-status-pill" style="background:rgba(79,142,247,0.12);color:#4f8ef7;white-space:nowrap;">${esc(p.status || 'In Progress')}</span>
        ${viewBtnHtml}
      </div>`;

  const titleHtml = opts.unmatched
    ? `<div class="cp-entity-name" style="font-size:14px;padding-right:130px;">${esc(p.projectName)}
        <span style="font-size:9.5px;font-weight:700;color:var(--txt2);background:var(--surface2,#20242e);
          border-radius:8px;padding:1px 6px;margin-left:4px;vertical-align:middle;">No project record</span>
      </div>`
    : `<div style="padding-right:130px;">
        <div class="cp-entity-name" style="font-size:14px;">${esc(p.projectName || p.projectId)}</div>
        <div class="cp-entity-id">${esc(p.projectId)} · ${esc(client?.name || p.clientId || '—')}</div>
      </div>`;

  const datesHtml = opts.unmatched
    ? ''
    : `<div style="font-size:11px;color:var(--muted);margin-bottom:.4rem;">
        Start: <strong style="color:var(--txt1);">${esc(fmtCPDateShort(p.startDate))}</strong>
        · End: <strong style="color:var(--txt1);">${esc(fmtCPDateShort(p.endDate))}</strong>
      </div>`;

  return `
    <div class="cp-entity-card emp-proj-card" data-project="${esc(p.projectName)}" style="position:relative;cursor:pointer;min-width:0;overflow:hidden;">
      ${topRightHtml}
      <div style="margin-bottom:.6rem;">
        ${titleHtml}
      </div>
      ${datesHtml}
      <div style="font-size:11px;color:var(--muted);margin-bottom:.6rem;">Your hours on this project: <strong>${esc(fh(myHours))}</strong></div>
      ${totalsHtml}
      <div style="font-size:9px;font-weight:700;margin-bottom:4px;color:${labelColor};">${labelText}</div>
      <div style="height:6px;background:var(--surface2,#20242e);border-radius:4px;overflow:hidden;">${barHtml}</div>
    </div>`;
}

function openEmpProjectDetailPage(projectName) {
  const container = $('myProjCardsContainer');
  if (!container) return;

  const p = EMP_DASH_PROJECT_BY_NAME[projectName] || { projectId: '', projectName, clientId: '', status: '', projectConstant: 0, __unmatched: true };
  const client = CP_CLIENTS.find(c => c.id === p.clientId);
  const moneyFmt = typeof fmtCPMoney === 'function' ? fmtCPMoney : (n => Math.round(Number(n) || 0).toLocaleString('en-IN'));

  let totalCost = 0;
  try { totalCost = getProjectCostBreakdown(p).totalCost; } catch (err) {  }
  let myCost = 0;
  try { myCost = getMyProjectCost(p); } catch (err) {  }

  const budget = parseFloat(p.projectConstant) || 0;
  const hasBudget = budget > 0;
  const isOverBudget = hasBudget && totalCost > budget;
  const fillPct = hasBudget ? Math.min((totalCost / budget) * 100, 100) : (totalCost > 0 ? 100 : 0);
  const profit = budget - totalCost;
  const isProfit = profit >= 0;

  let barHtml, statusText, statusColor;
  if (!totalCost) {
    barHtml = `<div style="width:100%;height:100%;background:var(--border-md,#3a3f4b);"></div>`;
    statusText = 'No hours logged yet'; statusColor = 'var(--txt1,var(--fg))';
  } else if (isOverBudget) {
    barHtml = `<div style="width:100%;height:100%;background:#f87171;"></div>`;
    statusText = 'Over budget'; statusColor = '#f87171';
  } else {
    barHtml = `<div style="width:${fillPct}%;height:100%;background:#34d399;"></div>`;
    statusText = hasBudget ? 'Within budget' : 'No budget set'; statusColor = hasBudget ? '#34d399' : 'var(--txt1,var(--fg))';
  }

  const summaryHtml = p.__unmatched
    ? `<div style="font-size:11px;font-weight:700;color:var(--txt2);background:var(--surface2,#20242e);
        border-radius:8px;padding:3px 9px;display:inline-block;margin-bottom:10px;">No project record</div>`
    : `<div style="font-size:11px;color:var(--txt2,var(--muted));margin-bottom:10px;">
        ${esc(p.projectId)} · ${esc(client?.name || p.clientId || '—')}
        · Start: <strong style="color:var(--txt1);">${esc(fmtCPDateShort(p.startDate))}</strong>
        · End: <strong style="color:var(--txt1);">${esc(fmtCPDateShort(p.endDate))}</strong>
      </div>
      <span class="cp-status-pill" style="background:rgba(79,142,247,0.12);color:#4f8ef7;margin-bottom:10px;display:inline-block;">${esc(p.status || 'In Progress')}</span>`;

  const totalsHtml = `
    <div style="display:flex;gap:18px;flex-wrap:wrap;margin:10px 0;font-size:11px;">
      <div><span style="color:var(--muted);">Project Budget:</span> <strong style="color:var(--txt1);">${hasBudget ? esc(moneyFmt(budget)) : 'Not set'}</strong></div>
      <div><span style="color:var(--muted);">Total Points Used:</span> <strong style="color:var(--txt1);">${esc(moneyFmt(totalCost))}</strong></div>
      ${hasBudget ? `<div><span style="color:var(--muted);">${isProfit ? 'Profit Points' : 'Loss Points'}:</span> <strong style="color:${isProfit ? '#34d399' : '#f87171'};">${esc(moneyFmt(Math.abs(profit)))}</strong></div>` : ''}
      <div><span style="color:var(--muted);">My Points Used:</span> <strong style="color:#4f8ef7;">${esc(moneyFmt(myCost))}</strong></div>
    </div>
    <div style="font-size:9px;font-weight:700;margin-bottom:4px;color:${statusColor};">${statusText}</div>
    <div style="height:6px;background:var(--surface2,#20242e);border-radius:4px;overflow:hidden;margin-bottom:4px;">${barHtml}</div>`;

  const entries = EMP_DASH_FULL_HISTORY
    .filter(e => e.project === projectName && e.status !== 'Leave' && e.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalHours = entries.reduce((s, e) => s + Number(e.hours || 0), 0);

  const rowsHtml = entries.length
    ? entries.map(e => {
        const dateLabel = new Date(e.date + 'T00:00:00').toLocaleDateString('en-IN',
          { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        return `
          <div style="padding:9px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span style="font-size:12.5px;font-weight:700;color:var(--txt1);">${esc(dateLabel)}</span>
              <span style="font-size:12.5px;font-weight:700;color:var(--a1);white-space:nowrap;">${esc(fh(e.hours))}</span>
            </div>
            ${e.task ? `<div style="font-size:11px;color:var(--txt2,var(--muted));margin-top:3px;"><span class="tpill">${esc(e.task)}</span></div>` : ''}
            <div style="font-size:11px;color:${e.notes ? 'var(--txt2,var(--muted))' : 'var(--muted)'};margin-top:3px;${e.notes ? '' : 'font-style:italic;'}">
              ${e.notes ? '📝 ' + esc(e.notes) : 'No notes'}
            </div>
          </div>`;
      }).join('')
    : `<div style="font-size:12px;color:var(--txt2,var(--muted));padding:12px 0;">No entries found for this project.</div>`;

  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <button id="empProjDetailBack" class="cp-back-btn">← Back</button>
    </div>
    <div class="cp-card">
      <div style="font-weight:700;font-size:16px;color:var(--txt1);margin-bottom:6px;">${esc(projectName)}</div>
      ${summaryHtml}
      ${totalsHtml}
      <div style="font-size:11px;color:var(--txt2,var(--muted));margin:10px 0 4px;">${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'} · ${esc(fh(totalHours))} total</div>
      <div>${rowsHtml}</div>
    </div>`;

  $('empProjDetailBack').addEventListener('click', () => renderMyDashboardTab());
}

function computeAttendanceRange() {
  const today = todayStr();

  if (EMP_ATTEND_RANGE === 'month') {
    const fromDate = EMP_ATTEND_MONTH + '-01';
    const toDate = (EMP_ATTEND_MONTH === today.slice(0, 7))
      ? today
      : (typeof lastDayOfMonthStr_ === 'function' ? lastDayOfMonthStr_(EMP_ATTEND_MONTH) : today);
    return { fromDate, toDate };
  }

  const d = new Date();
  d.setDate(d.getDate() - 14);
  const fromDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { fromDate, toDate: today };
}

function buildDateRangeArray(fromDate, toDate) {
  const dates = [];
  const cur = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');
  while (cur <= end) {
    dates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates.reverse();
}

async function renderMyAttendanceTab() {
  const session = APP_SESSION;
  const rangeBar = $('myAttendRangeBar');
  const gridWrap = $('myAttendGridWrap');
  if (!gridWrap) return;

  if (rangeBar) {
    const isMonth = EMP_ATTEND_RANGE === 'month';
    rangeBar.innerHTML = `
      <button class="rbtn ${EMP_ATTEND_RANGE === 'last15' ? 'active' : ''}" data-range="last15">Last 15 Days</button>
      <button class="rbtn ${isMonth ? 'active' : ''}" data-range="month">Select Month</button>
      ${isMonth ? `<input type="month" id="empAttendMonthPicker" value="${esc(EMP_ATTEND_MONTH)}" max="${esc(todayStr().slice(0, 7))}"
        style="margin-left:4px;background:var(--surface2,#20242e);border:1px solid var(--border);border-radius:6px;
        color:var(--txt1);font-size:12px;padding:6px 8px;"/>` : ''}`;

    if (!rangeBar.dataset.wired) {
      rangeBar.dataset.wired = '1';
      rangeBar.addEventListener('click', e => {
        const btn = e.target.closest('button[data-range]');
        if (!btn) return;
        EMP_ATTEND_RANGE = btn.dataset.range;
        renderMyAttendanceTab();
      });
      rangeBar.addEventListener('change', e => {
        if (e.target.id === 'empAttendMonthPicker') {
          EMP_ATTEND_MONTH = e.target.value || todayStr().slice(0, 7);
          renderMyAttendanceTab();
        }
      });
    }
  }

  gridWrap.innerHTML = `<div class="slot-loading"><div class="slot-spinner"></div><span>Loading…</span></div>`;

  try {
    await ensureEmpFullHistoryLoaded();
    if (session !== APP_SESSION) return;
  } catch (err) {
    if (session !== APP_SESSION) return;
    showLoadError(gridWrap, 'Could not load your attendance: ' + err.message, renderMyAttendanceTab);
    return;
  }

  if (typeof ensureCPStyles === 'function') ensureCPStyles(); 

  const { fromDate, toDate } = computeAttendanceRange();
  const dates = buildDateRangeArray(fromDate, toDate);

  const byDate = {};
  EMP_DASH_FULL_HISTORY.forEach(e => {
    if (!e.date) return;
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const rows = dates.map(dateStr => buildEmpAttendanceRow(dateStr, byDate[dateStr] || [])).join('');
  gridWrap.innerHTML = `<div class="cp-card">${rows}</div>`;
}

function buildEmpAttendanceRow(dateStr, dayEntries) {
  const statusKey = typeof getDayStatus === 'function'
    ? getDayStatus(dateStr, dayEntries)
    : (dayEntries.length ? 'worked' : 'not_logged');

  const worked = dayEntries.filter(e => e.status !== 'Leave');
  const totalHours = worked.reduce((s, e) => s + Number(e.hours || 0), 0);

  let meta = (typeof STATUS_META !== 'undefined' && STATUS_META[statusKey])
    || { icon: '', label: statusKey, fg: 'var(--txt1)', bg: 'var(--surface2)' };

  if (statusKey === 'worked') {
    const otThreshold = typeof OVERTIME_THRESHOLD_HOURS === 'number' ? OVERTIME_THRESHOLD_HOURS : 9;
    if (totalHours >= otThreshold) {
      const overage = totalHours - otThreshold;
      meta = { icon: '⚡', label: `OT · ${fh(overage)}`, fg: '#92400e', bg: 'rgba(251,191,36,0.18)' };
    } else if (totalHours > 0) {
      const shortfall = otThreshold - totalHours;
      meta = { icon: '🔵', label: `Permission · ${fh(shortfall)}`, fg: '#4f8ef7', bg: 'rgba(79,142,247,0.12)' };
    }
  }

  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN',
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const timeIns  = worked.map(e => e.timeIn).filter(Boolean).sort();
  const timeOuts = worked.map(e => e.timeOut).filter(Boolean).sort();
  const checkIn  = timeIns[0] || null;
  const checkOut = timeOuts[timeOuts.length - 1] || null;

  const checkTimesHtml = (checkIn || checkOut)
    ? `<span style="font-size:11px;color:var(--txt2,var(--muted));white-space:nowrap;">
         <b style="color:var(--txt1);">${esc(checkIn || '—')}</b> → <b style="color:var(--txt1);">${esc(checkOut || '—')}</b>
       </span>`
    : '';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap;">
      <span style="font-size:13px;font-weight:700;color:var(--txt1);min-width:170px;">${esc(label)}</span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;
        background:${meta.bg};color:${meta.fg};white-space:nowrap;">${meta.icon} ${esc(meta.label)}</span>
      ${checkTimesHtml}
      <div style="flex:1;"></div>
      <span style="font-size:13px;font-weight:700;color:var(--txt1);white-space:nowrap;">${totalHours > 0 ? esc(fh(totalHours)) : '—'}</span>
    </div>`;
}
let EMP_DASHBOARD_PROMISE = null;
let EMP_HISTORY_PROMISE = null;

// TABLE
let tData = [], tSort = { col:'date', dir:-1 }, tPage = 1;
const PAGE = CONFIG.PAGE_SIZE;

const OVERTIME_THRESHOLD_HOURS = 9;

function fmtHrsMin(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0)  return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function getDayTotalsMap() {
  const map = {};
  ENTRIES.filter(e => e.status !== 'Leave').forEach(e => {
    map[e.date] = (map[e.date] || 0) + Number(e.hours || 0);
  });
  return map;
}

function refreshStats() {
  const tod = todayStr(), ws = weekStart(), mo = todayStr().slice(0,7);
  const sum = arr => arr.reduce((s,e) => s + Number(e.hours||0), 0);
  const worked = ENTRIES.filter(e => e.status !== 'Leave');
  $('s0').textContent = fh(sum(worked.filter(e => e.date === tod)));
  $('s1').textContent = fh(sum(worked.filter(e => e.date >= ws)));
  $('s2').textContent = fh(sum(worked.filter(e => e.date.startsWith(mo))));
  $('s3').textContent = [...new Set(ENTRIES.map(e => e.date))].length + ' days';

  if (typeof checkDailyCelebration === 'function') checkDailyCelebration();
}

function refreshFilters() {
  const mon = $('fmon'), cur = mon?.value;
  if (!mon) return;
  const months = [...new Set(ENTRIES.map(e => e.date.slice(0,7)))].sort().reverse();
  mon.innerHTML = '<option value="">All months</option>';
  months.forEach(m => {
    const lbl = new Date(`${m}-01`).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    const o = document.createElement('option'); o.value=m; o.textContent=lbl;
    mon.appendChild(o);
  });
  if (cur) mon.value = cur;
}

function getFiltered() {
  const q   = $('srch')?.value.toLowerCase().trim() || '';
  const mon = $('fmon')?.value || '';
  const cli = $('fcli2')?.value || '';
  const slt = $('fslt')?.value || '';
  return ENTRIES.filter(e => {
    if (mon && !e.date.startsWith(mon)) return false;
    if (cli && e.clientId !== cli)      return false;
    if (slt && e.slot !== slt)          return false;
    if (q && ![e.client,e.project,e.task,e.notes,e.date,e.slot]
      .some(v => v?.toLowerCase().includes(q))) return false;
    return true;
  });
}

function refreshTable() {
  let rows = getFiltered();
  rows.sort((a,b) => {
    const av = a[tSort.col] ?? '', bv = b[tSort.col] ?? '';
    if (tSort.col === 'hours') return (Number(av)-Number(bv)) * tSort.dir;
    return (av < bv ? -1 : av > bv ? 1 : 0) * tSort.dir;
  });
  tData = rows; tPage = 1; renderPage();
}

function renderPage() {
  const tbody = $('tbody'), tfoot = $('tfoot'), pager = $('pager');
  if (!tbody) return;
  const total = tData.length, pages = Math.max(1, Math.ceil(total/PAGE));
  if (tPage > pages) tPage = pages;
  const cnt = $('cnt');
  if (cnt) cnt.textContent = `${total} entr${total===1?'y':'ies'}`;

  const slice      = tData.slice((tPage-1)*PAGE, tPage*PAGE);
  const totalHours = tData.filter(e=>e.status!=='Leave').reduce((s,e)=>s+Number(e.hours||0),0);
  const pageHours  = slice.filter(e=>e.status!=='Leave').reduce((s,e)=>s+Number(e.hours||0),0);

  if (!slice.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">
      <div class="estat">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p>${ENTRIES.length===0?'No entries yet. Start logging above.':'No entries match your filters.'}</p>
      </div></td></tr>`;
    if (tfoot) tfoot.innerHTML = '';
    if (pager) pager.innerHTML = '';
    return;
  }

  const slotIcon = { morning:'🌅', afternoon:'☀️', extended:'🌙' };
  const slotLabel = { morning:'Morning', afternoon:'Afternoon', extended:'Extended' };
  const dayTotals = getDayTotalsMap();

  tbody.innerHTML = slice.map((e,i) => {
    const isLeave = e.status === 'Leave';
    const isOvertimeDay = !isLeave && (dayTotals[e.date] || 0) > OVERTIME_THRESHOLD_HOURS;
    return `<tr class="${isLeave?'leave-row':''}">
      <td class="rn" data-label="#">${(tPage-1)*PAGE+i+1}</td>
      <td class="dcell" data-label="Date">${fmtDate(e.date)}<br><span style="font-size:.6rem;color:var(--muted)">${e.day||''}</span>${e.savedAt ? `<br><span style="font-size:.58rem;color:var(--muted);font-style:italic" title="Saved at ${e.savedAt}">🕐 ${e.savedAt}</span>` : ''}</td>
      <td data-label="Slot"><span class="slot-pill slot-${e.slot}">${slotIcon[e.slot]||''} ${slotLabel[e.slot]||e.slot} #${e.entryNum}</span></td>
      <td class="dcell" data-label="Time In">${e.timeIn||'—'}</td>
      <td class="dcell" data-label="Time Out">${e.timeOut||'—'}</td>
      <td data-label="Client">${isLeave ? '<span class="leave-badge-sm">🏖️ Leave</span>' : esc(e.client)}</td>
      <td data-label="Project">${isLeave ? '—' : esc(e.project)}</td>
      <td data-label="Task">${isLeave ? '—' : `<span class="tpill">${esc(e.task)}</span>`}</td>
      <td class="hcell" data-label="Hours">${isLeave ? '—' : (e.hours ? fmtHrsMin(e.hours) : '—')}${isOvertimeDay ? ` <span class="ot-badge" title="This day's total (${fmtHrsMin(dayTotals[e.date])}) is past ${fmtHrsMin(OVERTIME_THRESHOLD_HOURS)}" style="display:inline-block;font-size:.62rem;font-weight:700;color:#92400e;background:#fde68a;border-radius:5px;padding:1px 5px;margin-left:4px;vertical-align:middle;">⚡ OT +${fmtHrsMin(dayTotals[e.date] - OVERTIME_THRESHOLD_HOURS)}</span>` : ''}</td>
      <td class="ncell" data-label="Notes" title="${esc(e.notes)}">${isLeave ? '—' : esc(e.notes)}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    tfoot.innerHTML = `<tr class="totrow">
      <td class="rn"></td>
      <td colspan="7" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">
        Page / All filtered (worked hours only)
      </td>
      <td class="hcell">${fmtHrsMin(pageHours)} / ${fmtHrsMin(totalHours)}</td>
      <td></td>
    </tr>`;
  }

  document.querySelectorAll('th[data-col]').forEach(th => {
    const arr = th.querySelector('.sort-arr');
    th.classList.toggle('sorted', th.dataset.col === tSort.col);
    if (arr) arr.textContent = th.dataset.col === tSort.col
      ? (tSort.dir === -1 ? ' ↓' : ' ↑') : ' ↕';
  });

  if (!pager) return;
  if (pages <= 1) { pager.innerHTML = ''; return; }
  const nums = [];
  for (let p=1; p<=pages; p++) {
    if (p===1||p===pages||Math.abs(p-tPage)<=1) nums.push(p);
    else if (nums[nums.length-1] !== '…') nums.push('…');
  }
  pager.innerHTML = `
    <span style="color:var(--muted)">${(tPage-1)*PAGE+1}–${Math.min(tPage*PAGE,total)} of ${total}</span>
    <div class="pager-btns">
      <button class="pbtn" id="pprev" ${tPage===1?'disabled':''}>‹ Prev</button>
      ${nums.map(n => n==='…'
        ? `<span style="padding:.2rem .4rem;color:var(--muted)">…</span>`
        : `<button class="pbtn${n===tPage?' cur':''}" data-p="${n}">${n}</button>`
      ).join('')}
      <button class="pbtn" id="pnext" ${tPage===pages?'disabled':''}>Next ›</button>
    </div>`;
}

function initTable() {

  const thead = document.querySelector('#htbl thead');
  if (thead) {
    thead.addEventListener('click', e => {
      const th = e.target.closest('th[data-col]');
      if (!th) return;
      const col = th.dataset.col;
      tSort = { col, dir: tSort.col===col ? tSort.dir*-1 : -1 };
      refreshTable();
    });
  }

  const pager = $('pager');
  if (pager) {
    pager.addEventListener('click', e => {
      if (e.target.id==='pprev') tPage--;
      else if (e.target.id==='pnext') tPage++;
      else if (e.target.dataset.p) tPage = parseInt(e.target.dataset.p);
      else return;
      renderPage();
      document.querySelector('.thdr')?.scrollIntoView({behavior:'smooth',block:'start'});
    });
  }

  $('srch')?.addEventListener('input',  () => refreshTable());
  $('fmon')?.addEventListener('change', () => refreshTable());
  $('fcli2')?.addEventListener('change',() => refreshTable());
  $('fslt')?.addEventListener('change', () => refreshTable());

  $('xbtn')?.addEventListener('click', () => {
    const rows = getFiltered().slice().sort((a,b) => b.date.localeCompare(a.date));
    const hdr  = ['Date','Day','Slot','Entry#','Time In','Time Out','Hours',
                  'Client','Project','Task','Notes','Status','Saved At'];
    const lines = rows.map(e => [
      e.date, e.day||'', e.slot, e.entryNum,
      e.timeIn, e.timeOut, e.hours,
      `"${(e.client||'').replace(/"/g,'""')}"`,
      `"${(e.project||'').replace(/"/g,'""')}"`,
      e.task,
      `"${(e.notes||'').replace(/"/g,'""')}"`,
      e.status,
      `"${(e.savedAt||'').replace(/"/g,'""')}"`,
    ].join(','));
    const csv = [hdr, ...lines].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `timesheet_${USER.id}_${todayStr()}.csv`;
    a.click();
    toast('s', 'CSV downloaded', `${rows.length} rows`);
  });
}

// CELEBRATION
const CELEBRATION_THRESHOLD_HOURS = 9;
const CELEBRATION_SESSION_PREFIX  = 'tt_celebration_shown_';

function checkDailyCelebration() {
  if (typeof USER === 'undefined' || !USER || !USER.id) return;
  if (typeof ENTRIES === 'undefined' || !Array.isArray(ENTRIES)) return;
  if (typeof todayStr !== 'function') return;

  const today      = todayStr();
  const sessionKey = CELEBRATION_SESSION_PREFIX + USER.id + '_' + today;

  if (sessionStorage.getItem(sessionKey)) return;

  const todayHours = ENTRIES
    .filter(e => e.date === today && e.status !== 'Leave')
    .reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

  if (todayHours >= CELEBRATION_THRESHOLD_HOURS) {

    sessionStorage.setItem(sessionKey, '1');
    showCelebrationOverlay();
  }
}

function showCelebrationOverlay() {
  const DURATION   = 4500; 
  const FADE_MS    = 550;

  const overlay = document.createElement('div');
  overlay.id = 'celebrationOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 40%, rgba(24,24,40,.55), rgba(6,6,12,.78));
    backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
    opacity:0;transition:opacity ${FADE_MS}ms ease;
    pointer-events:none;
  `;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
  overlay.appendChild(canvas);

  const card = document.createElement('div');
  card.style.cssText = `
    position:relative;text-align:center;padding:30px 46px;
    background:linear-gradient(135deg, rgba(32,32,50,.92), rgba(18,18,32,.92));
    border:1px solid rgba(255,255,255,.10);
    border-radius:18px;
    box-shadow:0 24px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03) inset;
    transform:scale(.86) translateY(12px);
    opacity:0;
    transition:transform .65s cubic-bezier(.16,1,.3,1), opacity .55s ease;
  `;
  card.innerHTML = `
    <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:.2px;margin-bottom:10px;
      text-shadow:0 2px 12px rgba(0,0,0,.35);">
      🎉 +100 XP Earned
    </div>
    <div style="font-size:15px;font-weight:600;color:#ffb454;letter-spacing:.2px;
      text-shadow:0 2px 10px rgba(0,0,0,.3);">
      🔥 Daily Streak Continues
    </div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    requestAnimationFrame(() => {
      card.style.opacity   = '1';
      card.style.transform = 'scale(1) translateY(0)';
    });
  });

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cw = 0, ch = 0;

  function resize() {
    cw = overlay.clientWidth;
    ch = overlay.clientHeight;
    canvas.width  = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const PETAL_COLORS = ['#ff8fab', '#ffd166', '#a78bfa', '#4f8ef7', '#34d399', '#fb923c'];
  const BURST_COLORS = ['#ffd166', '#ff6b6b', '#4f8ef7', '#a78bfa', '#34d399', '#f472b6'];

  function makePetal() {
    return {
      x: Math.random() * cw,
      y: -20 - Math.random() * 220,
      size: 6 + Math.random() * 7,
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      speedY: 1 + Math.random() * 1.6,
      speedX: (Math.random() - 0.5) * 1.2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.06,
      sway: Math.random() * Math.PI * 2,
      opacity: 0.8 + Math.random() * 0.2,
    };
  }

  const petals = [];
  for (let i = 0; i < 26; i++) petals.push(makePetal());

  const bursts = [];
  function spawnBurst(x, y) {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
      const speed = 2 + Math.random() * 3.5;
      bursts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        size: 2 + Math.random() * 2,
        color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
      });
    }
  }

  const burstTimers = [300, 900, 1600, 2300].map(delay => setTimeout(() => {
    spawnBurst(cw * (0.25 + Math.random() * 0.5), ch * (0.25 + Math.random() * 0.35));
  }, delay));

  let rafId;
  function tick() {
    ctx.clearRect(0, 0, cw, ch);

    petals.forEach(p => {
      p.y += p.speedY;
      p.sway += 0.03;
      p.x += p.speedX + Math.sin(p.sway) * 0.6;
      p.rot += p.rotSpeed;
      if (p.y > ch + 20) Object.assign(p, makePetal(), { y: -20 });

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.05; 
      b.life -= b.decay;
      if (b.life <= 0) { bursts.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(b.life, 0);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    rafId = requestAnimationFrame(tick);
  }
  tick();

  setTimeout(() => {
    overlay.style.opacity = '0';
    card.style.opacity    = '0';
    setTimeout(() => {
      cancelAnimationFrame(rafId);
      burstTimers.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
      overlay.remove();
    }, FADE_MS);
  }, DURATION);
}
