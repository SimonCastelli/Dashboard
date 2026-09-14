// app.js — interacciones del dashboard. Sin dependencias.
// Estado local en localStorage: todo lo que se toca en la UI (tareas, notas,
// hábitos, correo→tarea) persiste entre recargas y entre las tres páginas.
// No hay red ni cuentas reales: esto sigue siendo el mock del README.

const STORE = {
  taskDone: 'panel.taskDone',       // { [sampleTaskId]: boolean }
  extraTasks: 'panel.extraTasks',   // [{ id, label, tagText, tagClass, due, done }]
  mailStatus: 'panel.mailStatus',   // { [mailId]: { read, tasked } }
  habitOverride: 'panel.habitOverride', // { [habit]: { [dayIndex]: boolean } }
  extraNotes: 'panel.extraNotes',   // [string]
  extraEvents: 'panel.extraEvents', // [string]
  taskDetails: 'panel.taskDetails',   // { [taskId]: {label, notes, dueDate, dueTime, priority, list, subtasks} }
  noteDetails: 'panel.noteDetails',   // { [noteId]: {title, body, tags, pinned} }
  extraNoteItems: 'panel.extraNoteItems', // [{id, title, body, tagText, tagClass, tags, due}]
  habitDetails: 'panel.habitDetails', // { [habitId]: {name, goal, reminder, freq, days, type, paused} }
  extraHabits: 'panel.extraHabits',   // [{id, name, ...}]
  goalDetails: 'panel.goalDetails',   // { [goalId]: {title, why, target, current, start, end, measure, milestones, status} }
  extraGoals: 'panel.extraGoals',     // [{id, title, ...}]
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* almacenamiento no disponible */ }
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// ── datos de muestra (reflejan lo hardcodeado en el HTML) ──
// meta/dueDate/dueTime/priority/list/notes/subtasks solo importan en la vista
// rica de tareas.html (el panel de edición); la tabla compacta del dashboard
// únicamente usa label/tagText/tagClass/due.
const SAMPLE_TASKS = [
  { id: 't1', label: 'Terminar TP2 de BD', tagText: 'facultad', tagClass: 'tag-accent', due: 'hoy 18:00', doneDefault: false,
    meta: 'Bases de Datos · 45 min estimados', dueDate: '2026-09-14', dueTime: '18:00', priority: 'Alta', list: 'facultad',
    notes: 'Consigna corregida: se extiende al jueves. Faltan las consultas 4 y 5 y el diagrama ER.',
    subtasks: [{ label: 'Consultas 1 a 3', done: true }, { label: 'Consultas 4 y 5', done: false }, { label: 'Diagrama ER', done: false }] },
  { id: 't2', label: 'Enviar presupuesto a Martín', tagText: 'freelance', tagClass: 'tag-neutral', due: 'mié 15/09', doneDefault: false,
    meta: 'Del mail "Re: presupuesto sitio"', dueDate: '2026-09-15', dueTime: '', priority: 'Media', list: 'freelance', notes: '', subtasks: [] },
  { id: 't3', label: 'Pedir certificado de alumno regular', tagText: 'facultad', tagClass: 'tag-accent', due: 'jue 16/09', doneDefault: false,
    meta: 'Secretaría Académica · online', dueDate: '2026-09-16', dueTime: '', priority: 'Media', list: 'facultad', notes: '', subtasks: [] },
  { id: 't4', label: 'Leer paper de scheduling', tagText: 'lectura', tagClass: 'tag-outline', due: 'sáb 18/09', doneDefault: false,
    meta: 'Sist. Operativos · 12 páginas', dueDate: '2026-09-18', dueTime: '', priority: 'Baja', list: 'lectura', notes: '', subtasks: [] },
  { id: 't5', label: 'Resumen unidad 3', tagText: 'facultad', tagClass: 'tag-accent', due: 'ayer', doneDefault: true,
    meta: 'Álgebra II', dueDate: '2026-09-13', dueTime: '', priority: 'Media', list: 'facultad', notes: '', subtasks: [] },
  { id: 't6', label: 'Leer 30 min', tagText: 'hábito', tagClass: 'tag-outline', due: 'hoy', doneDefault: false,
    meta: 'Sistemas operativos modernos, pág. 214', dueDate: '2026-09-14', dueTime: '', priority: 'Media', list: 'personal', notes: '', subtasks: [] },
];
const TASK_LIST_TAG = { facultad: 'tag-accent', personal: 'tag-outline', freelance: 'tag-neutral', lectura: 'tag-outline' };
const DAY_ABBR = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
// El due "hoy 18:00" / "mié 15/09" / "ayer" de las filas se recalcula con esta
// función a partir de dueDate/dueTime, para que Guardar cambios lo mantenga
// consistente con lo que el usuario tipeó en el formulario. (TODAY_REF y
// formatDue se definen más abajo, en "captura rápida" — como esta función
// solo se llama después de que corrió todo el script, ya están listas.)
function formatTaskDue(dueDate, dueTime) {
  if (!dueDate) return 'sin fecha';
  const [y, m, d] = dueDate.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  const diffDays = Math.round((date - TODAY_REF) / 86400000);
  let base;
  if (diffDays === 0) base = 'hoy';
  else if (diffDays === -1) base = 'ayer';
  else if (diffDays === 1) base = 'mañana';
  else base = `${DAY_ABBR[date.getDay()]} ${formatDue(date)}`;
  return dueTime ? `${base} ${dueTime}` : base;
}
const SAMPLE_MAIL_UNREAD_DEFAULT = { m1: true, m2: false, m3: true, m4: false, m5: false, m6: false };

// ── tareas ──
function getTaskDoneOverrides() { return load(STORE.taskDone, {}); }
function getExtraTasks() { return load(STORE.extraTasks, []); }
function getTaskDetailsOverrides() { return load(STORE.taskDetails, {}); }
function saveTaskDetailOverride(id, patch) {
  const overrides = getTaskDetailsOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...patch };
  save(STORE.taskDetails, overrides);
}
function getTaskById(id) {
  const sample = SAMPLE_TASKS.find((t) => t.id === id);
  const extra = getExtraTasks().find((t) => t.id === id);
  const base = sample || extra;
  if (!base) return null;
  const done = sample ? (getTaskDoneOverrides()[id] ?? sample.doneDefault) : !!extra.done;
  return { ...base, ...(getTaskDetailsOverrides()[id] || {}), done };
}
function getAllTasks() {
  const overrides = getTaskDoneOverrides();
  const details = getTaskDetailsOverrides();
  const sample = SAMPLE_TASKS.map((t) => ({ ...t, ...details[t.id], done: overrides[t.id] ?? t.doneDefault }));
  const extra = getExtraTasks().map((t) => ({ ...t, ...details[t.id] }));
  return sample.concat(extra).filter((t) => !t.deleted);
}
function countOpenTasks() { return getAllTasks().filter((t) => !t.done).length; }
function countDoneTasks() { return getAllTasks().filter((t) => t.done).length; }

function setTaskDone(id, done) {
  if (SAMPLE_TASKS.some((t) => t.id === id)) {
    const overrides = getTaskDoneOverrides();
    overrides[id] = done;
    save(STORE.taskDone, overrides);
  } else {
    const extra = getExtraTasks();
    const task = extra.find((t) => t.id === id);
    if (task) { task.done = done; save(STORE.extraTasks, extra); }
  }
}

function addTask({ label, tagText, tagClass, due, dueDate, meta }) {
  const extra = getExtraTasks();
  const id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  extra.push({ id, label, tagText: tagText || '', tagClass: tagClass || '', due: due || 'sin fecha', dueDate: dueDate || '', meta: meta || '', done: false });
  save(STORE.extraTasks, extra);
  renderTasksTable();
  updateBadges();
  return id;
}

function applyRowDoneState(row, done) {
  const check = row.querySelector('.check');
  const label = row.querySelector('.label');
  if (check) check.setAttribute('aria-pressed', String(done));
  if (label) label.classList.toggle('done', done);
}
function taskDueText(t) { return t.dueDate ? formatTaskDue(t.dueDate, t.dueTime) : (t.due || 'sin fecha'); }
function buildTaskRow(t) {
  const tr = document.createElement('tr');
  tr.dataset.id = t.id;
  tr.dataset.extra = '1';
  tr.innerHTML =
    `<td style="width:22px"><button class="check" aria-pressed="${t.done}" aria-label="Completar"></button></td>` +
    `<td class="label${t.done ? ' done' : ''}">${escapeHtml(t.label)}</td>` +
    `<td>${t.tagText ? `<span class="tag ${t.tagClass}">${escapeHtml(t.tagText)}</span>` : ''}</td>` +
    `<td class="mut" style="text-align:right">${escapeHtml(taskDueText(t))}</td>`;
  return tr;
}
function buildTaskListItem(t) {
  const li = document.createElement('li');
  li.className = 'row';
  li.dataset.listRow = '';
  li.dataset.id = t.id;
  li.dataset.extra = '1';
  li.innerHTML =
    `<button class="check" aria-pressed="${t.done}" aria-label="Completar"></button>` +
    `<div class="row-body"><span class="label${t.done ? ' done' : ''}">${escapeHtml(t.label)}</span>` +
    `<span class="row-meta mut">${escapeHtml(t.meta || 'Capturada')}</span></div>` +
    (t.tagText ? `<span class="tag ${t.tagClass || 'tag-outline'}">${escapeHtml(t.tagText)}</span>` : '') +
    `<span class="row-due mut num">${escapeHtml(taskDueText(t))}</span>`;
  return li;
}
function renderTasksTable() {
  // Hidrata el estado "hecho" (y, si se editaron, título/tag/vencimiento) de
  // cualquier fila de muestra, sea la tabla del dashboard (tr[data-id]) o una
  // fila de tareas.html (li[data-list-row][data-id]).
  const doneOverrides = getTaskDoneOverrides();
  const details = getTaskDetailsOverrides();
  document.querySelectorAll('tr[data-id], [data-list-row][data-id]').forEach((row) => {
    const sample = SAMPLE_TASKS.find((t) => t.id === row.dataset.id);
    if (!sample) return;
    const det = details[sample.id];
    if (det && det.deleted) { row.remove(); return; }
    applyRowDoneState(row, doneOverrides[sample.id] ?? sample.doneDefault);
    if (det) applyTaskDataToRow(row, { ...sample, ...det });
  });
  // Tareas capturadas: van a la tabla simple del dashboard y, si existe, al
  // grupo "otras" de la lista rica de tareas.html.
  const body = document.querySelector('[data-tasks-body]');
  const extraList = document.querySelector('[data-tasks-extra]');
  const extraHd = document.querySelector('[data-group="extra"]');
  const items = getExtraTasks().map((t) => ({ ...t, ...(details[t.id] || {}) })).filter((t) => !t.deleted);
  if (body) {
    body.querySelectorAll('tr[data-extra="1"]').forEach((r) => r.remove());
    items.forEach((t) => body.appendChild(buildTaskRow(t)));
  }
  if (extraList) {
    extraList.innerHTML = '';
    items.forEach((t) => extraList.appendChild(buildTaskListItem(t)));
    extraList.hidden = items.length === 0;
    if (extraHd) extraHd.hidden = items.length === 0;
  }
}
function applyTaskDataToRow(row, task) {
  const label = row.querySelector('.label');
  if (label) label.textContent = task.label;
  const tagEl = row.querySelector('.tag');
  if (tagEl) {
    if (task.tagText) { tagEl.hidden = false; tagEl.textContent = task.tagText; tagEl.className = `tag ${task.tagClass || 'tag-outline'}`; }
    else tagEl.hidden = true;
  }
  const dueEl = row.matches('[data-list-row]') ? row.querySelector('.row-due') : row.lastElementChild;
  if (dueEl) dueEl.textContent = taskDueText(task);
}
function refreshTaskRow(id) {
  const task = getTaskById(id);
  if (!task) return;
  document.querySelectorAll(`[data-id="${id}"]`).forEach((row) => {
    if (row.matches('tr, [data-list-row]')) applyTaskDataToRow(row, task);
  });
}

// ── correo ──
function getMailStatus() { return load(STORE.mailStatus, {}); }
function countUnread() {
  const status = getMailStatus();
  return Object.keys(SAMPLE_MAIL_UNREAD_DEFAULT).filter((id) => {
    const read = status[id]?.read;
    return read === undefined ? SAMPLE_MAIL_UNREAD_DEFAULT[id] : !read;
  }).length;
}
const ACCOUNT_TAGS = {
  facultad: 'tag-accent',
  freelance: 'tag-neutral',
  personal: 'tag-outline',
  otros: 'tag-accent-2',
};
function accountTagText(acc) { return ACCOUNT_TAGS[acc] ? acc : 'personal'; }
function accountTagClass(acc) { return ACCOUNT_TAGS[acc] || 'tag-outline'; }
function renderMailStatuses() {
  const mails = document.querySelectorAll('.mail[data-id]');
  if (!mails.length) return;
  const status = getMailStatus();
  mails.forEach((mail) => {
    const s = status[mail.dataset.id];
    if (!s) return;
    if (s.read) mail.classList.remove('unread');
    if (s.tasked) {
      const btn = mail.querySelector('[data-to-task]');
      if (btn) { btn.textContent = '✓ En tareas'; btn.disabled = true; }
    }
  });
}

// ── hábitos ──
function renderHabits() {
  const overrides = load(STORE.habitOverride, {});
  document.querySelectorAll('.dots[data-habit]').forEach((dots) => {
    const ov = overrides[dots.dataset.habit];
    if (!ov) return;
    Array.from(dots.children).forEach((dot, i) => {
      if (Object.prototype.hasOwnProperty.call(ov, i)) dot.classList.toggle('on', ov[i]);
    });
  });
}
function setHabitDay(habit, day, on) {
  const overrides = load(STORE.habitOverride, {});
  overrides[habit] = overrides[habit] || {};
  overrides[habit][day] = on;
  save(STORE.habitOverride, overrides);
}

// ── notas ──
// BASE_NOTES son las de muestra (antes vivían como texto plano en el HTML);
// notas.html las lista una por una, la vista compacta de "Hoy" las junta en
// una sola línea — ambas leen de la misma fuente.
const BASE_NOTES = ['Ideas TP final', 'Resumen SO cap. 4', 'Compras'];
function getAllNotes() { return BASE_NOTES.concat(load(STORE.extraNotes, [])); }
function renderNotes() {
  const p = document.querySelector('[data-notes-text]');
  if (p) p.textContent = getAllNotes().join(' · ');
  const list = document.querySelector('[data-notes-list]');
  if (list) {
    list.innerHTML = '';
    getAllNotes().forEach((text) => {
      const row = document.createElement('div');
      row.className = 'li';
      row.textContent = text;
      list.appendChild(row);
    });
  }
}
function addNote(text) {
  const extra = load(STORE.extraNotes, []);
  extra.push(text);
  save(STORE.extraNotes, extra);
  renderNotes();
}

// ── evento del día de hoy (se repite en cada vista que marca "hoy": la
// agenda, la semana y el mes comparten [data-today]) ──
function renderEvents() {
  const cells = document.querySelectorAll('[data-today]');
  if (!cells.length) return;
  const items = load(STORE.extraEvents, []);
  cells.forEach((cell) => {
    cell.querySelectorAll('.ev[data-extra="1"]').forEach((n) => n.remove());
    items.forEach((text) => {
      const div = document.createElement('div');
      div.className = 'ev';
      div.dataset.extra = '1';
      div.textContent = text;
      cell.appendChild(div);
    });
  });
}
function addEvent(text) {
  const extra = load(STORE.extraEvents, []);
  extra.push(text);
  save(STORE.extraEvents, extra);
  renderEvents();
}

// ── badges (bandeja / tareas en el sidebar y en los headers) ──
function updateBadges() {
  document.querySelectorAll('[data-badge="unread"]').forEach((el) => { el.textContent = countUnread(); });
  document.querySelectorAll('[data-badge="tasks-open"]').forEach((el) => { el.textContent = countOpenTasks(); });
  document.querySelectorAll('[data-badge="tasks-done"]').forEach((el) => { el.textContent = countDoneTasks(); });
}

// ── captura rápida: detección de fecha/hora/destino ──
// "Hoy" en este mock es fijo (martes 14/09/2026, ver topbar) — se usa como
// referencia para que chrono-node resuelva fechas relativas ("jueves",
// "mañana", "en 3 días") de forma consistente con el resto de la app.
const TODAY_REF = new Date(2026, 8, 14, 12, 0, 0);
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function formatDue(date) { return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); }
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatFriendly(date) { return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }); }
function nextWeekday(targetIdx) {
  const d = new Date(TODAY_REF);
  const diff = (targetIdx - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}
// Respaldo propio de "día de mes" ("4 de oct", "4 octubre") para cuando
// chrono-node no está disponible (sin red, CDN caído) — así la detección de
// fechas no depende por completo de un tercero.
function parseDayOfMonth(lower) {
  const m = lower.match(/\b(\d{1,2})\s*(?:de\s+)?([a-zé]{3,})\b/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  if (day < 1 || day > 31) return null;
  const token = m[2].replace(/^set/, 'sep'); // "setiembre", variante válida
  const monthIdx = MONTHS.findIndex((mo) => mo.startsWith(token.slice(0, 3)));
  if (monthIdx < 0) return null;
  const year = TODAY_REF.getFullYear() + (monthIdx < TODAY_REF.getMonth() ? 1 : 0);
  return new Date(year, monthIdx, day, 12);
}
// Detecta fecha/hora en texto libre ("tp 4 de oct", "el jueves 18h", "mañana").
// Usa chrono-node (natural-language date parser) cuando está disponible —
// entiende fechas numéricas, nombres de mes y relativas, no solo "jueves" o
// "20h" sueltos — y si no cargó (o no reconoce nada) cae a un detector propio
// simple de día de la semana + hora.
function parseCapture(text) {
  const tag = /tp|parcial|final|c[aá]tedra|facultad/i.test(text) ? 'facultad' : null;
  if (window.chrono && typeof window.chrono.parse === 'function') {
    try {
      const [result] = window.chrono.parse(text, TODAY_REF, { forwardDate: true });
      if (result) {
        const date = result.start.date();
        const time = result.start.isCertain('hour')
          ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
          : null;
        return { date, time, tag };
      }
    } catch { /* si chrono falla por lo que sea, seguimos con el detector simple */ }
  }
  const lower = text.toLowerCase();
  const dayName = DAYS.find((d) => lower.includes(d.slice(0, 4)));
  const timeMatch = lower.match(/(\d{1,2})\s?(?:h|:\d{2})/);
  const time = timeMatch ? timeMatch[0].replace('h', ':00') : null;
  const date = dayName ? nextWeekday(DAYS.indexOf(dayName)) : parseDayOfMonth(lower);
  return { date, time, tag };
}
function selectedKind() {
  const checked = document.querySelector('[name="kind"]:checked');
  const label = checked && checked.closest('label.radio');
  return label ? label.textContent.trim() : 'Tarea';
}
function saveCapture(sourceInput) {
  const active = sourceInput || ((!dialog || dialog.hidden) ? document.querySelector('[data-capture-input]') : dialog.querySelector('[data-capture-input]'));
  const text = (active && active.value || '').trim();
  if (!text) { closeCapture(); return; }
  const { date, time, tag } = parseCapture(text);
  const kind = selectedKind();
  const dateLabel = date ? formatFriendly(date) : null;
  if (kind === 'Nota') {
    addNote(text);
  } else if (kind === 'Evento') {
    addEvent(dateLabel ? `${dateLabel}${time ? ' ' + time : ''}: ${text}` : text);
  } else {
    addTask({
      label: text,
      tagText: tag || 'personal',
      tagClass: tag ? 'tag-accent' : 'tag-outline',
      due: date ? formatDue(date) : 'sin fecha',
      dueDate: date ? isoDate(date) : '',
      meta: 'Capturada',
    });
  }
  updateBadges();
  closeCapture();
}

// ── diálogo de captura ──
const dialog = document.getElementById('capture');
function openCapture(kind) {
  if (!dialog) return;
  if (kind) {
    dialog.querySelectorAll('[name="kind"]').forEach((r) => {
      const label = r.closest('label.radio');
      r.checked = !!(label && label.textContent.trim() === kind);
    });
  }
  dialog.hidden = false;
  dialog.querySelector('.input').focus();
}
function closeCapture() {
  if (!dialog) return;
  dialog.hidden = true;
  dialog.querySelectorAll('[data-capture-input]').forEach((i) => { i.value = ''; });
  const topbarInput = document.querySelector('.topbar [data-capture-input]');
  if (topbarInput) topbarInput.value = '';
  const hint = dialog.querySelector('[data-capture-hint]');
  if (hint) hint.textContent = 'escribí fecha y hora y las detecto';
  const firstKind = dialog.querySelector('[name="kind"]');
  if (firstKind) firstKind.checked = true;
}

document.addEventListener('click', (e) => {
  const check = e.target.closest('.check');
  if (check) {
    const on = check.getAttribute('aria-pressed') === 'true';
    const next = !on;
    // Subtareas (tareas.html) e hitos (objetivos.html): listas anidadas
    // dentro del panel de edición, no filas de la lista principal.
    const subList = check.closest('#t-sub');
    const mileList = check.closest('#g-milestones');
    if (subList || mileList) {
      const li = check.closest('li');
      applyRowDoneState(li, next);
      const idx = Array.prototype.indexOf.call((subList || mileList).children, li);
      if (subList) toggleSubtask(idx, next); else toggleMilestone(idx, next);
      return;
    }
    const row = check.closest('tr, [data-list-row]');
    applyRowDoneState(row || check.parentElement, next);
    if (row && row.dataset.id) setTaskDone(row.dataset.id, next);
    updateBadges();
    return;
  }
  const dot = e.target.closest('.dots i');
  if (dot) {
    const dots = dot.closest('.dots');
    const habit = dots && dots.dataset.habit;
    const day = Array.prototype.indexOf.call(dots.children, dot);
    const on = dot.classList.toggle('on');
    if (habit) {
      setHabitDay(habit, day, on);
      refreshHabitRowStats(habit);
      if (currentDetailId === habit) loadHabitDetail(habit);
    }
    return;
  }
  const openBtn = e.target.closest('[data-open-capture]');
  if (openBtn) { openCapture(openBtn.getAttribute('data-open-capture') || undefined); return; }
  if (e.target.closest('[data-save-capture]')) { saveCapture(); return; }
  if (e.target.closest('[data-close-capture]')) { closeCapture(); return; }
  const toTask = e.target.closest('[data-to-task]');
  if (toTask) {
    const mail = toTask.closest('.mail');
    const id = mail.dataset.id;
    const status = getMailStatus();
    status[id] = { read: true, tasked: true };
    save(STORE.mailStatus, status);
    addTask({
      label: mail.dataset.subject || mail.querySelector('.subject')?.textContent || 'Correo',
      tagText: accountTagText(mail.dataset.account),
      tagClass: accountTagClass(mail.dataset.account),
      due: 'sin fecha',
      meta: 'Desde ' + (mail.dataset.sender || 'un correo'),
    });
    toTask.textContent = '✓ En tareas';
    toTask.disabled = true;
    mail.classList.remove('unread');
    updateBadges();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCapture();
  if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openCapture(); }
});

// Filtro de cuentas en la bandeja
document.querySelectorAll('[name="account"]').forEach((input) => {
  input.addEventListener('change', () => {
    const value = input.value;
    document.querySelectorAll('.mail').forEach((mail) => {
      mail.hidden = value !== 'all' && mail.dataset.account !== value;
    });
  });
});

// Calendario de "Hoy": Hoy / Semana / Mes
const RANGE_LABELS = {
  today: { title: 'hoy · martes 14 septiembre', sub: '3 eventos · TP2 en 2 días' },
  week: { title: 'semana 38', sub: '6 eventos · 2 entregas' },
  month: { title: 'septiembre 2026', sub: '22 días de cursada · 1 entrega' },
};
document.querySelectorAll('[name="range"]').forEach((input) => {
  input.addEventListener('change', () => {
    const value = input.value;
    document.querySelectorAll('[data-range]').forEach((el) => {
      const active = el.dataset.range === value;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-hidden', String(!active));
    });
    const label = RANGE_LABELS[value];
    if (!label) return;
    const title = document.querySelector('[data-range-title]');
    const sub = document.querySelector('[data-range-sub]');
    if (title) title.textContent = label.title;
    if (sub) sub.textContent = label.sub;
  });
});

// Vista semana / día en el horario
document.querySelectorAll('[name="schedule-view"]').forEach((input) => {
  input.addEventListener('change', () => {
    const week = document.querySelector('.week');
    const list = document.querySelector('.sched');
    if (!week || !list) return;
    const isWeek = input.value === 'week';
    week.style.display = isWeek ? '' : 'none';
    list.style.display = isWeek ? 'none' : '';
  });
});

// Captura rápida: hint en vivo + Enter para guardar
document.querySelectorAll('[data-capture-input]').forEach((input) => {
  input.addEventListener('input', () => {
    const hint = document.querySelector('[data-capture-hint]');
    if (!hint) return;
    const { date, time, tag } = parseCapture(input.value);
    const bits = [];
    if (date) bits.push(formatFriendly(date));
    if (time) bits.push(time);
    if (tag) bits.push('destino Facultad');
    hint.textContent = bits.length ? 'detectado: ' + bits.join(' · ') : 'escribí fecha y hora y las detecto';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveCapture(input); }
  });
});

// Selección de fila en las pantallas de gestión (tareas, notas, hábitos,
// objetivos): además de resaltarla, carga sus datos reales en el panel de
// edición de la derecha (antes siempre mostraba el mismo ítem de muestra,
// sin importar en cuál se hiciera click).
document.addEventListener('click', (e) => {
  const row = e.target.closest('[data-list-row]');
  if (!row || e.target.closest('.check') || e.target.closest('.btn')) return;
  const list = row.closest('.split-list');
  if (list) list.querySelectorAll('[data-list-row]').forEach((r) => r.classList.remove('is-active'));
  row.classList.add('is-active');
  if (row.dataset.id) loadDetailForId(row.dataset.id);
});

// Chips de selección múltiple (etiquetas, días, "alimentado por", etc.) o
// exclusiva de a una (data-chips-exclusive: Lista de una tarea, filtro de
// notas por etiqueta) — en ese caso, elegir una desmarca las demás.
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-add-tag]')) { addNoteTag(e.target.closest('[data-add-tag]')); return; }
  const chip = e.target.closest('.chips .tag');
  if (!chip) return;
  const exclusiveGroup = chip.closest('[data-chips-exclusive]');
  if (exclusiveGroup) {
    exclusiveGroup.querySelectorAll('.tag').forEach((c) => {
      const on = c === chip;
      c.setAttribute('aria-pressed', String(on));
      c.classList.toggle('tag-accent', on);
      c.classList.toggle('tag-outline', !on);
    });
  } else {
    const on = chip.getAttribute('aria-pressed') === 'true';
    chip.setAttribute('aria-pressed', String(!on));
    chip.classList.toggle('tag-accent', !on);
    chip.classList.toggle('tag-outline', on);
  }
  const noteFilter = chip.closest('[data-chips-filter="notes"]');
  if (noteFilter) filterNotes();
});

// ════════════════════════════════════════════════════════════════════════
// Pantallas de gestión (tareas.html, notas.html, habitos.html,
// objetivos.html): antes de esto, el panel de la derecha era 100% decorativo
// — mostraba siempre el mismo ítem de muestra sin importar qué fila se
// seleccionara, y Guardar/Descartar/Eliminar no hacían nada. Todo lo que
// sigue lo conecta de verdad: seleccionar una fila carga sus datos reales,
// editar y Guardar los persiste y actualiza la fila, los checklists
// (subtareas, hitos) cuentan y persisten, los filtros filtran de verdad.
// ════════════════════════════════════════════════════════════════════════
const PAGE_KIND = document.getElementById('t-title') ? 'tasks'
  : document.querySelector('.note-title') ? 'notes'
  : document.getElementById('h-name') ? 'habits'
  : document.getElementById('g-name') ? 'goals'
  : null;
let currentDetailId = null;

// ── helpers genéricos de formulario ──
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function setSegValue(containerId, value) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll('input[type="radio"]').forEach((r) => { r.checked = r.value === value; });
}
function getSegValue(containerId) {
  const el = document.getElementById(containerId);
  const checked = el && el.querySelector('input[type="radio"]:checked');
  return checked ? checked.value : null;
}
function setChipsExclusive(containerId, value) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll('.tag').forEach((c) => {
    const on = c.dataset.value === value;
    c.setAttribute('aria-pressed', String(on));
    c.classList.toggle('tag-accent', on);
    c.classList.toggle('tag-outline', !on);
  });
}
function getChipsExclusiveValue(containerId) {
  const el = document.getElementById(containerId);
  const active = el && el.querySelector('.tag[aria-pressed="true"]');
  return active ? active.dataset.value : null;
}
function setChipsMulti(containerId, values) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll('.tag').forEach((c) => {
    const on = (values || []).includes(c.dataset.value);
    c.setAttribute('aria-pressed', String(on));
    c.classList.toggle('tag-accent', on);
    c.classList.toggle('tag-outline', !on);
  });
}
function getChipsMultiValues(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  return Array.from(el.querySelectorAll('.tag[aria-pressed="true"]')).map((c) => c.dataset.value);
}
function nowHM() { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function flashSaved() {
  const hd = document.querySelector('.detail-hd .k');
  if (!hd) return;
  const original = hd.textContent;
  hd.textContent = '✓ guardado';
  setTimeout(() => { if (hd.textContent === '✓ guardado') hd.textContent = original; }, 1200);
}
function loadDetailForId(id) {
  if (PAGE_KIND === 'tasks') loadTaskDetail(id);
  else if (PAGE_KIND === 'notes') loadNoteDetail(id);
  else if (PAGE_KIND === 'habits') loadHabitDetail(id);
  else if (PAGE_KIND === 'goals') loadGoalDetail(id);
}
function selectRowById(id) {
  const row = document.querySelector(`[data-list-row][data-id="${id}"]`);
  if (!row) return;
  document.querySelectorAll('.split-list [data-list-row]').forEach((r) => r.classList.remove('is-active'));
  row.classList.add('is-active');
  row.scrollIntoView({ block: 'nearest' });
}
function selectFirstRow() {
  const row = document.querySelector('.split-list [data-list-row].is-active:not([hidden])')
    || document.querySelector('.split-list [data-list-row]:not([hidden])');
  if (row) { row.classList.add('is-active'); if (row.dataset.id) loadDetailForId(row.dataset.id); }
}
function updateGroupVisibility(scope) {
  (scope || document).querySelectorAll('.split-list .rows').forEach((ul) => {
    const hd = ul.previousElementSibling;
    if (!hd || !hd.classList.contains('group-hd')) return;
    const anyVisible = Array.from(ul.children).some((li) => !li.hidden);
    hd.hidden = !anyVisible;
  });
}

// ── tareas.html: panel de edición, checklist de subtareas, filtros ──
function renderSubtasks(subs) {
  const ul = document.getElementById('t-sub');
  if (!ul) return;
  ul.innerHTML = '';
  subs.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'row';
    li.innerHTML = `<button class="check" aria-pressed="${s.done}" aria-label="Completar"></button><span class="label${s.done ? ' done' : ''}">${escapeHtml(s.label)}</span>`;
    ul.appendChild(li);
  });
  updateSubCount(subs);
}
function updateSubCount(subs) {
  const el = document.querySelector('[data-sub-count]');
  if (el) el.textContent = `${subs.filter((s) => s.done).length} de ${subs.length}`;
}
function toggleSubtask(idx, done) {
  if (!currentDetailId) return;
  const t = getTaskById(currentDetailId);
  const subs = (t.subtasks || []).map((s, i) => (i === idx ? { ...s, done } : s));
  saveTaskDetailOverride(currentDetailId, { subtasks: subs });
  updateSubCount(subs);
}
function loadTaskDetail(id) {
  const t = getTaskById(id);
  if (!t) return;
  currentDetailId = id;
  setVal('t-title', t.label);
  setVal('t-notes', t.notes || '');
  setVal('t-due', t.dueDate || '');
  setVal('t-time', t.dueTime || '');
  setSegValue('t-prio', t.priority || 'Media');
  setChipsExclusive('t-list', t.list || 'personal');
  renderSubtasks(t.subtasks || []);
}
function saveTaskDetail() {
  if (!currentDetailId) return;
  const id = currentDetailId;
  const label = (document.getElementById('t-title')?.value || '').trim();
  if (!label) return;
  const notes = document.getElementById('t-notes')?.value || '';
  const dueDate = document.getElementById('t-due')?.value || '';
  const dueTime = document.getElementById('t-time')?.value || '';
  const priority = getSegValue('t-prio') || 'Media';
  const list = getChipsExclusiveValue('t-list') || 'personal';
  saveTaskDetailOverride(id, { label, notes, dueDate, dueTime, priority, list, tagText: list, tagClass: TASK_LIST_TAG[list] || 'tag-outline' });
  refreshTaskRow(id);
  updateTaskSummary();
  updateBadges();
  flashSaved();
}
function discardTaskDetail() { if (currentDetailId) loadTaskDetail(currentDetailId); }
function deleteTaskDetail() {
  if (!currentDetailId || !confirm('¿Eliminar esta tarea?')) return;
  saveTaskDetailOverride(currentDetailId, { deleted: true });
  document.querySelectorAll(`[data-id="${currentDetailId}"]`).forEach((el) => { if (el.matches('[data-list-row]')) el.remove(); });
  currentDetailId = null;
  updateTaskSummary();
  updateBadges();
  selectFirstRow();
}
function duplicateTaskDetail() {
  if (!currentDetailId) return;
  const t = getTaskById(currentDetailId);
  if (!t) return;
  const id = addTask({ label: t.label + ' (copia)', tagText: t.tagText, tagClass: t.tagClass, due: t.due, dueDate: t.dueDate, meta: t.meta });
  saveTaskDetailOverride(id, { notes: t.notes, priority: t.priority, list: t.list, subtasks: (t.subtasks || []).map((s) => ({ ...s })), dueTime: t.dueTime });
  renderTasksTable();
  updateTaskSummary();
  selectRowById(id);
  loadTaskDetail(id);
}
function updateTaskSummary() {
  const el = document.querySelector('[data-tasks-done-count]');
  if (el) el.textContent = countDoneTasks();
}
function applyTaskFilters() {
  const statusInput = document.querySelector('[name="task-view"]:checked');
  const status = statusInput ? statusInput.value : 'open';
  const q = (document.querySelector('[data-search="tasks"]')?.value || '').toLowerCase().trim();
  document.querySelectorAll('.split-list [data-list-row][data-id]').forEach((row) => {
    const task = getTaskById(row.dataset.id);
    if (!task) { row.hidden = false; return; }
    let show = true;
    if (status === 'open') show = !task.done;
    else if (status === 'done') show = task.done;
    else if (status === 'today') show = task.dueDate === isoDate(TODAY_REF);
    if (show && q) show = task.label.toLowerCase().includes(q);
    row.hidden = !show;
  });
  updateGroupVisibility();
}
function importFromBandeja() {
  // No dependemos de tener bandeja.html abierta: usamos el mismo mapeo
  // cuenta→tag que "→ Tarea" ahí, leyendo el estado real persistido de los
  // mails (cuáles siguen sin leer y todavía no se pasaron a tareas).
  const status = getMailStatus();
  const pending = Object.keys(SAMPLE_MAIL_INFO).filter((id) => {
    const s = status[id] || {};
    const stillUnread = s.read === undefined ? SAMPLE_MAIL_UNREAD_DEFAULT[id] : !s.read;
    return stillUnread && !s.tasked;
  });
  if (!pending.length) { alert('No hay correos sin leer para importar.'); return; }
  pending.forEach((id) => {
    status[id] = { ...(status[id] || {}), tasked: true };
    const info = SAMPLE_MAIL_INFO[id];
    addTask({ label: info.subject, tagText: accountTagText(info.account), tagClass: accountTagClass(info.account), due: 'sin fecha', meta: 'Importada de Bandeja' });
  });
  save(STORE.mailStatus, status);
  renderTasksTable();
  updateBadges();
  alert(`${pending.length} tarea(s) importada(s) desde Bandeja.`);
}
const SAMPLE_MAIL_INFO = {
  m1: { subject: 'Inscripción a finales — apertura 20/09', account: 'facultad' },
  m2: { subject: 'Re: presupuesto sitio — adjunto', account: 'freelance' },
  m3: { subject: 'TP2: consigna corregida', account: 'facultad' },
  m4: { subject: 'Vence tu préstamo el 18/09', account: 'otros' },
  m5: { subject: 'Domingo en casa', account: 'personal' },
  m6: { subject: 'Material unidad 5', account: 'facultad' },
};

// ── notas.html: autoguardado, etiquetas, filtros, exportar, markdown ──
const SAMPLE_NOTES = [
  { id: 'n1', title: 'Resumen SO — capítulo 4', tagText: 'facultad', tagClass: 'tag-accent', due: 'hoy', pinned: true, tags: ['facultad', 'SO'], linked: 'Sist. Operativos · miércoles 10:00',
    body: '## Planificación de procesos\n\n**FCFS** — simple, sin inanición, mal tiempo de respuesta con procesos largos adelante.\n**SJF** — óptimo en tiempo medio de espera, necesita estimar la duración.\n**Round robin** — quantum chico = más cambios de contexto = más overhead.\n\n- [ ] Rehacer el ejercicio 7 con quantum 4 ms\n- [x] Tabla comparativa de los tres algoritmos\n\n> Un proceso es un programa en ejecución, con su contador, registros y variables.\n\nPreguntar en clase: ¿cómo se mide el overhead del cambio de contexto en la práctica?' },
  { id: 'n2', title: 'Ideas TP final', tagText: 'ideas', tagClass: 'tag-neutral', due: '12/09', pinned: true, tags: ['ideas'], linked: '',
    body: 'Tablero de materias con scraping del SIU + recordatorios de parciales.' },
  { id: 'n3', title: 'Compras', tagText: 'personal', tagClass: 'tag-outline', due: '11/09', pinned: true, tags: ['personal'], linked: '', body: 'Cuaderno A4, cargador, café.' },
  { id: 'n4', title: 'Consultas para la cátedra de BD', tagText: 'facultad', tagClass: 'tag-accent', due: '13/09', pinned: false, tags: ['facultad'], linked: '', body: '¿El diagrama ER va con notación Chen o crow’s foot?' },
  { id: 'n5', title: 'Diario — semana difícil', tagText: 'diario', tagClass: 'tag-outline', due: '13/09', pinned: false, tags: ['diario'], linked: '', body: 'Dormí poco tres días. Bajar la carga del viernes.' },
  { id: 'n6', title: 'Tanenbaum, cap. 2 — subrayados', tagText: 'lectura', tagClass: 'tag-outline', due: '10/09', pinned: false, tags: ['lectura'], linked: '', body: '"Un proceso es un programa en ejecución", más el modelo de cinco estados.' },
  { id: 'n7', title: 'Inglés — vocabulario técnico', tagText: 'facultad', tagClass: 'tag-accent', due: '09/09', pinned: false, tags: ['facultad'], linked: '', body: 'deadlock, throughput, overhead, bottleneck.' },
];
function getNoteDetailsOverrides() { return load(STORE.noteDetails, {}); }
function saveNoteDetailOverride(id, patch) {
  const overrides = getNoteDetailsOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...patch };
  save(STORE.noteDetails, overrides);
}
function getExtraNoteItems() { return load(STORE.extraNoteItems, []); }
function getNoteById(id) {
  const sample = SAMPLE_NOTES.find((n) => n.id === id);
  const extra = getExtraNoteItems().find((n) => n.id === id);
  const base = sample || extra;
  if (!base) return null;
  return { ...base, ...(getNoteDetailsOverrides()[id] || {}) };
}
function getAllNoteItems() {
  const det = getNoteDetailsOverrides();
  return SAMPLE_NOTES.map((n) => ({ ...n, ...det[n.id] }))
    .concat(getExtraNoteItems().map((n) => ({ ...n, ...det[n.id] })))
    .filter((n) => !n.deleted);
}
function loadNoteDetail(id) {
  const n = getNoteById(id);
  if (!n) return;
  currentDetailId = id;
  setVal('n-title', n.title);
  setVal('n-body', n.body || '');
  const status = document.querySelector('[data-note-status]');
  if (status) status.textContent = 'editando · guardado ' + nowHM();
  const linked = document.querySelector('[data-note-linked]');
  if (linked) linked.textContent = n.linked || '—';
  const pinBtn = document.querySelector('[data-pin-note]');
  if (pinBtn) pinBtn.setAttribute('aria-pressed', String(!!n.pinned));
  const tagsWrap = document.getElementById('n-tags');
  if (tagsWrap) {
    tagsWrap.querySelectorAll('.tag').forEach((c) => { if (!c.hasAttribute('data-add-tag')) c.remove(); });
    const addBtn = tagsWrap.querySelector('[data-add-tag]');
    (n.tags || []).forEach((t) => {
      const btn = document.createElement('button');
      btn.className = 'tag tag-accent';
      btn.setAttribute('aria-pressed', 'true');
      btn.textContent = t;
      tagsWrap.insertBefore(btn, addBtn);
    });
  }
}
let noteSaveTimer = null;
function scheduleNoteAutosave() {
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(saveCurrentNote, 400);
}
function saveCurrentNote() {
  if (!currentDetailId) return;
  const title = document.getElementById('n-title')?.value.trim() || 'Sin título';
  const body = document.getElementById('n-body')?.value || '';
  const tags = Array.from(document.querySelectorAll('#n-tags .tag')).filter((c) => !c.hasAttribute('data-add-tag')).map((c) => c.textContent.trim());
  saveNoteDetailOverride(currentDetailId, { title, body, tags, tagText: tags[0] || '' });
  refreshNoteRow(currentDetailId);
  const status = document.querySelector('[data-note-status]');
  if (status) status.textContent = `editando · guardado ${nowHM()}`;
}
function refreshNoteRow(id) {
  const n = getNoteById(id);
  if (!n) return;
  document.querySelectorAll(`[data-id="${id}"][data-list-row]`).forEach((row) => {
    const label = row.querySelector('.label');
    if (label) label.textContent = n.title;
    const meta = row.querySelector('.row-meta');
    if (meta) meta.textContent = (n.body || '').replace(/^#+\s*/, '').split('\n').find((l) => l.trim()) || '';
    row.dataset.tag = (n.tags && n.tags[0]) || '';
  });
}
function addNoteTag(btn) {
  const name = prompt('Nueva etiqueta:');
  if (!name || !name.trim()) return;
  const el = document.createElement('button');
  el.className = 'tag tag-accent';
  el.setAttribute('aria-pressed', 'true');
  el.textContent = name.trim();
  btn.parentElement.insertBefore(el, btn);
  scheduleNoteAutosave();
}
function toggleNotePin() {
  if (!currentDetailId) return;
  const n = getNoteById(currentDetailId);
  saveNoteDetailOverride(currentDetailId, { pinned: !n.pinned });
  const btn = document.querySelector('[data-pin-note]');
  if (btn) btn.setAttribute('aria-pressed', String(!n.pinned));
}
function deleteNoteDetail() {
  if (!currentDetailId || !confirm('¿Eliminar esta nota?')) return;
  saveNoteDetailOverride(currentDetailId, { deleted: true });
  document.querySelectorAll(`[data-id="${currentDetailId}"]`).forEach((el) => { if (el.matches('[data-list-row]')) el.remove(); });
  currentDetailId = null;
  selectFirstRow();
}
function duplicateNoteDetail() {
  if (!currentDetailId) return;
  const n = getNoteById(currentDetailId);
  if (!n) return;
  const items = getExtraNoteItems();
  const id = 'xn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  items.push({ ...n, id, title: n.title + ' (copia)', pinned: false });
  save(STORE.extraNoteItems, items);
  renderExtraNotesList();
  selectRowById(id);
  loadNoteDetail(id);
}
function noteToTask() {
  if (!currentDetailId) return;
  const n = getNoteById(currentDetailId);
  if (!n) return;
  addTask({ label: n.title, tagText: (n.tags && n.tags[0]) || 'personal', tagClass: 'tag-outline', due: 'sin fecha', meta: 'Desde nota "' + n.title + '"' });
  alert('Se creó una tarea a partir de esta nota.');
}
function insertMarkdown(kind) {
  const ta = document.getElementById('n-body');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end) || 'texto';
  let text = selected;
  if (kind === 'bold') text = `**${selected}**`;
  else if (kind === 'italic') text = `*${selected}*`;
  else if (kind === 'h2') text = `\n## ${selected}\n`;
  else if (kind === 'list') text = selected.split('\n').map((l) => `- ${l}`).join('\n');
  else if (kind === 'checklist') text = selected.split('\n').map((l) => `- [ ] ${l}`).join('\n');
  else if (kind === 'code') text = `\`${selected}\``;
  ta.focus();
  ta.setRangeText(text, start, end, 'end');
  scheduleNoteAutosave();
}
function exportNotesMd() {
  const notes = getAllNoteItems();
  const md = notes.map((n) => `# ${n.title}\n\n${n.body || ''}\n`).join('\n---\n\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notas.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function buildNoteListItem(n) {
  const li = document.createElement('li');
  li.className = 'row note-row';
  li.dataset.listRow = '';
  li.dataset.id = n.id;
  li.dataset.tag = (n.tags && n.tags[0]) || '';
  li.innerHTML =
    `<div class="row-body"><span class="label">${escapeHtml(n.title)}</span>` +
    `<span class="row-meta mut">${escapeHtml((n.body || '').slice(0, 90))}</span></div>` +
    (n.tags && n.tags[0] ? `<span class="tag tag-outline">${escapeHtml(n.tags[0])}</span>` : '') +
    `<span class="row-due mut num">${escapeHtml(n.due || '')}</span>`;
  return li;
}
function renderExtraNotesList() {
  const list = document.querySelector('[data-notes-extra]');
  const hd = document.querySelector('[data-group="extra"]');
  if (!list) return;
  const det = getNoteDetailsOverrides();
  const items = getExtraNoteItems().map((n) => ({ ...n, ...det[n.id] })).filter((n) => !n.deleted);
  list.innerHTML = '';
  items.forEach((n) => list.appendChild(buildNoteListItem(n)));
  list.hidden = items.length === 0;
  if (hd) hd.hidden = items.length === 0;
}
function filterNotes() {
  const q = (document.querySelector('[data-search="notes"]')?.value || '').toLowerCase().trim();
  const activeChip = document.querySelector('[data-chips-filter="notes"] .tag[aria-pressed="true"]');
  const tag = activeChip ? activeChip.dataset.value : 'todas';
  document.querySelectorAll('.split-list .note-row').forEach((row) => {
    let show = tag === 'todas' || row.dataset.tag === tag;
    if (show && q) show = (row.querySelector('.label')?.textContent.toLowerCase() || '').includes(q);
    row.hidden = !show;
  });
  updateGroupVisibility();
}

// ── habitos.html: streak/cumplimiento en vivo, pausar, nuevo hábito ──
const SAMPLE_HABITS = [
  { id: 'h-correr', name: 'Correr', schedule: 'lun, mié, vie', record: 21, goal: '5 km', reminder: '07:00', freq: 'Días fijos', days: ['L', 'M2', 'V'], type: 'Cantidad' },
  { id: 'h-leer', name: 'Leer 30 min', schedule: 'todos los días', record: 33, goal: '30 min', reminder: '21:00', freq: 'Diario', days: ['L', 'M1', 'M2', 'J', 'V', 'S', 'D'], type: 'Tiempo' },
  { id: 'h-meditar', name: 'Meditar', schedule: 'todos los días', record: 11, goal: '10 min', reminder: '08:00', freq: 'Diario', days: ['L', 'M1', 'M2', 'J', 'V', 'S', 'D'], type: 'Tiempo' },
  { id: 'h-estudiar', name: 'Estudiar 1 h', schedule: 'lun a vie', record: 14, goal: '1 h', reminder: '19:00', freq: 'Días fijos', days: ['L', 'M1', 'M2', 'J', 'V'], type: 'Tiempo' },
  { id: 'h-ingles', name: 'Inglés — 3 sesiones', schedule: '3 por semana', record: 9, goal: '1 sesión', reminder: '20:00', freq: 'N por semana', days: ['L', 'M2', 'V'], type: 'Sí / no' },
  { id: 'h-finanzas', name: 'Revisar finanzas', schedule: 'domingos', record: 12, goal: '—', reminder: '10:00', freq: 'Días fijos', days: ['D'], type: 'Sí / no' },
  { id: 'h-nadar', name: 'Nadar', schedule: 'martes y jueves', record: 8, goal: '1 km', reminder: '07:30', freq: 'Días fijos', days: ['M2', 'J'], type: 'Cantidad', paused: true },
  { id: 'h-dibujar', name: 'Dibujar', schedule: 'libre', record: 5, goal: '30 min', reminder: '', freq: 'N por semana', days: [], type: 'Tiempo', paused: true },
];
function getHabitDetailsOverrides() { return load(STORE.habitDetails, {}); }
function saveHabitDetailOverride(id, patch) {
  const overrides = getHabitDetailsOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...patch };
  save(STORE.habitDetails, overrides);
}
function getExtraHabits() { return load(STORE.extraHabits, []); }
function getHabitById(id) {
  const sample = SAMPLE_HABITS.find((h) => h.id === id);
  const extra = getExtraHabits().find((h) => h.id === id);
  const base = sample || extra;
  if (!base) return null;
  return { ...base, ...(getHabitDetailsOverrides()[id] || {}) };
}
function habitStats(habitKey) {
  const dots = document.querySelector(`.dots[data-habit="${habitKey}"]`);
  if (!dots) return { streak: 0, compliance: 0, states: [] };
  const states = Array.from(dots.children).map((i) => i.classList.contains('on'));
  const compliance = states.length ? Math.round((states.filter(Boolean).length / states.length) * 100) : 0;
  let streak = 0;
  for (let i = states.length - 1; i >= 0 && states[i]; i--) streak++;
  return { streak, compliance, states };
}
function refreshHabitRowStats(habitKey) {
  const row = document.querySelector(`[data-list-row][data-id="${habitKey}"]`);
  const seed = getHabitById(habitKey);
  if (!row || !seed) return;
  const { streak, compliance } = habitStats(habitKey);
  const dueEl = row.querySelector('.row-due');
  if (dueEl) dueEl.textContent = `${compliance}%`;
  const metaEl = row.querySelector('[data-habit-meta]');
  if (metaEl) metaEl.textContent = `${seed.schedule} · racha ${streak} días · récord ${seed.record} días`;
}
function loadHabitDetail(id) {
  const h = getHabitById(id);
  if (!h) return;
  currentDetailId = id;
  setVal('h-name', h.name);
  setVal('h-goal', h.goal || '');
  setVal('h-time', h.reminder || '');
  setSegValue('h-freq', h.freq || 'Diario');
  setSegValue('h-type', h.type || 'Cantidad');
  setChipsMulti('h-days', h.days || []);
  const { streak, compliance, states } = habitStats(id);
  const streakEl = document.querySelector('[data-habit-streak]');
  if (streakEl) streakEl.textContent = `${streak} días`;
  const compEl = document.querySelector('[data-habit-compliance]');
  if (compEl) compEl.textContent = `${compliance}%`;
  const barEl = document.querySelector('[data-habit-bar]');
  if (barEl) barEl.style.width = `${compliance}%`;
  const monthWrap = document.getElementById('h-month-dots');
  if (monthWrap) {
    monthWrap.innerHTML = '';
    states.forEach((on) => {
      const i = document.createElement('i');
      if (on) i.className = 'on';
      monthWrap.appendChild(i);
    });
  }
  const monthNote = document.querySelector('[data-habit-month-note]');
  if (monthNote) monthNote.textContent = `${states.filter(Boolean).length} de ${states.length} días marcados`;
  const pauseBtn = document.querySelector('[data-pause-habit]');
  if (pauseBtn) pauseBtn.setAttribute('aria-pressed', String(!!h.paused));
}
function saveHabitDetail() {
  if (!currentDetailId) return;
  const id = currentDetailId;
  const name = (document.getElementById('h-name')?.value || '').trim();
  if (!name) return;
  const goal = document.getElementById('h-goal')?.value || '';
  const reminder = document.getElementById('h-time')?.value || '';
  const freq = getSegValue('h-freq') || 'Diario';
  const type = getSegValue('h-type') || 'Cantidad';
  const days = getChipsMultiValues('h-days');
  saveHabitDetailOverride(id, { name, goal, reminder, freq, type, days });
  const row = document.querySelector(`[data-list-row][data-id="${id}"]`);
  if (row) { const label = row.querySelector('.label'); if (label) label.textContent = name; }
  flashSaved();
}
function discardHabitDetail() { if (currentDetailId) loadHabitDetail(currentDetailId); }
function deleteHabitDetail() {
  if (!currentDetailId || !confirm('¿Eliminar este hábito?')) return;
  saveHabitDetailOverride(currentDetailId, { deleted: true });
  document.querySelectorAll(`[data-id="${currentDetailId}"]`).forEach((el) => { if (el.matches('[data-list-row]')) el.remove(); });
  currentDetailId = null;
  selectFirstRow();
}
function togglePauseHabit() {
  if (!currentDetailId) return;
  const h = getHabitById(currentDetailId);
  const next = !h.paused;
  saveHabitDetailOverride(currentDetailId, { paused: next });
  const row = document.querySelector(`[data-list-row][data-id="${currentDetailId}"]`);
  if (row) row.classList.toggle('is-paused', next);
  const btn = document.querySelector('[data-pause-habit]');
  if (btn) btn.setAttribute('aria-pressed', String(next));
}
function reactivateHabit(id) {
  saveHabitDetailOverride(id, { paused: false });
  const row = document.querySelector(`[data-list-row][data-id="${id}"]`);
  if (row) row.classList.remove('is-paused');
}
function renderHabitPauseStates() {
  const det = getHabitDetailsOverrides();
  document.querySelectorAll('[data-list-row][data-id^="h-"]').forEach((row) => {
    const id = row.dataset.id;
    if (det[id]?.deleted) { row.remove(); return; }
    if (det[id]?.paused ?? SAMPLE_HABITS.find((h) => h.id === id)?.paused) row.classList.add('is-paused');
  });
}
function buildHabitListItem(h) {
  const li = document.createElement('li');
  li.className = 'row habit-row';
  li.dataset.listRow = '';
  li.dataset.id = h.id;
  li.innerHTML =
    `<button class="check" aria-pressed="false" aria-label="Marcar hoy"></button>` +
    `<div class="row-body"><span class="label">${escapeHtml(h.name)}</span>` +
    `<span class="row-meta mut" data-habit-meta>${escapeHtml(h.schedule)} · racha 0 días · récord 0 días</span>` +
    `<div class="dots wide" data-habit="${h.id}">${'<i></i>'.repeat(30)}</div></div>` +
    `<span class="row-due mut num">0%</span>`;
  return li;
}
function createNewHabit() {
  const name = prompt('Nombre del hábito:', 'Nuevo hábito');
  if (!name || !name.trim()) return;
  const id = 'xh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const habit = { id, name: name.trim(), schedule: 'todos los días', record: 0, goal: '', reminder: '', freq: 'Diario', days: [], type: 'Sí / no' };
  const extra = getExtraHabits();
  extra.push(habit);
  save(STORE.extraHabits, extra);
  const firstGroup = document.querySelector('.split-list .rows');
  if (firstGroup) firstGroup.appendChild(buildHabitListItem(habit));
  selectRowById(id);
  loadHabitDetail(id);
}
function viewHabitHistory() {
  const ids = SAMPLE_HABITS.filter((h) => !h.paused).map((h) => h.id).concat(getExtraHabits().map((h) => h.id));
  const det = getHabitDetailsOverrides();
  const active = ids.filter((id) => !(det[id]?.paused) && !(det[id]?.deleted));
  const values = active.map((id) => habitStats(id).compliance);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  alert(`Cumplimiento promedio de los últimos 30 días: ${avg}% sobre ${values.length} hábito(s) activo(s).`);
}

// ── objetivos.html: hitos, medición, archivar, cerrar cuatrimestre ──
const SAMPLE_GOALS = [
  { id: 'g1', title: 'Aprobar 4 materias', why: 'Cerrar el año con las cuatro del cuatrimestre para poder cursar Redes en marzo.', target: 4, current: 2, start: '2026-08-10', end: '2026-12-19', measure: 'Cantidad', unit: 'plain', tagText: 'facultad', tagClass: 'tag-accent', meta: '2 aprobadas · Álgebra II y BD rinden en diciembre', milestones: [{ label: 'Inglés Técnico — aprobada 05/09', done: true }, { label: 'Álgebra II — parcial 1 aprobado', done: true }, { label: 'Bases de Datos — final 12/12', done: false }, { label: 'Sist. Operativos — final 19/12', done: false }], status: 'curso' },
  { id: 'g2', title: 'Leer 12 libros', why: 'Volver al ritmo de lectura de antes de la facultad.', target: 12, current: 7, start: '2026-08-01', end: '2026-12-19', measure: 'Cantidad', unit: 'plain', tagText: 'personal', tagClass: 'tag-outline', meta: '7 terminados · vas 1 libro adelantada', milestones: [], status: 'curso' },
  { id: 'g3', title: 'Correr 300 km', why: 'Llegar entrenada a la 10k de noviembre.', target: 300, current: 186, start: '2026-08-01', end: '2026-12-19', measure: 'Cantidad', unit: 'plain', tagText: 'salud', tagClass: 'tag-neutral', meta: '186 km · 8,2 km por semana necesarios', milestones: [], status: 'curso' },
  { id: 'g4', title: 'Ahorrar $480.000', why: 'Cubrir el viaje de fin de cuatrimestre.', target: 480000, current: 295000, start: '2026-08-01', end: '2026-12-19', measure: 'Cantidad', unit: 'money', tagText: 'finanzas', tagClass: 'tag-outline', meta: '$295.000 · $13.000 por semana', milestones: [], status: 'curso' },
  { id: 'g5', title: 'Inglés B2', why: 'Necesario para la beca del último año.', target: 40, current: 24, start: '2026-08-01', end: '2026-12-19', measure: 'Cantidad', unit: 'plain', tagText: 'facultad', tagClass: 'tag-accent', meta: '24 de 40 sesiones hechas', milestones: [], status: 'curso' },
  { id: 'g6', title: 'Meditar 100 días', why: 'Bajar el estrés en época de parciales.', target: 100, current: 38, start: '2026-08-01', end: '2026-12-19', measure: 'Cantidad', unit: 'plain', tagText: 'salud', tagClass: 'tag-neutral', meta: '38 días · el ritmo actual llega a 71', milestones: [], status: 'riesgo' },
];
function getGoalDetailsOverrides() { return load(STORE.goalDetails, {}); }
function saveGoalDetailOverride(id, patch) {
  const overrides = getGoalDetailsOverrides();
  overrides[id] = { ...(overrides[id] || {}), ...patch };
  save(STORE.goalDetails, overrides);
}
function getExtraGoals() { return load(STORE.extraGoals, []); }
function getGoalById(id) {
  const sample = SAMPLE_GOALS.find((g) => g.id === id);
  const extra = getExtraGoals().find((g) => g.id === id);
  const base = sample || extra;
  if (!base) return null;
  return { ...base, ...(getGoalDetailsOverrides()[id] || {}) };
}
function formatGoalValue(g, val) { return g.unit === 'money' ? `$${Math.round(val / 1000)}k` : String(val); }
function goalDisplay(g) {
  if (g.measure === 'Hito' && g.milestones && g.milestones.length) {
    const done = g.milestones.filter((m) => m.done).length;
    return { pct: Math.round((done / g.milestones.length) * 100), text: `${done} / ${g.milestones.length}` };
  }
  const pct = g.target ? Math.round((g.current / g.target) * 100) : 0;
  const text = g.measure === 'Porcentaje' ? `${g.current}%` : `${formatGoalValue(g, g.current)} / ${formatGoalValue(g, g.target)}`;
  return { pct, text };
}
function refreshGoalRow(id) {
  const g = getGoalById(id);
  if (!g) return;
  const { pct, text } = goalDisplay(g);
  document.querySelectorAll(`[data-id="${id}"][data-list-row]`).forEach((row) => {
    const label = row.querySelector('.label');
    if (label) label.textContent = g.title;
    const num = row.querySelector('.goal-hd .num');
    if (num) num.textContent = text;
    const bar = row.querySelector('.bar > span');
    if (bar) bar.style.width = `${Math.min(pct, 100)}%`;
  });
}
function renderMilestones(miles) {
  const ul = document.getElementById('g-milestones');
  if (!ul) return;
  ul.innerHTML = '';
  miles.forEach((m) => {
    const li = document.createElement('li');
    li.className = 'row';
    li.innerHTML = `<button class="check" aria-pressed="${m.done}" aria-label="Completar"></button><span class="label${m.done ? ' done' : ''}">${escapeHtml(m.label)}</span>`;
    ul.appendChild(li);
  });
  updateMileCount(miles);
}
function updateMileCount(miles) {
  const el = document.querySelector('[data-mile-count]');
  if (el) el.textContent = `${miles.filter((m) => m.done).length} de ${miles.length}`;
}
function toggleMilestone(idx, done) {
  if (!currentDetailId) return;
  const g = getGoalById(currentDetailId);
  const miles = (g.milestones || []).map((m, i) => (i === idx ? { ...m, done } : m));
  saveGoalDetailOverride(currentDetailId, { milestones: miles });
  updateMileCount(miles);
  if (g.measure === 'Hito') { refreshGoalRow(currentDetailId); loadGoalDetail(currentDetailId); }
}
function loadGoalDetail(id) {
  const g = getGoalById(id);
  if (!g) return;
  currentDetailId = id;
  setVal('g-name', g.title);
  setVal('g-why', g.why || '');
  setVal('g-target', g.target);
  setVal('g-current', g.current);
  setVal('g-start', g.start || '');
  setVal('g-end', g.end || '');
  setSegValue('g-measure', g.measure || 'Cantidad');
  renderMilestones(g.milestones || []);
  const { pct } = goalDisplay(g);
  const pctEl = document.querySelector('[data-goal-pct]');
  if (pctEl) pctEl.textContent = `${Math.min(pct, 100)}%`;
  const barEl = document.querySelector('[data-goal-bar]');
  if (barEl) barEl.style.width = `${Math.min(pct, 100)}%`;
  const paceEl = document.querySelector('[data-goal-pace]');
  if (paceEl) {
    const overdue = g.end && new Date(g.end) < TODAY_REF && pct < 100;
    paceEl.textContent = pct >= 100 ? 'Cumplido' : overdue ? 'Atrasado' : 'En fecha';
  }
  const isHito = g.measure === 'Hito';
  const targetInput = document.getElementById('g-target');
  const currentInput = document.getElementById('g-current');
  if (targetInput) targetInput.disabled = isHito;
  if (currentInput) currentInput.disabled = isHito;
}
function saveGoalDetail() {
  if (!currentDetailId) return;
  const id = currentDetailId;
  const title = (document.getElementById('g-name')?.value || '').trim();
  if (!title) return;
  const why = document.getElementById('g-why')?.value || '';
  const target = Number(document.getElementById('g-target')?.value) || 0;
  const current = Number(document.getElementById('g-current')?.value) || 0;
  const start = document.getElementById('g-start')?.value || '';
  const end = document.getElementById('g-end')?.value || '';
  const measure = getSegValue('g-measure') || 'Cantidad';
  saveGoalDetailOverride(id, { title, why, target, current, start, end, measure });
  refreshGoalRow(id);
  loadGoalDetail(id);
  updateGoalsSummary();
  flashSaved();
}
function discardGoalDetail() { if (currentDetailId) loadGoalDetail(currentDetailId); }
function deleteGoalDetail() {
  if (!currentDetailId || !confirm('¿Eliminar este objetivo?')) return;
  saveGoalDetailOverride(currentDetailId, { deleted: true });
  document.querySelectorAll(`[data-id="${currentDetailId}"]`).forEach((el) => { if (el.matches('[data-list-row]')) el.remove(); });
  currentDetailId = null;
  updateGoalsSummary();
  selectFirstRow();
}
function buildGoalListItem(g) {
  const { text, pct } = goalDisplay(g);
  const li = document.createElement('li');
  li.className = 'row goal-row';
  li.dataset.listRow = '';
  li.dataset.id = g.id;
  li.dataset.status = g.status || 'curso';
  li.innerHTML =
    `<div class="row-body"><div class="goal-hd"><span class="label">${escapeHtml(g.title)}</span><span class="mut num">${escapeHtml(text)}</span></div>` +
    `<div class="bar"><span style="width:${Math.min(pct, 100)}%"></span></div>` +
    `<span class="row-meta mut">${escapeHtml(g.meta || '')}</span></div>` +
    (g.tagText ? `<span class="tag ${g.tagClass || 'tag-outline'}">${escapeHtml(g.tagText)}</span>` : '');
  return li;
}
function moveGoalToClosedList(id) {
  const g = getGoalById(id);
  const closedList = document.querySelector('[data-goals-closed]');
  if (!g || !closedList) return;
  closedList.appendChild(buildGoalListItem(g));
}
function archiveGoal() {
  if (!currentDetailId) return;
  const id = currentDetailId;
  saveGoalDetailOverride(id, { status: 'cerrado' });
  const row = document.querySelector(`[data-list-row][data-id="${id}"]`);
  if (row) row.remove();
  moveGoalToClosedList(id);
  applyGoalRangeFilter();
  currentDetailId = null;
  updateGoalsSummary();
  selectFirstRow();
}
function closeQuarter() {
  if (!confirm('¿Cerrar el cuatrimestre? Se archivan todos los objetivos en curso y en riesgo.')) return;
  document.querySelectorAll('.split-list [data-list-row][data-id^="g"]').forEach((row) => {
    const id = row.dataset.id;
    saveGoalDetailOverride(id, { status: 'cerrado' });
    moveGoalToClosedList(id);
    row.remove();
  });
  applyGoalRangeFilter();
  currentDetailId = null;
  updateGoalsSummary();
}
function applyGoalRangeFilter() {
  const checked = document.querySelector('[name="g-range"]:checked');
  const showClosed = checked ? checked.value === 'cerrados' : false;
  document.querySelectorAll('.split-list ul.rows:not([data-goals-closed])').forEach((ul) => { ul.hidden = showClosed; });
  document.querySelectorAll('.split-list p.group-hd:not([data-group="cerrados"])').forEach((hd) => { hd.hidden = showClosed; });
  const closedList = document.querySelector('[data-goals-closed]');
  const closedHd = document.querySelector('[data-group="cerrados"]');
  const hasClosed = closedList && closedList.children.length > 0;
  if (closedList) closedList.hidden = !showClosed || !hasClosed;
  if (closedHd) closedHd.hidden = !showClosed || !hasClosed;
}
function createNewGoal() {
  const title = prompt('Nombre del objetivo:', 'Nuevo objetivo');
  if (!title || !title.trim()) return;
  const id = 'xg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const goal = { id, title: title.trim(), why: '', target: 100, current: 0, start: isoDate(TODAY_REF), end: '', measure: 'Cantidad', unit: 'plain', tagText: 'personal', tagClass: 'tag-outline', meta: '', milestones: [], status: 'curso' };
  const extra = getExtraGoals();
  extra.push(goal);
  save(STORE.extraGoals, extra);
  const container = document.querySelector('.split-list ul.rows');
  if (container) container.appendChild(buildGoalListItem(goal));
  selectRowById(id);
  loadGoalDetail(id);
  updateGoalsSummary();
}
function updateGoalsSummary() {
  const el = document.querySelector('[data-goals-summary]');
  if (!el) return;
  const det = getGoalDetailsOverrides();
  const goals = SAMPLE_GOALS.concat(getExtraGoals())
    .map((g) => ({ ...g, ...det[g.id] }))
    .filter((g) => !g.deleted && g.status !== 'cerrado');
  if (!goals.length) { el.textContent = 'sin objetivos en curso'; return; }
  const avg = Math.round(goals.reduce((sum, g) => sum + goalDisplay(g).pct, 0) / goals.length);
  el.textContent = `quedan 14 semanas · avance medio ${avg}%`;
}

// ── wiring de botones y filtros de las 4 pantallas de gestión ──
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-save-detail]')) {
    if (PAGE_KIND === 'tasks') saveTaskDetail();
    else if (PAGE_KIND === 'habits') saveHabitDetail();
    else if (PAGE_KIND === 'goals') saveGoalDetail();
    return;
  }
  if (e.target.closest('[data-discard-detail]')) {
    if (PAGE_KIND === 'tasks') discardTaskDetail();
    else if (PAGE_KIND === 'habits') discardHabitDetail();
    else if (PAGE_KIND === 'goals') discardGoalDetail();
    return;
  }
  if (e.target.closest('[data-delete-detail]')) {
    if (PAGE_KIND === 'tasks') deleteTaskDetail();
    else if (PAGE_KIND === 'notes') deleteNoteDetail();
    else if (PAGE_KIND === 'habits') deleteHabitDetail();
    else if (PAGE_KIND === 'goals') deleteGoalDetail();
    return;
  }
  if (e.target.closest('[data-duplicate-detail]')) {
    if (PAGE_KIND === 'tasks') duplicateTaskDetail();
    else if (PAGE_KIND === 'notes') duplicateNoteDetail();
    return;
  }
  if (e.target.closest('[data-import-bandeja]')) { importFromBandeja(); return; }
  if (e.target.closest('[data-export-notes]')) { exportNotesMd(); return; }
  if (e.target.closest('[data-pin-note]')) { toggleNotePin(); return; }
  if (e.target.closest('[data-note-to-task]')) { noteToTask(); return; }
  const mdBtn = e.target.closest('[data-md]');
  if (mdBtn) { insertMarkdown(mdBtn.dataset.md); return; }
  if (e.target.closest('[data-new-habit]')) { createNewHabit(); return; }
  if (e.target.closest('[data-new-goal]')) { createNewGoal(); return; }
  if (e.target.closest('[data-pause-habit]')) { togglePauseHabit(); return; }
  const reactivateBtn = e.target.closest('[data-reactivate-habit]');
  if (reactivateBtn) {
    const row = reactivateBtn.closest('[data-list-row]');
    if (row) reactivateHabit(row.dataset.id);
    return;
  }
  if (e.target.closest('[data-view-history]')) { viewHabitHistory(); return; }
  if (e.target.closest('[data-archive-goal]')) { archiveGoal(); return; }
  if (e.target.closest('[data-close-quarter]')) { closeQuarter(); return; }
});
document.querySelectorAll('[name="task-view"]').forEach((r) => r.addEventListener('change', applyTaskFilters));
document.querySelector('[data-search="tasks"]')?.addEventListener('input', applyTaskFilters);
document.querySelector('[data-search="notes"]')?.addEventListener('input', filterNotes);
document.querySelectorAll('[name="g-range"]').forEach((r) => r.addEventListener('change', applyGoalRangeFilter));
document.getElementById('n-title')?.addEventListener('input', scheduleNoteAutosave);
document.getElementById('n-body')?.addEventListener('input', scheduleNoteAutosave);
document.getElementById('t-sub-add')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !currentDetailId) return;
  e.preventDefault();
  const label = e.target.value.trim();
  if (!label) return;
  const t = getTaskById(currentDetailId);
  const subs = (t.subtasks || []).concat([{ label, done: false }]);
  saveTaskDetailOverride(currentDetailId, { subtasks: subs });
  renderSubtasks(subs);
  e.target.value = '';
});
document.getElementById('g-mile-add')?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !currentDetailId) return;
  e.preventDefault();
  const label = e.target.value.trim();
  if (!label) return;
  const g = getGoalById(currentDetailId);
  const miles = (g.milestones || []).concat([{ label, done: false }]);
  saveGoalDetailOverride(currentDetailId, { milestones: miles });
  renderMilestones(miles);
  if (g.measure === 'Hito') { refreshGoalRow(currentDetailId); loadGoalDetail(currentDetailId); }
  e.target.value = '';
});

// ── hidratar la página con lo persistido ──
renderTasksTable();
renderMailStatuses();
renderHabits();
renderNotes();
renderEvents();
updateBadges();
if (PAGE_KIND === 'tasks') { updateTaskSummary(); applyTaskFilters(); }
if (PAGE_KIND === 'notes') { renderExtraNotesList(); filterNotes(); }
if (PAGE_KIND === 'habits') { renderHabitPauseStates(); SAMPLE_HABITS.forEach((h) => refreshHabitRowStats(h.id)); }
if (PAGE_KIND === 'goals') { updateGoalsSummary(); }
if (PAGE_KIND) selectFirstRow();
