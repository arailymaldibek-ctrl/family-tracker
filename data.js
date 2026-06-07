// ---- Firebase REST helpers ----
const FB_URL = "https://fam-tracker-bc2cb-default-rtdb.firebaseio.com";

async function fbGet(path) {
  const r = await fetch(`${FB_URL}/${path}.json`);
  return r.json();
}
async function fbSet(path, data) {
  await fetch(`${FB_URL}/${path}.json`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
async function fbPatch(path, data) {
  await fetch(`${FB_URL}/${path}.json`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
async function fbDelete(path) {
  await fetch(`${FB_URL}/${path}.json`, { method: "DELETE" });
}

// ---- Default data ----
function defaultMembers() {
  return [
    { key: "Папа",    avatar: "👨", role: "Налоги, транспорт, ЖКХ" },
    { key: "Мама",    avatar: "👩", role: "Школа, питание" },
    { key: "Жанерке", avatar: "🧒", role: "за финансы семьи" },
    { key: "Айтолкын",avatar: "🧒", role: "средний ребёнок" },
    { key: "Айсултан",avatar: "🧒", role: "средний ребёнок" },
    { key: "Мейрамкан",avatar:"👵", role: "хавать нам мозги" },
  ];
}

function defaultReminders() {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };
  const thisMonth = (day) => { const d = new Date(today.getFullYear(), today.getMonth(), day); return fmt(d); };
  return [
    { id: 1, name: "Оплата газа",          category: "jkh",    date: thisMonth(25), person: "Папа",   repeat: "monthly", done: false },
    { id: 2, name: "Оплата электричества",  category: "jkh",    date: thisMonth(25), person: "Папа",   repeat: "monthly", done: false },
    { id: 3, name: "Оплата вай-фай",        category: "jkh",    date: thisMonth(20), person: "Мама",   repeat: "monthly", done: false },
    { id: 4, name: "Транспортный налог",    category: "tax",    date: fmt(new Date(today.getFullYear(), 9, 1)), person: "Папа", repeat: "yearly", done: false },
    { id: 5, name: "Питание в школе",       category: "school", date: thisMonth(10), person: "Мама",   repeat: "monthly", done: false },
    { id: 6, name: "Родительское собрание", category: "school", date: addDays(5),    person: "Мама",   repeat: "none",    done: false },
  ];
}

// ---- DB object ----
const DB = {
  _cache: null,

  async _load() {
    if (this._cache) return this._cache;
    let data = await fbGet("familytracker");
    if (!data || !data.reminders) {
      data = { reminders: defaultReminders(), members: defaultMembers(), nextId: 10 };
      await fbSet("familytracker", data);
    }
    if (!data.members) {
      data.members = defaultMembers();
      await fbSet("familytracker/members", data.members);
    }
    this._cache = data;
    return data;
  },

  _invalidate() { this._cache = null; },

  async getAll() {
    const data = await this._load();
    return Object.values(data.reminders || {});
  },

  async add(r) {
    const data = await this._load();
    r.id = data.nextId++;
    r.done = false;
    data.reminders[r.id] = r;
    await fbPatch("familytracker", { reminders: data.reminders, nextId: data.nextId });
    this._invalidate();
    return r;
  },

  async update(id, fields) {
    const data = await this._load();
    if (data.reminders[id]) {
      data.reminders[id] = { ...data.reminders[id], ...fields };
      await fbSet(`familytracker/reminders/${id}`, data.reminders[id]);
      this._invalidate();
    }
  },

  async remove(id) {
    await fbDelete(`familytracker/reminders/${id}`);
    this._invalidate();
  },

  async toggleDone(id) {
    const data = await this._load();
    const r = data.reminders[id];
    if (!r) return;
    if (!r.done) {
      r.done = true;
      await fbSet(`familytracker/reminders/${id}/done`, true);
      if (r.repeat !== "none") {
        const next = { ...r, id: data.nextId++, done: false };
        const d = new Date(r.date);
        if (r.repeat === "monthly") d.setMonth(d.getMonth() + 1);
        else if (r.repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
        next.date = d.toISOString().slice(0, 10);
        data.reminders[next.id] = next;
        await fbPatch("familytracker", { reminders: data.reminders, nextId: data.nextId });
      }
    } else {
      r.done = false;
      await fbSet(`familytracker/reminders/${id}/done`, false);
    }
    this._invalidate();
  },

  async getMembers() {
    const data = await this._load();
    return data.members || defaultMembers();
  },

  async addMember(m) {
    const data = await this._load();
    data.members.push(m);
    await fbSet("familytracker/members", data.members);
    this._invalidate();
  },

  async updateMember(oldKey, m) {
    const data = await this._load();
    const i = data.members.findIndex(x => x.key === oldKey);
    if (i !== -1) {
      data.members[i] = m;
      Object.values(data.reminders).forEach(r => { if (r.person === oldKey) r.person = m.key; });
      await fbSet("familytracker", data);
      this._invalidate();
    }
  },

  async removeMember(key) {
    const data = await this._load();
    data.members = data.members.filter(m => m.key !== key);
    await fbSet("familytracker/members", data.members);
    this._invalidate();
  },
};
