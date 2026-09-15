# D&D Chess

A browser-based chess game where every piece is reskinned as a Dungeons &
Dragons character class. Three ways to play:

1. **Split-Screen (hot-seat)** — two people share one screen and take turns.
2. **VS Computer** — you play against a bot that runs entirely in your browser.
3. **Online** — two players on different devices join the same game with a
   short room code and see each other's moves live.

Standard chess rules apply underneath the theme — nothing about how the
pieces move is changed, only what they're called and how they look. See
[`ProductSpec.md`](./ProductSpec.md) for the full design, and
[`FEATUREROADMAP_workplan.md`](./FEATUREROADMAP_workplan.md) for the build
plan and current progress.

## Who built this

Built by Yankun Zhang (yankunzhang@brandeis.edu) with Claude Code as the
coding assistant.

## What "Cloudflare Workers" means here

This app doesn't run on a traditional always-on server. It deploys to
**Cloudflare Workers**, a platform that runs your code on-demand, close to
whoever's using it, instead of on one server you have to keep running
yourself. Two Workers features this project relies on:

- **Workers Assets** — Cloudflare hosts your static files (HTML/CSS/JS)
  directly and serves them at the edge; no separate file host needed.
- **Durable Objects** — for the Online mode, each game room gets its own
  small, stateful piece of server-side code (a "Durable Object") that
  remembers the board position and relays moves between the two players
  over a live connection (a WebSocket). "Stateful" just means it can
  remember things between messages, unlike a normal Worker request which
  forgets everything as soon as it responds.

This project runs entirely on Cloudflare's **Workers Free plan** — no paid
tier or credit card is required to deploy it.

## How to run it locally

Requirements: [Node.js](https://nodejs.org) (for `npm`) and a free
[Cloudflare account](https://dash.cloudflare.com/sign-up).

```bash
npm install
npm run dev
```

This starts a local development server (via `wrangler dev`) that simulates
Cloudflare Workers, Assets, and Durable Objects on your machine. It prints a
local URL (usually `http://localhost:8787`) — open that in your browser.

## How to deploy it

```bash
npx wrangler login   # one-time: connects your Cloudflare account
npm run deploy
```

`wrangler` is Cloudflare's command-line deployment tool. `npm run deploy`
uploads the app and prints a live URL that looks like
`https://<app-name>.<your-subdomain>.workers.dev` — that's the real,
public address anyone can open to play. No further configuration is
needed for the Free plan.

## Project status

This project is being built incrementally, in the order laid out in
[`FEATUREROADMAP_workplan.md`](./FEATUREROADMAP_workplan.md): hot-seat mode
is deployed and playable first, then the computer opponent, then online
play. Check that file for exactly what's done and what's next.
