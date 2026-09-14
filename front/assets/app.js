// app.js — interacciones del dashboard. Sin dependencias.
document.addEventListener('click', (e) => {
  const check = e.target.closest('.check');
  if (check) {
    const on = check.getAttribute('aria-pressed') === 'true';
    check.setAttribute('aria-pressed', String(!on));
    const label = check.parentElement.querySelector('.label');
    if (label) label.classList.toggle('done', !on);
    return;
  }
  if (e.target.closest('[data-open-capture]')) { openCapture(); return; }
  if (e.target.closest('[data-close-capture]')) { closeCapture(); return; }
  const toTask = e.target.closest('[data-to-task]');
  if (toTask) {
    const mail = toTask.closest('.mail');
    toTask.textContent = '✓ En tareas';
    toTask.disabled = true;
    mail.classList.remove('unread');
  }
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

// Captura rápida: detecta fecha/hora simples en el texto
const dialog = document.getElementById('capture');
function openCapture() {
  if (!dialog) return;
  dialog.hidden = false;
  dialog.querySelector('.input').focus();
}
function closeCapture() { if (dialog) dialog.hidden = true; }
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCapture();
  if (e.key === 'n' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openCapture(); }
});

const DAYS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
document.querySelectorAll('[data-capture-input]').forEach((input) => {
  input.addEventListener('input', () => {
    const hint = document.querySelector('[data-capture-hint]');
    if (!hint) return;
    const text = input.value.toLowerCase();
    const day = DAYS.find((d) => text.includes(d.slice(0, 4)));
    const time = text.match(/(\d{1,2})\s?(?:h|:\d{2})/);
    const bits = [];
    if (day) bits.push(day);
    if (time) bits.push(time[0].replace('h', ':00'));
    if (/tp|parcial|final|c[aá]tedra|facultad/.test(text)) bits.push('destino Facultad');
    hint.textContent = bits.length ? 'detectado: ' + bits.join(' · ') : 'escribí fecha y hora y las detecto';
  });
});
