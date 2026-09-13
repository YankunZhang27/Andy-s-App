export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomCode = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      return this.handleWebSocket(request);
    }
    return new Response('Not Found', { status: 404 });
  }
  handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const sessionId = Math.random().toString(36).substr(2, 9);
    this.sessions.set(sessionId, { socket: server, playerId: null, roomCode: null });
    server.addEventListener('message', async (message) => {
      await this.handleMessage(sessionId, message.data);
    });
    server.addEventListener('close', () => {
      this.sessions.delete(sessionId);
    });
    return new Response(null, { status: 101, webSocket: client });
  }
  async handleMessage(sessionId, data) {
    try {
      const message = JSON.parse(data);
      const session = this.sessions.get(sessionId);
      switch (message.type) {
        case 'join':
          await this.handleJoin(sessionId, message);
          break;
        case 'gameState':
          this.broadcastToRoom(message.roomCode, { type: 'gameState', from: message.playerId, data: message.data }, sessionId);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  async handleJoin(sessionId, message) {
    const session = this.sessions.get(sessionId);
    session.playerId = message.playerId;
    session.roomCode = message.roomCode;
    const socket = session.socket;
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'joined', roomCode: message.roomCode, playerId: message.playerId }));
    }
  }
  getPlayersInRoom(roomCode) {
    return Array.from(this.sessions.values()).filter(s => s.roomCode === roomCode);
  }
  broadcastToRoom(roomCode, message, excludeSessionId = null) {
    const players = this.getPlayersInRoom(roomCode);
    for (const session of players) {
      if (excludeSessionId && session === this.sessions.get(excludeSessionId)) continue;
      if (session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify(message));
      }
    }
  }
}
export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const roomCode = url.searchParams.get('room') || 'default';
      const durableObjectId = env.GAME_ROOM.idFromName(roomCode);
      const gameRoom = env.GAME_ROOM.get(durableObjectId);
      return gameRoom.fetch(request);
    }
    return new Response('Not Found', { status: 404 });
  },
  async scheduled(event, env, ctx) {
    console.log('Cleaning up inactive game rooms');
  }
};
