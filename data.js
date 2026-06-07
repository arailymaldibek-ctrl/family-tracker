const DB = {
  KEY: 'familytracker_v1',

  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || this.defaults();
    } catch {
      return this.defaults();
    }
  },

  save(data) {
    localStorage.setItem(this.KEY, JSON.stringify(data));
  },

  defaults() {
    const today = new Date();
    const fmt = (d) => d.toISOString().slice(0, 10);
    const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };
    const thisMonth = (day) => { const d = new Date(today.getFullYear(), today.getMonth(), day); return fmt(d); };

    return {
      reminders: [
        { id: 1, name: 'Оплата газа', category: 'jkh', date: thisMonth(25), person: 'Папа', repeat: 'monthly', done: false },
        { id: 2, name: 'Оплата электричества', category: 'jkh', date: thisMonth(25), person: 'Папа', repeat: 'monthly', done: false },
        { id: 3, name: 'Оплата вай-фай', category: 'jkh', date: thisMonth(20), person: 'Мама', repeat: 'monthly', done: false },
        { id: 4, name: 'Транспортный налог', category: 'tax', date: fmt(new Date(today.getFullYear(), 9, 1)), person: 'Папа', repeat: 'yearly', done: false },
        { id: 5, name: 'Питание в школе (9 кл)', category: 'school', date: thisMonth(10), person: '9 класс', repeat: 'monthly', done: false },
        { id: 6, name: 'Питание в школе (5 кл)', category: 'school', date: thisMonth(10), person: '5 класс', repeat: 'monthly', done: false },
        { id: 7, name: 'Питание в школе (3 кл)', category: 'school', date: thisMonth(10), person: '3 класс', repeat: 'monthly', done: false },
        { id: 8, name: 'Родительское собрание', category: 'school', date: addDays(5), person: 'Мама', repeat: 'none', done: false },
      ],
      nextId: 9,
    };
  },

  defaultMembers() {
    return [
      { key: 'Папа',    avatar: '👨', role: 'Налоги, транспорт, ЖКХ' },
      { key: 'Мама',    avatar: '👩', role: 'Школа, питание' },
      { key: '9 класс', avatar: '🎒', role: '9 класс' },
      { key: '5 класс', avatar: '📚', role: '5 класс' },
      { key: '3 класс', avatar: '✏️', role: '3 класс' },
    ];
  },

  getMembers() {
    const data = this.load();
    if (!data.members) { data.members = this.defaultMembers(); this.save(data); }
    return data.members;
  },

  addMember(m) {
    const data = this.load();
    if (!data.members) data.members = this.defaultMembers();
    data.members.push(m);
    this.save(data);
  },

  updateMember(oldKey, m) {
    const data = this.load();
    if (!data.members) data.members = this.defaultMembers();
    const i = data.members.findIndex(x => x.key === oldKey);
    if (i !== -1) {
      data.members[i] = m;
      // rename in reminders too
      data.reminders.forEach(r => { if (r.person === oldKey) r.person = m.key; });
      this.save(data);
    }
  },

  removeMember(key) {
    const data = this.load();
    if (!data.members) data.members = this.defaultMembers();
    data.members = data.members.filter(m => m.key !== key);
    this.save(data);
  },

  getAll() { return this.load().reminders; },

  add(r) {
    const data = this.load();
    r.id = data.nextId++;
    r.done = false;
    data.reminders.push(r);
    this.save(data);
    return r;
  },

  update(id, fields) {
    const data = this.load();
    const i = data.reminders.findIndex(r => r.id === id);
    if (i !== -1) { data.reminders[i] = { ...data.reminders[i], ...fields }; this.save(data); }
  },

  remove(id) {
    const data = this.load();
    data.reminders = data.reminders.filter(r => r.id !== id);
    this.save(data);
  },

  toggleDone(id) {
    const data = this.load();
    const r = data.reminders.find(r => r.id === id);
    if (!r) return;
    if (!r.done) {
      r.done = true;
      // schedule next occurrence
      if (r.repeat !== 'none') {
        const next = { ...r, id: data.nextId++, done: false };
        const d = new Date(r.date);
        if (r.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (r.repeat === 'yearly') d.setFullYear(d.getFullYear() + 1);
        next.date = d.toISOString().slice(0, 10);
        data.reminders.push(next);
      }
    } else {
      r.done = false;
    }
    this.save(data);
  },
};
