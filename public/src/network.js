// WebSocket client for a coven (game room). Talks to the GameRoom Durable
// Object on the Worker, which relays every player's board state to everyone
// else in the room and turns multi-line clears into garbage attacks.

class RoomConnection {
  constructor(roomCode) {
    this.roomCode = roomCode;
    this.ws = null;
    this.you = null;
    this._lastSent = 0;

    this.onWelcome = null;      // (you, players[]) => {}
    this.onPeerJoined = null;   // (player) => {}
    this.onPeerState = null;    // (stateMsg) => {}
    this.onPeerLeft = null;     // (id) => {}
    this.onPeerGameOver = null; // (id) => {}
    this.onGarbage = null;      // (amount) => {}
    this.onWinner = null;       // (id) => {}
    this.onClose = null;        // () => {}
  }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${proto}://${location.host}/api/room/${encodeURIComponent(this.roomCode)}`);
      this.ws.addEventListener('open', () => resolve());
      this.ws.addEventListener('error', (err) => reject(err));
      this.ws.addEventListener('message', (event) => this._handleMessage(event));
      this.ws.addEventListener('close', () => { if (this.onClose) this.onClose(); });
    });
  }

  _handleMessage(event) {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    switch (msg.type) {
      case 'welcome':
        this.you = msg.you;
        if (this.onWelcome) this.onWelcome(msg.you, msg.players);
        break;
      case 'player_joined':
        if (this.onPeerJoined) this.onPeerJoined(msg.player);
        break;
      case 'state':
        if (this.onPeerState) this.onPeerState(msg);
        break;
      case 'player_left':
        if (this.onPeerLeft) this.onPeerLeft(msg.id);
        break;
      case 'player_gameover':
        if (this.onPeerGameOver) this.onPeerGameOver(msg.id);
        break;
      case 'garbage':
        if (this.onGarbage) this.onGarbage(msg.amount);
        break;
      case 'winner':
        if (this.onWinner) this.onWinner(msg.id);
        break;
    }
  }

  // Throttled to ~8/sec, except line-clear and game-over updates go through
  // immediately so garbage attacks and coven-wide game-over land on time.
  sendState(state, minIntervalMs = 120) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const urgent = state.clearedNow > 0 || state.alive === false;
    const now = Date.now();
    if (!urgent && now - this._lastSent < minIntervalMs) return;
    this._lastSent = now;
    this.ws.send(JSON.stringify({ type: 'state', ...state }));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}
