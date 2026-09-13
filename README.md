# Tetromancy

A real-time multiplayer, wizard-themed twist on falling-block puzzle games,
built with vanilla JavaScript and Cloudflare Workers + Durable Objects.

## Features

- 🧙 **Wizard-themed design** — midnight-grimoire palette, gemstone tetrominoes, Coven Code rooms
- 🌐 **Real multiplayer** — any number of players, each on their own device, joined by a shared Coven Code
- 🔮 **The Scrying Wall** — every player's board updates live on everyone else's screen
- ⚔️ **Garbage attacks** — clearing 2+ lines at once sends garbage rows to every other wizard still standing
- 🎮 **Full Tetris mechanics** — seven-bag randomizer, hold, next queue, ghost piece, soft/hard drop, lock delay, scoring, levels
- ☁️ **Cloudflare-native** — Workers serve the static app, a Durable Object per room relays state over WebSockets

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:8787` to play. Open a second browser tab (or a
different device on the same network) and join with the Coven Code shown in
the first tab to test multiplayer locally.

## Deployment to Cloudflare

Requires a free Cloudflare account.

```bash
npx wrangler login   # opens a browser to authenticate
npm run deploy
```

Wrangler will print your live URL, e.g. `https://tetromancy.<your-subdomain>.workers.dev`.

To use a custom domain instead, add it to your Cloudflare account first, then
uncomment the `[[routes]]` block at the bottom of `wrangler.toml` with your
domain.

## How to Play

- **Cast a New Game** — generates a Coven Code and starts a room
- **Join the Circle** — enter a Coven Code to join someone else's room
- **Controls**: ← → move, ↓ soft drop, ↑ / X rotate clockwise, Z rotate counter-clockwise,
  Space hard drop, C hold, P pause

Clear two or more lines at once to send garbage rows to every other wizard
still in the coven. Last board standing wins.

## Tech Stack

- Vanilla JavaScript, HTML5 Canvas, CSS3
- Cloudflare Workers (static asset serving + room routing)
- Cloudflare Durable Objects (one `GameRoom` per Coven Code, WebSocket relay)

## Project Structure

```
public/
  index.html          landing screen + game screen markup
  src/tetris.js        game engine (board, pieces, scoring) + canvas rendering
  src/network.js        WebSocket client (RoomConnection)
  src/app.js            UI wiring, input handling, game loop
  src/styles.css         Tetromancy visual identity
src/worker.js          Worker fetch handler + GameRoom Durable Object
wrangler.toml          Cloudflare Workers configuration
```

## License

MIT
