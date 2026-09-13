# Block Quest - Multiplayer Tetris

A real-time multiplayer Tetris game built with vanilla JavaScript and Cloudflare Workers, inspired by D&D aesthetics.

## Features

- ⚔️ **Epic Fantasy Design** - Gold and red aesthetic with dramatic typography
- 🎮 **Local Multiplayer** - Two players on the same screen
- 📱 **Responsive Design** - Works on desktop and mobile
- ☁️ **Cloudflare Deployment Ready** - Built for Cloudflare Workers + Durable Objects
- 🎯 **Full Tetris Mechanics** - Line clearing, scoring, levels, hard drops

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:8787` to play.

## Deployment to Cloudflare

```bash
wrangler login
npm run deploy
```

## How to Play

- **CREATE ARENA** - Start a new game
- **JOIN ARENA** - Join with a room code
- **Controls**: Arrow keys to move, SPACE to rotate, down arrow to drop faster

## Tech Stack

- Vanilla JavaScript
- HTML5 Canvas
- Cloudflare Workers + Durable Objects
- CSS3

## License

MIT