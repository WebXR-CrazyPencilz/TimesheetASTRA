const TIMESHEET_SPREADSHEET_ID  = '1kFGs8kwZp_Wcsk0mWm8xw1ZohTd9WfZRtcncb-lKiuI';
const MANAGEMENT_SPREADSHEET_ID = '1rjYDUXgUKXj1r-pbgmEYpEeG6D0Wjpg7eHcdQQ3wQ-w';

const SHEET_ID = TIMESHEET_SPREADSHEET_ID;

const MANAGEMENT_SHEET_NAMES = ['Employees', 'Clients', 'Projects', 'Teams', 'HistoricalTimesheet', 'SalaryPivotView'];

let _ssMemo   = null;
let _mgmtSsMemo = null;
const _sheetMemo = {};

function getSpreadsheet() {
  if (_ssMemo) return _ssMemo;
  try {
    _ssMemo = SpreadsheetApp.openById(TIMESHEET_SPREADSHEET_ID);
    return _ssMemo;
  } catch (ex) {
    throw new Error(
      'Cannot open the Timesheet spreadsheet (ID: ' + TIMESHEET_SPREADSHEET_ID + '). ' +
      'This means either the ID is wrong, the sheet was deleted/moved, ' +
      'or this Apps Script project\'s account no longer has access to it. ' +
      'Run the "runBackendDiagnostics" function from the Apps Script editor, ' +
      'or call action=diagnostics, for a full check. Original error: ' + ex.message
    );
  }
}

function getManagementSpreadsheet() {
  if (_mgmtSsMemo) return _mgmtSsMemo;
  try {
    _mgmtSsMemo = SpreadsheetApp.openById(MANAGEMENT_SPREADSHEET_ID);
    return _mgmtSsMemo;
  } catch (ex) {
    throw new Error(
      'Cannot open the Management spreadsheet (ID: ' + MANAGEMENT_SPREADSHEET_ID + '). ' +
      'Set MANAGEMENT_SPREADSHEET_ID at the top of Code.gs to the new spreadsheet\'s ID, ' +
      'and make sure this Apps Script project\'s account has access to it. Original error: ' + ex.message
    );
  }
}

const SLOTS = {
  morning:   { label: 'Morning',   defaultIn: '09:30', defaultOut: '13:00' },
  afternoon: { label: 'Afternoon', defaultIn: '13:45', defaultOut: '19:30' },
  extended:  { label: 'Extended',  defaultIn: '19:30', defaultOut: '22:00' },
};

const EMP_HEADERS = [
  'Date', 'Day', 'Slot', 'Entry#', 'Time In', 'Time Out',
  'Hours', 'Client ID', 'Client', 'Project ID', 'Project',
  'Task', 'Notes', 'Status', 'Saved At'
];

const FINANCE_HEADERS  = ['Client ID','Client Name','Estimate Cost','Received Amount','Start Date','End Date','Notes'];
const PROJ_DET_HEADERS = ['Project ID','Client ID','Project Name','Estimate Hours','Estimate Cost','Resources','Notes'];
const SALARY_HEADERS   = ['Employee ID','Employee Name','Type','Amount','Effective Date'];

function doGet(e) {
  try {
    const action = e.parameter.action;
    const p      = e.parameter;
    switch (action) {
      case 'login':              return ok(handleLogin(p.uid, p.pw));
      case 'getMasterData':      return ok(getMasterData());

      case 'getDaySlots':        return ok(getDaySlots(p.uid, p.date));
      case 'saveSlot':           return ok(saveSlot(JSON.parse(decodeURIComponent(p.data))));
      case 'saveBiometricPunch': return ok(saveBiometricPunch(JSON.parse(decodeURIComponent(p.data))));
      case 'saveAndHistory':     return ok(saveAndHistory(JSON.parse(decodeURIComponent(p.data))));
      case 'getHistory':         return ok(getHistory(p.uid));
      case 'getEntries':         return ok(getHistory(p.uid));
      case 'getAllHistory':       return ok(getAllHistory(p.uid));

      case 'getEmployeeDetail':  return ok(getEmployeeDetail(p.uid, p.from, p.to));

      case 'createEmployee':     return ok(createEmployee(JSON.parse(decodeURIComponent(p.data))));
      case 'updateEmployeeRecord': return ok(updateEmployeeRecord(JSON.parse(decodeURIComponent(p.data))));
      case 'changeOwnPassword':    return ok(changeOwnPassword(JSON.parse(decodeURIComponent(p.data))));

      case 'getFinanceData':     return ok(getFinanceData());
      case 'saveClientFinance':  return ok(saveClientFinance(JSON.parse(decodeURIComponent(p.data))));
      case 'saveProjectDetails': return ok(saveProjectDetails(JSON.parse(decodeURIComponent(p.data))));
      case 'saveSalary':         return ok(saveSalary(JSON.parse(decodeURIComponent(p.data))));

      case 'getSalaryHistory':   return ok(getSalaryHistory());
      case 'saveSalaryMonth':    return ok(saveSalaryMonth(JSON.parse(decodeURIComponent(p.data))));
      case 'rebuildSalaryPivot': { ensureSalaryPivotStructure(); return ok({ ensured: true, sheetName: SALARY_PIVOT_SHEET_NAME }); }

      case 'getClientMasterList':  return ok(getClientMasterList());
      case 'getNextClientId':      return ok(getNextClientId());
      case 'createClientMaster':   return ok(createClientMaster(JSON.parse(decodeURIComponent(p.data))));
      case 'updateClientMaster':   return ok(updateClientMaster(JSON.parse(decodeURIComponent(p.data))));
      case 'deleteClientMaster':   return ok(deleteClientMaster(JSON.parse(decodeURIComponent(p.data))));

      case 'getProjectMasterList': return ok(getProjectMasterList(p.role));
      case 'getProjectMasterOne':  return ok(getProjectMasterOne(p.projectId, p.role));
      case 'getNextProjectId':     return ok(getNextProjectId());
      case 'saveProjectMaster':    return ok(saveProjectMaster(JSON.parse(decodeURIComponent(p.data))));
      case 'deleteProjectMaster':  return ok(deleteProjectMaster(JSON.parse(decodeURIComponent(p.data))));

      case 'forceLeave':         return ok(forceLeave(JSON.parse(decodeURIComponent(p.data))));

      case 'getHistoricalSheetData':      return ok(getHistoricalSheetData(p.clientId, p.projectId));
      case 'saveHistoricalMonth':         return ok(saveHistoricalMonth(JSON.parse(decodeURIComponent(p.data))));
      case 'saveHistoricalDraft':         return ok(saveHistoricalDraft(JSON.parse(decodeURIComponent(p.data))));
      case 'finalizeHistoricalProject':   return ok(finalizeHistoricalProject(JSON.parse(decodeURIComponent(p.data))));
      case 'reopenHistoricalProject':     return ok(reopenHistoricalProject(JSON.parse(decodeURIComponent(p.data))));
      case 'deleteHistoricalMonthRecord': return ok(deleteHistoricalMonthRecord(JSON.parse(decodeURIComponent(p.data))));
      case 'getHistoricalRecords':        return ok(getHistoricalRecords(p.filters ? JSON.parse(decodeURIComponent(p.filters)) : {}));
      case 'getHistoricalProjectsSummary':return ok(getHistoricalProjectsSummary());

      case 'getTLData':          return ok(getTLData());
      case 'getProjectTabData':  return ok(getProjectTabData(p.role));
      case 'getEmployeeDashboard': return ok(getEmployeeDashboard(p.uid));

      case 'getUnitsData':         return ok(getUnitsData(p.uid));
      case 'setProjectUnits':      return ok(setProjectUnits(JSON.parse(decodeURIComponent(p.data))));
      case 'allocateUnits':        return ok(allocateUnits(JSON.parse(decodeURIComponent(p.data))));
      case 'updateUnitAllocation': return ok(updateUnitAllocation(JSON.parse(decodeURIComponent(p.data))));
      case 'deleteUnitAllocation': return ok(deleteUnitAllocation(JSON.parse(decodeURIComponent(p.data))));
      case 'setPositionTarget':    return ok(setPositionTarget(JSON.parse(decodeURIComponent(p.data))));
      case 'setEmployeePosition':  return ok(setEmployeePosition(JSON.parse(decodeURIComponent(p.data))));
      case 'markUnitsSeen':        return ok(markUnitsSeen(JSON.parse(decodeURIComponent(p.data))));

      case 'diagnostics':        return ok(runBackendDiagnostics());

      default: return err('Unknown action: ' + action);
    }
  } catch (ex) {
    const action = e && e.parameter ? e.parameter.action : 'unknown';
    return err('[' + action + '] ' + ex.message);
  }
}
function doPost(e) { return doGet(e); }

function handleLogin(employeeId, password) {
  if (!employeeId || !password) throw new Error('Missing credentials.');
  const employees = readEmployeesRaw_();
  const match = employees.find(e => e.active && e.id === employeeId && e.pw !== null && e.pw === password);
  if (!match) throw new Error('Wrong employee ID or password.');
  ensureEmployeeSheet(match.name);
  return { id: match.id, name: match.name, team: match.team, extendedDaysBack: match.extendedDaysBack };
}

function readEmployeesRaw_() {
  const rows = mgmtSheet('Employees').getDataRange().getValues();
  const list = [];
  const seenSynthetic = {};

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawId     = String(r[0] || '').trim();
    const name      = String(r[1] || '').trim();
    const team      = String(r[2] || '').trim();
    const rawPw     = String(r[3] || '').trim();
    const statusRaw = String(r[4] || '').trim();
    const extendedDaysBack = parseInt(String(r[5] || '').trim(), 10) || 0;

    if (!rawId && !name) continue;
    if (rawId.toUpperCase() === 'EMPLOYEE ID') continue;

    const isInactive = statusRaw
      ? /^in-?active$/i.test(statusRaw)
      : (!rawId && !!name);

    let id = rawId;
    let pw = rawPw || null;

    if (isInactive) {
      const base = 'INACTIVE-' + (name.replace(/\s+/g, '_') || 'UNKNOWN');
      let candidate = base, n = 2;
      while (seenSynthetic[candidate]) { candidate = base + '_' + n; n++; }
      seenSynthetic[candidate] = true;
      id = candidate;
      pw = null;
    }

    if (!id) continue;

    list.push({ id, name, team, pw, active: !isInactive, extendedDaysBack });
  }
  return list;
}

const EMP_CACHE_KEY     = 'tt_emp_id_name_map_v1';
const EMP_CACHE_TTL_SEC = 300;

function getEmpNameMap() {
  const cache  = CacheService.getScriptCache();
  const cached = cache.get(EMP_CACHE_KEY);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {  }
  }
  const map = {};
  readEmployeesRaw_().forEach(e => { map[e.id] = e.name; });
  cache.put(EMP_CACHE_KEY, JSON.stringify(map), EMP_CACHE_TTL_SEC);
  return map;
}

function getEmpName(uid) {
  const map  = getEmpNameMap();
  const name = map[uid];
  if (!name) throw new Error('Employee not found: ' + uid);
  return name;
}

function createEmployee(data) {
  const id   = String(data.id || '').trim();
  const name = String(data.name || '').trim();
  const team = String(data.team || '').trim();
  const pw   = String(data.pw || '').trim();

  if (!id || !name || !team || !pw) {
    throw new Error('id, name, team, and pw are all required.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const existing = readEmployeesRaw_();
    if (existing.some(e => e.id === id)) {
      throw new Error('Employee ID "' + id + '" already exists.');
    }

    const sh = mgmtSheet('Employees');
    sh.appendRow([id, name, team, pw, 'Active']);

    CacheService.getScriptCache().remove(EMP_CACHE_KEY);

    return { created: true, id, name, team };
  } finally {
    lock.releaseLock();
  }
}

function updateEmployeeRecord(data) {
  if (data.role !== 'hr') throw new Error('Only HR can modify employee records.');

  const originalName = String(data.originalName || '').trim();
  if (!originalName) throw new Error('originalName is required.');

  const newName   = String(data.name || originalName).trim();
  const team      = String(data.team || '').trim();
  const wantActive = data.status === 'Active';
  const newId     = String(data.newId || '').trim();
  const newPw     = String(data.newPw || '').trim();
  const extendedDaysBackRaw = data.extendedDaysBack;
  const extendedDaysBack = extendedDaysBackRaw === undefined || extendedDaysBackRaw === ''
    ? null
    : (parseInt(extendedDaysBackRaw, 10) || 0);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = mgmtSheet('Employees');
    const lastRow = sh.getLastRow();
    if (lastRow < 2) throw new Error('Employee not found: ' + originalName);

    const rows = sh.getRange(2, 1, lastRow - 1, 6).getValues();
    let targetRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][1] || '').trim() === originalName) { targetRow = i + 2; break; }
    }
    if (targetRow === -1) throw new Error('Employee not found: ' + originalName);

    const currentRow = sh.getRange(targetRow, 1, 1, 6).getValues()[0];
    const currentId  = String(currentRow[0] || '').trim();
    const currentPw  = String(currentRow[3] || '').trim();
    const currentExtendedDaysBack = currentRow[5];

    let finalId = currentId, finalPw = currentPw;

    if (wantActive) {
      if (newId && newId !== currentId) finalId = newId;
      if (newPw) finalPw = newPw;

      if (!finalId || !finalPw) {
        throw new Error('This employee has no Employee ID/Password on file — provide both to reactivate them.');
      }

      if (finalId !== currentId) {
        const dupe = rows.some((r, i) => i + 2 !== targetRow && String(r[0] || '').trim() === finalId);
        if (dupe) throw new Error('Employee ID "' + finalId + '" already exists.');
      }
    } else {
      finalId = '';
      finalPw = '';
    }

    sh.getRange(targetRow, 1, 1, 6).setValues([[
      finalId, newName, team, finalPw, wantActive ? 'Active' : 'In-Active',
      extendedDaysBack === null ? currentExtendedDaysBack : extendedDaysBack,
    ]]);

    CacheService.getScriptCache().remove(EMP_CACHE_KEY);

    return { updated: true, name: newName, status: wantActive ? 'Active' : 'In-Active' };
  } finally {
    lock.releaseLock();
  }
}

function changeOwnPassword(data) {
  const uid       = String(data.uid || '').trim();
  const currentPw = String(data.currentPw || '');
  const newPw     = String(data.newPw || '').trim();

  if (!uid || !currentPw || !newPw) throw new Error('uid, currentPw, and newPw are all required.');
  if (newPw.length < 4) throw new Error('New password must be at least 4 characters.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = mgmtSheet('Employees');
    const lastRow = sh.getLastRow();
    if (lastRow < 2) throw new Error('Employee not found.');

    const rows = sh.getRange(2, 1, lastRow - 1, 5).getValues();
    let targetRow = -1;
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === uid) { targetRow = i + 2; break; }
    }
    if (targetRow === -1) throw new Error('Employee not found.');

    const row = rows[targetRow - 2];
    const statusRaw = String(row[4] || '').trim();
    if (/^in-?active$/i.test(statusRaw)) throw new Error('This account is inactive — contact HR.');

    const currentPwOnFile = String(row[3] || '').trim();
    if (!currentPwOnFile || currentPwOnFile !== currentPw) {
      throw new Error('Current password is incorrect.');
    }

    sh.getRange(targetRow, 4).setValue(newPw);
    return { changed: true };
  } finally {
    lock.releaseLock();
  }
}

function getMasterData() {
  const cliSheet = mgmtSheet('Clients');
  const prjSheet = mgmtSheet('Projects');

  let cliRows = [], cliColors = [];
  if (cliSheet.getLastRow() > 1) {
    const cliRange = cliSheet.getRange(2, 1, cliSheet.getLastRow() - 1, 2);
    cliRows   = cliRange.getValues();
    cliColors = cliRange.getBackgrounds();
  }

  let prjRows = [], prjColors = [];
  if (prjSheet.getLastRow() > 0) {
    const prjRange = prjSheet.getRange(1, 1, prjSheet.getLastRow(), 3);
    prjRows   = prjRange.getValues();
    prjColors = prjRange.getBackgrounds();
  }

  return {
    employees: readEmployeesRaw_().map(e => ({ id: e.id, name: e.name, team: e.team, active: e.active, extendedDaysBack: e.extendedDaysBack })),

    clients: cliRows
      .map((r, i) => ({ row: r, color: cliColors[i] }))
      .filter(({ row, color }) => row[1] && String(row[1]).trim() !== 'Client ID' && isGreenRow(color))
      .map(({ row }) => ({ id: String(row[1]).trim(), name: String(row[0]).trim() })),

    projects: prjRows
      .map((r, i) => ({ row: r, color: prjColors[i] }))
      .filter(({ row, color }) => row[1] && String(row[1]).trim() !== 'Project ID' && isGreenRow(color))
      .map(({ row }) => ({
        cid:  row[0] ? String(row[0]).trim() : '',
        id:   String(row[1]).trim(),
        name: String(row[2] || '').trim(),
      })),
  };
}

const GREEN_HEX_PATTERNS = [
  '#b7e1cd','#93c47d','#6aa84f','#38761d','#274e13',
  '#00ff00','#34a853','#a6d4a4','#d9ead3','#a4c2a4','#b6d7a8',
];

function isGreenRow(colorRow) {
  if (!colorRow) return false;
  return colorRow.some(hex => isGreenHex(hex));
}

function isGreenHex(hex) {
  if (!hex || hex === '#ffffff' || hex === '#null') return false;
  const lower = String(hex).toLowerCase();
  if (GREEN_HEX_PATTERNS.includes(lower)) return true;
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(lower);
  if (!m) return false;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return g > 100 && g > r + 15 && g > b + 15;
}

function getEmployeeDetail(uid, fromDate, toDate) {
  if (!uid) throw new Error('uid is required.');

  const empName  = getEmpName(uid);
  const sh       = getEmployeeSheetForRead(empName);
  const lastRow  = sh.getLastRow();
  const startRow = getDataStartRow(sh);

  if (lastRow < startRow) {
    return { entries: [], summary: emptySummary(empName, uid) };
  }

  const data = sh.getRange(startRow, 1, lastRow - startRow + 1, EMP_HEADERS.length).getValues();
  const allParsedEntries = data.map(r => rowToEntry(r)).filter(e => e.date);
  let entries = allParsedEntries;

  if (fromDate) entries = entries.filter(e => e.date >= fromDate);
  if (toDate)   entries = entries.filter(e => e.date <= toDate);

  entries.sort((a, b) => b.date.localeCompare(a.date) || slotOrder(a.slot) - slotOrder(b.slot));

  const worked  = entries.filter(e => e.status !== 'Leave');
  const leaves  = entries.filter(e => e.status === 'Leave');
  const totalH  = worked.reduce((s, e) => s + parseHours(e.hours), 0);

  const projMap = {};
  worked.forEach(e => {
    const k = e.project || 'Unassigned';
    if (!projMap[k]) projMap[k] = { name: k, hours: 0, entries: 0 };
    projMap[k].hours   += parseHours(e.hours);
    projMap[k].entries += 1;
  });

  const cliMap = {};
  worked.forEach(e => {
    const k = e.client || 'Unknown';
    if (!cliMap[k]) cliMap[k] = { name: k, hours: 0 };
    cliMap[k].hours += parseHours(e.hours);
  });

  const dayMap = {};
  entries.forEach(e => {
    if (!dayMap[e.date]) dayMap[e.date] = { date: e.date, day: e.day, hours: 0, isLeave: false };
    if (e.status === 'Leave') { dayMap[e.date].isLeave = true; }
    else { dayMap[e.date].hours += parseHours(e.hours); }
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
    hoursStr: fmtHours(d.hours),
  }));

  const uniqueDays   = new Set(worked.map(e => e.date)).size;

  const nowMonth   = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM');
  const monthWorked = allParsedEntries
    .filter(e => e.date && e.date.startsWith(nowMonth) && e.status !== 'Leave');
  const monthH    = monthWorked.reduce((s, e) => s + parseHours(e.hours), 0);
  const monthDays = new Set(monthWorked.map(e => e.date)).size;

  const leaveDatesSet = [...new Set(leaves.map(e => e.date))].sort().reverse();
  const leaveDates = leaveDatesSet.map(d => {
    const dt = new Date(d + 'T00:00:00');
    return {
      date: d,
      display: dt.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' }),
    };
  });

  return {
    emp: { id: uid, name: empName },
    entries,
    summary: {
      totalHours:    fmtHours(totalH),
      totalHoursRaw: totalH,
      totalDays:     uniqueDays,
      totalLeaves:   leaveDatesSet.length,
      leaveDates,
      totalEntries:  worked.length,
      monthHours:    fmtHours(monthH),
      monthDays,
      projects:      Object.values(projMap).sort((a,b) => b.hours - a.hours)
                       .map(p => ({ ...p, hoursStr: fmtHours(p.hours) })),
      clients:       Object.values(cliMap).sort((a,b) => b.hours - a.hours)
                       .map(c => ({ ...c, hoursStr: fmtHours(c.hours) })),
      days,
    },
  };
}

function emptySummary(name, uid) {
  return {
    emp: { id: uid, name },
    totalHours: '0h', totalHoursRaw: 0, totalDays: 0,
    totalLeaves: 0, totalEntries: 0, avgHoursPerDay: '0h',
    projects: [], clients: [], days: [],
  };
}

function ensureEmployeeSheet(empName) {
  const ss = getSpreadsheet();
  let sh   = ss.getSheetByName(empName);
  if (!sh) {
    sh = ss.insertSheet(empName);
    const hRange = sh.getRange(1, 1, 1, EMP_HEADERS.length);
    hRange.setValues([EMP_HEADERS]);
    hRange.setFontWeight('bold');
    hRange.setBackground('#1a1e28');
    hRange.setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 90);  sh.setColumnWidth(2, 80);
    sh.setColumnWidth(3, 90);  sh.setColumnWidth(4, 55);
    sh.setColumnWidth(5, 80);  sh.setColumnWidth(6, 80);
    sh.setColumnWidth(7, 60);  sh.setColumnWidth(9, 130);
    sh.setColumnWidth(11, 160); sh.setColumnWidth(12, 100);
    sh.setColumnWidth(13, 200); sh.setColumnWidth(14, 80);
    const formats = [];
    for (let i = 0; i < 1000; i++) formats.push(['0', '@', '@', '@']);
    sh.getRange(2, 4, 1000, 4).setNumberFormats(formats);
  }
  return sh;
}

function getEmployeeSheetForRead(empName) {
  const ss = getSpreadsheet();
  const sh = ss.getSheetByName(empName);
  return sh || ensureEmployeeSheet(empName);
}

function readDaySlotsRaw_(empName, date) {
  const sh       = ensureEmployeeSheet(empName);
  const lastRow  = sh.getLastRow();
  const startRow = getDataStartRow(sh);
  const seen     = {};
  const dupRows  = [];

  if (lastRow >= startRow) {
    const numRows = lastRow - startRow + 1;
    const data    = sh.getRange(startRow, 1, numRows, EMP_HEADERS.length).getValues();
    data.forEach((r, i) => {
      const rowDate = safeStr(r[0]);
      if (rowDate !== date) return;
      const slot     = safeStr(r[2]);
      const entryNum = safeInt(r[3]);
      const key      = slot + '-' + entryNum;
      if (seen[key]) dupRows.push(i + startRow);
      else            seen[key] = rowToEntry(r);
    });
  }

  const entries = Object.values(seen);
  entries.sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot) || a.entryNum - b.entryNum);
  return { entries, dupRows, sh };
}

function getDaySlots(uid, date) {
  if (!uid || !date) throw new Error('uid and date are required.');
  const empName = getEmpName(uid);

  let result = readDaySlotsRaw_(empName, date);
  if (result.dupRows.length === 0) {
    return { date, slots: SLOTS, entries: result.entries };
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { date, slots: SLOTS, entries: result.entries };
  }
  try {
    result = readDaySlotsRaw_(empName, date);
    result.dupRows.sort((a, b) => b - a).forEach(rowIdx => result.sh.deleteRow(rowIdx));
  } finally {
    lock.releaseLock();
  }

  return { date, slots: SLOTS, entries: result.entries };
}

function saveBiometricPunch(data) {
  if (data.role !== 'hr') throw new Error('Only HR can record biometric punch data.');

  const uid    = data.uid;
  const date   = data.date;
  const bioIn  = String(data.bioIn  || '').trim();
  const bioOut = String(data.bioOut || '').trim();
  if (!uid || !date) throw new Error('uid and date are required.');
  if (!bioIn && !bioOut) throw new Error('At least one of biometric in/out time is required.');

  const empName = getEmpName(uid);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh       = ensureEmployeeSheet(empName);
    const lastRow  = sh.getLastRow();
    const startRow = getDataStartRow(sh);

    let targetRow = -1;
    let insertBefore = -1;
    if (lastRow >= startRow) {
      const vals = sh.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();
      for (let i = 0; i < vals.length; i++) {
        const rowDate = safeStr(vals[i][0]);
        if (rowDate === date && safeStr(vals[i][13]) === 'BiometricPunch') { targetRow = i + startRow; break; }
        if (insertBefore === -1 && rowDate > date) insertBefore = i + startRow;
      }
    }

    const day = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' });
    const savedAtVal = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');
    const enteredBy  = safeStr(data.enteredByName) || 'HR';
    const newRow = [
      date, day, 'biometric', 1, bioIn, bioOut, '0h',
      '', '', '', '', 'Biometric Punch', `Recorded by ${enteredBy}`, 'BiometricPunch', savedAtVal
    ];

    if (targetRow !== -1) {
      sh.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      return { saved: true, action: 'updated' };
    }

    if (insertBefore > 0) {
      sh.insertRowBefore(insertBefore);
      sh.getRange(insertBefore, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sh.appendRow(newRow);
    }
    return { saved: true, action: 'inserted' };
  } finally {
    lock.releaseLock();
  }
}

function saveSlot(data) {
  const {
    uid, date, day, slot,
    timeIn, timeOut, hours,
    clientId, client, projectId, project,
    task, notes, status, savedAt
  } = data;

  const entryNum = parseInt(data.entryNum, 10);
  if (!uid || !date || !slot) throw new Error('uid, date, slot are required.');
  if (isNaN(entryNum) || entryNum < 1) throw new Error('Invalid entryNum: ' + data.entryNum);

  const empName = getEmpName(uid);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try saving again in a moment.');
  }

  try {
    const sh       = ensureEmployeeSheet(empName);
    const lastRow  = sh.getLastRow();
    const startRow = getDataStartRow(sh);

    if (status !== 'Holiday' && lastRow >= startRow) {
      const statusScan = sh.getRange(startRow, 1, lastRow - startRow + 1, 14).getValues();
      const isHolidayLocked = statusScan.some(r => safeStr(r[0]) === date && safeStr(r[13]) === 'Holiday');
      if (isHolidayLocked) {
        throw new Error('This date is a Public Holiday — no entries can be logged.');
      }
    }

    let slotCount    = 0;
    let targetRow    = -1;
    let insertBefore = -1;

    if (lastRow >= startRow) {
      const vals = sh.getRange(startRow, 1, lastRow - startRow + 1, 4).getValues();
      for (let i = 0; i < vals.length; i++) {
        const rowDate     = safeStr(vals[i][0]);
        const rowSlot     = safeStr(vals[i][2]);
        const rowEntryNum = safeInt(vals[i][3]);

        if (rowDate === date && rowSlot === slot) {
          if (rowEntryNum === entryNum) targetRow = i + startRow;
          else                          slotCount++;
        }

        if (insertBefore === -1) {
          if (rowDate > date) insertBefore = i + startRow;
          else if (rowDate === date && slotOrder(rowSlot) > slotOrder(slot)) insertBefore = i + startRow;
          else if (rowDate === date && rowSlot === slot && rowEntryNum > entryNum) insertBefore = i + startRow;
        }
      }
    }

    if (slotCount >= 4) throw new Error('Maximum 4 entries allowed per slot (' + slot + ').');

    const savedAtVal = savedAt || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');
    const newRow = [
      date, day, slot, entryNum, timeIn, timeOut,
      fmtHours(parseFloat(hours) || 0),
      clientId||'', client||'', projectId||'', project||'',
      task||'', notes||'', status||'Worked', savedAtVal
    ];

    if (targetRow !== -1) {
      sh.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
      colorRow(sh, targetRow, status);
      return { saved: true, action: 'updated', row: targetRow };
    }

    let finalRow;
    if (insertBefore > 0) {
      sh.insertRowBefore(insertBefore);
      finalRow = insertBefore;
      sh.getRange(finalRow, 1, 1, newRow.length).setValues([newRow]);
      sh.getRange(finalRow, 4, 1, 4).setNumberFormats([['0', '@', '@', '@']]);
    } else {
      sh.appendRow(newRow);
      finalRow = sh.getLastRow();
      sh.getRange(finalRow, 4, 1, 4).setNumberFormats([['0', '@', '@', '@']]);
    }

    colorRow(sh, finalRow, status);
    return { saved: true, action: 'inserted', row: finalRow };
  } finally {
    lock.releaseLock();
  }
}

function saveAndHistory(data) {
  const saveResult = saveSlot(data);
  const history    = getHistory(data.uid);
  return { saved: saveResult.saved, action: saveResult.action, row: saveResult.row, history };
}

function getHistory(uid) {
  const entries = getAllHistory(uid);
  const dates = new Set([...new Set(entries.map(e => e.date))].slice(0,10));
  return entries.filter(e => dates.has(e.date));
}

function getAllHistory(uid) {
  if (!uid) throw new Error('uid is required.');
  return readEmployeeHistory_(getEmpName(uid));
}

function getFinanceData() {
  return {
    clientFinance:  getSheetData('ClientFinance',  FINANCE_HEADERS),
    projectDetails: getSheetData('ProjectDetails', PROJ_DET_HEADERS),
    salaries:       getSheetData('Salaries',       SALARY_HEADERS),
    masterData:     getMasterData(),
  };
}

function saveClientFinance(data) {
  const sh = ensureSheet('ClientFinance', FINANCE_HEADERS);
  const { clientId, clientName, estimateCost, receivedAmount, startDate, endDate, notes } = data;
  if (!clientId) throw new Error('clientId is required.');
  const rows   = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,FINANCE_HEADERS.length).getValues() : [];
  const newRow = [clientId, clientName||'', estimateCost||0, receivedAmount||0, startDate||'', endDate||'', notes||''];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === clientId) {
      sh.getRange(i+2,1,1,newRow.length).setValues([newRow]);
      colorFinanceRow(sh, i+2, estimateCost, receivedAmount);
      return { saved: true, action: 'updated' };
    }
  }
  sh.appendRow(newRow);
  colorFinanceRow(sh, sh.getLastRow(), estimateCost, receivedAmount);
  return { saved: true, action: 'inserted' };
}

function saveProjectDetails(data) {
  const sh = ensureSheet('ProjectDetails', PROJ_DET_HEADERS);
  const { projectId, clientId, projectName, estimateHours, estimateCost, resources, notes } = data;
  if (!projectId) throw new Error('projectId is required.');
  const rows   = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,PROJ_DET_HEADERS.length).getValues() : [];
  const newRow = [projectId, clientId||'', projectName||'', estimateHours||0, estimateCost||0, resources||'', notes||''];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === projectId) {
      sh.getRange(i+2,1,1,newRow.length).setValues([newRow]);
      return { saved: true, action: 'updated' };
    }
  }
  sh.appendRow(newRow);
  return { saved: true, action: 'inserted' };
}

function saveSalary(data) {
  const sh = ensureSheet('Salaries', SALARY_HEADERS);
  const { empId, empName, type, amount, effectiveDate } = data;
  if (!empId) throw new Error('empId is required.');
  if (!['fixed','hourly'].includes(type)) throw new Error('type must be fixed or hourly.');
  const rows   = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,SALARY_HEADERS.length).getValues() : [];
  const date   = effectiveDate || Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd');
  const newRow = [empId, empName||'', type, amount||0, date];
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === empId) {
      sh.getRange(i+2,1,1,newRow.length).setValues([newRow]);
      return { saved: true, action: 'updated' };
    }
  }
  sh.appendRow(newRow);
  return { saved: true, action: 'inserted' };
}

const SALARY_PIVOT_SHEET_NAME = 'SalaryPivotView';
const SALARY_HISTORY_HEADERS  = ['empId','empName','month','lpa','monthly','hourly','points','workHours','updatedAt','explicit'];

function ensureSalaryPivotStructure() {
  const ss = getManagementSpreadsheet();
  let sh = ss.getSheetByName(SALARY_PIVOT_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SALARY_PIVOT_SHEET_NAME);
    sh.getRange(1, 1, 1, SALARY_HISTORY_HEADERS.length).setValues([SALARY_HISTORY_HEADERS]);
    sh.getRange(1, 1, 1, SALARY_HISTORY_HEADERS.length)
      .setFontWeight('bold').setBackground('#1a1e28').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    Logger.log('Created new ' + SALARY_PIVOT_SHEET_NAME + ' in the Management spreadsheet.');
  }
  return sh;
}

function getSalaryHistory() {
  const sh = ensureSalaryPivotStructure();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const data = sh.getRange(2, 1, lastRow - 1, SALARY_HISTORY_HEADERS.length).getValues();
  return data
    .filter(row => row[0] && row[2])
    .map(row => ({
      empId:     safeStr(row[0]),
      empName:   safeStr(row[1]),
      month:     safeStr(row[2]),
      lpa:       parseFloat(row[3]) || 0,
      monthly:   parseFloat(row[4]) || 0,
      hourly:    parseFloat(row[5]) || 0,
      points:    parseFloat(row[6]) || 0,
      workHours: parseFloat(row[7]) || 0,
      updatedAt: safeStr(row[8]),
      explicit:  !!row[9],
    }));
}

function saveSalaryMonth(data) {
  const { empId, empName, month, lpa, monthly, hourly, points, workHours } = data;
  if (!empId) throw new Error('empId is required.');
  if (!month) throw new Error('month is required (format: YYYY-MM).');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must be in YYYY-MM format.');

  const sh = ensureSalaryPivotStructure();
  const lastRow = sh.getLastRow();
  let targetRow = -1;

  if (lastRow >= 2) {
    const existing = sh.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (safeStr(existing[i][0]) === empId && safeStr(existing[i][2]) === month) {
        targetRow = i + 2;
        break;
      }
    }
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');
  const rowData = [
    empId, empName || '', month,
    parseFloat(lpa) || 0,
    parseFloat(monthly) || 0,
    parseFloat(hourly) || 0,
    parseFloat(points) || 0,
    parseFloat(workHours) || 0,
    now,
    true,
  ];

  if (targetRow !== -1) {
    sh.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { saved: true, action: 'updated', empId, month };
  }

  sh.appendRow(rowData);
  return { saved: true, action: 'inserted', empId, month };
}

const CLIENT_ID_PREFIX = 'CL-';
const CLIENT_ID_DIGITS = 3;
const CLIENT_GREEN_HEX = '#d9ead3';

function getClientMasterList() {
  const sh = mgmtSheet('Clients');
  if (sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  return rows
    .filter(r => r[1] && String(r[1]).trim() !== 'Client ID')
    .map(r => ({ name: safeStr(r[0]), id: safeStr(r[1]) }));
}

function getNextClientId() {
  const clients = getClientMasterList();
  let maxNum = 0;
  clients.forEach(c => {
    const m = /^CL-(\d+)$/i.exec(c.id);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  });
  return CLIENT_ID_PREFIX + String(maxNum + 1).padStart(CLIENT_ID_DIGITS, '0');
}

function createClientMaster(data) {
  const role = data.role;
  if (role !== 'manager' && role !== 'tl') throw new Error('Only the Manager or Team Leader can create clients.');

  const name = (data.name || '').trim();
  if (!name) throw new Error('Client name is required.');

  const sh = mgmtSheet('Clients');
  const id = getNextClientId();
  sh.appendRow([name, id]);
  const lastRow = sh.getLastRow();
  sh.getRange(lastRow, 1, 1, 2).setBackground(CLIENT_GREEN_HEX);
  return { created: true, id, name };
}

function updateClientMaster(data) {
  if (data.role !== 'manager') throw new Error('Only the Manager can rename clients.');

  const { id, name } = data;
  if (!id) throw new Error('id is required.');
  if (!name || !name.trim()) throw new Error('name is required.');

  const sh = mgmtSheet('Clients');
  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('Client not found: ' + id);
  const rows = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (safeStr(rows[i][1]) === id) {
      sh.getRange(i + 2, 1).setValue(name.trim());
      return { updated: true, id, name: name.trim() };
    }
  }
  throw new Error('Client not found: ' + id);
}

function deleteClientMaster(data) {
  const { role, id } = data;
  if (role !== 'manager') throw new Error('Only the Manager can delete clients.');
  if (!id) throw new Error('id is required.');

  const sh = mgmtSheet('Clients');
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { deleted: false, message: 'No clients to delete.' };
  const rows = sh.getRange(2, 1, lastRow - 1, 2).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (safeStr(rows[i][1]) === id) {
      sh.deleteRow(i + 2);
      return { deleted: true, id };
    }
  }
  return { deleted: false, message: 'Client not found: ' + id };
}

const PROJECT_SHEET_TOTAL_COLS = 15;
const PROJECT_EXTENDED_HEADERS = ['Project Constant','Project Value','Views Planned','Views Completed','Views Delivered','Status','Created Date','Updated Date','Manager Notes','Team Leader Notes','Start Date','End Date'];

function ensureProjectSheetExtended() {
  const sh = mgmtSheet('Projects');
  const headerRow = sh.getRange(1, 4, 1, PROJECT_EXTENDED_HEADERS.length).getValues()[0];
  const needsHeaders = PROJECT_EXTENDED_HEADERS.some((h, i) => headerRow[i] !== h);
  if (needsHeaders) {
    sh.getRange(1, 4, 1, PROJECT_EXTENDED_HEADERS.length).setValues([PROJECT_EXTENDED_HEADERS])
      .setFontWeight('bold');
    sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).setNumberFormat('@');
  }
  return sh;
}

function rowToProjectMaster(r) {
  return {
    clientId:        safeStr(r[0]),
    projectId:       safeStr(r[1]),
    projectName:     safeStr(r[2]),
    projectConstant: safeStr(r[3]),
    projectValue:    parseFloat(r[4]) || 0,
    plannedViews:    parseFloat(r[5]) || 0,
    completedViews:  parseFloat(r[6]) || 0,
    deliveredViews:  parseFloat(r[7]) || 0,
    status:          safeStr(r[8]) || 'In Progress',
    createdDate:     safeStr(r[9]),
    updatedDate:     safeStr(r[10]),
    managerNotes:    safeStr(r[11]),
    teamLeaderNotes: safeStr(r[12]),
    startDate:       safeStr(r[13]),
    endDate:         safeStr(r[14]),
  };
}

function getProjectMasterList(role) {
  const sh = ensureProjectSheetExtended();
  if (sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, PROJECT_SHEET_TOTAL_COLS).getValues();
  const projects = rows
    .filter(r => r[1] && String(r[1]).trim() !== 'Project ID')
    .map(rowToProjectMaster);

  return projects;
}

function getProjectMasterOne(projectId, role) {
  if (!projectId) throw new Error('projectId is required.');
  const found = getProjectMasterList(role).find(p => p.projectId === projectId);
  if (!found) throw new Error('Project not found: ' + projectId);
  return found;
}

function getNextProjectId() {
  const sh = ensureProjectSheetExtended();
  if (sh.getLastRow() < 2) return null;
  const ids = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();

  let best = null;
  ids.forEach(r => {
    const id = safeStr(r[0]);
    const m = /^([A-Za-z]+)-(\d+)$/.exec(id);
    if (!m) return;
    const num = parseInt(m[2], 10);
    if (!best || num > best.num) best = { prefix: m[1], num, digits: m[2].length };
  });

  if (!best) return null;
  return best.prefix + '-' + String(best.num + 1).padStart(best.digits, '0');
}

function saveProjectMaster(data) {
  const role = data.role;
  if (role !== 'manager' && role !== 'tl') throw new Error('role must be "manager" or "tl".');

  const sh = ensureProjectSheetExtended();
  const isUpdate  = !!data.originalProjectId;
  const lookupId  = isUpdate ? data.originalProjectId : data.projectId;
  if (!lookupId) throw new Error('projectId is required.');

  const lastRow = sh.getLastRow();
  let targetRow = -1;
  if (lastRow > 1) {
    const ids = sh.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (safeStr(ids[i][0]) === lookupId) { targetRow = i + 2; break; }
    }
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');

  if (targetRow === -1) {
    if (role !== 'manager' && role !== 'tl') throw new Error('Only the Manager or Team Leader can create projects.');
    if (!data.projectId)   throw new Error('projectId is required to create a project.');
    if (!data.projectName) throw new Error('projectName is required to create a project.');

    const newRow = [
      data.clientId || '', data.projectId, data.projectName,
      data.projectConstant || '', data.projectValue || 0,
      data.plannedViews || 0, 0, 0,
      data.status || 'In Progress', now, now,
      data.managerNotes || '', data.teamLeaderNotes || '',
      data.startDate || '', data.endDate || '',
    ];
    sh.appendRow(newRow);
    const newLastRow = sh.getLastRow();
    sh.getRange(newLastRow, 1, 1, 3).setBackground(CLIENT_GREEN_HEX);
    return { saved: true, action: 'created', projectId: data.projectId };
  }

  const existing = sh.getRange(targetRow, 1, 1, PROJECT_SHEET_TOTAL_COLS).getValues()[0];
  const merged = existing.slice();

  if (role === 'manager') {
    if (data.clientId        !== undefined) merged[0] = data.clientId;
    if (data.projectId       !== undefined) merged[1] = data.projectId;
    if (data.projectName     !== undefined) merged[2] = data.projectName;
    if (data.projectConstant !== undefined) merged[3] = data.projectConstant;
    if (data.projectValue    !== undefined) merged[4] = data.projectValue;
    if (data.plannedViews    !== undefined) merged[5] = data.plannedViews;
    if (data.completedViews  !== undefined) merged[6] = data.completedViews;
    if (data.status          !== undefined) merged[8] = data.status;
    if (data.managerNotes    !== undefined) merged[11] = data.managerNotes;
    if (data.startDate       !== undefined) merged[13] = data.startDate;
    if (data.endDate         !== undefined) merged[14] = data.endDate;
  } else {
    if (data.completedViews  !== undefined) merged[6] = data.completedViews;
    if (data.startDate       !== undefined) merged[13] = data.startDate;
    if (data.endDate         !== undefined) merged[14] = data.endDate;
    if (data.status          !== undefined) merged[8] = data.status;
    if (data.teamLeaderNotes !== undefined) merged[12] = data.teamLeaderNotes;
  }
  merged[10] = now;

  sh.getRange(targetRow, 1, 1, merged.length).setValues([merged]);
  return { saved: true, action: 'updated', projectId: merged[1] };
}

function deleteProjectMaster(data) {
  const { role, projectId } = data;
  if (role !== 'manager') throw new Error('Only the Manager can delete projects.');
  if (!projectId) throw new Error('projectId is required.');

  const sh = ensureProjectSheetExtended();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { deleted: false, message: 'No projects to delete.' };

  const ids = sh.getRange(2, 2, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (safeStr(ids[i][0]) === projectId) {
      sh.deleteRow(i + 2);
      return { deleted: true, projectId };
    }
  }
  return { deleted: false, message: 'Project not found: ' + projectId };
}

const HIST_SHEET_NAME = 'HistoricalTimesheet';
const HIST_HEADERS = [
  'Client ID', 'Client Name', 'Project ID', 'Project Name', 'Month', 'Year',
  'Employee ID', 'Employee Name', 'Total Hours', 'Imported By', 'Imported Date', 'Status', 'Remarks',
];

function ensureHistoricalSheet() {
  const ss = getManagementSpreadsheet();
  let sh = ss.getSheetByName(HIST_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(HIST_SHEET_NAME);
    sh.getRange(1, 1, 1, HIST_HEADERS.length).setValues([HIST_HEADERS]);
    sh.getRange(1, 1, 1, HIST_HEADERS.length)
      .setFontWeight('bold').setBackground('#1a1e28').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    Logger.log('Created new ' + HIST_SHEET_NAME + ' in the Management spreadsheet.');
  }
  return sh;
}

function parseColonHours(val) {
  const s = String(val === null || val === undefined ? '' : val).trim();
  if (!s) return null;
  const m = /^(\d+):([0-5]?\d)$/.exec(s);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function fmtColonHoursLabel_(h) {
  const totalMins = Math.round(Number(h) * 60);
  const hrs = Math.floor(totalMins / 60), mins = totalMins % 60;
  return hrs + 'h ' + mins + 'm';
}

function histRowToRecord(r) {
  return {
    clientId:     safeStr(r[0]),
    clientName:   safeStr(r[1]),
    projectId:    safeStr(r[2]),
    projectName:  safeStr(r[3]),
    month:        safeStr(r[4]),
    year:         safeStr(r[5]),
    employeeId:   safeStr(r[6]),
    employeeName: safeStr(r[7]),
    totalHours:   parseFloat(r[8]) || 0,
    importedBy:   safeStr(r[9]),
    importedDate: safeStr(r[10]),
    status:       safeStr(r[11]) || 'Draft',
    remarks:      safeStr(r[12]),
  };
}

function getAllHistoricalRows_() {
  const sh = ensureHistoricalSheet();
  if (sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HIST_HEADERS.length).getValues();
  return rows.filter(r => r[2]).map(histRowToRecord);
}

function getHistoricalSheetData(clientId, projectId) {
  const rows = getAllHistoricalRows_().filter(r => r.clientId === clientId && r.projectId === projectId);
  const isFinal = rows.some(r => r.status === 'Final');

  const byMonth = {};
  rows.forEach(r => {
    const key = r.month + ' ' + r.year;
    if (!byMonth[key]) byMonth[key] = { month: r.month, year: r.year, records: [] };
    if (!r.employeeId) return;
    byMonth[key].records.push({
      employeeId: r.employeeId, employeeName: r.employeeName,
      hours: r.totalHours, hoursDisplay: fmtColonHoursLabel_(r.totalHours),
      remarks: r.remarks,
    });
  });

  return {
    clientId, projectId, isFinal,
    months: Object.values(byMonth),
  };
}

function saveHistoricalMonth(data) {
  if (data.role !== 'tl') throw new Error('Only Team Leaders can save historical timesheets.');

  const clientId  = safeStr(data.clientId);
  const projectId = safeStr(data.projectId);
  const month     = safeStr(data.month);
  const year      = safeStr(data.year);
  const records   = Array.isArray(data.records) ? data.records : [];

  if (!clientId || !projectId || !month || !year) {
    throw new Error('Client, Project, Month, and Year are all required.');
  }

  const master  = getMasterData();
  const client  = master.clients.find(c => c.id === clientId);
  const project = master.projects.find(p => p.id === projectId);
  if (!client)  throw new Error('Client not found: ' + clientId);
  if (!project) throw new Error('Project not found: ' + projectId);

  const existingAll = getAllHistoricalRows_();
  if (existingAll.some(r => r.clientId === clientId && r.projectId === projectId && r.status === 'Final')) {
    throw new Error('This project has been Finalized and can no longer be edited.');
  }

  const seen = {};
  const validated = [];
  const errors = [];
  records.forEach((rec, i) => {
    const rowNum = i + 1;
    const empId = safeStr(rec.employeeId);
    const emp = master.employees.find(e => e.id === empId);
    if (!emp) { errors.push('Row ' + rowNum + ': Employee not found.'); return; }

    const key = emp.id.toLowerCase();
    if (seen[key]) { errors.push('Row ' + rowNum + ': ' + emp.name + ' appears more than once in this month.'); return; }
    seen[key] = true;

    const hours = parseColonHours(rec.hours);
    if (hours === null || hours < 0) {
      errors.push('Row ' + rowNum + ': Invalid hours for ' + emp.name + ' — expected HH:MM, e.g. 81:05.');
      return;
    }

    validated.push({ employeeId: emp.id, employeeName: emp.name, hours, remarks: safeStr(rec.remarks) });
  });

  if (errors.length) throw new Error(errors.join(' '));

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = ensureHistoricalSheet();

    if (sh.getLastRow() >= 2) {
      const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HIST_HEADERS.length).getValues();
      const rowsToDelete = [];
      rows.forEach((r, i) => {
        if (safeStr(r[0]) === clientId && safeStr(r[2]) === projectId &&
            safeStr(r[4]) === month && safeStr(r[5]) === year) {
          rowsToDelete.push(i + 2);
        }
      });
      rowsToDelete.sort((a, b) => b - a).forEach(rowNum => sh.deleteRow(rowNum));
    }

    if (validated.length) {
      const now = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const importedBy = safeStr(data.importedByName) || 'Team Leader';

      const newRows = validated.map(rec => [
        clientId, client.name, projectId, project.name, month, year,
        rec.employeeId, rec.employeeName, rec.hours, importedBy, now, 'Draft', rec.remarks,
      ]);
      sh.getRange(sh.getLastRow() + 1, 1, newRows.length, HIST_HEADERS.length).setValues(newRows);
    } else {
      const now = new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      const importedBy = safeStr(data.importedByName) || 'Team Leader';
      const markerRow = [
        clientId, client.name, projectId, project.name, month, year,
        '', '', 0, importedBy, now, 'Draft', '',
      ];
      sh.getRange(sh.getLastRow() + 1, 1, 1, markerRow.length).setValues([markerRow]);
    }

    return { saved: true, month, year, count: validated.length };
  } finally {
    lock.releaseLock();
  }
}

function saveHistoricalDraft(data) {
  if (data.role !== 'tl') throw new Error('Only Team Leaders can save historical timesheets.');
  const months = Array.isArray(data.months) ? data.months : [];
  if (!months.length) throw new Error('No months to save.');

  const results = months.map(m => saveHistoricalMonth({
    role: data.role, importedByName: data.importedByName,
    clientId: data.clientId, projectId: data.projectId,
    month: m.month, year: m.year, records: m.records,
  }));

  return { saved: true, monthsSaved: results.length };
}

function finalizeHistoricalProject(data) {
  if (data.role !== 'tl') throw new Error('Only Team Leaders can finalize historical timesheets.');
  const clientId  = safeStr(data.clientId);
  const projectId = safeStr(data.projectId);
  if (!clientId || !projectId) throw new Error('clientId and projectId are required.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = ensureHistoricalSheet();
    if (sh.getLastRow() < 2) throw new Error('No historical records found for this project.');
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HIST_HEADERS.length).getValues();

    let count = 0;
    rows.forEach((r, i) => {
      if (safeStr(r[0]) === clientId && safeStr(r[2]) === projectId) {
        sh.getRange(i + 2, 12).setValue('Final');
        count++;
      }
    });
    if (!count) throw new Error('No historical records found for this project.');

    return { finalized: true, rowsLocked: count };
  } finally {
    lock.releaseLock();
  }
}

function reopenHistoricalProject(data) {
  if (data.role !== 'tl') throw new Error('Only Team Leaders can reopen historical timesheets.');
  const clientId  = safeStr(data.clientId);
  const projectId = safeStr(data.projectId);
  if (!clientId || !projectId) throw new Error('clientId and projectId are required.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = ensureHistoricalSheet();
    if (sh.getLastRow() < 2) return { reopened: false };
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HIST_HEADERS.length).getValues();

    let count = 0;
    rows.forEach((r, i) => {
      if (safeStr(r[0]) === clientId && safeStr(r[2]) === projectId) {
        sh.getRange(i + 2, 12).setValue('Draft');
        count++;
      }
    });
    return { reopened: count > 0, rowsReopened: count };
  } finally {
    lock.releaseLock();
  }
}

function deleteHistoricalMonthRecord(data) {
  if (data.role !== 'tl') throw new Error('Only Team Leaders can delete historical records.');
  const { clientId, projectId, month, year, employeeId } = data;
  if (!clientId || !projectId || !month || !year || !employeeId) {
    throw new Error('clientId, projectId, month, year, and employeeId are all required.');
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }
  try {
    const sh = ensureHistoricalSheet();
    if (sh.getLastRow() < 2) return { deleted: false };
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HIST_HEADERS.length).getValues();

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (safeStr(r[0]) === clientId && safeStr(r[2]) === projectId &&
          safeStr(r[4]) === month && safeStr(r[5]) === year && safeStr(r[6]) === employeeId) {
        if (safeStr(r[11]) === 'Final') throw new Error('This project has been Finalized and can no longer be edited.');

        const hasOtherRowThisMonth = rows.some((r2, i2) =>
          i2 !== i && safeStr(r2[0]) === clientId && safeStr(r2[2]) === projectId &&
          safeStr(r2[4]) === month && safeStr(r2[5]) === year
        );

        sh.deleteRow(i + 2);

        if (!hasOtherRowThisMonth) {
          const client  = getMasterData().clients.find(c => c.id === clientId);
          const project = getMasterData().projects.find(p => p.id === projectId);
          const now = new Date().toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          sh.appendRow([
            clientId, client ? client.name : '', projectId, project ? project.name : '', month, year,
            '', '', 0, 'Team Leader', now, 'Draft', '',
          ]);
        }

        return { deleted: true };
      }
    }
    return { deleted: false };
  } finally {
    lock.releaseLock();
  }
}

function getHistoricalRecords(filters) {
  filters = filters || {};
  let rows = getAllHistoricalRows_().filter(r => r.employeeId);
  if (filters.month)      rows = rows.filter(r => r.month === filters.month);
  if (filters.year)       rows = rows.filter(r => r.year === filters.year);
  if (filters.clientId)   rows = rows.filter(r => r.clientId === filters.clientId);
  if (filters.projectId)  rows = rows.filter(r => r.projectId === filters.projectId);
  if (filters.employeeId) rows = rows.filter(r => r.employeeId === filters.employeeId);
  return rows;
}

function getHistoricalProjectsSummary(rows) {
  rows = rows || getAllHistoricalRows_();
  const byProject = {};
  rows.forEach(r => {
    const key = r.clientId + '|' + r.projectId;
    if (!byProject[key]) {
      byProject[key] = {
        clientId: r.clientId, clientName: r.clientName,
        projectId: r.projectId, projectName: r.projectName,
        months: new Set(), employees: new Set(),
        totalHours: 0, isFinal: false, lastUpdated: '',
      };
    }
    const p = byProject[key];
    p.months.add(r.month + ' ' + r.year);
    if (r.employeeId) p.employees.add(r.employeeId);
    p.totalHours += r.totalHours;
    if (r.status === 'Final') p.isFinal = true;
    if (r.importedDate > p.lastUpdated) p.lastUpdated = r.importedDate;
  });

  return Object.values(byProject).map(p => ({
    clientId: p.clientId, clientName: p.clientName,
    projectId: p.projectId, projectName: p.projectName,
    monthCount: p.months.size, employeeCount: p.employees.size,
    totalHours: p.totalHours, isFinal: p.isFinal, lastUpdated: p.lastUpdated,
  })).sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
}

function forceLeave(data) {
  const { uid, date } = data;
  if (!uid || !date) throw new Error('uid and date are required.');

  const empName = getEmpName(uid);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('System is busy right now — please try again in a moment.');
  }

  try {
    const sh       = ensureEmployeeSheet(empName);
    const lastRow  = sh.getLastRow();
    const startRow = getDataStartRow(sh);

    if (lastRow >= startRow) {
      const vals = sh.getRange(startRow,1,lastRow-startRow+1,4).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (safeStr(vals[i][0]) === date) {
          const existing = sh.getRange(i+startRow,14,1,1).getValue();
          if (String(existing).trim() === 'Holiday') throw new Error('This date is a Public Holiday — no entries can be logged.');
        }
      }
      for (let i = 0; i < vals.length; i++) {
        if (safeStr(vals[i][0]) === date && safeStr(vals[i][2]) === 'morning') {
          const existing = sh.getRange(i+startRow,14,1,1).getValue();
          if (String(existing).trim() === 'Leave') return { saved: false, message: 'Leave already exists for ' + date };
        }
      }
    }

    const day     = new Date(date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'});
    const savedAt = Utilities.formatDate(new Date(),'Asia/Kolkata','dd MMM yyyy, hh:mm:ss a');
    const leaveRow = [date,day,'morning',1,'','','0h','','','','','','Force leave applied by manager','Leave',savedAt];
    sh.appendRow(leaveRow);
    sh.getRange(sh.getLastRow(),1,1,EMP_HEADERS.length).setBackground('#fef3c7').setFontColor('#92400e');
    return { saved: true, date, empName };
  } finally {
    lock.releaseLock();
  }
}

function getTLData() {
  const master = getMasterData();
  const entries = [], errors = [];
  const sheets = {};
  getSpreadsheet().getSheets().forEach(sh => { sheets[sh.getName()] = sh; });
  master.employees.forEach(emp => {
    try {
      readEmployeeHistory_(emp.name, sheets).forEach(e => entries.push({ ...e, empId: emp.id, empName: emp.name, empTeam: emp.team }));
    } catch (error) { errors.push({ empId: emp.id, empName: emp.name, message: error.message }); }
  });
  return { ...master, entries, errors };
}

function ensureSheet(name, headers) {
  const ss = getSpreadsheet();
  let sh   = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const hRange = sh.getRange(1,1,1,headers.length);
    hRange.setValues([headers]);
    hRange.setFontWeight('bold');
    hRange.setBackground('#1a1e28');
    hRange.setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getSheetData(name, headers) {
  try {
    const sh = sheet(name);
    if (sh.getLastRow() < 2) return [];
    const rows = sh.getRange(2,1,sh.getLastRow()-1,headers.length).getValues();
    return rows.filter(r=>r[0]).map(r => {
      const obj = {};
      headers.forEach((h,i) => { obj[h] = safeStr(r[i]); });
      return obj;
    });
  } catch(e) { return []; }
}

function colorFinanceRow(sh, rowIndex, estimate, received) {
  const range = sh.getRange(rowIndex,1,1,FINANCE_HEADERS.length);
  const est = parseFloat(estimate)||0, rec = parseFloat(received)||0;
  if (rec>est)      { range.setBackground('#d9ead3'); range.setFontColor('#274e13'); }
  else if (rec<est) { range.setBackground('#fce8e6'); range.setFontColor('#b71c1c'); }
  else              { range.setBackground('#fef3c7'); range.setFontColor('#92400e'); }
}

function getDataStartRow(sh) {
  if (sh.getLastRow() < 1) return 1;
  const cellA1 = sh.getRange(1,1).getValue();
  if (cellA1===null||cellA1===undefined||cellA1==='') return 2;
  if (cellA1 instanceof Date) return 1;
  if (typeof cellA1==='number'&&cellA1>0) return 1;
  const asStr = String(cellA1).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(asStr)) return 1;
  return 2;
}

function safeStr(val) {
  if (val===null||val===undefined) return '';
  if (val instanceof Date) {
    const y=val.getFullYear(), m=String(val.getMonth()+1).padStart(2,'0'), d=String(val.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }
  return String(val).trim();
}

function safeInt(val) {
  if (val===null||val===undefined) return 0;
  if (val instanceof Date) {
    const epoch=new Date(1899,11,30);
    return Math.round((val.getTime()-epoch.getTime())/86400000);
  }
  return parseInt(val,10)||0;
}

function safeTimeStr(val) {
  if (val===null||val===undefined||val==='') return '';
  if (val instanceof Date) {
    return String(val.getHours()).padStart(2,'0')+':'+String(val.getMinutes()).padStart(2,'0');
  }
  return String(val).trim();
}

function slotOrder(slot) { return {morning:0,afternoon:1,extended:2}[slot]??9; }

function fmtHours(h) {
  if (!h||h<=0) return '0h';
  const totalMins=Math.round(h*60), hrs=Math.floor(totalMins/60), mins=totalMins%60;
  if (hrs===0) return mins+'m';
  if (mins===0) return hrs+'h';
  return hrs+'h '+mins+'m';
}

function parseHours(val) {
  if (!val) return 0;
  const s=String(val).trim();
  const hMatch=s.match(/(\d+)h/), mMatch=s.match(/(\d+)m/);
  const h=hMatch?parseInt(hMatch[1],10):0, m=mMatch?parseInt(mMatch[1],10):0;
  if (h===0&&m===0) return parseFloat(s)||0;
  return Math.round(((h*60+m)/60)*100)/100;
}

function rowToEntry(r) {
  return {
    date:      safeStr(r[0]),
    day:       safeStr(r[1]),
    slot:      safeStr(r[2]),
    entryNum:  safeInt(r[3]),
    timeIn:    safeTimeStr(r[4]),
    timeOut:   safeTimeStr(r[5]),
    hours:     parseHours(r[6]),
    clientId:  safeStr(r[7]),
    client:    safeStr(r[8]),
    projectId: safeStr(r[9]),
    project:   safeStr(r[10]),
    task:      safeStr(r[11]),
    notes:     safeStr(r[12]),
    status:    safeStr(r[13]),
    savedAt:   safeStr(r[14])||'',
  };
}

function colorRow(sh, rowIndex, status) {
  const range = sh.getRange(rowIndex,1,1,EMP_HEADERS.length);
  if (status==='Leave')        { range.setBackground('#fef3c7'); range.setFontColor('#92400e'); }
  else if (status==='Holiday') { range.setBackground('#fde68a'); range.setFontColor('#78350f'); }
  else                         { range.setBackground(null); range.setFontColor(null); }
}

function backfillHolidayRowColors() {
  const ss = getSpreadsheet();
  const sheets = ss.getSheets();
  const skip = ['Employees','Clients','Projects','ClientFinance','ProjectDetails','Salaries','SalaryPivotView','HistoricalTimesheet'];
  let coloredRows = 0, sheetsTouched = 0;

  sheets.forEach(sh => {
    const name = sh.getName();
    if (skip.includes(name)) return;
    const lastRow = sh.getLastRow(), startRow = getDataStartRow(sh);
    if (lastRow < startRow) return;

    const statusCol = sh.getRange(startRow, 14, lastRow - startRow + 1, 1).getValues();
    let touchedThisSheet = false;
    statusCol.forEach((r, i) => {
      if (safeStr(r[0]) === 'Holiday') {
        colorRow(sh, startRow + i, 'Holiday');
        coloredRows++;
        touchedThisSheet = true;
      }
    });
    if (touchedThisSheet) sheetsTouched++;
  });

  Logger.log('Backfill complete. Colored ' + coloredRows + ' Holiday row(s) across ' + sheetsTouched + ' sheet(s).');
  return { coloredRows, sheetsTouched };
}

function sheet(name) {
  if (_sheetMemo[name]) return _sheetMemo[name];
  const s = getSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Sheet "'+name+'" not found in the Timesheet spreadsheet.');
  _sheetMemo[name] = s;
  return s;
}

function mgmtSheet(name) {
  const key = 'mgmt:' + name;
  if (_sheetMemo[key]) return _sheetMemo[key];
  const s = getManagementSpreadsheet().getSheetByName(name);
  if (!s) throw new Error('Sheet "'+name+'" not found in the Management spreadsheet (ID: ' + MANAGEMENT_SPREADSHEET_ID + '). Create a sheet named exactly "' + name + '" there.');
  _sheetMemo[key] = s;
  return s;
}

function runBackendDiagnostics() {
  const report = {
    sheetId: SHEET_ID,
    spreadsheetOpened: false,
    spreadsheetName: null,
    spreadsheetUrl: null,
    sheetsFound: [],
    expectedSheets: {},
    employeesReadTest: null,
    salaryPivotView: null,
    historicalTimesheet: null,
    errors: [],
  };

  let ss;
  try {
    ss = SpreadsheetApp.openById(SHEET_ID);
    report.spreadsheetOpened = true;
    report.spreadsheetName = ss.getName();
    report.spreadsheetUrl  = ss.getUrl();
  } catch (ex) {
    report.errors.push('Cannot open spreadsheet by ID ' + SHEET_ID + ': ' + ex.message);
    report.errors.push('This means the ID is wrong/deleted, or the Google account this ' +
      'Apps Script project runs as does not have access to this specific file. Check: ' +
      '(1) the ID in the spreadsheet\'s own URL matches SHEET_ID exactly, ' +
      '(2) Apps Script → Deploy → Manage deployments shows "Execute as: Me", and that ' +
      '"Me" is an account with at least Viewer access to this spreadsheet.');
    return report;
  }

  try {
    report.sheetsFound = ss.getSheets().map(s => s.getName());
  } catch (ex) {
    report.errors.push('Opened the spreadsheet but failed to list its sheets: ' + ex.message);
  }

  const expected = ['ClientFinance', 'ProjectDetails', 'Salaries'];
  expected.forEach(name => { report.expectedSheets[name] = report.sheetsFound.indexOf(name) !== -1; });

  try {
    const mgmtSsForTest = SpreadsheetApp.openById(MANAGEMENT_SPREADSHEET_ID);
    const empSheet = mgmtSsForTest.getSheetByName('Employees');
    report.employeesReadTest = empSheet
      ? { readable: true, lastRow: empSheet.getLastRow(), location: 'Management spreadsheet' }
      : { readable: false, reason: '"Employees" sheet not found in the Management spreadsheet.' };
  } catch (ex) {
    report.errors.push('Read test on "Employees" sheet (Management spreadsheet) failed: ' + ex.message);
    report.employeesReadTest = { readable: false, reason: ex.message };
  }

  try {
    const mgmtSsForSalary = SpreadsheetApp.openById(MANAGEMENT_SPREADSHEET_ID);
    const salSheet = mgmtSsForSalary.getSheetByName(SALARY_PIVOT_SHEET_NAME);
    report.salaryPivotView = salSheet
      ? { exists: true, lastRow: salSheet.getLastRow(), lastCol: salSheet.getLastColumn(), location: 'Management spreadsheet' }
      : { exists: false, note: 'Not created yet — it is auto-created the first time the Salary tab loads or a salary is saved. Not an error by itself.' };
  } catch (ex) {
    report.errors.push('Check on "' + SALARY_PIVOT_SHEET_NAME + '" (Management spreadsheet) failed: ' + ex.message);
  }

  try {
    const mgmtSsForHist = SpreadsheetApp.openById(MANAGEMENT_SPREADSHEET_ID);
    const histSheet = mgmtSsForHist.getSheetByName(HIST_SHEET_NAME);
    report.historicalTimesheet = histSheet
      ? { exists: true, lastRow: histSheet.getLastRow(), lastCol: histSheet.getLastColumn(), location: 'Management spreadsheet' }
      : { exists: false, note: 'Not created yet — it is auto-created the first time a Historical Import save happens. Not an error by itself.' };
  } catch (ex) {
    report.errors.push('Check on "' + HIST_SHEET_NAME + '" (Management spreadsheet) failed: ' + ex.message);
  }

  report.managementSpreadsheet = { opened: false };
  try {
    const mgmtSs = SpreadsheetApp.openById(MANAGEMENT_SPREADSHEET_ID);
    report.managementSpreadsheet.opened = true;
    report.managementSpreadsheet.name = mgmtSs.getName();
    report.managementSpreadsheet.url  = mgmtSs.getUrl();
    const mgmtSheetsFound = mgmtSs.getSheets().map(s => s.getName());
    report.managementSpreadsheet.sheetsFound = mgmtSheetsFound;
    report.managementSpreadsheet.expectedSheets = {};
    MANAGEMENT_SHEET_NAMES.forEach(name => {
      report.managementSpreadsheet.expectedSheets[name] = mgmtSheetsFound.indexOf(name) !== -1;
    });
  } catch (ex) {
    report.errors.push('Cannot open Management spreadsheet (ID: ' + MANAGEMENT_SPREADSHEET_ID + '): ' + ex.message +
      ' — set MANAGEMENT_SPREADSHEET_ID at the top of Code.gs.');
  }

  report.ok = report.spreadsheetOpened && report.errors.length === 0;
  return report;
}

function runBackendDiagnosticsFromEditor() {
  const report = runBackendDiagnostics();
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}

function resetSalaryPivotViewManually() {
  const ss = getManagementSpreadsheet();
  const sh = ss.getSheetByName(SALARY_PIVOT_SHEET_NAME);
  if (!sh) {
    Logger.log('"' + SALARY_PIVOT_SHEET_NAME + '" does not exist in the Management spreadsheet — nothing to reset. ' +
      'Just call getSalaryHistory or open the Salary tab and it will be created fresh.');
    return { deleted: false, reason: 'Sheet does not exist.' };
  }
  ss.deleteSheet(sh);
  Logger.log('Deleted "' + SALARY_PIVOT_SHEET_NAME + '" from the Management spreadsheet. It will be recreated automatically, ' +
    'in the new flat format, the next time the Salary tab loads or a salary is saved.');
  return { deleted: true };
}

function clearEmployeeCache() {
  CacheService.getScriptCache().remove(EMP_CACHE_KEY);
  Logger.log('Employee id->name cache cleared.');
  return { cleared: true };
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'ok',data}))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'error',message:msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function cleanupAllSheets() {
  const ss=getSpreadsheet();
  const sheets=ss.getSheets();
  const skip=['Employees','Clients','Projects','ClientFinance','ProjectDetails','Salaries','SalaryPivotView'];
  let fixedRows=0;
  sheets.forEach(sh=>{
    const name=sh.getName();
    if (skip.includes(name)) return;
    const lastRow=sh.getLastRow(), startRow=getDataStartRow(sh);
    if (lastRow<startRow) return;
    const numRows=lastRow-startRow+1;
    sh.getRange(startRow,4,numRows,1).setNumberFormat('0');
    sh.getRange(startRow,7,numRows,1).setNumberFormat('@');
    sh.getRange(startRow,5,numRows,1).setNumberFormat('@');
    sh.getRange(startRow,6,numRows,1).setNumberFormat('@');
    const data=sh.getRange(startRow,1,numRows,EMP_HEADERS.length).getValues();
    const fixed=data.map(r=>{
      const timeIn=safeTimeStr(r[4]),timeOut=safeTimeStr(r[5]),hours=fmtHours(parseHours(r[6]));
      if(timeIn!==r[4]||timeOut!==r[5]||hours!==String(r[6]).trim()) fixedRows++;
      return [safeStr(r[0]),safeStr(r[1]),safeStr(r[2]),safeInt(r[3]),
        timeIn,timeOut,hours,safeStr(r[7]),safeStr(r[8]),safeStr(r[9]),safeStr(r[10]),
        safeStr(r[11]),safeStr(r[12]),safeStr(r[13]),safeStr(r[14])];
    });
    sh.getRange(startRow,1,fixed.length,EMP_HEADERS.length).setValues(fixed);
  });
  Logger.log('Cleanup complete. Rows fixed: '+fixedRows);
  return 'Cleanup complete. Rows fixed: '+fixedRows;
}

function readEmployeeHistory_(name, sheets) {
  const sh = sheets ? sheets[name] : getSpreadsheet().getSheetByName(name);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (!lastRow) return [];
  const rows = sh.getRange(1, 1, lastRow, EMP_HEADERS.length).getValues();
  const first = rows[0][0];
  const headerless = first instanceof Date || (typeof first === 'number' && first > 0) || /^\d{4}-\d{2}-\d{2}/.test(String(first || ''));
  return rows.slice(headerless ? 0 : 1)
    .map(rowToEntry)
    .filter(entry => entry.date)
    .sort((a,b) => b.date.localeCompare(a.date) || slotOrder(a.slot) - slotOrder(b.slot) || a.entryNum - b.entryNum);
}
function getProjectTabData(role) {
  const rows = getAllHistoricalRows_();
  return {
    clients: getClientMasterList(), projects: getProjectMasterList(role),
    historicalRecords: rows.filter(r => r.employeeId),
    historicalProjectsSummary: getHistoricalProjectsSummary(rows),
  };
}
function getEmployeeDashboard(uid) {
  if (!uid) throw new Error('uid is required.');
  const team = getTLData();
  if (!team.employees.some(e => e.id === uid)) throw new Error('Employee not found.');
  const history = team.entries.filter(e => e.empId === uid);
  const names = new Set(history.map(e => e.project).filter(Boolean));
  const projects = getProjectMasterList('employee').filter(p => names.has(p.projectName));
  const normalize = v => String(v || '').trim().toLowerCase().replace(/\s*-\s*/g, '-');
  const ids = new Set(projects.map(p => normalize(p.projectId)));
  return {
    employees: team.employees, errors: team.errors, history,
    entries: team.entries.filter(e => names.has(e.project)),
    projects, clients: getClientMasterList(),
    historicalRecords: getHistoricalRecords({}).filter(r => ids.has(normalize(r.projectId))),
    salaryRecords: getSalaryHistory(),
  };
}

// ═══ UNITS ════════════════════════════════════════════════════════
const PROJECT_UNITS_SHEET   = 'ProjectUnits';
const UNIT_ALLOC_SHEET      = 'UnitAllocations';
const POSITION_TARGET_SHEET = 'PositionTargets';

const PROJECT_UNITS_HEADERS   = ['Project ID', 'Project Name', 'Total Units', 'Updated By', 'Updated At'];
const UNIT_ALLOC_HEADERS      = ['Allocation ID', 'Work Date', 'Month', 'Employee ID', 'Employee Name',
                                 'Project ID', 'Project Name', 'Units', 'Work Note', 'Allocated By', 'Allocated At', 'Seen',
                                 'Image Name'];
const POSITION_TARGET_HEADERS = ['Position', 'Monthly Target', 'Updated By', 'Updated At'];
const EMP_POSITION_COL        = 7;

function ensureMgmtSheet_(name, headers) {
  const ss = getManagementSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1a1e28').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readRows_(sh, width) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
}

function requireUnitsAdmin_(data) {
  if (data.role !== 'manager' && data.role !== 'tl') {
    throw new Error('Only the Manager or a Team Leader can manage units.');
  }
}

function unitsNow_() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm:ss a');
}

function readEmployeePositions_() {
  const sh = mgmtSheet('Employees');
  const header = sh.getRange(1, EMP_POSITION_COL).getValue();
  if (String(header).trim() !== 'Position') sh.getRange(1, EMP_POSITION_COL).setValue('Position').setFontWeight('bold');
  const map = {};
  readRows_(sh, EMP_POSITION_COL).forEach(r => {
    const id = safeStr(r[0]);
    if (id) map[id] = safeStr(r[EMP_POSITION_COL - 1]);
  });
  return map;
}

function ensureAllocSheet_() {
  const sh = ensureMgmtSheet_(UNIT_ALLOC_SHEET, UNIT_ALLOC_HEADERS);
  const col = UNIT_ALLOC_HEADERS.length;
  if (String(sh.getRange(1, col).getValue()).trim() !== UNIT_ALLOC_HEADERS[col - 1]) {
    sh.getRange(1, col).setValue(UNIT_ALLOC_HEADERS[col - 1])
      .setFontWeight('bold').setBackground('#1a1e28').setFontColor('#ffffff');
  }
  return sh;
}

function readAllocations_() {
  return readRows_(ensureAllocSheet_(), UNIT_ALLOC_HEADERS.length)
    .filter(r => r[0])
    .map(r => ({
      id:          safeStr(r[0]),
      date:        safeStr(r[1]),
      month:       safeStr(r[2]),
      empId:       safeStr(r[3]),
      empName:     safeStr(r[4]),
      projectId:   safeStr(r[5]),
      projectName: safeStr(r[6]),
      units:       parseFloat(r[7]) || 0,
      note:        safeStr(r[8]),
      allocatedBy: safeStr(r[9]),
      allocatedAt: safeStr(r[10]),
      seen:        r[11] === true || String(r[11]).toUpperCase() === 'TRUE',
      imageNames:  safeStr(r[12]) ? safeStr(r[12]).split('\n').map(n => n.trim()).filter(Boolean) : [],
    }));
}

function getUnitsData(uid) {
  const projectUnits = readRows_(ensureMgmtSheet_(PROJECT_UNITS_SHEET, PROJECT_UNITS_HEADERS), PROJECT_UNITS_HEADERS.length)
    .filter(r => r[0])
    .map(r => ({ projectId: safeStr(r[0]), projectName: safeStr(r[1]), totalUnits: parseFloat(r[2]) || 0,
                 updatedBy: safeStr(r[3]), updatedAt: safeStr(r[4]) }));
  const targets = readRows_(ensureMgmtSheet_(POSITION_TARGET_SHEET, POSITION_TARGET_HEADERS), POSITION_TARGET_HEADERS.length)
    .filter(r => r[0])
    .map(r => ({ position: safeStr(r[0]), target: parseFloat(r[1]) || 0 }));
  const positions = readEmployeePositions_();
  let allocations = readAllocations_();
  if (uid) allocations = allocations.filter(a => a.empId === uid);
  return {
    projectUnits, targets, allocations,
    positions: uid ? { [uid]: positions[uid] || '' } : positions,
  };
}

function setProjectUnits(data) {
  requireUnitsAdmin_(data);
  const projectId = safeStr(data.projectId);
  const total = parseFloat(data.totalUnits);
  if (!projectId) throw new Error('projectId is required.');
  if (isNaN(total) || total < 0) throw new Error('Total units must be 0 or more.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('System is busy right now — please try again in a moment.');
  try {
    const used = readAllocations_().filter(a => a.projectId === projectId).reduce((s, a) => s + a.units, 0);
    if (total < used) throw new Error('Total units cannot be less than the ' + used + ' units already allocated.');

    const sh = ensureMgmtSheet_(PROJECT_UNITS_SHEET, PROJECT_UNITS_HEADERS);
    const row = [projectId, safeStr(data.projectName), total, safeStr(data.byName) || data.role, unitsNow_()];
    const rows = readRows_(sh, 1);
    for (let i = 0; i < rows.length; i++) {
      if (safeStr(rows[i][0]) === projectId) {
        sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return { saved: true, action: 'updated' };
      }
    }
    sh.appendRow(row);
    return { saved: true, action: 'inserted' };
  } finally {
    lock.releaseLock();
  }
}

function allocateUnits(data) {
  requireUnitsAdmin_(data);
  const empId     = safeStr(data.empId);
  const projectId = safeStr(data.projectId);
  const images    = (Array.isArray(data.images) ? data.images : [])
    .map(img => ({ name: safeStr(img.name), units: parseFloat(img.units) }));
  const date      = safeStr(data.date) || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
  if (!empId || !projectId) throw new Error('Employee and project are required.');
  if (!images.length) throw new Error('Add at least one image.');
  if (images.some(img => !img.name)) throw new Error('Every image needs a name.');
  if (images.some(img => isNaN(img.units) || img.units <= 0)) throw new Error('Every image needs units more than 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Work date must be YYYY-MM-DD.');

  const empName = getEmpName(empId);
  const units = images.reduce((sum, img) => sum + img.units, 0);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('System is busy right now — please try again in a moment.');
  try {
    const project = getUnitsData().projectUnits.find(p => p.projectId === projectId);
    if (!project || project.totalUnits <= 0) throw new Error('Set the total units for this project before allocating.');
    const used = readAllocations_().filter(a => a.projectId === projectId).reduce((s, a) => s + a.units, 0);
    const remaining = project.totalUnits - used;
    if (units > remaining) throw new Error('Only ' + remaining + ' units are left on ' + (project.projectName || projectId) + '.');

    const id = 'UA-' + Utilities.getUuid().slice(0, 8);
    const by = safeStr(data.byName) || data.role, at = unitsNow_(), note = safeStr(data.note);
    const base = [date, date.slice(0, 7), empId, empName, projectId, project.projectName];
    const rows = images.map((img, i) => [id + '-' + (i + 1), ...base, img.units, note, by, at, false, img.name]);
    const sh = ensureAllocSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, UNIT_ALLOC_HEADERS.length).setValues(rows);
    return { saved: true, id, rows: rows.length, remaining: remaining - units };
  } finally {
    lock.releaseLock();
  }
}

function updateUnitAllocation(data) {
  requireUnitsAdmin_(data);
  const id = safeStr(data.id);
  const units = parseFloat(data.units);
  if (!id) throw new Error('id is required.');
  if (isNaN(units) || units <= 0) throw new Error('Units must be more than 0.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('System is busy right now — please try again in a moment.');
  try {
    const all = readAllocations_();
    const current = all.find(a => a.id === id);
    if (!current) throw new Error('Allocation not found: ' + id);
    const project = getUnitsData().projectUnits.find(p => p.projectId === current.projectId);
    const used = all.filter(a => a.projectId === current.projectId).reduce((s, a) => s + a.units, 0);
    const available = (project ? project.totalUnits : 0) - used + current.units;
    if (units > available) throw new Error('Only ' + available + ' units are available for this image.');

    const sh = ensureAllocSheet_();
    const rows = readRows_(sh, 1);
    for (let i = 0; i < rows.length; i++) {
      if (safeStr(rows[i][0]) === id) {
        sh.getRange(i + 2, 8).setValue(units);
        return { saved: true, id, units };
      }
    }
    throw new Error('Allocation not found: ' + id);
  } finally {
    lock.releaseLock();
  }
}

function deleteUnitAllocation(data) {
  requireUnitsAdmin_(data);
  const id = safeStr(data.id);
  if (!id) throw new Error('id is required.');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('System is busy right now — please try again in a moment.');
  try {
    const sh = ensureAllocSheet_();
    const rows = readRows_(sh, 1);
    for (let i = 0; i < rows.length; i++) {
      if (safeStr(rows[i][0]) === id) { sh.deleteRow(i + 2); return { deleted: true, id }; }
    }
    return { deleted: false };
  } finally {
    lock.releaseLock();
  }
}

function setPositionTarget(data) {
  requireUnitsAdmin_(data);
  const position = safeStr(data.position);
  const target = parseFloat(data.target);
  if (!position) throw new Error('Position is required.');

  const sh = ensureMgmtSheet_(POSITION_TARGET_SHEET, POSITION_TARGET_HEADERS);
  const rows = readRows_(sh, 1);
  for (let i = 0; i < rows.length; i++) {
    if (safeStr(rows[i][0]).toLowerCase() === position.toLowerCase()) {
      if (data.remove) { sh.deleteRow(i + 2); return { deleted: true }; }
      if (isNaN(target) || target < 0) throw new Error('Target must be 0 or more.');
      sh.getRange(i + 2, 1, 1, 4).setValues([[position, target, safeStr(data.byName) || data.role, unitsNow_()]]);
      return { saved: true, action: 'updated' };
    }
  }
  if (data.remove) return { deleted: false };
  if (isNaN(target) || target < 0) throw new Error('Target must be 0 or more.');
  sh.appendRow([position, target, safeStr(data.byName) || data.role, unitsNow_()]);
  return { saved: true, action: 'inserted' };
}

function setEmployeePosition(data) {
  requireUnitsAdmin_(data);
  const empId = safeStr(data.empId);
  if (!empId) throw new Error('empId is required.');
  const sh = mgmtSheet('Employees');
  readEmployeePositions_();
  const rows = readRows_(sh, 1);
  for (let i = 0; i < rows.length; i++) {
    if (safeStr(rows[i][0]) === empId) {
      sh.getRange(i + 2, EMP_POSITION_COL).setValue(safeStr(data.position));
      return { saved: true };
    }
  }
  throw new Error('Employee not found: ' + empId);
}

function markUnitsSeen(data) {
  const uid = safeStr(data.uid);
  if (!uid) throw new Error('uid is required.');
  const sh = ensureAllocSheet_();
  const rows = readRows_(sh, UNIT_ALLOC_HEADERS.length);
  let count = 0;
  rows.forEach((r, i) => {
    const seen = r[11] === true || String(r[11]).toUpperCase() === 'TRUE';
    if (safeStr(r[3]) === uid && !seen) { sh.getRange(i + 2, 12).setValue(true); count++; }
  });
  return { marked: count };
}
