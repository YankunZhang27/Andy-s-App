const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const BLOCK_SIZE = 20;
const TETROMINOS = {
  I: { shape: [[1, 1, 1, 1]], color: '#00ffff' },
  O: { shape: [[1, 1], [1, 1]], color: '#ffff00' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#ff00ff' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00ff00' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#ff0000' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000ff' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#ff8800' }
};
class TetrisGame {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(0));
    this.currentPiece = null;
    this.currentX = 0;
    this.currentY = 0;
    this.score = 0;
    this.lines = 0;
    this.gameOver = false;
    this.isPaused = false;
    this.level = 1;
    this.dropCounter = 0;
    this.dropInterval = 800;
    this.spawnPiece();
    this.draw();
  }
  spawnPiece() {
    const pieces = Object.keys(TETROMINOS);
    const type = pieces[Math.floor(Math.random() * pieces.length)];
    const tetromino = TETROMINOS[type];
    this.currentPiece = {
      shape: tetromino.shape.map(row => [...row]),
      color: tetromino.color,
      type: type
    };
    this.currentX = Math.floor((GRID_WIDTH - this.currentPiece.shape[0].length) / 2);
    this.currentY = 0;
    if (this.checkCollision()) this.gameOver = true;
  }
  checkCollision(offsetX = 0, offsetY = 0, piece = this.currentPiece) {
    const x = this.currentX + offsetX;
    const y = this.currentY + offsetY;
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const gridX = x + col;
          const gridY = y + row;
          if (gridX < 0 || gridX >= GRID_WIDTH || gridY >= GRID_HEIGHT) return true;
          if (gridY >= 0 && this.grid[gridY][gridX]) return true;
        }
      }
    }
    return false;
  }
  moveLeft() { if (!this.checkCollision(-1, 0)) this.currentX--; }
  moveRight() { if (!this.checkCollision(1, 0)) this.currentX++; }
  moveDown() {
    if (!this.checkCollision(0, 1)) {
      this.currentY++;
      this.score += 1;
    } else {
      this.placePiece();
    }
  }
  rotate() {
    const original = this.currentPiece.shape;
    this.currentPiece.shape = this.rotateMatrix(this.currentPiece.shape);
    if (this.checkCollision()) this.currentPiece.shape = original;
  }
  rotateMatrix(matrix) {
    const n = matrix.length;
    const rotated = Array(n).fill(null).map(() => Array(matrix[0].length).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < matrix[0].length; j++) {
        rotated[j][n - 1 - i] = matrix[i][j];
      }
    }
    return rotated;
  }
  placePiece() {
    for (let row = 0; row < this.currentPiece.shape.length; row++) {
      for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
        if (this.currentPiece.shape[row][col]) {
          const gridY = this.currentY + row;
          const gridX = this.currentX + col;
          if (gridY >= 0 && gridY < GRID_HEIGHT && gridX >= 0 && gridX < GRID_WIDTH) {
            this.grid[gridY][gridX] = this.currentPiece.color;
          }
        }
      }
    }
    this.clearLines();
    this.spawnPiece();
  }
  clearLines() {
    let linesCleared = 0;
    for (let row = GRID_HEIGHT - 1; row >= 0; row--) {
      if (this.grid[row].every(cell => cell !== 0)) {
        this.grid.splice(row, 1);
        this.grid.unshift(Array(GRID_WIDTH).fill(0));
        linesCleared++;
        row++;
      }
    }
    if (linesCleared > 0) {
      this.lines += linesCleared;
      this.score += linesCleared * 100 * linesCleared;
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.dropInterval = Math.max(100, 800 - (this.level - 1) * 50);
      }
    }
  }
  update(deltaTime) {
    if (this.gameOver || this.isPaused) return;
    this.dropCounter += deltaTime;
    if (this.dropCounter > this.dropInterval) {
      this.moveDown();
      this.dropCounter = 0;
    }
  }
  draw() {
    this.ctx.fillStyle = '#0a0a1a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_HEIGHT; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * BLOCK_SIZE);
      this.ctx.lineTo(GRID_WIDTH * BLOCK_SIZE, i * BLOCK_SIZE);
      this.ctx.stroke();
    }
    for (let i = 0; i <= GRID_WIDTH; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * BLOCK_SIZE, 0);
      this.ctx.lineTo(i * BLOCK_SIZE, GRID_HEIGHT * BLOCK_SIZE);
      this.ctx.stroke();
    }
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let col = 0; col < GRID_WIDTH; col++) {
        if (this.grid[row][col]) {
          this.ctx.fillStyle = this.grid[row][col];
          this.ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
        }
      }
    }
    if (this.currentPiece) {
      this.ctx.fillStyle = this.currentPiece.color;
      for (let row = 0; row < this.currentPiece.shape.length; row++) {
        for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
          if (this.currentPiece.shape[row][col]) {
            const x = (this.currentX + col) * BLOCK_SIZE;
            const y = (this.currentY + row) * BLOCK_SIZE;
            this.ctx.fillRect(x, y, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
          }
        }
      }
    }
  }
}