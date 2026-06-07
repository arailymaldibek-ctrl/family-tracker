// ---- helpers ----
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const CAT_LABEL = { jkh: "ЖКХ", tax: "Налоги", school: "Школа" };
const CAT_ICON  = { jkh: "🏠", tax: "🚗", school: "🎓" };
const REPEAT_LABEL = { none: "Разово", monthly: "Ежемесячно", yearly: "Ежегодно" };

function statusOf(r) {
  if (r.done) return { icon: "✅", cls: "done-status", label: "Выполнено" };
  const diff = Math.ceil((new Date(r.date) - new Date()) / 86400000);
  if (diff < 0)  return { icon: "🔴", cls: "overdue", label: `Просрочено ${-diff} дн.` };
  if (diff <= 7) return { icon: "🟡", cls: "soon",    label: `${diff} дн.` };
  return { icon: "🟢", cls: "ok", label: `${diff} дн.` };
}

function taskCard(r) {
  const s = statusOf(r);
  const div = document.createElement("div");
  div.className = `task-card${r.done ? " done" : ""}`;
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
        ${r.repeat !== "none" ? `<span>🔁 ${REPEAT_LABEL[r.repeat]}</span>` : ""}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn-done" data-id="${r.id}">${r.done ? "Отменить" : "✓ Готово"}</button>
      <button class="btn-edit" data-id="${r.id}">✏️</button>
      <button class="btn-delete" data-id="${r.id}">🗑</button>
    </div>`;
  return div;
}

// ---- loader overlay ----
function showLoader(show) {
  let el = $("#loader");
  if (!el) {
    el = document.createElement("div");
    el.id = "loader";
    el.innerHTML = `<div class="loader-spin"></div>`;
    document.body.appendChild(el);
  }
  el.style.display = show ? "flex" : "none";
}

// ---- navigation ----
async function showPage(name) {
  $$(".page").forEach(p => p.classList.remove("active"));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  $(`#page-${name}`).classList.add("active");
  showLoader(true);
  if (name === "dashboard") await renderDashboard();
  if (name === "reminders") await renderReminders();
  if (name === "calendar")  await renderCalendar();
  if (name === "family")    await renderFamily();
  if (name === "settings")  await renderSettings();
  showLoader(false);
}

$$(".nav-btn").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));

// ---- dashboard ----
async function renderDashboard() {
  const all = await DB.getAll();
  const active = all.filter(r => !r.done);
  const now = new Date();
  const overdue = active.filter(r => new Date(r.date) < now).length;
  const week    = active.filter(r => { const d=(new Date(r.date)-now)/86400000; return d>=0&&d<=7; }).length;
  const month   = active.filter(r => { const d=(new Date(r.date)-now)/86400000; return d>=0&&d<=31; }).length;

  $("#counters").innerHTML = `
    <div class="counter-card red"><div class="num">${overdue}</div><div class="label">Просрочено</div></div>
    <div class="counter-card yellow"><div class="num">${week}</div><div class="label">На этой неделе</div></div>
    <div class="counter-card green"><div class="num">${month}</div><div class="label">В этом месяце</div></div>`;

  const urgent = active.filter(r => {
    const diff = (new Date(r.date) - now) / 86400000;
    return diff <= 7;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));

  const ul = $("#urgent-list");
  ul.innerHTML = "";
  if (!urgent.length) { ul.innerHTML = '<div class="empty">Срочных задач нет 🎉</div>'; return; }
  urgent.forEach(r => ul.appendChild(taskCard(r)));
  bindTaskActions(ul);
}

// ---- reminders ----
async function renderReminders() {
  const cat = $("#filter-category").value;
  const per = $("#filter-person").value;
  let list = await DB.getAll();
  if (cat) list = list.filter(r => r.category === cat);
  if (per) list = list.filter(r => r.person === per);
  list.sort((a, b) => new Date(a.date) - new Date(b.date));
  const ul = $("#all-list");
  ul.innerHTML = "";
  if (!list.length) { ul.innerHTML = '<div class="empty">Нет задач по фильтру</div>'; return; }
  list.forEach(r => ul.appendChild(taskCard(r)));
  bindTaskActions(ul);
}

$("#filter-category").addEventListener("change", renderReminders);
$("#filter-person").addEventListener("change", renderReminders);

// ---- calendar ----
let calYear, calMonth;
(function initCal() {
  const n = new Date();
  calYear = n.getFullYear();
  calMonth = n.getMonth();
})();

async function renderCalendar() {
  const months = ["Январь","Февраль","Март","Апрель","Май","Июнь",
                  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  $("#cal-title").textContent = `${months[calMonth]} ${calYear}`;

  const grid = $("#calendar-grid");
  grid.innerHTML = "";
  ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(d => {
    const el = document.createElement("div");
    el.className = "cal-day-name"; el.textContent = d; grid.appendChild(el);
  });

  const first = new Date(calYear, calMonth, 1);
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();
  const reminders = await DB.getAll();
  const byDate = {};
  reminders.forEach(r => {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date].push(r);
  });

  const cells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  for (let i = 0; i < cells; i++) {
    const cell = document.createElement("div");
    cell.className = "cal-day";
    let day, dateStr, otherMonth = false;
    if (i < startDow) {
      day = daysInPrev - startDow + i + 1;
      dateStr = new Date(calYear, calMonth - 1, day).toISOString().slice(0, 10);
      otherMonth = true;
    } else if (i < startDow + daysInMonth) {
      day = i - startDow + 1;
      dateStr = new Date(calYear, calMonth, day).toISOString().slice(0, 10);
    } else {
      day = i - startDow - daysInMonth + 1;
      dateStr = new Date(calYear, calMonth + 1, day).toISOString().slice(0, 10);
      otherMonth = true;
    }
    if (otherMonth) cell.classList.add("other-month");
    const isToday = !otherMonth && today.getDate()===day && today.getMonth()===calMonth && today.getFullYear()===calYear;
    if (isToday) cell.classList.add("today");
    cell.innerHTML = `<span>${day}</span>`;
    const events = byDate[dateStr];
    if (events && events.length) {
      const dotsDiv = document.createElement("div");
      dotsDiv.className = "dots";
      events.slice(0, 3).forEach(ev => {
        const dot = document.createElement("div");
        const s = statusOf(ev);
        dot.className = "dot" + (s.cls==="overdue"?" red":s.cls==="soon"?" yellow":"");
        dotsDiv.appendChild(dot);
      });
      cell.appendChild(dotsDiv);
      cell.addEventListener("click", () => showDayEvents(dateStr, events));
    }
    grid.appendChild(cell);
  }
}

function showDayEvents(dateStr, events) {
  const area = $("#cal-day-events");
  area.innerHTML = `<h3>📅 ${dateStr}</h3>`;
  const ul = document.createElement("div");
  ul.className = "task-list";
  events.forEach(r => ul.appendChild(taskCard(r)));
  area.appendChild(ul);
  bindTaskActions(ul);
}

$("#cal-prev").addEventListener("click", () => {
  calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar(); $("#cal-day-events").innerHTML = "";
});
$("#cal-next").addEventListener("click", () => {
  calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar(); $("#cal-day-events").innerHTML = "";
});

// ---- family ----
async function renderFamily() {
  const all = await DB.getAll();
  const members = await DB.getMembers();
  const grid = $("#family-grid");
  grid.innerHTML = "";
  members.forEach(m => {
    const active = all.filter(r => r.person === m.key && !r.done).length;
    const card = document.createElement("div");
    card.className = "family-card";
    card.innerHTML = `
      <div class="family-avatar">${m.avatar}</div>
      <div class="family-name">${m.key}</div>
      <div class="family-role">${m.role}</div>
      <div class="family-count">Задач: <span>${active}</span></div>`;
    grid.appendChild(card);
  });
}

// ---- settings ----
async function populatePersonSelects() {
  const members = await DB.getMembers();
  ["filter-person", "f-person"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = id === "filter-person" ? '<option value="">Все</option>' : "";
    members.forEach(m => {
      const o = document.createElement("option");
      o.value = m.key; o.textContent = `${m.avatar} ${m.key}`;
      sel.appendChild(o);
    });
    sel.value = val;
  });
}

async function renderSettings() {
  await populatePersonSelects();
  const members = await DB.getMembers();
  const list = $("#members-list");
  list.innerHTML = "";
  members.forEach(m => {
    const row = document.createElement("div");
    row.className = "member-row";
    row.innerHTML = `
      <div class="m-avatar">${m.avatar}</div>
      <div class="m-info">
        <div class="m-name">${m.key}</div>
        <div class="m-role">${m.role || ""}</div>
      </div>
      <div class="m-actions">
        <button class="btn-edit mem-edit" data-key="${m.key}">✏️</button>
        <button class="btn-delete mem-del" data-key="${m.key}">🗑</button>
      </div>`;
    list.appendChild(row);
  });
}

$("#members-list").addEventListener("click", async e => {
  const key = e.target.dataset.key;
  if (!key) return;
  if (e.target.classList.contains("mem-del")) {
    if (confirm(`Удалить «${key}»?`)) {
      showLoader(true);
      await DB.removeMember(key);
      await renderSettings();
      showLoader(false);
    }
  }
  if (e.target.classList.contains("mem-edit")) {
    const members = await DB.getMembers();
    const m = members.find(x => x.key === key);
    if (!m) return;
    $("#member-edit-key").value = m.key;
    $("#member-name").value = m.key;
    $("#member-avatar").value = m.avatar;
    $("#member-role").value = m.role || "";
    $("#member-submit").textContent = "Сохранить";
    $("#member-cancel").style.display = "";
    $("#member-name").focus();
  }
});

$("#member-cancel").addEventListener("click", () => {
  $("#member-form").reset();
  $("#member-edit-key").value = "";
  $("#member-submit").textContent = "+ Добавить";
  $("#member-cancel").style.display = "none";
});

$("#member-form").addEventListener("submit", async e => {
  e.preventDefault();
  const editKey = $("#member-edit-key").value;
  const m = {
    key:    $("#member-name").value.trim(),
    avatar: $("#member-avatar").value,
    role:   $("#member-role").value.trim(),
  };
  if (!m.key) return;
  showLoader(true);
  if (editKey) {
    await DB.updateMember(editKey, m);
  } else {
    const members = await DB.getMembers();
    if (members.find(x => x.key === m.key)) { alert("Такое имя уже есть"); showLoader(false); return; }
    await DB.addMember(m);
  }
  $("#member-form").reset();
  $("#member-edit-key").value = "";
  $("#member-submit").textContent = "+ Добавить";
  $("#member-cancel").style.display = "none";
  await renderSettings();
  showLoader(false);
});

// ---- task actions ----
function bindTaskActions(container) {
  container.addEventListener("click", async e => {
    const id = parseInt(e.target.dataset.id);
    if (!id) return;
    if (e.target.classList.contains("btn-done")) {
      showLoader(true);
      await DB.toggleDone(id);
      await refreshCurrentPage();
      showLoader(false);
    }
    if (e.target.classList.contains("btn-delete")) {
      if (confirm("Удалить задачу?")) {
        showLoader(true);
        await DB.remove(id);
        await refreshCurrentPage();
        showLoader(false);
      }
    }
    if (e.target.classList.contains("btn-edit")) {
      openEditModal(id);
    }
  });
}

async function refreshCurrentPage() {
  const active = $$(".nav-btn").find(b => b.classList.contains("active"));
  if (active) await showPage(active.dataset.page);
}

// ---- modal ----
function openModal(reset = true) {
  if (reset) {
    $("#reminder-form").reset();
    $("#edit-id").value = "";
    $("#modal-title").textContent = "Добавить напоминание";
    const d = new Date(); d.setDate(d.getDate() + 7);
    $("#f-date").value = d.toISOString().slice(0, 10);
  }
  $("#modal-overlay").classList.add("open");
}

function closeModal() { $("#modal-overlay").classList.remove("open"); }

async function openEditModal(id) {
  const all = await DB.getAll();
  const r = all.find(x => x.id === id);
  if (!r) return;
  $("#edit-id").value = r.id;
  $("#f-name").value = r.name;
  $("#f-category").value = r.category;
  $("#f-date").value = r.date;
  $("#f-person").value = r.person;
  $("#f-repeat").value = r.repeat;
  $("#modal-title").textContent = "Редактировать";
  $("#modal-overlay").classList.add("open");
}

$("#openModal").addEventListener("click", () => openModal());
$("#closeModal").addEventListener("click", closeModal);
$("#modal-overlay").addEventListener("click", e => { if (e.target === $("#modal-overlay")) closeModal(); });

$("#reminder-form").addEventListener("submit", async e => {
  e.preventDefault();
  const fields = {
    name:     $("#f-name").value.trim(),
    category: $("#f-category").value,
    date:     $("#f-date").value,
    person:   $("#f-person").value,
    repeat:   $("#f-repeat").value,
  };
  const editId = parseInt($("#edit-id").value);
  showLoader(true);
  if (editId) {
    await DB.update(editId, fields);
  } else {
    await DB.add(fields);
  }
  closeModal();
  await populatePersonSelects();
  await refreshCurrentPage();
  showLoader(false);
});

// ---- init ----
(async () => {
  await populatePersonSelects();
  await showPage("dashboard");
})();
