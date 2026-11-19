(() => {
  const ROWS = 'ABCDEFGHI';
  const params = new URLSearchParams(location.search);
  const cfg = {
    channel: (params.get('channel') || '').trim(),
    difficulty: (params.get('difficulty') || 'rotate').toLowerCase(), // 1-10, easy/medium/hard, or rotate
    variant: (params.get('variant') || 'mix').toLowerCase(), // classic, diagonal, windoku, centerdot, asterisk, or mix
    prefix: params.get('prefix') || '',
    hintAfter: num(params.get('hint'), 60), // seconds with no progress before a free cell is revealed (0 = off)
    cooldown: num(params.get('cooldown'), 3), // seconds a player waits after a wrong guess
    nextIn: num(params.get('next'), 30), // seconds between puzzles
    maxPerMsg: num(params.get('max'), 3), // moves accepted from a single chat message
    demo: params.get('demo') === '1',
    test: params.get('test') === '1',
    transparent: params.get('bg') === 'transparent',
    notes: params.get('notes') !== '0', // viewers can pencil in notes, e.g. B7?35
  };

  const POINTS = { correct: 10, unit: 5, finish: 10, wrong: -2 };
  const ROTATION = [3, 5, 8]; // levels used by difficulty=rotate
  const LS_ALL = 'numbersonstream.alltime';
  const LS_CUR = 'numbersonstream.current';
  const LS_CMD = 'numbersonstream.cmd';
  const LS_STATUS = 'numbersonstream.status';
  const LS_HEARTBEAT = 'numbersonstream.heartbeat';
  const LS_SETTINGS = 'numbersonstream.settings';

  function num(v, d) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }
  const $ = (s) => document.querySelector(s);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  // ---------- Setup screen (no channel given) ----------
  if (!cfg.channel && !cfg.demo) {
    document.body.classList.add('setup-mode');
    const form = $('#setup-form');
    const out = $('#setup-url');
    const update = () => {
      const fd = new FormData(form);
      const u = new URL(location.href.split('?')[0]);
      for (const [k, v] of fd.entries()) if (v !== '') u.searchParams.set(k, v);
      if (!fd.get('bg')) u.searchParams.delete('bg');
      u.searchParams.delete('rotate');
      if (fd.get('notes')) u.searchParams.delete('notes'); else u.searchParams.set('notes', '0');
      if (fd.get('rotate')) u.searchParams.set('difficulty', 'rotate');
      // OBS WebSocket link: same settings go on both the game and control URLs.
      const c = new URL('control.html', u);
      const useObs = !!fd.get('obs');
      form.querySelector('.obs-box').classList.toggle('on', useObs);
      for (const k of ['obs', 'obspass', 'obsport']) u.searchParams.delete(k);
      if (useObs) {
        for (const x of [u, c]) {
          x.searchParams.set('obs', '1');
          if (fd.get('obspass')) x.searchParams.set('obspass', fd.get('obspass'));
          if (fd.get('obsport') && fd.get('obsport') !== '4455') x.searchParams.set('obsport', fd.get('obsport'));
        }
      }
      $('#setup-control-url').value = c.toString();
      const lv = +form.difficulty.value;
      $('#setup-level').textContent = fd.get('rotate') ? 'Rotating 3 → 5 → 8' : `${lv} · ${Sudoku.LEVELS[lv].name}`;
      form.difficulty.disabled = !!fd.get('rotate');
      out.value = u.toString();
    };
    form.addEventListener('input', update);
    form.addEventListener('submit', (e) => { e.preventDefault(); update(); location.href = out.value; });
    $('#setup-copy').addEventListener('click', () => { update(); out.select(); navigator.clipboard?.writeText(out.value); });
    $('#setup-copy-control').addEventListener('click', () => { update(); const c = $('#setup-control-url'); c.select(); navigator.clipboard?.writeText(c.value); });
    $('#setup-demo').addEventListener('click', () => { location.search = '?demo=1'; });
    update();
    return;
  }

  if (cfg.transparent) document.body.classList.add('transparent');

  // ---------- State ----------
  let state = null; // { puzzle, solution, grid, owners, scores, level, variant, tech, mixIndex, round, startedAt, lastProgress }
  let allTime = store.get(LS_ALL, {});
  const cooldowns = new Map();
  let roundOver = false;
  let nextTimer = null;

  // Live settings for upcoming puzzles. Start from the URL; the control page and
  // mod commands can change them. Saved overrides only apply while the URL is unchanged.
  const urlSig = `${cfg.difficulty}|${cfg.variant}`;
  let urlChanged = false;
  const settings = (() => {
    const s = store.get(LS_SETTINGS, null);
    if (s && s.urlSig === urlSig) return s;
    urlChanged = !!s;
    return { urlSig, level: cfg.difficulty === 'rotate' ? 'rotate' : Sudoku.toLevel(cfg.difficulty), variant: validVariant(cfg.variant) ? cfg.variant : 'mix' };
  })();
  function validVariant(v) { return v === 'mix' || !!Sudoku.VARIANTS[v]; }
  function saveSettings() { store.set(LS_SETTINGS, settings); }
  saveSettings();

  // Old saves stored 'easy'/'medium'/'hard'; map them onto 1-10.
  function levelOf(s) { return s ? Sudoku.toLevel(s.level ?? s.difficulty) : 0; }

  function nextLevel() {
    if (settings.level !== 'rotate') return settings.level;
    const prev = ROTATION.indexOf(levelOf(state));
    return ROTATION[(prev + 1) % ROTATION.length];
  }

  function nextVariant() {
    if (settings.variant !== 'mix') return settings.variant;
    const order = Sudoku.VARIANT_ORDER;
    const at = state && Number.isInteger(state.mixIndex) ? state.mixIndex : -1;
    return { variant: order[(at + 1) % order.length], mixIndex: (at + 1) % order.length };
  }

  // "7", "diagonal", "diagonal 7", "hard windoku" ... -> { level, variant }
  function parseNewArgs(arg) {
    const out = {};
    for (const w of String(arg || '').toLowerCase().split(/\s+/).filter(Boolean)) {
      if (Sudoku.VARIANTS[w]) out.variant = w;
      else if (/^\d+$/.test(w) || ['easy', 'medium', 'hard', 'expert'].includes(w)) out.level = Sudoku.toLevel(w);
    }
    return out;
  }

  function newRound(opts = {}) {
    clearInterval(nextTimer);
    roundOver = false;
    $('#overlay').classList.remove('show');
    const level = opts.level || nextLevel();
    let variant = opts.variant, mixIndex = state ? state.mixIndex : undefined;
    if (!variant) {
      const v = nextVariant();
      if (typeof v === 'string') variant = v; else ({ variant, mixIndex } = v);
    }
    const p = Sudoku.generate(level, variant);
    state = {
      puzzle: p.puzzle, solution: p.solution,
      grid: p.puzzle.slice(),
      notes: new Array(81).fill(0), // pencil marks: bit v set = note v
      owners: new Array(81).fill(null),
      scores: {},
      level: p.level,
      variant: p.variant,
      tech: p.tech,
      mixIndex,
      round: (state ? state.round : 0) + 1,
      startedAt: Date.now(),
      lastProgress: Date.now(),
    };
    save();
    renderAll();
    const geo = Sudoku.geometry(state.variant);
    const label = `${geo.key === 'classic' ? '' : geo.name + ' '}puzzle (level ${state.level} · ${Sudoku.LEVELS[state.level].name})`;
    feed({ type: 'system', text: `New ${label}! Type a cell and a number, e.g. B7 4` });
    if (geo.rule) feed({ type: 'system', text: `Twist: ${geo.rule}` });
  }

  function save() { store.set(LS_CUR, state); store.set(LS_ALL, allTime); }

  // ---------- Colors ----------
  function hashHue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
  function readableColor(hex, name) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return `hsl(${hashHue(name)} 80% 68%)`;
    const n = parseInt(m[1], 16);
    let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return `hsl(${Math.round(h)} ${Math.round(Math.max(s, 0.55) * 100)}% ${Math.round(Math.min(Math.max(l, 0.62), 0.8) * 100)}%)`;
  }

  // ---------- Chat parsing ----------
  // Accepts "B7 4", "b7=4", "B74", "!B7 4" and several moves per message.
  const MOVE_RE = /(?:^|[^A-Za-z0-9])([A-Ia-i])([1-9])\s*[=:\-]?\s*([1-9])(?![0-9])/g;

  // Notes: "B7?35" pencils in 3 and 5, "B7?-3" rubs out 3, "B7?x" (or "B7?0") clears the cell.
  const NOTE_RE = /(?:^|[^A-Za-z0-9])([A-Ia-i])([1-9])\s*\?\s*(-?)\s*([1-9](?:[\s,]*[1-9]){0,8}|[0xX])(?![0-9A-Za-z])/g;

  function stripPrefix(text) {
    const t = text.trim();
    if (!cfg.prefix) return t;
    return t.toLowerCase().startsWith(cfg.prefix.toLowerCase()) ? t.slice(cfg.prefix.length) : null;
  }

  function parseNotes(text) {
    const t = stripPrefix(text);
    if (t === null || !cfg.notes) return [];
    const out = [];
    for (const m of t.matchAll(NOTE_RE)) {
      const clear = /^[0x]$/i.test(m[4]);
      const mask = clear ? 0 : [...m[4].replace(/[^1-9]/g, '')].reduce((a, d) => a | (1 << +d), 0);
      out.push({ index: ROWS.indexOf(m[1].toUpperCase()) * 9 + (+m[2] - 1), op: clear ? 'clear' : m[3] ? 'remove' : 'add', mask });
      if (out.length >= cfg.maxPerMsg) break;
    }
    return out;
  }

  function parseMoves(text) {
    const t = stripPrefix(text);
    if (t === null) return [];
    const moves = [];
    for (const m of t.matchAll(MOVE_RE)) {
      moves.push({ index: ROWS.indexOf(m[1].toUpperCase()) * 9 + (+m[2] - 1), value: +m[3], label: m[1].toUpperCase() + m[2] });
      if (moves.length >= cfg.maxPerMsg) break;
    }
    return moves;
  }

  function handleChat(msg) {
    const text = msg.text.trim();
    if (/^!sudoku\b/i.test(text)) return handleCommand(msg, text);
    if (roundOver || !state) return;
    const notes = parseNotes(text);
    if (notes.length) applyNotes(notes);
    const moves = parseMoves(text);
    if (!moves.length) { if (notes.length) save(); return; }
    const now = Date.now();
    if ((cooldowns.get(msg.user) || 0) > now) return;
    const player = { user: msg.user, name: msg.displayName, color: readableColor(msg.color, msg.user) };
    for (const mv of moves) {
      if (state.grid[mv.index]) continue; // already filled (given or solved)
      if (state.solution[mv.index] === mv.value) {
        correct(player, mv);
        if (roundOver) break;
      } else {
        wrong(player, mv);
        cooldowns.set(msg.user, now + cfg.cooldown * 1000);
        break;
      }
    }
    save();
  }

  function handleCommand(msg, text) {
    const [, sub = '', ...rest] = text.toLowerCase().split(/\s+/);
    const arg = rest.join(' ');
    if (sub === 'score' || sub === 'rank') return; // reserved; scores are always on screen
    if (!(msg.isMod || msg.isBroadcaster)) return;
    runCommand(sub, arg);
  }

  // Shared by mod chat commands, hotkeys and the control page.
  function runCommand(sub, arg) {
    if (sub === 'new' || sub === 'skip') newRound(parseNewArgs(arg));
    else if (sub === 'level' || sub === 'difficulty') {
      const a = String(arg).trim().toLowerCase();
      if (!a) return;
      settings.level = a === 'rotate' ? 'rotate' : Sudoku.toLevel(a);
      saveSettings();
      feed({ type: 'system', text: settings.level === 'rotate' ? 'Difficulty will rotate 3 → 5 → 8' : `Next puzzles: level ${settings.level} · ${Sudoku.LEVELS[settings.level].name}` });
    } else if (sub === 'variant') {
      const a = String(arg).trim().toLowerCase();
      if (!validVariant(a)) return;
      settings.variant = a;
      saveSettings();
      feed({ type: 'system', text: a === 'mix' ? 'Variants will mix it up' : `Next puzzles: ${Sudoku.VARIANTS[a].name}` });
    }
    else if (sub === 'hint') giveHint();
    else if (sub === 'resetscores') { allTime = {}; save(); renderBoards(); feed({ type: 'system', text: 'All-time scores reset' }); }
    else if (sub === 'clearnotes') { clearAllNotes(); feed({ type: 'system', text: 'All notes cleared' }); }
    else if (sub === 'resetround') {
      if (state) { state.scores = {}; save(); renderBoards(); feed({ type: 'system', text: 'Scores for this puzzle reset' }); }
    }
  }

  // ---------- Notes ----------
  // Shared by the whole chat; never scored or checked, just a scratchpad.
  function applyNotes(list) {
    for (const n of list) {
      if (state.grid[n.index]) continue;
      const before = state.notes[n.index];
      if (n.op === 'clear') state.notes[n.index] = 0;
      else if (n.op === 'remove') state.notes[n.index] &= ~n.mask;
      else state.notes[n.index] |= n.mask;
      if (state.notes[n.index] !== before) renderCell(n.index, 'noted');
    }
  }

  // When a cell is filled: wipe its notes and rub that number out of every cell it now rules out.
  function cleanNotes(i) {
    const v = state.grid[i];
    state.notes[i] = 0;
    for (const p of Sudoku.geometry(state.variant).peers[i]) {
      if (state.notes[p] & (1 << v)) { state.notes[p] &= ~(1 << v); renderCell(p); }
    }
  }

  function clearAllNotes() {
    if (!state) return;
    state.notes = new Array(81).fill(0);
    cells.forEach((_, i) => renderCell(i));
    save();
  }

  // ---------- Scoring ----------
  function addPoints(player, pts) {
    const r = (state.scores[player.user] ||= { name: player.name, color: player.color, points: 0, cells: 0 });
    const a = (allTime[player.user] ||= { name: player.name, color: player.color, points: 0, cells: 0, wins: 0 });
    r.name = a.name = player.name; r.color = a.color = player.color;
    r.points = Math.max(0, r.points + pts);
    a.points = Math.max(0, a.points + pts);
    if (pts > 0 && pts >= POINTS.correct) { r.cells++; a.cells++; }
  }

  // Regions (rows, columns, boxes and variant regions) through cell i that are now full.
  function fullUnits(i) {
    const geo = Sudoku.geometry(state.variant);
    return geo.cellUnits[i].map((u) => geo.units[u]).filter((u) => u.cells.every((j) => state.grid[j]));
  }
  function completedUnits(i) { return fullUnits(i).map((u) => u.label); }

  function correct(player, mv) {
    state.grid[mv.index] = mv.value;
    state.owners[mv.index] = { name: player.name, color: player.color };
    state.lastProgress = Date.now();
    cleanNotes(mv.index);
    let pts = POINTS.correct;
    const units = completedUnits(mv.index);
    pts += units.length * POINTS.unit;
    const finished = state.grid.every(Boolean);
    if (finished) pts += POINTS.finish;
    addPoints(player, pts);
    renderCell(mv.index, 'pop');
    if (units.length) flashUnits(mv.index, units.length);
    feed({ type: 'good', player, text: `${mv.label} = ${mv.value}`, pts, extra: units.length ? `completed ${units.join(' + ')}` : '' });
    renderBoards();
    if (finished) endRound();
  }

  function wrong(player, mv) {
    addPoints(player, POINTS.wrong);
    const cell = cells[mv.index];
    cell.num.textContent = mv.value;
    cell.el.classList.remove('wrong'); void cell.el.offsetWidth; cell.el.classList.add('wrong');
    setTimeout(() => { cell.el.classList.remove('wrong'); renderCell(mv.index); }, 900);
    feed({ type: 'bad', player, text: `${mv.label} ≠ ${mv.value}`, pts: POINTS.wrong });
    renderBoards();
  }

  function giveHint() {
    if (roundOver || !state) return;
    const empty = state.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    if (!empty.length) return;
    const i = empty[Math.floor(Math.random() * empty.length)];
    state.grid[i] = state.solution[i];
    state.owners[i] = { hint: true };
    state.lastProgress = Date.now();
    cleanNotes(i);
    renderCell(i, 'pop');
    feed({ type: 'system', text: `Hint: ${ROWS[Sudoku.row(i)]}${Sudoku.col(i) + 1} = ${state.solution[i]}` });
    save();
    if (state.grid.every(Boolean)) endRound();
  }

  function ranked(obj) { return Object.entries(obj).map(([user, s]) => ({ user, ...s })).sort((a, b) => b.points - a.points || b.cells - a.cells); }

  function endRound() {
    roundOver = true;
    const top = ranked(state.scores);
    if (top[0]) allTime[top[0].user].wins = (allTime[top[0].user].wins || 0) + 1;
    save();
    renderBoards();
    const secs = Math.round((Date.now() - state.startedAt) / 1000);
    const geo = Sudoku.geometry(state.variant);
    $('#ov-time').textContent = `${geo.name} · level ${state.level} — solved in ${fmtTime(secs)} by ${top.length} player${top.length === 1 ? '' : 's'}`;
    const list = $('#ov-list'); list.replaceChildren();
    top.slice(0, 5).forEach((p, idx) => list.append(row(idx + 1, p.name, p.color, `${p.points} pts · ${p.cells} cells`)));
    $('#ov-mvp').textContent = top[0] ? top[0].name : 'Nobody — hints solved it!';
    $('#ov-mvp').style.color = top[0] ? top[0].color : '';
    $('#overlay').classList.add('show');
    let left = cfg.nextIn;
    $('#ov-next').textContent = left;
    nextTimer = setInterval(() => {
      left--;
      $('#ov-next').textContent = Math.max(0, left);
      if (left <= 0) newRound();
    }, 1000);
  }

  // ---------- Rendering ----------
  const cells = [];
  function buildBoard() {
    const board = $('#board');
    const corner = document.createElement('div'); corner.className = 'lbl'; board.append(corner);
    for (let c = 1; c <= 9; c++) { const l = document.createElement('div'); l.className = 'lbl col'; l.textContent = c; board.append(l); }
    for (let r = 0; r < 9; r++) {
      const l = document.createElement('div'); l.className = 'lbl row'; l.textContent = ROWS[r]; board.append(l);
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        const el = document.createElement('div');
        el.className = 'cell';
        if (c % 3 === 2 && c < 8) el.classList.add('br');
        if (r % 3 === 2 && r < 8) el.classList.add('bb');
        const numEl = document.createElement('span'); numEl.className = 'num';
        const who = document.createElement('span'); who.className = 'who';
        const coord = document.createElement('span'); coord.className = 'coord'; coord.textContent = ROWS[r] + (c + 1);
        const notesEl = document.createElement('div'); notesEl.className = 'notes';
        for (let d = 1; d <= 9; d++) { const s = document.createElement('span'); s.textContent = d; notesEl.append(s); }
        el.append(coord, notesEl, numEl, who);
        board.append(el);
        cells.push({ el, num: numEl, who, notes: notesEl });
      }
    }
  }

  function renderCell(i, anim) {
    const { el, num: n, who } = cells[i];
    const v = state.grid[i];
    const owner = state.owners[i];
    el.classList.toggle('given', !!state.puzzle[i]);
    el.classList.toggle('empty', !v);
    el.classList.toggle('hint', !!(owner && owner.hint));
    el.classList.toggle('claimed', !!(owner && !owner.hint));
    n.textContent = v || '';
    n.style.color = owner && !owner.hint ? owner.color : '';
    who.textContent = owner ? (owner.hint ? 'hint' : owner.name) : '';
    who.style.color = owner && !owner.hint ? owner.color : '';
    const mask = v ? 0 : (state.notes && state.notes[i]) || 0;
    el.classList.toggle('has-notes', !!mask);
    [...cells[i].notes.children].forEach((s, k) => s.classList.toggle('on', !!(mask & (1 << (k + 1)))));
    if (anim) { el.classList.remove(anim); void el.offsetWidth; el.classList.add(anim); }
  }

  function flashUnits(i, count) {
    const hits = fullUnits(i).flatMap((u) => u.cells);
    for (const j of new Set(hits)) { const el = cells[j].el; el.classList.remove('unit'); void el.offsetWidth; el.classList.add('unit'); }
  }

  function row(rank, name, color, detail) {
    const li = document.createElement('li');
    const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = rank;
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = name; nm.style.color = color;
    const dt = document.createElement('span'); dt.className = 'dt'; dt.textContent = detail;
    li.append(rk, nm, dt);
    return li;
  }

  function renderBoards() {
    const r = $('#round-list'); r.replaceChildren();
    const rr = ranked(state.scores).slice(0, 5);
    rr.forEach((p, i) => r.append(row(i + 1, p.name, p.color, `${p.points}`)));
    if (!rr.length) r.append(Object.assign(document.createElement('li'), { className: 'empty-li', textContent: 'No points yet — be first!' }));
    const a = $('#all-list'); a.replaceChildren();
    const aa = ranked(allTime).slice(0, 5);
    aa.forEach((p, i) => a.append(row(i + 1, p.name, p.color, `${p.points}${p.wins ? ` · ${p.wins}🏆` : ''}`)));
    if (!aa.length) a.append(Object.assign(document.createElement('li'), { className: 'empty-li', textContent: '—' }));
  }

  function tier(level) { return level <= 3 ? 'easy' : level <= 5 ? 'medium' : level <= 7 ? 'hard' : 'expert'; }

  function renderAll() {
    const geo = Sudoku.geometry(state.variant);
    cells.forEach(({ el }) => el.classList.remove('x-diag', 'x-win', 'x-dot', 'x-star'));
    for (const u of geo.extra) for (const c of u.cells) cells[c].el.classList.add(u.cls);
    $('#board').dataset.variant = geo.key;
    cells.forEach((_, i) => renderCell(i));
    $('#round-no').textContent = `Puzzle #${state.round}`;
    $('#difficulty').textContent = `Lv ${state.level} · ${Sudoku.LEVELS[state.level].name}`;
    $('#difficulty').dataset.level = tier(state.level);
    $('#variant').textContent = geo.name;
    $('#variant').hidden = geo.key === 'classic';
    $('#rule').textContent = geo.rule;
    $('#rule').hidden = !geo.rule;
    renderBoards();
  }

  function feed(item) {
    const ul = $('#feed');
    const li = document.createElement('li');
    li.className = item.type;
    if (item.player) {
      const nm = document.createElement('b'); nm.textContent = item.player.name; nm.style.color = item.player.color;
      li.append(nm, ' ');
    }
    const t = document.createElement('span'); t.textContent = item.text; li.append(t);
    if (item.pts) { const p = document.createElement('em'); p.textContent = (item.pts > 0 ? ' +' : ' ') + item.pts; li.append(p); }
    if (item.extra) { const x = document.createElement('small'); x.textContent = ' ' + item.extra; li.append(x); }
    ul.prepend(li);
    while (ul.children.length > 8) ul.lastChild.remove();
  }

  function fmtTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function tick() {
    if (!state) return;
    if (!roundOver) {
      const secs = Math.floor((Date.now() - state.startedAt) / 1000);
      $('#timer').textContent = fmtTime(secs);
      const filled = state.grid.filter(Boolean).length;
      $('#progress-bar').style.width = `${(filled / 81) * 100}%`;
      $('#remaining').textContent = `${81 - filled} left`;
      if (cfg.hintAfter > 0) {
        const idle = (Date.now() - state.lastProgress) / 1000;
        const left = Math.ceil(cfg.hintAfter - idle);
        $('#hint-in').textContent = left > 0 ? `hint in ${left}s` : '';
        if (left <= 0) giveHint();
      }
    }
  }

  // ---------- Status ----------
  function setStatus(s, detail) {
    store.set(LS_STATUS, { text: statusText(s, detail), state: s });
    const el = $('#status');
    el.dataset.state = s;
    el.textContent = statusText(s, detail);
  }
  function statusText(s, detail) {
    return s === 'connected' ? `● reading #${detail}` : s === 'connecting' ? '○ connecting…' : s === 'demo' ? '● demo mode' : `○ disconnected — ${detail || ''}`;
  }

  // ---------- Control page link ----------
  // control.html sends commands through localStorage (storage event) and a
  // BroadcastChannel; both reach every page of the same origin in OBS.
  const seenCmds = new Set();
  function onControl(c, remote) {
    // Remote commands can come from another device whose clock differs, so only de-dupe those.
    if (!c || !c.id || seenCmds.has(c.id) || (!remote && Date.now() - c.t > 10000)) return;
    seenCmds.add(c.id);
    if (c.cmd === 'chat') handleChat({ user: 'streamer', displayName: c.name || 'Streamer', color: '#FFD700', isBroadcaster: true, isMod: true, text: String(c.arg || '') });
    else runCommand(c.cmd, c.arg || '');
  }
  window.addEventListener('storage', (e) => { if (e.key === LS_CMD && e.newValue) { try { onControl(JSON.parse(e.newValue)); } catch {} } });
  try { new BroadcastChannel('numbersonstream').onmessage = (e) => onControl(e.data); } catch {}
  setInterval(() => store.set(LS_HEARTBEAT, Date.now()), 1000);

  // Optional OBS WebSocket link (?obs=1), so the control page can run as an OBS
  // dock, in a normal browser or on another device.
  const obsCfg = ObsBridge.fromParams(params);
  if (obsCfg) {
    const bridge = ObsBridge.connect({
      ...obsCfg,
      onMessage: (m) => { if (m.kind === 'cmd') onControl(m, true); else if (m.kind === 'hello') sendSnapshot(); },
    });
    function sendSnapshot() {
      if (!state) return;
      const top = ranked(state.scores).slice(0, 10).map(({ name, color, points }) => ({ name, color, points }));
      bridge.send({
        kind: 'state', beat: Date.now(), status: store.get(LS_STATUS, null), settings,
        cur: { round: state.round, level: state.level, variant: state.variant, filled: state.grid.filter(Boolean).length, top },
      });
    }
    setInterval(sendSnapshot, 1000);
  }

  // ---------- Boot ----------
  buildBoard();
  $('#how-prefix').textContent = cfg.prefix;
  $('#how-prefix2').textContent = cfg.prefix;
  document.querySelectorAll('.how-prefix-n').forEach((e) => { e.textContent = cfg.prefix; });
  $('#how-notes').hidden = !cfg.notes;
  const saved = store.get(LS_CUR, null);
  if (saved && saved.solution && saved.grid && !saved.grid.every(Boolean) && !urlChanged) {
    state = saved;
    state.level = levelOf(saved);
    state.variant = Sudoku.VARIANTS[saved.variant] ? saved.variant : 'classic';
    if (!Array.isArray(state.notes)) state.notes = new Array(81).fill(0);
    state.lastProgress = Date.now();
    renderAll();
    feed({ type: 'system', text: 'Puzzle restored — keep going!' });
  } else {
    if (saved) state = { ...saved, level: levelOf(saved) }; // keep round counter/rotation position
    newRound();
  }
  setInterval(tick, 250);
  tick();

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'n' || e.key === 'N') newRound();
    if (e.key === 'h' || e.key === 'H') giveHint();
  });

  if (cfg.channel) {
    TwitchChat.connect(cfg.channel, { onMessage: handleChat, onStatus: setStatus });
  }

  if (cfg.demo) {
    if (!cfg.channel) setStatus('demo');
    const bots = ['PixelPanda', 'grid_wizard', 'NineLives', 'boxbuster', 'Quokka42', 'ZenSolver', 'kettlecorn', 'MossyRock'];
    const colors = ['#FF4500', '#1E90FF', '#9ACD32', '#DAA520', '#8A2BE2', '#00FF7F', '#FF69B4', ''];
    setInterval(() => {
      if (roundOver) return;
      const k = Math.floor(Math.random() * bots.length);
      const empty = state.grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (!empty.length) return;
      const i = empty[Math.floor(Math.random() * empty.length)];
      if (cfg.notes && Math.random() < 0.3) {
        const other = ((state.solution[i] + Math.floor(Math.random() * 8)) % 9) + 1;
        const ds = Math.random() < 0.5 ? `${state.solution[i]}${other}` : `${other}${state.solution[i]}`;
        handleChat({ user: bots[k].toLowerCase(), displayName: bots[k], color: colors[k], text: `${cfg.prefix}${ROWS[Sudoku.row(i)]}${Sudoku.col(i) + 1}?${ds}` });
        return;
      }
      const good = Math.random() < 0.75;
      const v = good ? state.solution[i] : ((state.solution[i] + Math.floor(Math.random() * 8)) % 9) + 1;
      const variants = [`${ROWS[Sudoku.row(i)]}${Sudoku.col(i) + 1} ${v}`, `${ROWS[Sudoku.row(i)].toLowerCase()}${Sudoku.col(i) + 1}=${v}`, `ok ${ROWS[Sudoku.row(i)]}${Sudoku.col(i) + 1} ${v} i think`];
      handleChat({ user: bots[k].toLowerCase(), displayName: bots[k], color: colors[k], text: cfg.prefix + variants[Math.floor(Math.random() * variants.length)] });
    }, 900);
  }

  if (cfg.test) {
    const box = $('#test-input');
    box.hidden = false;
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !box.value.trim()) return;
      handleChat({ user: 'streamer', displayName: 'Streamer', color: '#FFD700', isBroadcaster: true, isMod: true, text: box.value });
      box.value = '';
    });
  }

  window.__sudokuOnStream = { handleChat, get state() { return state; }, parseMoves, parseNotes, newRound, giveHint };
})();
