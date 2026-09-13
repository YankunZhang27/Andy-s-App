// Core Tetris engine: board state, seven-bag randomizer, movement, rotation
// with basic wall kicks, hold, ghost piece, scoring, levels, and garbage-line
// injection for multiplayer attacks. Rendering helpers for both the local
// board and remote peers' boards live at the bottom of this file.

const COLS = 10;
const VISIBLE_ROWS = 20;
const HIDDEN_ROWS = 2;
const TOTAL_ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
const GARBAGE_COLOR = '#4A4358';

const PIECES = {
  I: { size: 4, color: '#5B9BD9', cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { size: 2, color: '#E8B84B', cells: [[1, 1], [1, 1]] },
  T: { size: 3, color: '#A578D9', cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { size: 3, color: '#6FBF8A', cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { size: 3, color: '#D9645A', cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { size: 3, color: '#7E8FD9', cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { size: 3, color: '#E08A45', cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};

function rotateCW(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) result[c][n - 1 - r] = matrix[r][c];
  }
  return result;
}

function makeBagGenerator() {
  let bag = [];
  return function next() {
    if (bag.length === 0) {
      bag = Object.keys(PIECES);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

class TetrisEngine {
  constructor() {
    this.grid = Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(0));
    this._drawBag = makeBagGenerator();
    this.queue = [this._drawBag(), this._drawBag(), this._drawBag()];
    this.hold = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.alive = true;
    this.isPaused = false;
    this.dropCounter = 0;
    this.lockTimer = 0;
    this.lockDelay = 500;
    this.groundedTime = 0;
    this.maxGroundedTime = 3000;
    this.clearedNow = 0;
    this._spawn();
  }

  get dropInterval() {
    return Math.max(120, 1000 - (this.level - 1) * 75);
  }

  _pieceFromType(type) {
    const def = PIECES[type];
    return { type, color: def.color, size: def.size, cells: def.cells.map((row) => [...row]) };
  }

  _spawnPosition(size) {
    return {
      x: Math.floor((COLS - size) / 2),
      y: HIDDEN_ROWS - (size === 4 ? 2 : 1),
    };
  }

  _spawn() {
    const type = this.queue.shift();
    this.queue.push(this._drawBag());
    this.current = this._pieceFromType(type);
    const pos = this._spawnPosition(this.current.size);
    this.x = pos.x;
    this.y = pos.y;
    this.canHold = true;
    this.groundedTime = 0;
    this.lockTimer = 0;
    this.dropCounter = 0;
    if (this._collides(this.current, this.x, this.y)) this.alive = false;
  }

  _collides(piece, x, y) {
    for (let r = 0; r < piece.size; r++) {
      for (let c = 0; c < piece.size; c++) {
        if (!piece.cells[r][c]) continue;
        const gx = x + c;
        const gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= TOTAL_ROWS) return true;
        if (gy >= 0 && this.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  _refreshGrounded() {
    if (this._collides(this.current, this.x, this.y + 1)) {
      if (this.groundedTime < this.maxGroundedTime) this.lockTimer = 0;
    } else {
      this.lockTimer = 0;
      this.groundedTime = 0;
    }
  }

  _tryMove(dx, dy) {
    if (!this.alive || this.isPaused) return false;
    if (this._collides(this.current, this.x + dx, this.y + dy)) return false;
    this.x += dx;
    this.y += dy;
    this._refreshGrounded();
    return true;
  }

  moveLeft() { this._tryMove(-1, 0); }
  moveRight() { this._tryMove(1, 0); }

  softDrop() {
    if (this._tryMove(0, 1)) this.score += 1;
  }

  hardDrop() {
    if (!this.alive || this.isPaused) return;
    let dist = 0;
    while (!this._collides(this.current, this.x, this.y + 1)) { this.y++; dist++; }
    this.score += dist * 2;
    this._lock();
  }

  // dir: 1 = clockwise, -1 = counter-clockwise
  rotate(dir = 1) {
    if (!this.alive || this.isPaused || this.current.type === 'O') return;
    let rotated = this.current.cells;
    const turns = dir === 1 ? 1 : 3;
    for (let i = 0; i < turns; i++) rotated = rotateCW(rotated);
    const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
    for (const [kx, ky] of kicks) {
      if (!this._collides({ ...this.current, cells: rotated }, this.x + kx, this.y + ky)) {
        this.current.cells = rotated;
        this.x += kx;
        this.y += ky;
        this._refreshGrounded();
        return;
      }
    }
  }

  holdPiece() {
    if (!this.alive || this.isPaused || !this.canHold) return;
    const currentType = this.current.type;
    if (this.hold) {
      this.current = this._pieceFromType(this.hold);
      const pos = this._spawnPosition(this.current.size);
      this.x = pos.x;
      this.y = pos.y;
    } else {
      this._spawn();
    }
    this.hold = currentType;
    this.canHold = false;
  }

  getGhostY() {
    let gy = this.y;
    while (!this._collides(this.current, this.x, gy + 1)) gy++;
    return gy;
  }

  tick(deltaTime) {
    if (!this.alive || this.isPaused) { this.clearedNow = 0; return; }
    this.clearedNow = 0;
    if (this._collides(this.current, this.x, this.y + 1)) {
      this.lockTimer += deltaTime;
      this.groundedTime += deltaTime;
      if (this.lockTimer >= this.lockDelay || this.groundedTime >= this.maxGroundedTime) this._lock();
    } else {
      this.dropCounter += deltaTime;
      if (this.dropCounter >= this.dropInterval) {
        this.dropCounter = 0;
        this.y++;
      }
    }
  }

  _lock() {
    for (let r = 0; r < this.current.size; r++) {
      for (let c = 0; c < this.current.size; c++) {
        if (!this.current.cells[r][c]) continue;
        const gy = this.y + r;
        const gx = this.x + c;
        if (gy >= 0 && gy < TOTAL_ROWS) this.grid[gy][gx] = this.current.color;
      }
    }
    const cleared = this._clearLines();
    this.clearedNow = cleared;
    if (cleared > 0) {
      this.lines += cleared;
      const table = [0, 100, 300, 500, 800];
      this.score += (table[cleared] || 800) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
    }
    this._spawn();
  }

  _clearLines() {
    let cleared = 0;
    for (let row = TOTAL_ROWS - 1; row >= 0; row--) {
      if (this.grid[row].every((cell) => cell !== 0)) {
        this.grid.splice(row, 1);
        this.grid.unshift(Array(COLS).fill(0));
        cleared++;
        row++;
      }
    }
    return cleared;
  }

  // Rises the stack by `count` rows of garbage, each with one random gap.
  addGarbage(count) {
    if (!this.alive || count <= 0) return;
    const gapCol = Math.floor(Math.random() * COLS);
    for (let i = 0; i < count; i++) {
      if (this.grid[0].some((cell) => cell)) { this.alive = false; return; }
      this.grid.shift();
      const row = Array(COLS).fill(GARBAGE_COLOR);
      row[gapCol] = 0;
      this.grid.push(row);
    }
    while (this._collides(this.current, this.x, this.y)) {
      this.y--;
      if (this.y < -TOTAL_ROWS) { this.alive = false; break; }
    }
  }

  serialize() {
    return {
      grid: this.grid.slice(HIDDEN_ROWS),
      piece: this.alive ? {
        cells: this.current.cells,
        color: this.current.color,
        size: this.current.size,
        x: this.x,
        y: this.y - HIDDEN_ROWS,
      } : null,
      score: this.score,
      lines: this.lines,
      level: this.level,
      alive: this.alive,
      clearedNow: this.clearedNow,
    };
  }
}

// ---------- rendering helpers (canvas-based, no engine dependency for peers) ----------

function drawCells(ctx, grid, blockSize) {
  ctx.fillStyle = '#0d0a1a';
  ctx.fillRect(0, 0, COLS * blockSize, VISIBLE_ROWS * blockSize);
  for (let r = 0; r < VISIBLE_ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = grid[r] ? grid[r][c] : 0;
      ctx.fillStyle = cell || 'rgba(241,233,216,0.035)';
      ctx.fillRect(c * blockSize + 1, r * blockSize + 1, blockSize - 2, blockSize - 2);
    }
  }
}

function drawPieceCells(ctx, piece, blockSize, color, alpha = 1) {
  if (!piece) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color || piece.color;
  for (let r = 0; r < piece.size; r++) {
    for (let c = 0; c < piece.size; c++) {
      if (!piece.cells[r][c]) continue;
      const y = piece.y + r;
      if (y < 0) continue;
      const x = piece.x + c;
      ctx.fillRect(x * blockSize + 1, y * blockSize + 1, blockSize - 2, blockSize - 2);
    }
  }
  ctx.restore();
}

function renderOwnBoard(ctx, engine, blockSize) {
  drawCells(ctx, engine.grid.slice(HIDDEN_ROWS), blockSize);
  if (!engine.alive) return;
  const ghostPiece = { ...engine.current, x: engine.x, y: engine.getGhostY() - HIDDEN_ROWS };
  drawPieceCells(ctx, ghostPiece, blockSize, 'rgba(244,214,138,0.28)');
  const livePiece = { ...engine.current, x: engine.x, y: engine.y - HIDDEN_ROWS };
  drawPieceCells(ctx, livePiece, blockSize, engine.current.color);
}

function renderPeerBoard(ctx, state, blockSize) {
  drawCells(ctx, state.grid, blockSize);
  if (state.piece) drawPieceCells(ctx, state.piece, blockSize, state.piece.color);
}

function renderMiniPreview(ctx, type, blockSize) {
  ctx.fillStyle = '#171029';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!type) return;
  const def = PIECES[type];
  const offset = (4 - def.size) / 2;
  ctx.fillStyle = def.color;
  for (let r = 0; r < def.size; r++) {
    for (let c = 0; c < def.size; c++) {
      if (!def.cells[r][c]) continue;
      ctx.fillRect((c + offset) * blockSize + 1, (r + offset) * blockSize + 1, blockSize - 2, blockSize - 2);
    }
  }
}
