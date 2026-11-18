// Sudoku generator / solver. Grids are flat arrays of 81 numbers, 0 = empty.
window.Sudoku = (() => {
  const ALL = 0x3fe; // bits 1..9

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const row = (i) => Math.floor(i / 9);
  const col = (i) => i % 9;
  const box = (i) => Math.floor(row(i) / 3) * 3 + Math.floor(col(i) / 3);

  // Precompute the 20 peers of every cell.
  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const p = new Set();
    for (let j = 0; j < 81; j++) {
      if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) p.add(j);
    }
    PEERS.push([...p]);
  }

  // Unit index lists: 9 rows, 9 cols, 9 boxes.
  const UNITS = { row: [], col: [], box: [] };
  for (let u = 0; u < 9; u++) {
    UNITS.row.push([...Array(81).keys()].filter((i) => row(i) === u));
    UNITS.col.push([...Array(81).keys()].filter((i) => col(i) === u));
    UNITS.box.push([...Array(81).keys()].filter((i) => box(i) === u));
  }

  function candidates(g, i) {
    let used = 0;
    for (const p of PEERS[i]) used |= 1 << g[p];
    return ALL & ~used;
  }

  function bitCount(n) {
    let c = 0;
    while (n) { n &= n - 1; c++; }
    return c;
  }

  // Counts solutions up to `limit`, picking the most constrained cell first.
  function countSolutions(g, limit = 2) {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(g, i);
      const c = bitCount(m);
      if (c === 0) return 0;
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c === 1) break; }
    }
    if (best === -1) return 1;
    let total = 0;
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & (1 << v))) continue;
      g[best] = v;
      total += countSolutions(g, limit - total);
      g[best] = 0;
      if (total >= limit) break;
    }
    return total;
  }

  function fillRandom(g) {
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = candidates(g, i);
      const c = bitCount(m);
      if (c === 0) return false;
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; }
    }
    if (best === -1) return true;
    const vals = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((v) => bestMask & (1 << v)));
    for (const v of vals) {
      g[best] = v;
      if (fillRandom(g)) return true;
    }
    g[best] = 0;
    return false;
  }

  const CLUES = { easy: 40, medium: 32, hard: 26 };

  // Returns { puzzle, solution, difficulty } with a unique solution.
  function generate(difficulty = 'medium') {
    const target = CLUES[difficulty] || CLUES.medium;
    const solution = new Array(81).fill(0);
    fillRandom(solution);
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= target) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice(), 2) !== 1) puzzle[i] = keep;
      else clues--;
    }
    return { puzzle, solution, difficulty };
  }

  return { generate, countSolutions, UNITS, row, col, box };
})();
