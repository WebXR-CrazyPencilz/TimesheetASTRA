// UNITS — project units allocated to people by TL / Manager, tracked against monthly position targets
let UNITS_DATA  = null;
let UNITS_MONTH = todayStr().slice(0, 7);

const UNITS_INPUT_STYLE = 'background:var(--inp);border:1px solid var(--inp-b);border-radius:7px;color:var(--txt);font-size:12.5px;padding:7px 9px;font-family:inherit;';
const UNITS_PRIMARY_STYLE = 'background:var(--a1);color:#fff;border:none;';

function unitsFmt(n) { return (Math.round(Number(n) * 100) / 100).toLocaleString('en-IN'); }

function unitsActiveEmployees() {
  return (LIVE_EMPLOYEES || []).filter(e => e.active !== false);
}

function unitsProjectName(id) {
  const p = (PROJECTS || []).find(p => p.id === id);
  if (p) return p.name;
  const u = UNITS_DATA && UNITS_DATA.projectUnits.find(p => p.projectId === id);
  return u ? (u.projectName || id) : id;
}

function unitsTargetFor(position) {
  if (!position || !UNITS_DATA) return 0;
  const t = UNITS_DATA.targets.find(t => t.position.toLowerCase() === position.toLowerCase());
  return t ? t.target : 0;
}

function unitsEarned(empId, month) {
  return UNITS_DATA.allocations
    .filter(a => a.empId === empId && a.month === month)
    .reduce((s, a) => s + a.units, 0);
}

function unitsProjectUsed(projectId) {
  return UNITS_DATA.allocations.filter(a => a.projectId === projectId).reduce((s, a) => s + a.units, 0);
}

function unitsProgressBar(earned, target) {
  if (!target) return `<span style="font-size:11px;color:var(--muted)">No target set</span>`;
  const pct = Math.round(earned / target * 100);
  const color = pct >= 100 ? 'var(--ok)' : pct >= 60 ? 'var(--warn)' : 'var(--err)';
  return `
    <div style="display:flex;align-items:center;gap:8px;min-width:160px;">
      <div style="flex:1;height:7px;background:var(--border);border-radius:99px;overflow:hidden;">
        <div style="width:${Math.min(pct, 100)}%;height:100%;background:${color};"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:${color};min-width:40px;text-align:right;">${pct}%</span>
    </div>`;
}

function unitsMonthOptions(selected) {
  const months = new Set([todayStr().slice(0, 7), selected]);
  (UNITS_DATA ? UNITS_DATA.allocations : []).forEach(a => a.month && months.add(a.month));
  return [...months].sort().reverse().map(m => {
    const label = new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `<option value="${m}"${m === selected ? ' selected' : ''}>${label}</option>`;
  }).join('');
}

function unitsSection(title, body, extra = '') {
  return `
    <div class="card" style="padding:1rem 1.1rem;margin-bottom:1.25rem;overflow:visible;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:.8rem;flex-wrap:wrap;">
        <div style="font-weight:700;font-size:14px;color:var(--txt)">${title}</div>${extra}
      </div>
      ${body}
    </div>`;
}

function unitsTable(headers, rows, empty) {
  if (!rows.length) return `<div class="chart-empty" style="padding:1rem;font-size:12.5px;color:var(--muted)">${empty}</div>`;
  return `
    <div class="twrap"><table style="width:100%">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

// ── TL / Manager ──────────────────────────────────────────────────

async function renderUnitsTab(content) {
  const session = APP_SESSION;
  content.innerHTML = '<div class="mgr-loading"><div class="slot-spinner"></div><span>Loading units…</span></div>';
  try {
    UNITS_DATA = await apiGetUnitsData();
    if (session !== APP_SESSION) return;
    drawUnitsAdmin(content);
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(content, 'Could not load units: ' + error.message, () => renderUnitsTab(content));
  }
}

async function unitsAdminWrite(content, action, data, successMsg) {
  try {
    await apiUnitsWrite(action, data);
    toast('s', successMsg);
    await renderUnitsTab(content);
  } catch (error) {
    toast('e', 'Could not save', error.message);
  }
}

function drawUnitsAdmin(content) {
  const month = UNITS_MONTH;
  const employees = unitsActiveEmployees();
  const projects = PROJECTS || [];
  const monthAllocs = UNITS_DATA.allocations.filter(a => a.month === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.allocatedAt.localeCompare(a.allocatedAt));
  const positions = [...new Set(UNITS_DATA.targets.map(t => t.position))];

  const monthTotal = monthAllocs.reduce((s, a) => s + a.units, 0);
  const people = employees.map(e => {
    const position = UNITS_DATA.positions[e.id] || '';
    const target = unitsTargetFor(position);
    return { ...e, position, target, earned: unitsEarned(e.id, month) };
  });
  const withTarget = people.filter(p => p.target > 0);
  const onTrack = withTarget.filter(p => p.earned >= p.target).length;

  const projectRows = projects.map(p => {
    const u = UNITS_DATA.projectUnits.find(u => u.projectId === p.id);
    const total = u ? u.totalUnits : 0;
    const used = unitsProjectUsed(p.id);
    return { id: p.id, name: p.name, total, used, remaining: total - used };
  });

  const peopleTable = unitsTable(
    ['Employee', 'Position', 'Target', 'Earned', 'Progress'],
    people.map(p => `
      <tr>
        <td>${esc(p.name)}<div style="font-size:11px;color:var(--muted)">${esc(p.team || '')}</div></td>
        <td><select class="units-pos" data-emp="${esc(p.id)}" style="${UNITS_INPUT_STYLE}">
          <option value="">—</option>
          ${[...new Set([...positions, p.position].filter(Boolean))].map(pos =>
            `<option value="${esc(pos)}"${pos === p.position ? ' selected' : ''}>${esc(pos)}</option>`).join('')}
        </select></td>
        <td>${p.target ? unitsFmt(p.target) : '—'}</td>
        <td style="font-weight:700">${unitsFmt(p.earned)}</td>
        <td>${unitsProgressBar(p.earned, p.target)}</td>
      </tr>`),
    'No active employees.');

  const projectTable = unitsTable(
    ['Project', 'Total units', 'Allocated', 'Remaining'],
    projectRows.map(p => `
      <tr>
        <td>${esc(p.name)}<div style="font-size:11px;color:var(--muted)">${esc(p.id)}</div></td>
        <td><div style="display:flex;gap:6px;">
          <input type="number" min="0" step="any" class="units-total" data-id="${esc(p.id)}" data-name="${esc(p.name)}"
            value="${p.total || ''}" placeholder="0" style="${UNITS_INPUT_STYLE}width:100px;"/>
          <button type="button" class="btn bghost units-total-save" data-id="${esc(p.id)}" style="padding:.4rem .7rem">Save</button>
        </div></td>
        <td>${unitsFmt(p.used)}</td>
        <td style="font-weight:700;color:${p.total && p.remaining <= 0 ? 'var(--err)' : 'var(--txt)'}">${p.total ? unitsFmt(p.remaining) : '—'}</td>
      </tr>`),
    'No projects found.');

  const targetsBody = `
    ${unitsTable(['Position', 'Monthly target', ''],
      UNITS_DATA.targets.map(t => `
        <tr>
          <td>${esc(t.position)}</td>
          <td>${unitsFmt(t.target)}</td>
          <td style="text-align:right"><button type="button" class="btn bghost units-target-del" data-pos="${esc(t.position)}" style="padding:.35rem .7rem">Remove</button></td>
        </tr>`),
      'No positions yet. Add one below, e.g. Junior · 200.')}
    <form id="unitsTargetForm" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      <input name="position" required placeholder="Position (e.g. Senior)" style="${UNITS_INPUT_STYLE}"/>
      <input name="target" type="number" min="0" step="any" required placeholder="Monthly units" style="${UNITS_INPUT_STYLE}width:140px;"/>
      <button type="submit" class="btn" style="${UNITS_PRIMARY_STYLE}">Save target</button>
    </form>`;

  const allocTable = unitsTable(
    ['Date', 'Employee', 'Project', 'Units', 'Work done', 'By', ''],
    monthAllocs.map(a => `
      <tr>
        <td>${fmtDate(a.date)}</td>
        <td>${esc(a.empName)}</td>
        <td>${esc(a.projectName || unitsProjectName(a.projectId))}</td>
        <td style="font-weight:700">${unitsFmt(a.units)}</td>
        <td style="max-width:260px">${esc(a.note) || '—'}</td>
        <td style="font-size:11px;color:var(--muted)">${esc(a.allocatedBy)}</td>
        <td style="text-align:right"><button type="button" class="btn bghost units-alloc-del" data-id="${esc(a.id)}" style="padding:.35rem .7rem">Delete</button></td>
      </tr>`),
    'No units allocated this month.');

  content.innerHTML = `
    <div class="strip" style="margin-bottom:1.25rem">
      <div class="sitem"><span class="slbl">Units this month</span><span class="sval hi">${unitsFmt(monthTotal)}</span></div>
      <div class="sitem"><span class="slbl">Allocations</span><span class="sval">${monthAllocs.length}</span></div>
      <div class="sitem"><span class="slbl">On target</span><span class="sval">${onTrack} / ${withTarget.length}</span></div>
      <div class="sitem"><span class="slbl">Month</span><span class="sval">
        <select id="unitsMonth" style="${UNITS_INPUT_STYLE}">${unitsMonthOptions(month)}</select></span></div>
    </div>
    <div style="font-size:12px;color:var(--txt2);margin:-.5rem 0 1rem;">Units are added from each project's page (Projects &amp; Clients → open a project → 🎯 Units).</div>
    ${unitsSection('👥 People — this month vs target', peopleTable)}
    ${unitsSection('🧾 Allocations this month', allocTable)}
    ${unitsSection('📁 Project units', projectTable)}
    ${unitsSection('🎯 Monthly targets by position', targetsBody)}
  `;

  $('unitsMonth').onchange = e => { UNITS_MONTH = e.target.value; drawUnitsAdmin(content); };

  $('unitsTargetForm').onsubmit = ev => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.target));
    unitsAdminWrite(content, 'setPositionTarget', f, `Target saved for ${f.position}`);
  };

  content.querySelectorAll('.units-pos').forEach(sel => {
    sel.onchange = () => unitsAdminWrite(content, 'setEmployeePosition',
      { empId: sel.dataset.emp, position: sel.value }, 'Position updated');
  });

  content.querySelectorAll('.units-total-save').forEach(btn => {
    btn.onclick = () => {
      const input = content.querySelector(`.units-total[data-id="${CSS.escape(btn.dataset.id)}"]`);
      unitsAdminWrite(content, 'setProjectUnits',
        { projectId: input.dataset.id, projectName: input.dataset.name, totalUnits: input.value || 0 },
        'Project units saved');
    };
  });

  content.querySelectorAll('.units-target-del').forEach(btn => {
    btn.onclick = () => {
      if (!confirm(`Remove the target for ${btn.dataset.pos}?`)) return;
      unitsAdminWrite(content, 'setPositionTarget', { position: btn.dataset.pos, remove: true }, 'Target removed');
    };
  });

  content.querySelectorAll('.units-alloc-del').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Delete this allocation? The units go back to the project.')) return;
      unitsAdminWrite(content, 'deleteUnitAllocation', { id: btn.dataset.id }, 'Allocation deleted');
    };
  });
}

// ── Project detail page ───────────────────────────────────────────

async function renderProjectUnitsSection(project) {
  const el = $('cpUnitsSection');
  if (!el) return;
  const session = APP_SESSION;
  el.innerHTML = `<div class="cp-card"><div class="slot-loading"><div class="slot-spinner"></div><span>Loading units…</span></div></div>`;
  try {
    UNITS_DATA = await apiGetUnitsData();
    if (session !== APP_SESSION || !document.body.contains(el)) return;
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(el, 'Could not load units: ' + error.message, () => renderProjectUnitsSection(project));
    return;
  }

  const pid = project.projectId;
  const entry = UNITS_DATA.projectUnits.find(u => u.projectId === pid);
  const total = entry ? entry.totalUnits : 0;
  const allocs = UNITS_DATA.allocations.filter(a => a.projectId === pid)
    .sort((a, b) => b.date.localeCompare(a.date) || b.allocatedAt.localeCompare(a.allocatedAt));
  const used = allocs.reduce((s, a) => s + a.units, 0);
  const remaining = total - used;
  const pct = total ? Math.min(used / total * 100, 100) : 0;

  const byEmp = {};
  allocs.forEach(a => { byEmp[a.empName] = (byEmp[a.empName] || 0) + a.units; });

  el.innerHTML = `
    <div class="cp-card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:.9rem;">
        <div style="font-weight:700;font-size:14px;color:var(--txt1);">🎯 Units</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:11px;color:var(--txt2);font-weight:600;">Total units</span>
          <input id="puTotal" type="number" min="0" step="any" value="${total || ''}" placeholder="0" class="cp-finput" style="width:100px;padding:6px 9px;"/>
          <button id="puTotalSave" class="cp-btn-ghost">Save</button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:.4rem;">
        <div style="flex:1;height:10px;background:var(--surface2);border-radius:6px;overflow:hidden;">
          <div style="width:${pct}%;height:100%;background:${remaining <= 0 && total ? 'var(--err)' : 'var(--a1)'};"></div>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--txt1);white-space:nowrap;">${unitsFmt(used)} / ${total ? unitsFmt(total) : '—'}</span>
      </div>
      <div style="font-size:11.5px;color:var(--txt2);margin-bottom:1rem;">
        ${total ? `${unitsFmt(remaining)} units left` : 'Set the total units for this project to start allocating.'}
        ${Object.keys(byEmp).length ? ' · ' + Object.entries(byEmp).sort((a, b) => b[1] - a[1])
          .map(([n, u]) => `${esc(n)} ${unitsFmt(u)}`).join(' · ') : ''}
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1.4fr) 70px 130px auto;gap:6px;align-items:center;">
        <select id="puEmp" class="cp-finput" style="padding:7px 9px;">
          <option value="">— Select name —</option>
          ${unitsActiveEmployees().map(e => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}
        </select>
        <input id="puUnits" type="number" min="1" max="100" step="1" placeholder="Images" title="How many images" class="cp-finput" style="padding:7px 9px;"/>
        <input id="puDate" type="date" value="${todayStr()}" class="cp-finput" style="padding:7px 9px;"/>
        <button id="puAdd" title="Save these units for the selected person" style="background:var(--a1);color:#fff;border:none;border-radius:8px;
          height:34px;padding:0 14px;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap;">＋ Add &amp; Save</button>
        <input id="puNote" type="text" maxlength="200" placeholder="Work done (optional)" class="cp-finput"
          style="grid-column:1/-1;padding:7px 9px;"/>
      </div>
      <div id="puImages" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;margin-top:6px;"></div>
      <div id="puSum" style="font-size:11.5px;font-weight:600;color:var(--txt2);margin-top:6px;"></div>

      ${allocs.length ? `
      <div style="margin-top:1rem;display:flex;flex-direction:column;gap:4px;">
        ${allocs.map(a => `
          <div style="display:flex;align-items:center;gap:10px;font-size:12px;padding:7px 9px;background:var(--surface2);border-radius:7px;">
            <span style="flex:0 0 78px;color:var(--txt2);">${fmtDate(a.date)}</span>
            <span style="flex:1;min-width:0;">
              <span style="font-weight:600;color:var(--txt1);">${esc(a.empName)}</span>
              ${a.note ? `<span style="color:var(--txt2);"> · ${esc(a.note)}</span>` : ''}
              ${a.imageNames && a.imageNames.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;">
                ${a.imageNames.map(n => `<span style="font-size:10.5px;padding:2px 7px;border-radius:99px;
                  background:var(--surface1);border:1px solid var(--border-md);color:var(--txt2);">🖼 ${esc(n)}</span>`).join('')}
              </div>` : ''}
            </span>
            <input class="pu-edit cp-finput" data-id="${esc(a.id)}" data-old="${a.units}" type="number" min="0.01" step="any" value="${a.units}"
              title="Change units" style="width:68px;padding:4px 6px;font-weight:700;"/>
            <button class="pu-del" data-id="${esc(a.id)}" title="Delete" style="background:none;border:none;color:var(--err);cursor:pointer;font-size:14px;">✕</button>
          </div>`).join('')}
      </div>` : ''}
    </div>`;

  const write = async (action, data, msg, btn) => {
    if (btn) btn.disabled = true;
    try {
      await apiUnitsWrite(action, data);
      toast('s', msg);
      renderProjectUnitsSection(project);
    } catch (error) {
      toast('e', 'Could not save', error.message);
      if (btn) btn.disabled = false;
    }
  };

  $('puTotalSave').onclick = e => write('setProjectUnits',
    { projectId: pid, projectName: project.projectName, totalUnits: $('puTotal').value || 0 }, 'Total units saved', e.target);

  const addBtn = $('puAdd');
  if (addBtn) addBtn.onclick = () => {
    const empId = $('puEmp').value;
    const rows = [...el.querySelectorAll('.pu-img-row')];
    if (!empId) { toast('e', 'Select a name'); return; }
    if (!rows.length) { toast('e', 'Enter the number of images'); return; }
    if (!total) { toast('e', 'Set the total units first', 'Enter the project total above and click Save.'); $('puTotal').focus(); return; }
    const images = rows.map(r => ({ name: r.querySelector('.pu-img').value.trim(), units: Number(r.querySelector('.pu-img-units').value) }));
    const missing = images.findIndex(img => !img.name);
    if (missing !== -1) { toast('e', 'Enter every image name', `Image ${missing + 1} is empty.`); rows[missing].querySelector('.pu-img').focus(); return; }
    const bad = images.findIndex(img => !(img.units > 0));
    if (bad !== -1) { toast('e', 'Enter the units', `Image ${bad + 1} needs units more than 0.`); rows[bad].querySelector('.pu-img-units').focus(); return; }
    const sum = images.reduce((t, img) => t + img.units, 0);
    if (sum > remaining) { toast('e', 'Not enough units', `These images need ${unitsFmt(sum)} but only ${unitsFmt(remaining)} are left.`); return; }
    write('allocateUnits', { empId, projectId: pid, images, date: $('puDate').value, note: $('puNote').value.trim() },
      `${unitsFmt(sum)} units added`, addBtn);
  };

  const updateSum = () => {
    const sum = [...el.querySelectorAll('.pu-img-units')].reduce((t, i) => t + (Number(i.value) || 0), 0);
    $('puSum').textContent = sum ? `Total for these images: ${unitsFmt(sum)} units` : '';
    $('puSum').style.color = sum > remaining ? 'var(--err)' : 'var(--txt2)';
  };

  const unitsInput = $('puUnits');
  if (unitsInput) unitsInput.oninput = () => {
    const box = $('puImages');
    const n = Math.min(Math.max(parseInt(unitsInput.value, 10) || 0, 0), 100);
    const kept = [...box.querySelectorAll('.pu-img-row')].map(r => ({
      name: r.querySelector('.pu-img').value, units: r.querySelector('.pu-img-units').value }));
    box.innerHTML = Array.from({ length: n }, (_, i) => `
      <div class="pu-img-row" style="display:flex;gap:4px;">
        <input class="pu-img cp-finput" type="text" maxlength="120" placeholder="Image ${i + 1} name"
          value="${esc(kept[i] ? kept[i].name : '')}" style="flex:1;min-width:0;padding:7px 9px;"/>
        <input class="pu-img-units cp-finput" type="number" min="0.01" step="any" title="Units for this image"
          value="${esc(kept[i] ? kept[i].units : '1')}" style="width:62px;padding:7px 6px;"/>
      </div>`).join('');
    box.querySelectorAll('.pu-img-units').forEach(i => { i.oninput = updateSum; });
    updateSum();
  };

  el.querySelectorAll('.pu-edit').forEach(input => {
    input.onchange = () => {
      const units = Number(input.value);
      if (!(units > 0)) { toast('e', 'Units must be more than 0'); input.value = input.dataset.old; return; }
      write('updateUnitAllocation', { id: input.dataset.id, units }, 'Units updated', input);
    };
  });

  ['puUnits', 'puNote'].forEach(id => {
    const input = $(id);
    if (input && addBtn) input.onkeydown = e => { if (e.key === 'Enter') addBtn.click(); };
  });

  el.querySelectorAll('.pu-del').forEach(btn => {
    btn.onclick = () => {
      if (!confirm('Delete this allocation? The units go back to the project.')) return;
      write('deleteUnitAllocation', { id: btn.dataset.id }, 'Allocation deleted', btn);
    };
  });
}

// ── Employee ──────────────────────────────────────────────────────

let UNITS_POLL = null;
let UNITS_OUTSIDE_CLICK = false;
const UNITS_POLL_MS = 2 * 60 * 1000;

async function checkUnitNotifications() {
  if (UNITS_POLL) clearInterval(UNITS_POLL);
  const session = APP_SESSION;
  const bell = $('unitsBell');
  if (bell) bell.onclick = e => { e.stopPropagation(); toggleUnitsBellPanel(); };
  if (!UNITS_OUTSIDE_CLICK) {
    UNITS_OUTSIDE_CLICK = true;
    document.addEventListener('click', e => {
      const panel = $('unitsBellPanel');
      if (panel && panel.style.display !== 'none' && !panel.contains(e.target)) panel.style.display = 'none';
    });
  }

  let known = null;
  const poll = async () => {
    if (session !== APP_SESSION || !USER) { clearInterval(UNITS_POLL); return; }
    try {
      const data = await apiGetUnitsData(USER.id);
      if (session !== APP_SESSION) return;
      UNITS_DATA = data;
      const unseen = data.allocations.filter(a => !a.seen);
      updateUnitsBell(unseen);
      const fresh = known ? unseen.filter(a => !known.has(a.id)) : unseen;
      if (fresh.length) {
        const total = fresh.reduce((s, a) => s + a.units, 0);
        toast('s', `🎯 You earned ${unitsFmt(total)} new unit${total === 1 ? '' : 's'}`,
          [...new Set(fresh.map(a => a.projectName))].join(' · ') + ' — click 🔔 for details', 9000);
      }
      known = new Set(unseen.map(a => a.id));
      if (fresh.length && $('myUnitsCard') && $('empTabProjects')?.style.display !== 'none') drawMyUnitsCard($('myUnitsCard'));
    } catch (error) {
      console.error('[UNITS] Notification check failed:', error.message);
    }
  };
  await poll();
  UNITS_POLL = setInterval(poll, UNITS_POLL_MS);
}

function updateUnitsBell(unseen) {
  const count = $('unitsBellCount');
  if (!count) return;
  const total = unseen.reduce((s, a) => s + a.units, 0);
  count.textContent = total > 99 ? '99+' : total;
  count.style.display = unseen.length ? '' : 'none';
}

function unitsItemLabel(a) {
  return a.imageNames && a.imageNames.length ? a.imageNames.join(', ') : (a.note || 'Work allocated');
}

function toggleUnitsBellPanel() {
  const panel = $('unitsBellPanel');
  if (!panel) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  const all = (UNITS_DATA ? UNITS_DATA.allocations : []).slice()
    .sort((a, b) => b.allocatedAt.localeCompare(a.allocatedAt) || b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const unseen = all.filter(a => !a.seen);
  const list = (unseen.length ? unseen : all.slice(0, 8));
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem .9rem;border-bottom:1px solid var(--border);">
      <span style="font-weight:700;font-size:13px;color:var(--txt);">🔔 Notifications</span>
      ${unseen.length ? `<button id="unitsMarkRead" class="btn bghost" style="padding:.3rem .6rem;font-size:11px;">Mark all read</button>` : ''}
    </div>
    <div style="max-height:360px;overflow-y:auto;">
      ${list.length ? list.map(a => `
        <div style="padding:.65rem .9rem;border-bottom:1px solid var(--border);${a.seen ? '' : 'background:rgba(52,211,153,.07);'}">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12.5px;">
            <span style="font-weight:700;color:var(--txt);">🎯 +${unitsFmt(a.units)} unit${a.units === 1 ? '' : 's'}</span>
            <span style="color:var(--muted);font-size:11px;white-space:nowrap;">${fmtDate(a.date)}</span>
          </div>
          <div style="font-size:12px;color:var(--txt2);margin-top:2px;">${esc(a.projectName)}</div>
          <div style="font-size:11.5px;color:var(--muted);margin-top:2px;">🖼 ${esc(unitsItemLabel(a))} · by ${esc(a.allocatedBy)}</div>
        </div>`).join('')
        : `<div style="padding:1.2rem;text-align:center;font-size:12px;color:var(--muted);">No notifications yet.</div>`}
    </div>
    ${!unseen.length && all.length ? `<div style="padding:.5rem .9rem;font-size:11px;color:var(--muted);">You're all caught up.</div>` : ''}`;
  panel.style.display = '';
  const btn = $('unitsMarkRead');
  if (btn) btn.onclick = async e => {
    e.stopPropagation();
    btn.disabled = true;
    try {
      await apiUnitsWrite('markUnitsSeen', { uid: USER.id });
      UNITS_DATA.allocations.forEach(a => { a.seen = true; });
      updateUnitsBell([]);
      panel.style.display = 'none';
      if ($('myUnitsCard')) drawMyUnitsCard($('myUnitsCard'));
    } catch (error) {
      toast('e', 'Could not update notifications', error.message);
      btn.disabled = false;
    }
  };
}

// ── Employee dashboard card ───────────────────────────────────────

async function renderMyUnitsCard() {
  const el = $('myUnitsCard');
  if (!el || !USER) return;
  const session = APP_SESSION;
  try {
    UNITS_DATA = await apiGetUnitsData(USER.id);
    if (session !== APP_SESSION) return;
  } catch (error) {
    if (session !== APP_SESSION) return;
    showLoadError(el, 'Could not load your units: ' + error.message, renderMyUnitsCard);
    return;
  }
  drawMyUnitsCard(el);
}

function drawMyUnitsCard(el) {
  const month = UNITS_MONTH;
  const all = UNITS_DATA.allocations;
  const mine = all.filter(a => a.month === month)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const earned = mine.reduce((s, a) => s + a.units, 0);
  const lifetime = all.reduce((s, a) => s + a.units, 0);

  const byProject = {};
  mine.forEach(a => { byProject[a.projectName] = (byProject[a.projectName] || 0) + a.units; });

  const images = mine.flatMap(a => a.imageNames && a.imageNames.length
    ? a.imageNames.map(name => ({ ...a, name, imgUnits: a.units / a.imageNames.length }))
    : [{ ...a, name: a.note || `${unitsFmt(a.units)} unit${a.units === 1 ? '' : 's'}`, imgUnits: a.units }]);

  el.innerHTML = `
    <div class="card" style="padding:1rem 1.1rem;overflow:visible;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:.9rem;">
        <div style="font-weight:700;font-size:14px;color:var(--txt)">🎯 My Units</div>
        <select id="myUnitsMonth" style="${UNITS_INPUT_STYLE}">${unitsMonthOptions(month)}</select>
      </div>
      <div class="strip" style="margin-bottom:1rem">
        <div class="sitem"><span class="slbl">This month</span><span class="sval hi">${unitsFmt(earned)}</span></div>
        <div class="sitem"><span class="slbl">Images</span><span class="sval">${images.length}</span></div>
        <div class="sitem"><span class="slbl">Projects</span><span class="sval">${Object.keys(byProject).length}</span></div>
        <div class="sitem"><span class="slbl">All time</span><span class="sval">${unitsFmt(lifetime)}</span></div>
      </div>
      ${Object.keys(byProject).length ? `
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([name, u]) => {
            const projImages = images.filter(a => a.projectName === name);
            const fresh = projImages.filter(a => !a.seen).length;
            return `
            <details class="my-units-proj" style="border:1px solid var(--border-md);border-radius:10px;overflow:hidden;">
              <summary style="display:flex;align-items:center;gap:10px;padding:.7rem .9rem;cursor:pointer;list-style:none;background:var(--surface2);">
                <span class="my-units-arrow" style="font-size:10px;color:var(--txt2);transition:transform .15s;">▶</span>
                <span style="flex:1;min-width:0;font-weight:700;font-size:13px;color:var(--txt);">📁 ${esc(name)}
                  ${fresh ? `<span class="saved-badge" style="margin-left:6px;">${fresh} new</span>` : ''}</span>
                <span style="font-size:12px;color:var(--txt2);white-space:nowrap;">${projImages.length} image${projImages.length === 1 ? '' : 's'}</span>
                <span style="font-size:13px;font-weight:700;color:var(--a1);white-space:nowrap;">${unitsFmt(u)} units</span>
              </summary>
              ${unitsTable(['Date', 'Image', 'Units', 'By'],
                projImages.map(a => `
                  <tr${a.seen ? '' : ' style="background:rgba(52,211,153,.08)"'}>
                    <td style="white-space:nowrap">${fmtDate(a.date)}${a.seen ? '' : ' <span class="saved-badge">New</span>'}</td>
                    <td>🖼 ${esc(a.name)}</td>
                    <td style="font-weight:700">${unitsFmt(a.imgUnits)}</td>
                    <td style="font-size:11px;color:var(--muted)">${esc(a.allocatedBy)}</td>
                  </tr>`), '')}
            </details>`;
          }).join('')}
        </div>` : `<div class="chart-empty" style="padding:1rem;font-size:12.5px;color:var(--muted)">No units this month yet.</div>`}
    </div>`;

  $('myUnitsMonth').onchange = e => { UNITS_MONTH = e.target.value; drawMyUnitsCard(el); };
  el.querySelectorAll('.my-units-proj').forEach(d => {
    d.ontoggle = () => { d.querySelector('.my-units-arrow').style.transform = d.open ? 'rotate(90deg)' : ''; };
  });
}
