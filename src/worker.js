const WIZARD_NAMES = [
  'Elowen', 'Bramblewick', 'Ashglow', 'Moriven',
  'Thistledown', 'Emberwick', 'Hollowmere', 'Cindergale',
];
const WIZARD_AVATARS = ['🧙', '🔮', '🕯️', '✨', '🧪', '📖', '🦉', '⚗️'];

// One GameRoom per Coven Code (Durable Object id derived via idFromName).
// Relays every connected wizard's board state to everyone else in the room
// and turns double-or-bigger line clears into garbage sent to opponents.
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // WebSocket -> { id, name, avatar, alive }

    // Restore sessions that survived hibernation.
    for (const ws of this.state.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta) this.sessions.set(ws, meta);
    }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    const idx = this.sessions.size;
    const meta = {
      id: crypto.randomUUID(),
      name: WIZARD_NAMES[idx % WIZARD_NAMES.length],
      avatar: WIZARD_AVATARS[idx % WIZARD_AVATARS.length],
      alive: true,
    };

    this.state.acceptWebSocket(server);
    server.serializeAttachment(meta);
    this.sessions.set(server, meta);

    server.send(JSON.stringify({ type: 'welcome', you: meta, players: [...this.sessions.values()] }));
    this._broadcast({ type: 'player_joined', player: meta }, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const meta = this.sessions.get(ws);
    if (!meta) return;

    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type !== 'state') return;

    this._broadcast({
      type: 'state',
      id: meta.id,
      grid: msg.grid,
      piece: msg.piece,
      score: msg.score,
      lines: msg.lines,
      level: msg.level,
      alive: msg.alive,
    }, ws);

    if ((msg.clearedNow || 0) >= 2) {
      const amount = msg.clearedNow - 1;
      for (const [peerWs, peerMeta] of this.sessions) {
        if (peerWs !== ws && peerMeta.alive) {
          this._send(peerWs, { type: 'garbage', amount });
        }
      }
    }

    if (msg.alive === false && meta.alive) {
      meta.alive = false;
      ws.serializeAttachment(meta);
      this._broadcast({ type: 'player_gameover', id: meta.id });
      this._maybeDeclareWinner();
    }
  }

  async webSocketClose(ws) {
    const meta = this.sessions.get(ws);
    this.sessions.delete(ws);
    if (meta) {
      this._broadcast({ type: 'player_left', id: meta.id });
      this._maybeDeclareWinner();
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  _maybeDeclareWinner() {
    const players = [...this.sessions.values()];
    const alive = players.filter((p) => p.alive);
    if (players.length > 1 && alive.length === 1) {
      this._broadcast({ type: 'winner', id: alive[0].id });
    }
  }

  _send(ws, message) {
    try { ws.send(JSON.stringify(message)); } catch { /* peer socket already gone */ }
  }

  _broadcast(message, exclude) {
    for (const ws of this.sessions.keys()) {
      if (ws !== exclude) this._send(ws, message);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/room/')) {
      const code = decodeURIComponent(url.pathname.slice('/api/room/'.length)).toUpperCase();
      if (!code) return new Response('Missing coven code', { status: 400 });
      const id = env.GAME_ROOM.idFromName(code);
      return env.GAME_ROOM.get(id).fetch(request);
    }

    if (request.method === 'GET') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
