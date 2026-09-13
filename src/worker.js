// Cloudflare Durable Object for game room management
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // Placeholder for future WebSocket/game state management
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Main Worker handler - serves the game
export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);

    // API endpoint for game state (future: upgrade to WebSocket)
    if (url.pathname === '/api/game-state' && request.method === 'POST') {
      const data = await request.json();
      return new Response(JSON.stringify({ status: 'received' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Serve static files (index.html, styles.css, tetris.js, etc.)
    if (request.method === 'GET') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    console.log('Periodic cleanup task executed');
  }
};