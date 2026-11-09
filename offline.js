/* R5: fixed fictional data only. No network, credentials, dates or free text. */
(function (root) {
  'use strict';
  const IDS = ['demo-schedule-a', 'demo-progress-b'];
  const STATES = ['todo', 'doing', 'done'];
  const LABELS = ['架空の予定 A', '架空の進捗 B'];
  const NAMES = {todo: '未着手', doing: '進行中', done: '完了'};
  const KEY = 'postpartum-r5-fictional-v1';
  const RELOAD_LABEL = '「保存済みの状態を読み込み直す」';
  function fresh() { return {version: 1, statuses: ['todo', 'todo']}; }
  function valid(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === 'statuses,version' && value.version === 1
      && Array.isArray(value.statuses) && value.statuses.length === 2
      && value.statuses.every(s => STATES.includes(s));
  }
  function parseStored(raw) {
    if (raw === null) return fresh();
    const parsed = JSON.parse(raw);
    if (!valid(parsed)) throw new Error('invalid-demo-data');
    return {version: 1, statuses: [...parsed.statuses]};
  }
  function createStore(storage) {
    let state = fresh();
    // The exact stored text this tab last read or wrote. undefined = unknown (could not read).
    let seen;
    let notice = '';
    let kind = 'info';
    let stale = false;
    function say(text, nextKind) { notice = text; kind = nextKind; }
    function load() {
      stale = false;
      state = fresh();
      let raw;
      try { raw = storage.getItem(KEY); } catch (_) {
        seen = undefined;
        say('保存データを読み込めません。架空の初期状態で表示しています。', 'error');
        return false;
      }
      seen = raw;
      try { state = parseStored(raw); } catch (_) {
        state = fresh();
        say('保存データを読み込めません。架空の初期状態で表示しています。', 'error');
        return false;
      }
      say(raw === null ? '架空データを表示しています。実際の予定管理には使わないでください。' : 'この端末に保存した架空の状態を読み込みました。', 'info');
      return true;
    }
    function write(text) {
      storage.setItem(KEY, text);
      if (storage.getItem(KEY) !== text) throw new Error('write-not-confirmed');
    }
    load();
    return {
      get state() { return {version: 1, statuses: [...state.statuses]}; },
      get notice() { return notice; },
      get kind() { return kind; },
      get stale() { return stale; },
      set(index, status) {
        if (!Number.isInteger(index) || index < 0 || index >= IDS.length || !STATES.includes(status)) throw new Error('invalid-choice');
        let current;
        try { current = storage.getItem(KEY); } catch (_) {
          say('保存できませんでした。保存先を確認できません。表示は最後に保存した状態のままです。', 'error');
          return 'failed';
        }
        if (current !== seen) {
          stale = true;
          say('別のタブなどで保存内容が変わっていたため、上書きせずに保存を中止しました。' + RELOAD_LABEL + 'を押してから選び直してください。', 'conflict');
          return 'conflict';
        }
        const next = {version: 1, statuses: [...state.statuses]};
        next.statuses[index] = status;
        const text = JSON.stringify(next);
        try { write(text); } catch (_) {
          say('保存できませんでした。表示は最後に保存した状態のままです。', 'error');
          return 'failed';
        }
        state = next; seen = text; stale = false;
        say('架空の状態をこの端末に保存しました。', 'saved');
        return 'saved';
      },
      reset() {
        const text = JSON.stringify(fresh());
        try { write(text); } catch (_) {
          say('初期化を保存できませんでした。状態は変更していません。', 'error');
          return 'failed';
        }
        state = fresh(); seen = text; stale = false;
        say('架空の状態を初期化しました。', 'saved');
        return 'saved';
      },
      reload() { return load(); },
      externalChange(reloadNow) {
        if (reloadNow) {
          if (load()) say('別のタブなどでの変更を検知し、最新の保存内容を表示しました。', 'info');
          return;
        }
        stale = true;
        say('別のタブなどでこのデモの保存内容が変わりました。' + RELOAD_LABEL + 'を押すと最新の状態を表示します。', 'conflict');
      }
    };
  }
  function mount(document, storage, confirmAction) {
    const model = createStore(storage);
    const el = id => document.getElementById(id);
    const controls = [];
    const marks = [];
    const ALL = [0, 1];
    function dirtyCount() {
      const saved = model.state.statuses;
      return controls.filter((select, i) => select.value !== saved[i]).length;
    }
    function render(syncIndexes) {
      const saved = model.state.statuses;
      syncIndexes.forEach(i => { controls[i].value = saved[i]; });
      controls.forEach((select, i) => {
        const changed = select.value !== saved[i];
        marks[i].textContent = changed ? '未保存（保存済みは「' + NAMES[saved[i]] + '」）' : '保存済み';
        marks[i].setAttribute('data-dirty', changed ? 'true' : 'false');
      });
      const dirty = dirtyCount();
      el('dirty').textContent = dirty ? '未保存の変更が ' + dirty + ' 件あります。「保存」を押すまで保存されません。' : '未保存の変更はありません。';
      el('dirty').setAttribute('data-dirty', dirty ? 'true' : 'false');
      el('progress').textContent = '保存済みの完了 ' + saved.filter(s => s === 'done').length + ' / 2';
      el('message').textContent = model.notice;
      el('message').setAttribute('data-kind', model.kind);
      el('reload').setAttribute('data-attention', model.stale ? 'true' : 'false');
    }
    LABELS.forEach((label, index) => {
      const card = document.createElement('article');
      const title = document.createElement('h2'); title.textContent = label;
      const select = document.createElement('select'); select.setAttribute('aria-label', label + 'の状態');
      STATES.forEach(status => { const option = document.createElement('option'); option.value = status; option.textContent = NAMES[status]; select.append(option); });
      const mark = document.createElement('span'); mark.setAttribute('class', 'mark');
      const button = document.createElement('button'); button.textContent = '保存';
      select.onchange = () => render([]);
      button.onclick = () => {
        const result = model.set(index, select.value);
        // failed: show the last saved value again. conflict: keep the choice until the user reloads.
        render(result === 'conflict' ? [] : [index]);
      };
      controls.push(select); marks.push(mark); card.append(title, select, mark, button); el('tasks').append(card);
    });
    el('reload').onclick = () => {
      if (dirtyCount() > 0 && !confirmAction('未保存の変更を破棄して、保存済みの状態を読み込み直しますか？')) return;
      model.reload(); render(ALL);
    };
    el('reset').onclick = () => {
      if (!confirmAction('この端末のR5架空データ2件を初期化しますか？')) return;
      render(model.reset() === 'saved' ? ALL : []);
    };
    render(ALL);
    return {
      model,
      isDirty() { return dirtyCount() > 0; },
      // Another tab changed the stored data. Without unsaved choices, show it now;
      // otherwise keep the user's choices and ask them to reload explicitly.
      externalChange() { const clean = dirtyCount() === 0; model.externalChange(clean); render(clean ? ALL : []); }
    };
  }
  root.PostpartumR5 = {fresh, valid, createStore, mount, KEY};
})(globalThis);
