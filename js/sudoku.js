// Sudoku generator, solver and difficulty grader.
// Grids are flat arrays of 81 numbers, 0 = empty. Every variant is a 9x9 grid
// with the usual rows/columns/boxes plus optional extra "1-9 once" regions.
window.Sudoku = (() => {
  const ALL = 0x3fe; // bits 1..9
  const bit = (v) => 1 << v;
  const row = (i) => Math.floor(i / 9);
  const col = (i) => i % 9;
  const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);
  const ROWS = 'ABCDEFGHI';
  const range = (n) => [...Array(n).keys()];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function bitCount(n) { let c = 0; while (n) { n &= n - 1; c++; } return c; }
  function onlyValue(mask) { return 31 - Math.clz32(mask); }
  function combos(arr, k, start = 0, pick = [], out = []) {
    if (pick.length === k) { out.push(pick.slice()); return out; }
    for (let i = start; i < arr.length; i++) { pick.push(arr[i]); combos(arr, k, i + 1, pick, out); pick.pop(); }
    return out;
  }

  // ---------- Regions ----------
  const BASE = [];
  for (let u = 0; u < 9; u++) BASE.push({ kind: 'row', label: `row ${ROWS[u]}`, cells: range(81).filter((i) => row(i) === u) });
  for (let u = 0; u < 9; u++) BASE.push({ kind: 'col', label: `column ${u + 1}`, cells: range(81).filter((i) => col(i) === u) });
  for (let u = 0; u < 9; u++) BASE.push({ kind: 'box', label: 'box', cells: range(81).filter((i) => box(i) === u) });

  const rc = (r, c) => r * 9 + c;
  const windowAt = (r0, c0) => range(9).map((k) => rc(r0 + Math.floor(k / 3), c0 + (k % 3)));

  const VARIANTS = {
    classic: { name: 'Classic', rule: '', extra: [] },
    diagonal: {
      name: 'Diagonal', rule: 'Both long diagonals (shaded) must also contain 1–9 once.',
      extra: [
        { kind: 'extra', label: 'diagonal', cls: 'x-diag', cells: range(9).map((k) => rc(k, k)) },
        { kind: 'extra', label: 'diagonal', cls: 'x-diag', cells: range(9).map((k) => rc(k, 8 - k)) },
      ],
    },
    windoku: {
      name: 'Windoku', rule: 'The 4 shaded windows must also contain 1–9 once.',
      extra: [[1, 1], [1, 5], [5, 1], [5, 5]].map(([r, c]) => ({ kind: 'extra', label: 'window', cls: 'x-win', cells: windowAt(r, c) })),
    },
    centerdot: {
      name: 'Center Dot', rule: 'The 9 dotted box centers must also contain 1–9 once.',
      extra: [{ kind: 'extra', label: 'center dots', cls: 'x-dot', cells: [1, 4, 7].flatMap((r) => [1, 4, 7].map((c) => rc(r, c))) }],
    },
    asterisk: {
      name: 'Asterisk', rule: 'The 9 starred cells must also contain 1–9 once.',
      extra: [{ kind: 'extra', label: 'asterisk', cls: 'x-star', cells: [[1, 4], [2, 2], [2, 6], [4, 1], [4, 4], [4, 7], [6, 2], [6, 6], [7, 4]].map(([r, c]) => rc(r, c)) }],
    },
  };
  const VARIANT_ORDER = ['classic', 'diagonal', 'classic', 'windoku', 'classic', 'centerdot', 'classic', 'asterisk'];

  const geoCache = {};
  function geometry(key) {
    if (!VARIANTS[key]) key = 'classic';
    if (geoCache[key]) return geoCache[key];
    const units = [...BASE, ...VARIANTS[key].extra];
    const cellUnits = range(81).map(() => []);
    units.forEach((u, ui) => u.cells.forEach((c) => cellUnits[c].push(ui)));
    const peers = range(81).map((i) => {
      const p = new Set();
      for (const ui of cellUnits[i]) for (const c of units[ui].cells) if (c !== i) p.add(c);
      return [...p];
    });
    // Pairs of regions overlapping in 2+ cells, for locked-candidate eliminations.
    const overlaps = [];
    for (let a = 0; a < units.length; a++) {
      for (let b = a + 1; b < units.length; b++) {
        const set = new Set(units[a].cells.filter((c) => units[b].cells.includes(c)));
        if (set.size >= 2) overlaps.push([a, b, set], [b, a, set]);
      }
    }
    return (geoCache[key] = { key, ...VARIANTS[key], units, cellUnits, peers, overlaps });
  }

  // ---------- Brute force ----------
  function candidates(g, i, geo) {
    let used = 0;
    for (const p of geo.peers[i]) used |= bit(g[p]);
    return ALL & ~used;
  }

  function pickCell(g, geo) {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(g, i, geo);
      const c = bitCount(m);
      if (c === 0) return { dead: true };
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c === 1) break; }
    }
    return { best, bestMask };
  }

  // Counts solutions up to `limit`.
  function countSolutions(g, limit = 2, geo = geometry('classic')) {
    const { dead, best, bestMask } = pickCell(g, geo);
    if (dead) return 0;
    if (best === -1) return 1;
    let total = 0;
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & bit(v))) continue;
      g[best] = v;
      total += countSolutions(g, limit - total, geo);
      g[best] = 0;
      if (total >= limit) break;
    }
    return total;
  }

  function fillRandom(g, geo) {
    const { dead, best, bestMask } = pickCell(g, geo);
    if (dead) return false;
    if (best === -1) return true;
    for (const v of shuffle(range(10).filter((v) => bestMask & bit(v)))) {
      g[best] = v;
      if (fillRandom(g, geo)) return true;
    }
    g[best] = 0;
    return false;
  }

  // ---------- Human-style grader ----------
  // Technique tiers: 1 singles, 2 locked candidates, 3 naked/hidden pairs &
  // triples, 4 X-wing, 5 = needs more than that (or guessing).
  const TECH_NAMES = ['', 'singles', 'locked candidates', 'pairs & triples', 'X-wing', 'beyond X-wing'];

  function grade(puzzle, geo, cap = 4) {
    const val = puzzle.slice();
    const cand = new Array(81).fill(ALL);
    let left = 81;
    const place = (i, v) => {
      val[i] = v; cand[i] = bit(v); left--;
      for (const p of geo.peers[i]) cand[p] &= ~bit(v);
    };
    for (let i = 0; i < 81; i++) if (puzzle[i]) { val[i] = 0; place(i, puzzle[i]); }
    const open = (cells) => cells.filter((c) => !val[c]);
    const eliminate = (cells, mask) => {
      let hit = false;
      for (const c of cells) if (!val[c] && cand[c] & mask) { cand[c] &= ~mask; hit = true; }
      return hit;
    };

    function singles() {
      let hit = false;
      for (let i = 0; i < 81; i++) {
        if (!val[i] && bitCount(cand[i]) === 1) { place(i, onlyValue(cand[i])); hit = true; }
      }
      for (const u of geo.units) {
        for (let v = 1; v <= 9; v++) {
          let where = -1, n = 0;
          for (const c of u.cells) {
            if (val[c] === v) { n = -1; break; }
            if (!val[c] && cand[c] & bit(v)) { where = c; n++; }
          }
          if (n === 1) { place(where, v); hit = true; }
        }
      }
      return hit;
    }

    function locked() {
      for (const [a, b, inter] of geo.overlaps) {
        const A = open(geo.units[a].cells);
        for (let v = 1; v <= 9; v++) {
          const pos = A.filter((c) => cand[c] & bit(v));
          if (!pos.length || !pos.every((c) => inter.has(c))) continue;
          if (eliminate(geo.units[b].cells.filter((c) => !inter.has(c)), bit(v))) return true;
        }
      }
      return false;
    }

    function subsets() {
      for (const u of geo.units) {
        const cells = open(u.cells);
        for (const k of [2, 3]) {
          if (cells.length <= k) continue;
          for (const set of combos(cells, k)) {
            const mask = set.reduce((m, c) => m | cand[c], 0);
            if (bitCount(mask) === k && eliminate(cells.filter((c) => !set.includes(c)), mask)) return true;
          }
          const vals = range(10).slice(1).filter((v) => cells.some((c) => cand[c] & bit(v)));
          for (const vs of combos(vals, k)) {
            const mask = vs.reduce((m, v) => m | bit(v), 0);
            const pos = cells.filter((c) => cand[c] & mask);
            if (pos.length !== k) continue;
            let hit = false;
            for (const c of pos) if (cand[c] & ~mask) { cand[c] &= mask; hit = true; }
            if (hit) return true;
          }
        }
      }
      return false;
    }

    function xwing() {
      for (let v = 1; v <= 9; v++) {
        for (const [base, cross] of [[0, 9], [9, 0]]) {
          const lines = [];
          for (let l = 0; l < 9; l++) {
            const idx = [];
            geo.units[base + l].cells.forEach((c, k) => { if (!val[c] && cand[c] & bit(v)) idx.push(k); });
            if (idx.length === 2) lines.push({ l, idx });
          }
          for (let x = 0; x < lines.length; x++) {
            for (let y = x + 1; y < lines.length; y++) {
              const [p, q] = [lines[x], lines[y]];
              if (p.idx[0] !== q.idx[0] || p.idx[1] !== q.idx[1]) continue;
              for (const k of p.idx) {
                const cells = geo.units[cross + k].cells.filter((_, n) => n !== p.l && n !== q.l);
                if (eliminate(cells, bit(v))) return true;
              }
            }
          }
        }
      }
      return false;
    }

    const steps = [singles, locked, subsets, xwing];
    let level = 1;
    while (left > 0) {
      let used = 0;
      for (let t = 0; t < Math.min(cap, steps.length); t++) if (steps[t]()) { used = t + 1; break; }
      if (!used) break;
      level = Math.max(level, used);
    }
    return { solved: left === 0, tech: left === 0 ? level : 5 };
  }

  // ---------- Difficulty levels (1-10) ----------
  // clues: stop removing at this many givens. max: hardest technique allowed.
  // min: hardest technique we try to require (best effort within the time budget).
  const LEVELS = [
    null,
    { name: 'Beginner', clues: 46, max: 1, min: 1 },
    { name: 'Easy', clues: 40, max: 1, min: 1 },
    { name: 'Casual', clues: 36, max: 1, min: 1 },
    { name: 'Medium', clues: 32, max: 1, min: 1 },
    { name: 'Tricky', clues: 29, max: 2, min: 1 },
    { name: 'Hard', clues: 27, max: 2, min: 2 },
    { name: 'Harder', clues: 26, max: 3, min: 3 },
    { name: 'Expert', clues: 24, max: 4, min: 3 },
    { name: 'Master', clues: 23, max: 4, min: 4 },
    { name: 'Fiendish', clues: 0, max: 5, min: 5 },
  ];
  const NAMED = { easy: 3, medium: 5, hard: 8, expert: 9 };
  function toLevel(d) {
    if (typeof d === 'string' && NAMED[d.toLowerCase()]) return NAMED[d.toLowerCase()];
    const n = Math.round(Number(d));
    return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 5;
  }

  function attempt(L, geo) {
    const solution = new Array(81).fill(0);
    fillRandom(solution, geo);
    const puzzle = solution.slice();
    let clues = 81;
    // Remove cells in 180°-symmetric pairs so boards look tidy.
    for (const i of shuffle(range(41))) {
      if (clues <= L.clues) break;
      const cells = i === 40 ? [40] : [i, 80 - i];
      const keep = cells.map((c) => puzzle[c]);
      cells.forEach((c) => { puzzle[c] = 0; });
      const ok = L.max >= 5 ? countSolutions(puzzle.slice(), 2, geo) === 1 : grade(puzzle, geo, L.max).solved;
      if (ok) clues -= cells.length;
      else cells.forEach((c, k) => { puzzle[c] = keep[k]; });
    }
    return { puzzle, solution, clues, tech: grade(puzzle, geo, 4).tech };
  }

  // Returns { puzzle, solution, level, variant, tech, clues } with a unique solution.
  function generate(level = 5, variant = 'classic', budgetMs = 900) {
    level = toLevel(level);
    const L = LEVELS[level];
    const geo = geometry(variant);
    const t0 = performance.now();
    let best = null;
    do {
      const a = attempt(L, geo);
      if (!best || a.tech > best.tech || (a.tech === best.tech && a.clues < best.clues)) best = a;
      if (best.tech >= L.min) break;
    } while (performance.now() - t0 < budgetMs);
    return { ...best, level, variant: geo.key };
  }

  const UNITS = { row: BASE.slice(0, 9).map((u) => u.cells), col: BASE.slice(9, 18).map((u) => u.cells), box: BASE.slice(18).map((u) => u.cells) };

  return { generate, grade, countSolutions, geometry, toLevel, LEVELS, VARIANTS, VARIANT_ORDER, TECH_NAMES, UNITS, row, col, box };
})();
