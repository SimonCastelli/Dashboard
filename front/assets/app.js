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
const SAMPLE_TASKS = [
  { id: 't1', label: 'Terminar TP2 de BD', tagText: 'facultad', tagClass: 'tag-accent', due: 'hoy', doneDefault: false },
  { id: 't2', label: 'Enviar presupuesto a Martín', tagText: 'freelance', tagClass: 'tag-neutral', due: 'mañana', doneDefault: false },
  { id: 't3', label: 'Pedir certificado de alumno regular', tagText: 'facultad', tagClass: 'tag-accent', due: '16/09', doneDefault: false },
  { id: 't4', label: 'Leer paper de scheduling', tagText: 'lectura', tagClass: 'tag-outline', due: '18/09', doneDefault: false },
  { id: 't5', label: 'Resumen unidad 3', tagText: '', tagClass: '', due: 'hecho', doneDefault: true },
];
const SAMPLE_MAIL_UNREAD_DEFAULT = { m1: true, m2: false, m3: true, m4: false, m5: false, m6: false };

// ── tareas ──
function getTaskDoneOverrides() { return load(STORE.taskDone, {}); }
function getExtraTasks() { return load(STORE.extraTasks, []); }
function getAllTasks() {
  const overrides = getTaskDoneOverrides();
  const sample = SAMPLE_TASKS.map((t) => ({ ...t, done: overrides[t.id] ?? t.doneDefault }));
  return sample.concat(getExtraTasks());
}
function countOpenTasks() { return getAllTasks().filter((t) => !t.done).length; }

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

function addTask({ label, tagText, tagClass, due }) {
  const extra = getExtraTasks();
  const id = 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  extra.push({ id, label, tagText: tagText || '', tagClass: tagClass || '', due: due || 'sin fecha', done: false });
  save(STORE.extraTasks, extra);
  renderTasksTable();
  return id;
}

function applyRowDoneState(row, done) {
  const check = row.querySelector('.check');
  const label = row.querySelector('.label');
  if (check) check.setAttribute('aria-pressed', String(done));
  if (label) label.classList.toggle('done', done);
}
function buildTaskRow(t) {
  const tr = document.createElement('tr');
  tr.dataset.id = t.id;
  tr.dataset.extra = '1';
  tr.innerHTML =
    `<td style="width:22px"><button class="check" aria-pressed="${t.done}" aria-label="Completar"></button></td>` +
    `<td class="label${t.done ? ' done' : ''}">${escapeHtml(t.label)}</td>` +
    `<td>${t.tagText ? `<span class="tag ${t.tagClass}">${escapeHtml(t.tagText)}</span>` : ''}</td>` +
    `<td class="mut" style="text-align:right">${escapeHtml(t.due)}</td>`;
  return tr;
}
function renderTasksTable() {
  const body = document.querySelector('[data-tasks-body]');
  if (!body) return;
  const overrides = getTaskDoneOverrides();
  SAMPLE_TASKS.forEach((t) => {
    const row = body.querySelector(`tr[data-id="${t.id}"]`);
    if (row) applyRowDoneState(row, overrides[t.id] ?? t.doneDefault);
  });
  body.querySelectorAll('tr[data-extra="1"]').forEach((r) => r.remove());
  getExtraTasks().forEach((t) => body.appendChild(buildTaskRow(t)));
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
function accountTagText(acc) { return acc === 'facultad' ? 'facultad' : acc === 'freelance' ? 'freelance' : 'personal'; }
function accountTagClass(acc) { return acc === 'facultad' ? 'tag-accent' : acc === 'freelance' ? 'tag-neutral' : 'tag-outline'; }
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
function renderNotes() {
  const p = document.querySelector('[data-notes-text]');
  if (!p) return;
  const base = p.dataset.notesBase || p.textContent;
  const extra = load(STORE.extraNotes, []);
  p.textContent = extra.length ? base + ' · ' + extra.join(' · ') : base;
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
}

// ── captura rápida: detección de fecha/hora/destino ──
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function parseCapture(text) {
  const lower = text.toLowerCase();
  const day = DAYS.find((d) => lower.includes(d.slice(0, 4)));
  const timeMatch = lower.match(/(\d{1,2})\s?(?:h|:\d{2})/);
  const time = timeMatch ? timeMatch[0].replace('h', ':00') : null;
  const tag = /tp|parcial|final|c[aá]tedra|facultad/.test(lower) ? 'facultad' : null;
  return { day, time, tag };
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
  const { day, tag } = parseCapture(text);
  const kind = selectedKind();
  if (kind === 'Nota') {
    addNote(text);
  } else if (kind === 'Evento') {
    addEvent(day ? `${capitalize(day)}: ${text}` : text);
  } else {
    addTask({
      label: text,
      tagText: tag || 'personal',
      tagClass: tag ? 'tag-accent' : 'tag-outline',
      due: day ? capitalize(day) : 'sin fecha',
    });
  }
  updateBadges();
  closeCapture();
}

// ── diálogo de captura ──
const dialog = document.getElementById('capture');
function openCapture() {
  if (!dialog) return;
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
    const row = check.closest('tr');
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
    if (habit) setHabitDay(habit, day, on);
    return;
  }
  if (e.target.closest('[data-open-capture]')) { openCapture(); return; }
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
    document.querySelectorAll('[data-range]').forEach((el) => { el.hidden = el.dataset.range !== value; });
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
    const { day, time, tag } = parseCapture(input.value);
    const bits = [];
    if (day) bits.push(day);
    if (time) bits.push(time);
    if (tag) bits.push('destino Facultad');
    hint.textContent = bits.length ? 'detectado: ' + bits.join(' · ') : 'escribí fecha y hora y las detecto';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveCapture(input); }
  });
});

// ── hidratar la página con lo persistido ──
renderTasksTable();
renderMailStatuses();
renderHabits();
renderNotes();
renderEvents();
updateBadges();
