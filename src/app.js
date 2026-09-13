class BlockQuestApp {
  constructor() {
    this.game1 = null;
    this.game2 = null;
    this.multiplayer = null;
    this.isPlaying = false;
    this.lastTime = 0;
    this.animationId = null;
    this.initializeEventListeners();
  }
  initializeEventListeners() {
    document.getElementById('create-game-btn').addEventListener('click', () => this.createGame());
    document.getElementById('join-game-btn').addEventListener('click', () => this.showJoinForm());
    document.getElementById('submit-join-btn').addEventListener('click', () => this.submitJoinGame());
    document.getElementById('cancel-join-btn').addEventListener('click', () => this.hideJoinForm());
    document.getElementById('room-code').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.submitJoinGame();
    });
    document.getElementById('leave-game-btn').addEventListener('click', () => this.leaveGame());
    document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
    document.getElementById('quit-btn').addEventListener('click', () => this.leaveGame());
    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }
  createGame() {
    this.multiplayer = new LocalMultiplayer();
    const roomCode = this.multiplayer.createGame();
    this.startGame(roomCode);
  }
  showJoinForm() { document.getElementById('join-form').classList.remove('hidden'); }
  hideJoinForm() {
    document.getElementById('join-form').classList.add('hidden');
    document.getElementById('room-code').value = '';
  }
  submitJoinGame() {
    const roomCode = document.getElementById('room-code').value.trim();
    if (roomCode.length > 0) {
      this.multiplayer = new LocalMultiplayer();
      this.multiplayer.joinGame(roomCode);
      this.startGame(roomCode);
      this.hideJoinForm();
    }
  }
  startGame(roomCode) {
    document.getElementById('landing-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('room-code-display').textContent = roomCode;
    this.game1 = new TetrisGame('player1-canvas');
    this.game2 = new TetrisGame('player2-canvas');
    this.isPlaying = true;
    this.lastTime = Date.now();
    this.gameLoop();
  }
  gameLoop = () => {
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    if (this.isPlaying) {
      this.game1.update(deltaTime);
      this.game2.update(deltaTime);
      this.game1.draw();
      this.game2.draw();
      this.updateUI();
      if (this.game1.gameOver || this.game2.gameOver) this.endGame();
    }
    this.animationId = requestAnimationFrame(this.gameLoop);
  };
  updateUI() {
    document.getElementById('player1-lines').textContent = this.game1.lines;
    document.getElementById('player1-score').textContent = this.game1.score;
    document.getElementById('player2-lines').textContent = this.game2.lines;
    document.getElementById('player2-score').textContent = this.game2.score;
  }
  handleKeyPress(event) {
    if (!this.isPlaying || !this.game1) return;
    switch (event.key.toLowerCase()) {
      case 'arrowleft':
        event.preventDefault();
        this.game1.moveLeft();
        break;
      case 'arrowright':
        event.preventDefault();
        this.game1.moveRight();
        break;
      case 'arrowdown':
        event.preventDefault();
        this.game1.moveDown();
        break;
      case ' ':
        event.preventDefault();
        this.game1.rotate();
        break;
    }
  }
  togglePause() {
    this.game1.isPaused = !this.game1.isPaused;
    this.game2.isPaused = !this.game2.isPaused;
    const pauseScreen = document.getElementById('pause-screen');
    if (this.game1.isPaused) {
      pauseScreen.classList.add('active');
    } else {
      pauseScreen.classList.remove('active');
    }
  }
  endGame() {
    this.isPlaying = false;
    const winner = this.game1.score > this.game2.score ? 'You' : 'Opponent';
    alert(`Game Over! ${winner} wins!\nYour Score: ${this.game1.score}\nOpponent Score: ${this.game2.score}`);
    this.leaveGame();
  }
  leaveGame() {
    this.isPlaying = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    if (this.multiplayer) this.multiplayer.disconnect();
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('pause-screen').classList.remove('active');
    document.getElementById('landing-screen').classList.add('active');
    this.game1 = null;
    this.game2 = null;
  }
}
document.addEventListener('DOMContentLoaded', () => { new BlockQuestApp(); });