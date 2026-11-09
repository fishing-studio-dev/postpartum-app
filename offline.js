/* R6 pure logic: data format, validation, storage with conflict detection, date arithmetic,
   近日 list and fictional examples. No DOM, no network. Runs in a browser or in Node.
   Exported as globalThis.PostpartumR6. */
(function (root) {
  'use strict';
  const KEY = 'postpartum-r6-v1';
  const VERSION = 1;
  const CATEGORIES = Object.freeze([
    Object.freeze({id: 'procedure', label: '手続き'}),
    Object.freeze({id: 'checkup', label: '健診'}),
    Object.freeze({id: 'vaccination', label: '予防接種'}),
    Object.freeze({id: 'care', label: 'ケア'}),
    Object.freeze({id: 'subsidy', label: '助成の手続き'})
  ]);
  const CATEGORY_IDS = CATEGORIES.map(c => c.id);
  const LIMITS = Object.freeze({title: 60, memo: 1000, checklist: 20, checkText: 60, items: 300});
  const PERIOD_DAYS = 182;
  const SOON_DAYS = 14;
  const DATA_KEYS = ['birthDate', 'items', 'version'];
  const ITEM_KEYS = ['category', 'checklist', 'date', 'done', 'id', 'memo', 'title'];
  const CHECK_KEYS = ['done', 'id', 'text'];
  const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  const RELOAD_LABEL = '「最新の内容を読み込む」';

  const TEXT = Object.freeze({
    empty: 'まだ何も登録されていません。',
    loaded: 'この端末に保存した内容を読み込みました。',
    invalid: '保存データの形式が正しくないため、読み込めませんでした。保存データは書き換えていません。',
    unreadable: 'この端末の保存先を読み込めませんでした。ブラウザーの設定（プライベートモードなど）を確認してください。',
    blocked: '保存データを読み込めていないため、上書きしないよう保存を止めています。' + RELOAD_LABEL + 'を押すか、設定の「すべて削除」で初めからにしてください。',
    conflict: '別のタブなどで保存内容が変わっていたため、上書きせずに保存を止めました。' + RELOAD_LABEL + 'を押してから、もう一度操作してください。',
    external: '別のタブなどで保存内容が変わりました。' + RELOAD_LABEL + 'を押すと最新の内容を表示します。',
    externalLoaded: '別のタブなどでの変更を検知し、最新の保存内容を表示しました。',
    failed: '保存できませんでした。表示は最後に保存した内容のままです。端末の空き容量やブラウザーの設定を確認してください。',
    missing: 'その項目が見つかりません。別のタブなどで削除された可能性があります。' + RELOAD_LABEL + 'を押してください。',
    tooMany: '登録できるのは' + LIMITS.items + '件までです。',
    title: 'タイトルは1〜' + LIMITS.title + '文字で入力してください。',
    category: '分類を選んでください。',
    date: '日付が正しくありません。選び直すか、空欄にしてください。',
    memo: 'メモは' + LIMITS.memo + '文字までです。',
    checkCount: 'チェック項目は' + LIMITS.checklist + '個までです。',
    checkText: 'チェック項目は1〜' + LIMITS.checkText + '文字で入力してください。',
    birthDate: '出産日が正しくありません。選び直すか、空欄にしてください。'
  });

  const len = s => [...s].length;
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  function hasExactKeys(value, keys) {
    const actual = Object.keys(value).sort();
    return actual.length === keys.length && actual.every((k, i) => k === keys[i]);
  }
  const validText = (s, max) => typeof s === 'string' && s === s.trim() && len(s) >= 1 && len(s) <= max;

  // --- dates (plain calendar arithmetic, no time zones involved) ---
  function isDate(s) {
    if (typeof s !== 'string') return false;
    const m = DATE_RE.exec(s);
    if (!m) return false;
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (y < 1900 || y > 2199 || mo < 1 || mo > 12 || d < 1) return false;
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
  }
  function addDays(s, n) {
    if (!isDate(s) || !Number.isInteger(n)) throw new TypeError('invalid-date');
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  // Today's date on this device's local calendar.
  function todayString(date) {
    const t = date || new Date();
    const pad = n => String(n).padStart(2, '0');
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }
  // Birth date + 182 days, as plain arithmetic. No medical meaning.
  function period(birthDate) {
    if (!isDate(birthDate)) return null;
    return {start: birthDate, end: addDays(birthDate, PERIOD_DAYS)};
  }
  function isOutOfPeriod(date, birthDate) {
    const p = period(birthDate);
    if (!p || !isDate(date)) return false;
    return date < p.start || date > p.end;
  }

  // --- validation of stored data ---
  function validateItem(item, ids) {
    if (!isObj(item) || !hasExactKeys(item, ITEM_KEYS)) return 'item-keys';
    if (typeof item.id !== 'string' || !ID_RE.test(item.id) || ids.has(item.id)) return 'item-id';
    ids.add(item.id);
    if (!validText(item.title, LIMITS.title)) return 'title';
    if (!CATEGORY_IDS.includes(item.category)) return 'category';
    if (item.date !== '' && !isDate(item.date)) return 'date';
    if (typeof item.done !== 'boolean') return 'done';
    if (typeof item.memo !== 'string' || len(item.memo) > LIMITS.memo) return 'memo';
    if (!Array.isArray(item.checklist) || item.checklist.length > LIMITS.checklist) return 'checklist';
    const checkIds = new Set();
    for (const c of item.checklist) {
      if (!isObj(c) || !hasExactKeys(c, CHECK_KEYS)) return 'check-keys';
      if (typeof c.id !== 'string' || !ID_RE.test(c.id) || checkIds.has(c.id)) return 'check-id';
      checkIds.add(c.id);
      if (!validText(c.text, LIMITS.checkText)) return 'check-text';
      if (typeof c.done !== 'boolean') return 'check-done';
    }
    return '';
  }
  // Returns '' when valid, otherwise a short error code.
  function validateData(value) {
    if (!isObj(value) || !hasExactKeys(value, DATA_KEYS)) return 'keys';
    if (value.version !== VERSION) return 'version';
    if (value.birthDate !== '' && !isDate(value.birthDate)) return 'birthDate';
    if (!Array.isArray(value.items) || value.items.length > LIMITS.items) return 'items';
    const ids = new Set();
    for (const item of value.items) {
      const error = validateItem(item, ids);
      if (error) return error;
    }
    return '';
  }
  function fresh() { return {version: VERSION, birthDate: '', items: []}; }
  function parseStored(raw) {
    if (raw === null) return fresh();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new Error('json'); }
    const error = validateData(parsed);
    if (error) throw new Error(error);
    return clone(parsed);
  }

  // --- pure list helpers ---
  function byDate(a, b) {
    if (a.item.date === b.item.date) return a.index - b.index;
    if (a.item.date === '') return 1;
    if (b.item.date === '') return -1;
    return a.item.date < b.item.date ? -1 : 1;
  }
  // Undone first, then by date (undated last), otherwise in the order entered.
  function sortItems(items) {
    return items.map((item, index) => ({item, index}))
      .sort((a, b) => (a.item.done === b.item.done ? byDate(a, b) : (a.item.done ? 1 : -1)))
      .map(x => clone(x.item));
  }
  function filterItems(items, filter) {
    const category = filter && filter.category ? filter.category : 'all';
    const undoneOnly = !!(filter && filter.undoneOnly);
    return items.filter(item => (category === 'all' || item.category === category) && (!undoneOnly || !item.done)).map(clone);
  }
  // In-app list only. overdue: undone, date before today. soon: undone, today <= date <= today+days.
  function upcoming(items, today, days) {
    const span = days === undefined ? SOON_DAYS : days;
    if (!isDate(today)) throw new TypeError('invalid-today');
    if (!Number.isInteger(span) || span < 0) throw new TypeError('invalid-days');
    const end = addDays(today, span);
    const dated = items.map((item, index) => ({item, index})).filter(x => !x.item.done && x.item.date !== '').sort(byDate);
    return {
      overdue: dated.filter(x => x.item.date < today).map(x => clone(x.item)),
      soon: dated.filter(x => x.item.date >= today && x.item.date <= end).map(x => clone(x.item))
    };
  }
  function exampleItems(today) {
    if (!isDate(today)) throw new TypeError('invalid-today');
    return [
      {title: '【例】架空の書類を出す', category: 'procedure', date: addDays(today, 3), memo: '架空の例です。不要になったら削除してください。', checklist: ['【例】架空の書類をそろえる', '【例】架空の窓口を調べる']},
      {title: '【例】架空の予定を確かめる', category: 'checkup', date: addDays(today, 9), memo: '架空の例です。', checklist: []},
      {title: '【例】架空のメモを見直す', category: 'care', date: addDays(today, -2), memo: '架空の例です（日付を過ぎた未完了の表示例）。', checklist: []}
    ];
  }

  let counter = 0;
  function defaultId() {
    counter += 1;
    return 'i' + Date.now().toString(36) + counter.toString(36) + Math.floor(Math.random() * 1e8).toString(36);
  }

  // --- store ---
  function createStore(storage, options) {
    const newId = options && typeof options.newId === 'function' ? options.newId : defaultId;
    let state = fresh();
    let seen; // exact stored text last read or written by this tab; undefined = unknown
    let notice = '';
    let kind = 'info';
    let stale = false;
    let blocked = false; // stored data could not be read: never overwrite it unless the user clears it
    let lastId = '';
    function say(text, nextKind) { notice = text; kind = nextKind; }
    function load() {
      stale = false;
      state = fresh();
      let raw;
      try { raw = storage.getItem(KEY); } catch (_) {
        seen = undefined; blocked = true;
        say(TEXT.unreadable, 'error');
        return false;
      }
      seen = raw;
      try { state = parseStored(raw); } catch (_) {
        state = fresh(); blocked = true;
        say(TEXT.invalid, 'error');
        return false;
      }
      blocked = false;
      say(raw === null ? TEXT.empty : TEXT.loaded, 'info');
      return true;
    }
    function takenIds() {
      const ids = new Set();
      for (const item of state.items) { ids.add(item.id); for (const c of item.checklist) ids.add(c.id); }
      return ids;
    }
    function uniqueId(taken) {
      for (let i = 0; i < 100; i++) {
        const id = String(newId());
        if (ID_RE.test(id) && !taken.has(id)) { taken.add(id); return id; }
      }
      throw new Error('no-unique-id');
    }
    function commit(next, okText, allowBlocked) {
      if (blocked && !allowBlocked) { say(TEXT.blocked, 'error'); return 'blocked'; }
      if (validateData(next)) { say(TEXT.failed, 'error'); return 'invalid'; }
      let current;
      try { current = storage.getItem(KEY); } catch (_) { say(TEXT.failed, 'error'); return 'failed'; }
      if (current !== seen) { stale = true; say(TEXT.conflict, 'conflict'); return 'conflict'; }
      const text = JSON.stringify(next);
      try {
        storage.setItem(KEY, text);
        if (storage.getItem(KEY) !== text) throw new Error('write-not-confirmed');
      } catch (_) {
        say(TEXT.failed, 'error');
        return 'failed';
      }
      state = clone(next); seen = text; stale = false; blocked = false;
      say(okText, 'saved');
      return 'saved';
    }
    function invalid(text) { say(text, 'error'); return 'invalid'; }
    // Builds a checked item from user input. Returns {item} or {error: message}.
    function build(base, fields, taken) {
      const allowed = ['category', 'checklist', 'date', 'done', 'memo', 'title'];
      if (!isObj(fields)) throw new TypeError('fields');
      for (const k of Object.keys(fields)) if (!allowed.includes(k)) throw new TypeError('unknown-field-' + k);
      const item = clone(base);
      if (fields.title !== undefined) item.title = String(fields.title).trim();
      if (!validText(item.title, LIMITS.title)) return {error: TEXT.title};
      if (fields.category !== undefined) item.category = fields.category;
      if (!CATEGORY_IDS.includes(item.category)) return {error: TEXT.category};
      if (fields.date !== undefined) item.date = String(fields.date);
      if (item.date !== '' && !isDate(item.date)) return {error: TEXT.date};
      if (fields.memo !== undefined) item.memo = String(fields.memo).replace(/\r\n?/g, '\n');
      if (len(item.memo) > LIMITS.memo) return {error: TEXT.memo};
      if (fields.done !== undefined) {
        if (typeof fields.done !== 'boolean') throw new TypeError('done');
        item.done = fields.done;
      }
      if (fields.checklist !== undefined) {
        if (!Array.isArray(fields.checklist)) throw new TypeError('checklist');
        if (fields.checklist.length > LIMITS.checklist) return {error: TEXT.checkCount};
        const own = new Set(base.checklist.map(c => c.id));
        const used = new Set();
        const list = [];
        for (const entry of fields.checklist) {
          const e = typeof entry === 'string' ? {text: entry} : entry;
          if (!isObj(e)) throw new TypeError('check-entry');
          const text = String(e.text === undefined ? '' : e.text).trim();
          if (!validText(text, LIMITS.checkText)) return {error: TEXT.checkText};
          const keep = typeof e.id === 'string' && own.has(e.id) && !used.has(e.id);
          const id = keep ? e.id : uniqueId(taken);
          used.add(id);
          list.push({id, text, done: e.done === true});
        }
        item.checklist = list;
      }
      return {item};
    }
    function find(id) { return state.items.findIndex(item => item.id === id); }
    function replaceItem(id, fields, okText) {
      const index = find(id);
      if (index < 0) { say(TEXT.missing, 'error'); return 'missing'; }
      const built = build(state.items[index], fields, takenIds());
      if (built.error) return invalid(built.error);
      const next = clone(state);
      next.items[index] = built.item;
      return commit(next, okText);
    }
    function checklistOf(id) { const i = find(id); return i < 0 ? null : clone(state.items[i].checklist); }
    function addItems(list, okText) {
      if (state.items.length + list.length > LIMITS.items) return invalid(TEXT.tooMany);
      const taken = takenIds();
      const next = clone(state);
      const added = [];
      for (const fields of list) {
        const base = {id: uniqueId(taken), title: '', category: 'procedure', date: '', done: false, memo: '', checklist: []};
        const built = build(base, fields, taken);
        if (built.error) return invalid(built.error);
        next.items.push(built.item);
        added.push(built.item.id);
      }
      const result = commit(next, okText);
      if (result === 'saved') lastId = added[added.length - 1];
      return result;
    }
    load();
    return {
      get state() { return clone(state); },
      get notice() { return notice; },
      get kind() { return kind; },
      get stale() { return stale; },
      get blocked() { return blocked; },
      get lastId() { return lastId; },
      item(id) { const i = find(id); return i < 0 ? null : clone(state.items[i]); },
      addItem(fields) { return addItems([fields], '追加しました。'); },
      updateItem(id, fields) { return replaceItem(id, fields, '保存しました。'); },
      removeItem(id) {
        const index = find(id);
        if (index < 0) { say(TEXT.missing, 'error'); return 'missing'; }
        const next = clone(state);
        next.items.splice(index, 1);
        return commit(next, '削除しました。');
      },
      setDone(id, done) { return replaceItem(id, {done: done === true}, done === true ? '完了にしました。' : '未完了に戻しました。'); },
      setMemo(id, memo) { return replaceItem(id, {memo}, 'メモを保存しました。'); },
      addCheck(id, text) {
        const list = checklistOf(id);
        if (!list) { say(TEXT.missing, 'error'); return 'missing'; }
        if (list.length >= LIMITS.checklist) return invalid(TEXT.checkCount);
        list.push({text, done: false});
        return replaceItem(id, {checklist: list}, 'チェック項目を追加しました。');
      },
      setCheckDone(id, checkId, done) {
        const list = checklistOf(id);
        const entry = list && list.find(c => c.id === checkId);
        if (!entry) { say(TEXT.missing, 'error'); return 'missing'; }
        entry.done = done === true;
        return replaceItem(id, {checklist: list}, 'チェック項目を保存しました。');
      },
      removeCheck(id, checkId) {
        const list = checklistOf(id);
        if (!list || !list.some(c => c.id === checkId)) { say(TEXT.missing, 'error'); return 'missing'; }
        return replaceItem(id, {checklist: list.filter(c => c.id !== checkId)}, 'チェック項目を削除しました。');
      },
      setBirthDate(value) {
        const date = String(value === undefined || value === null ? '' : value);
        if (date !== '' && !isDate(date)) return invalid(TEXT.birthDate);
        const next = clone(state);
        next.birthDate = date;
        return commit(next, date ? '出産日を保存しました。' : '出産日を消しました。');
      },
      addExamples(today) { return addItems(exampleItems(today), '架空の例を3件追加しました。不要になったら削除してください。'); },
      // The only write allowed while stored data is unreadable; the UI asks for confirmation first.
      clearAll() { return commit(fresh(), 'すべて削除しました。', true); },
      reload() { return load(); },
      externalChange(reloadNow) {
        if (reloadNow) {
          if (load()) say(TEXT.externalLoaded, 'info');
          return;
        }
        stale = true;
        say(TEXT.external, 'conflict');
      }
    };
  }

  root.PostpartumR6 = Object.freeze({
    KEY, VERSION, CATEGORIES, LIMITS, PERIOD_DAYS, SOON_DAYS, TEXT,
    isDate, addDays, todayString, period, isOutOfPeriod,
    validateData, parseStored, fresh, sortItems, filterItems, upcoming, exampleItems, createStore
  });
})(globalThis);
