// ---- helpers ----
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const CAT_LABEL = { jkh: 'ЖКХ', tax: 'Налоги', school: 'Школа' };
const CAT_ICON  = { jkh: '🏠', tax: '🚗', school: '🎓' };
const REPEAT_LABEL = { none: 'Разово', monthly: 'Ежемесячно', yearly: 'Ежегодно' };

const MEMBERS = [
  { key: 'Папа',    avatar: '👨', role: 'Налоги, транспорт, ЖКХ' },
  { key: 'Мама',    avatar: '👩', role: 'Школа, питание' },
  { key: '9 класс', avatar: '🎒', role: '9 класс' },
  { key: '5 класс', avatar: '📚', role: '5 класс' },
  { key: '3 класс', avatar: '✏️', role: '3 класс' },
];

function statusOf(r) {
  if (r.done) return { icon: '✅', cls: 'done-status', label: 'Выполнено' };
  const diff = Math.ceil((new Date(r.date) - new Date()) / 86400000);
  if (diff < 0)  return { icon: '🔴', cls: 'overdue', label: `Просрочено ${-diff} дн.` };
  if (diff <= 7) return { icon: '🟡', cls: 'soon',    label: `${diff} дн.` };
  return { icon: '🟢', cls: 'ok', label: `${diff} дн.` };
}

function taskCard(r, slim = false) {
  const s = statusOf(r);
  const div = document.createElement('div');
  div.className = `task-card${r.done ? ' done' : ''}`;
  div.dataset.id = r.id;
  div.innerHTML = `
    <div class="task-status">${s.icon}</div>
    <div class="task-info">
      <div class="task-name">${r.name}</div>
      <div class="task-meta">
        <span class="tag ${r.category}">${CAT_ICON[r.category]} ${CAT_LABEL[r.category]}</span>
        <span>👤 ${r.person}</span>
        <span>📅 ${r.date}</span>
        <span>${s.label}</span>
        ${r.repeat !== 'none' ? `<span>🔁 ${REPEAT_LABEL[r.repeat]}</span>` : ''}
      </div>
    </div>
    ${!slim ? `<div class="task-actions">
      <button class="btn-done" data-id="${r.id}">${r.done ? 'Отменить' : '✓ Готово'}</button>
      <button class="btn-edit" data-id="${r.id}">✏️</button>
      <button class="btn-delete" data-id="${r.id}">🗑</button>
    </div>` : ''}`;
  return div;
}

// ---- navigation ----
function showPage(name) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  $(`#page-${name}`).classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'reminders') renderReminders();
  if (name === 'calendar')  renderCalendar();
  if (name === 'family')    renderFamily();
}

$$('.nav-btn').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

// ---- dashboard ----
function renderDashboard() {
  const all = DB.getAll().filter(r => !r.done);
  const now = new Date();
  const overdue  = all.filter(r => new Date(r.date) < now).length;
  const week     = all.filter(r => { const d = (new Date(r.date)-now)/86400000; return d>=0 && d<=7; }).length;
  const month    = all.filter(r => { const d = (new Date(r.date)-now)/86400000; return d>=0 && d<=31; }).length;

  $('#counters').innerHTML = `
    <div class="counter-card red"><div class="num">${overdue}</div><div class="label">Просрочено</div></div>
    <div class="counter-card yellow"><div class="num">${week}</div><div class="label">На этой неделе</div></div>
    <div class="counter-card green"><div class="num">${month}</div><div class="label">В этом месяце</div></div>`;

  const urgent = DB.getAll().filter(r => {
    if (r.done) return false;
    const diff = (new Date(r.date) - now) / 86400000;
    return diff <= 7;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const ul = $('#urgent-list');
  ul.innerHTML = '';
  if (!urgent.length) { ul.innerHTML = '<div class="empty">Срочных задач нет 🎉</div>'; return; }
  urgent.forEach(r => ul.appendChild(taskCard(r)));
  bindTaskActions(ul);
}

// ---- reminders ----
function renderReminders() {
  const cat  = $('#filter-category').value;
  const per  = $('#filter-person').value;
  let list = DB.getAll();
  if (cat) list = list.filter(r => r.category === cat);
  if (per) list = list.filter(r => r.person === per);
  list.sort((a, b) => new Date(a.date) - new Date(b.date));
  const ul = $('#all-list');
  ul.innerHTML = '';
  if (!list.length) { ul.innerHTML = '<div class="empty">Нет задач по фильтру</div>'; return; }
  list.forEach(r => ul.appendChild(taskCard(r)));
  bindTaskActions(ul);
}

$('#filter-category').addEventListener('change', renderReminders);
$('#filter-person').addEventListener('change', renderReminders);

// ---- calendar ----
let calYear, calMonth;
(function initCal() {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
})();

function renderCalendar() {
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  $('#cal-title').textContent = `${months[calMonth]} ${calYear}`;

  const grid = $('#calendar-grid');
  grid.innerHTML = '';
  ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-name'; el.textContent = d; grid.appendChild(el);
  });

  const first = new Date(calYear, calMonth, 1);
  let startDow = first.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();

  const reminders = DB.getAll();
  const byDate = {};
  reminders.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const total = startDow + daysInMonth;
  const cells = Math.ceil(total / 7) * 7;

  for (let i = 0; i < cells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    let day, dateStr, otherMonth = false;

    if (i < startDow) {
      day = daysInPrev - startDow + i + 1;
      const d = new Date(calYear, calMonth - 1, day);
      dateStr = d.toISOString().slice(0, 10);
      otherMonth = true;
    } else if (i < startDow + daysInMonth) {
      day = i - startDow + 1;
      const d = new Date(calYear, calMonth, day);
      dateStr = d.toISOString().slice(0, 10);
    } else {
      day = i - startDow - daysInMonth + 1;
      const d = new Date(calYear, calMonth + 1, day);
      dateStr = d.toISOString().slice(0, 10);
      otherMonth = true;
    }

    if (otherMonth) cell.classList.add('other-month');

    const isToday = !otherMonth &&
      today.getDate() === day && today.getMonth() === calMonth && today.getFullYear() === calYear;
    if (isToday) cell.classList.add('today');

    cell.innerHTML = `<span>${day}</span>`;

    const events = byDate[dateStr];
    if (events && events.length) {
      const dotsDiv = document.createElement('div');
      dotsDiv.className = 'dots';
      events.slice(0, 3).forEach(ev => {
        const dot = document.createElement('div');
        const s = statusOf(ev);
        dot.className = 'dot' + (s.cls === 'overdue' ? ' red' : s.cls === 'soon' ? ' yellow' : '');
        dotsDiv.appendChild(dot);
      });
      cell.appendChild(dotsDiv);
      cell.addEventListener('click', () => showDayEvents(dateStr, events));
    }
    grid.appendChild(cell);
  }
}

function showDayEvents(dateStr, events) {
  const area = $('#cal-day-events');
  area.innerHTML = `<h3>📅 ${dateStr}</h3>`;
  const ul = document.createElement('div');
  ul.className = 'task-list';
  events.forEach(r => ul.appendChild(taskCard(r)));
  area.appendChild(ul);
  bindTaskActions(ul);
}

$('#cal-prev').addEventListener('click', () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar(); $('#cal-day-events').innerHTML = '';
});
$('#cal-next').addEventListener('click', () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar(); $('#cal-day-events').innerHTML = '';
});

// ---- family ----
function renderFamily() {
  const all = DB.getAll();
  const grid = $('#family-grid');
  grid.innerHTML = '';
  MEMBERS.forEach(m => {
    const active = all.filter(r => r.person === m.key && !r.done).length;
    const card = document.createElement('div');
    card.className = 'family-card';
    card.innerHTML = `
      <div class="family-avatar">${m.avatar}</div>
      <div class="family-name">${m.key}</div>
      <div class="family-role">${m.role}</div>
      <div class="family-count">Задач: <span>${active}</span></div>`;
    grid.appendChild(card);
  });
}

// ---- task actions ----
function bindTaskActions(container) {
  container.addEventListener('click', e => {
    const id = parseInt(e.target.dataset.id);
    if (!id) return;
    if (e.target.classList.contains('btn-done')) {
      DB.toggleDone(id); refreshCurrentPage();
    }
    if (e.target.classList.contains('btn-delete')) {
      if (confirm('Удалить задачу?')) { DB.remove(id); refreshCurrentPage(); }
    }
    if (e.target.classList.contains('btn-edit')) {
      openEditModal(id);
    }
  });
}

function refreshCurrentPage() {
  const active = $$('.nav-btn').find(b => b.classList.contains('active'));
  if (active) showPage(active.dataset.page);
}

// ---- modal ----
function openModal(reset = true) {
  if (reset) {
    $('#reminder-form').reset();
    $('#edit-id').value = '';
    $('#modal-title').textContent = 'Добавить напоминание';
    const d = new Date(); d.setDate(d.getDate() + 7);
    $('#f-date').value = d.toISOString().slice(0, 10);
  }
  $('#modal-overlay').classList.add('open');
}

function closeModal() { $('#modal-overlay').classList.remove('open'); }

function openEditModal(id) {
  const r = DB.getAll().find(x => x.id === id);
  if (!r) return;
  $('#edit-id').value = r.id;
  $('#f-name').value = r.name;
  $('#f-category').value = r.category;
  $('#f-date').value = r.date;
  $('#f-person').value = r.person;
  $('#f-repeat').value = r.repeat;
  $('#modal-title').textContent = 'Редактировать';
  $('#modal-overlay').classList.add('open');
}

$('#openModal').addEventListener('click', () => openModal());
$('#closeModal').addEventListener('click', closeModal);
$('#modal-overlay').addEventListener('click', e => { if (e.target === $('#modal-overlay')) closeModal(); });

$('#reminder-form').addEventListener('submit', e => {
  e.preventDefault();
  const fields = {
    name:     $('#f-name').value.trim(),
    category: $('#f-category').value,
    date:     $('#f-date').value,
    person:   $('#f-person').value,
    repeat:   $('#f-repeat').value,
  };
  const editId = parseInt($('#edit-id').value);
  if (editId) {
    DB.update(editId, fields);
  } else {
    DB.add(fields);
  }
  closeModal();
  refreshCurrentPage();
});

// ---- init ----
showPage('dashboard');
