/* R6 screen: builds the list, 近日 summary, filters, editor and settings panels.
   Uses createElement / textContent only (never HTML strings). No network.
   Exported as globalThis.PostpartumR6UI. */
(function (root) {
  'use strict';
  const COLLAPSED = 3;
  function mount(document, storage, options) {
    const R6 = root.PostpartumR6;
    const opts = options || {};
    const confirmAction = typeof opts.confirm === 'function' ? opts.confirm : () => false;
    const today = typeof opts.today === 'function' ? opts.today : () => R6.todayString(new Date());
    const store = R6.createStore(storage, {newId: opts.newId});
    const el = id => { const e = document.getElementById(id); if (!e) throw new Error('missing element ' + id); return e; };
    const view = {category: 'all', undoneOnly: false, soonOpen: false};
    let editing = null; // {id: string|null, checklist: [{id?, text, done}]}
    let editorDirty = false;

    function make(tag, className, text) {
      const e = document.createElement(tag);
      if (className) e.setAttribute('class', className);
      if (text !== undefined) e.textContent = text;
      return e;
    }
    const label = id => { const c = R6.CATEGORIES.find(x => x.id === id); return c ? c.label : ''; };
    function shortDate(date, now) {
      if (!date) return '日付なし';
      const [y, m, d] = date.split('-').map(Number);
      return (date.slice(0, 4) === now.slice(0, 4) ? '' : y + '/') + m + '/' + d;
    }
    function focus(e) { if (e && typeof e.focus === 'function') e.focus(); }

    // --- static parts built once ---
    const chipButtons = [];
    [{id: 'all', label: 'すべて'}].concat(R6.CATEGORIES).forEach(cat => {
      const b = make('button', 'chip', cat.label);
      b.setAttribute('type', 'button');
      b.setAttribute('data-category', cat.id);
      b.onclick = () => { view.category = cat.id; render(); };
      chipButtons.push(b);
      el('chips').append(b);
    });
    R6.CATEGORIES.forEach(cat => { const o = make('option', '', cat.label); o.value = cat.id; el('f-category').append(o); });

    // --- main render ---
    function renderSoon(items, now) {
      const {overdue, soon} = R6.upcoming(items, now);
      const title = '近日（今日から' + R6.SOON_DAYS + '日以内）の未完了 ' + soon.length + '件' + (overdue.length ? '・日付を過ぎた未完了 ' + overdue.length + '件' : '');
      el('soon-title').textContent = title;
      const all = overdue.map(item => ({item, group: '日付を過ぎた未完了'})).concat(soon.map(item => ({item, group: '近日'})));
      const list = el('soon-list');
      list.replaceChildren();
      if (!all.length) { list.append(make('li', 'soon-none', '近日の未完了はありません。')); el('soon-toggle').hidden = true; return; }
      const entries = all.length;
      const visible = view.soonOpen ? all : all.slice(0, COLLAPSED);
      let group = '';
      for (const row of visible) {
        if (row.group !== group) { group = row.group; list.append(make('li', 'soon-group', group)); }
        const li = make('li', group === '近日' ? 'soon-item' : 'soon-item late');
        const b = make('button', 'soon-open');
        b.setAttribute('type', 'button');
        b.append(make('span', 'date', shortDate(row.item.date, now)), make('span', 'title', row.item.title));
        b.onclick = () => openEditor(row.item.id);
        li.append(b);
        list.append(li);
      }
      const toggle = el('soon-toggle');
      toggle.hidden = entries <= COLLAPSED;
      toggle.textContent = view.soonOpen ? 'たたむ' : 'すべて表示（' + entries + '件）';
      toggle.setAttribute('aria-expanded', view.soonOpen ? 'true' : 'false');
    }
    function renderRow(item, now, birthDate) {
      const li = make('li', 'row');
      li.setAttribute('data-done', item.done ? 'true' : 'false');
      const box = make('label', 'row-check');
      const check = make('input');
      check.setAttribute('type', 'checkbox');
      check.setAttribute('aria-label', item.title + ' を完了にする');
      check.checked = item.done;
      check.onchange = () => { store.setDone(item.id, check.checked); render(); };
      box.append(check);
      const open = make('button', 'row-main');
      open.setAttribute('type', 'button');
      open.setAttribute('aria-label', item.title + ' を開く');
      open.append(make('span', 'date', shortDate(item.date, now)), make('span', 'title', item.title), make('span', 'tag', label(item.category)));
      if (item.memo) open.append(make('span', 'mark', 'メモ'));
      if (item.checklist.length) open.append(make('span', 'mark', 'チェック ' + item.checklist.filter(c => c.done).length + '/' + item.checklist.length));
      if (R6.isOutOfPeriod(item.date, birthDate)) open.append(make('span', 'mark outside', '期間外'));
      if (item.date && !item.done && item.date < now) open.append(make('span', 'mark late', '日付を過ぎた'));
      open.onclick = () => openEditor(item.id);
      li.append(box, open);
      return li;
    }
    function render() {
      const state = store.state;
      const now = today();
      el('message').textContent = store.notice;
      el('message').setAttribute('data-kind', store.kind);
      el('reload').hidden = !(store.stale || store.blocked);
      renderSoon(state.items, now);
      const p = R6.period(state.birthDate);
      el('period').textContent = p ? '出産日（' + p.start + '）〜 約6か月（' + p.end + ' ごろ）' : '出産日は未設定です（「設定」で入力できます）。';
      chipButtons.forEach(b => b.setAttribute('aria-pressed', b.getAttribute('data-category') === view.category ? 'true' : 'false'));
      el('undone-only').checked = view.undoneOnly;
      const shown = R6.sortItems(R6.filterItems(state.items, view));
      el('list-count').textContent = '表示 ' + shown.length + '件 / 全 ' + state.items.length + '件';
      el('empty').hidden = state.items.length > 0 || store.blocked;
      const list = el('list');
      list.replaceChildren();
      shown.forEach(item => list.append(renderRow(item, now, state.birthDate)));
      if (!shown.length && state.items.length) list.append(make('li', 'row-none', '条件に合う項目はありません。'));
    }

    // --- editor panel ---
    function renderChecklist() {
      const list = el('f-check-list');
      list.replaceChildren();
      editing.checklist.forEach((entry, index) => {
        const li = make('li', 'check-row');
        const box = make('label', 'check-box');
        const input = make('input');
        input.setAttribute('type', 'checkbox');
        input.checked = entry.done;
        input.onchange = () => { entry.done = input.checked; editorDirty = true; };
        box.append(input, make('span', 'check-text', entry.text));
        const remove = make('button', 'ghost small', '削除');
        remove.setAttribute('type', 'button');
        remove.setAttribute('aria-label', entry.text + ' を削除');
        remove.onclick = () => { editing.checklist.splice(index, 1); editorDirty = true; renderChecklist(); };
        li.append(box, remove);
        list.append(li);
      });
      el('f-check-count').textContent = editing.checklist.length + '/' + R6.LIMITS.checklist;
    }
    function openEditor(id) {
      const item = id ? store.item(id) : null;
      if (id && !item) { render(); return; }
      el('settings').hidden = true;
      editing = {id: item ? item.id : null, checklist: item ? item.checklist : []};
      editorDirty = false;
      el('editor-title').textContent = item ? '編集' : '追加';
      el('f-title').value = item ? item.title : '';
      el('f-category').value = item ? item.category : (view.category !== 'all' ? view.category : R6.CATEGORIES[0].id);
      el('f-date').value = item ? item.date : '';
      el('f-memo').value = item ? item.memo : '';
      el('f-done').checked = item ? item.done : false;
      el('f-check-text').value = '';
      el('f-error').textContent = '';
      el('f-delete').hidden = !item;
      renderChecklist();
      el('editor').hidden = false;
      focus(el('f-title'));
    }
    function closeEditor() { editing = null; editorDirty = false; el('editor').hidden = true; }
    ['f-title', 'f-category', 'f-date', 'f-memo', 'f-done'].forEach(id => {
      const field = el(id);
      field.oninput = () => { editorDirty = true; };
      field.onchange = () => { editorDirty = true; };
    });
    el('f-check-add').onclick = () => {
      const text = String(el('f-check-text').value).trim();
      if (editing.checklist.length >= R6.LIMITS.checklist) { el('f-error').textContent = R6.TEXT.checkCount; return; }
      if (!text || [...text].length > R6.LIMITS.checkText) { el('f-error').textContent = R6.TEXT.checkText; return; }
      editing.checklist.push({text, done: false});
      el('f-check-text').value = '';
      el('f-error').textContent = '';
      editorDirty = true;
      renderChecklist();
    };
    el('f-save').onclick = () => {
      const fields = {
        title: el('f-title').value, category: el('f-category').value, date: el('f-date').value,
        memo: el('f-memo').value, done: el('f-done').checked === true,
        checklist: editing.checklist.map(c => (c.id ? {id: c.id, text: c.text, done: c.done} : {text: c.text, done: c.done}))
      };
      const result = editing.id ? store.updateItem(editing.id, fields) : store.addItem(fields);
      if (result === 'saved') closeEditor();
      else el('f-error').textContent = store.notice;
      render();
    };
    el('f-cancel').onclick = () => {
      if (editorDirty && !confirmAction('保存していない変更を破棄して閉じますか？')) return;
      closeEditor(); render();
    };
    el('f-delete').onclick = () => {
      const item = editing && editing.id ? store.item(editing.id) : null;
      if (!item) { closeEditor(); render(); return; }
      if (!confirmAction('「' + item.title + '」を削除しますか？元に戻せません。')) return;
      if (store.removeItem(item.id) === 'saved') closeEditor();
      else el('f-error').textContent = store.notice;
      render();
    };

    // --- main controls ---
    el('add').onclick = () => openEditor(null);
    el('examples').onclick = () => { store.addExamples(today()); render(); };
    el('undone-only').onchange = () => { view.undoneOnly = el('undone-only').checked === true; render(); };
    el('soon-toggle').onclick = () => { view.soonOpen = !view.soonOpen; render(); };
    el('reload').onclick = () => {
      if (editing && editorDirty && !confirmAction('保存していない変更を破棄して、最新の内容を読み込みますか？')) return;
      closeEditor(); store.reload(); render();
    };

    // --- settings panel ---
    el('settings-open').onclick = () => {
      if (editing) return;
      el('s-birth').value = store.state.birthDate;
      el('settings').hidden = false;
      focus(el('s-birth'));
    };
    el('s-close').onclick = () => { el('settings').hidden = true; };
    el('s-birth-save').onclick = () => { if (store.setBirthDate(el('s-birth').value) === 'saved') el('settings').hidden = true; render(); };
    el('s-birth-clear').onclick = () => { if (store.setBirthDate('') === 'saved') { el('s-birth').value = ''; el('settings').hidden = true; } render(); };
    el('s-clear-all').onclick = () => {
      if (!confirmAction('この端末に保存したすべての項目と出産日を削除しますか？元に戻せません。')) return;
      if (store.clearAll() === 'saved') el('settings').hidden = true;
      render();
    };

    render();
    return {
      store,
      render,
      openEditor,
      isDirty() { return !!editing && editorDirty; },
      // Another tab changed the stored data. Without unsaved edits, show it now;
      // otherwise keep the edits and ask the user to reload explicitly.
      externalChange() {
        const clean = !(editing && editorDirty);
        if (clean && editing) closeEditor();
        store.externalChange(clean);
        render();
      }
    };
  }
  root.PostpartumR6UI = Object.freeze({mount});
})(globalThis);
