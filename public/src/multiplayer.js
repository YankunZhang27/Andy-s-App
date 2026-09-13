class LocalMultiplayer {
  constructor() {
    this.roomCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    this.playerId = Math.random().toString(36).substr(2, 9);
  }
  createGame() { return this.roomCode; }
  joinGame(roomCode) { this.roomCode = roomCode; }
  sendGameState(gameState) {}
  disconnect() {}
}