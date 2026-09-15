# Feature Roadmap / Workplan — D&D Chess

## How to use this document

- Every task is a checkbox: `[ ]` not started, `[x]` done.
- **Dependencies** lists which other tasks must be checked off first. Tasks
  with no unmet dependencies can be started at any time; this is what makes
  the plan resumable — pick any task whose dependencies are all checked,
  work it, check it off, stop whenever.
- **Files** lists what's expected to change. Small deviations are fine; if
  a task turns out to need a file not listed, that's normal.
- **Definition of done (DoD)** is the bar for checking the box — specific
  and testable, not "looks right."
- Tasks are grouped into phases, and the phases are ordered on purpose:
  **Phase 2 (hot-seat) ships to a live URL before Phase 3 (computer
  opponent) starts, which ships live before Phase 4 (online) starts.**
  That way there's always a playable, deployed game as early as possible,
  and each mode is a working increase in scope over the last rather than
  three separate builds finished all at once.
- Version control: each completed task gets its own commit (named after
  the task) pushed to the `claude/exciting-brahmagupta-9yf0v5` branch. A
  single pull request tracks this branch's progress and gets kept up to
  date as commits land, rather than opening a new PR per task (GitHub
  only allows one open PR per branch→base pair).

Nothing below gets built until you pick a task and say so — see the note
at the end of this file.

---

## Phase 0 — Project & Deploy Skeleton

Goal: prove the Cloudflare Workers deployment pipeline end-to-end with a
placeholder page, *before* any game logic exists, so every later phase is
deploying onto ground already known to work.

- [x] **0.1 — Scaffold the Workers project and deploy a placeholder page**
  - Dependencies: none
  - Files: `package.json`, `wrangler.jsonc`, `public/index.html`,
    `src/worker.js`, `.gitignore` (review/update)
  - DoD: `wrangler.jsonc` exists with `assets.directory` pointing at
    `public/`, `assets.not_found_handling` set to
    `"single-page-application"`, `compatibility_date` set to today's date,
    and `{"observability": {"enabled": true}}` set. `npm install` then
    `npm run deploy` succeeds and prints a live `workers.dev` URL that,
    when visited, shows a simple "D&D Chess — under construction" page
    served as a static asset.
  - Status: code, config, and local verification (`wrangler dev` serving
    the page correctly, `wrangler deploy --dry-run` validating the config)
    are done. The actual `npm run deploy` to get a live URL needs a
    Cloudflare account login (`npx wrangler login`), which this build
    environment doesn't have — see the note below.

---

## Phase 1 — Shared Chess Rules Engine (`rules.js`)

Goal: one hand-written module that knows all of chess, used by every mode.
No UI, no networking, no D&D theme — just correct chess.

- [ ] **1.1 — Board model and basic piece movement**
  - Dependencies: 0.1
  - Files: `src/rules.js`
  - DoD: `rules.js` can represent the starting position and produce
    pseudo-legal moves (legal-shaped, but not yet checked against "does
    this leave my king in check") for all six piece types: pawn
    (single/double forward push, diagonal capture), knight (L-shape),
    bishop (diagonal slide), rook (straight slide), queen (both), king
    (one square, any direction). Blocked/off-board squares are correctly
    excluded.
- [ ] **1.2 — Check, checkmate, and stalemate**
  - Dependencies: 1.1
  - Files: `src/rules.js`
  - DoD: `rules.js` can tell whether a given side's king is in check;
    filters pseudo-legal moves down to truly legal moves (a move that
    would leave your own king in check is excluded); correctly identifies
    checkmate (in check, no legal moves) and stalemate (not in check, no
    legal moves) on known reference positions (e.g. Fool's Mate, Scholar's
    Mate for checkmate; a known stalemate position).
- [ ] **1.3 — Castling, en passant, and promotion**
  - Dependencies: 1.2
  - Files: `src/rules.js`
  - DoD: Castling works both sides, only when the king and the relevant
    rook have never moved, the squares between them are empty, and the
    king is not in check, does not pass through check, and does not land
    in check. En passant capture is legal only on the immediate next move
    after the opponent's double-step pawn push, and expires after that.
    A pawn reaching the last rank must promote (to queen, rook, bishop, or
    knight — the mode layer decides how the player picks, but `rules.js`
    won't allow the pawn to just sit there). All three are covered by
    manual test cases (see 1.4).
- [ ] **1.4 — Rules self-test harness**
  - Dependencies: 1.3
  - Files: `src/rules.test.js` (or similar), `package.json` (add a
    `"test"` script if useful)
  - DoD: a runnable script exercises `rules.js` against known correct
    results — at minimum, a "perft" style legal-move count from the
    starting position (depth 1 = 20 legal moves, depth 2 = 400) — and
    passes. This is what proves "an illegal move is impossible to make"
    before any UI is built on top.

---

## Phase 2 — Split-Screen (Hot-Seat) Mode — first live deploy

Goal: the first fully playable, publicly deployed version of the game.

- [ ] **2.1 — D&D class theme module and piece art**
  - Dependencies: 0.1 (independent of Phase 1, can be done in parallel)
  - Files: `src/theme.js`, `public/pieces/*.svg`, `public/styles.css`
  - DoD: `theme.js` exports the piece-type → D&D class mapping from
    `ProductSpec.md` §2 (pawn=Monk, knight=Ranger, bishop=Cleric,
    rook=Fighter, queen=Sorcerer, king=Paladin) plus a label and an
    icon/art reference for each, for both colors. Every piece type has
    visually distinct art at board size.
- [ ] **2.2 — Board rendering and move input**
  - Dependencies: 1.2, 2.1
  - Files: `src/board-ui.js`, `public/index.html`, `public/styles.css`
  - DoD: renders an 8x8 board with themed pieces in the starting
    position; clicking your own piece highlights its legal destination
    squares (from `rules.js`); clicking a highlighted square makes the
    move and re-renders the board; clicking an illegal square does
    nothing; captured pieces are shown somewhere on screen.
- [ ] **2.3 — Split-Screen mode wiring**
  - Dependencies: 2.2
  - Files: `src/hotseat.js`, `src/app.js`, `public/index.html`
  - DoD: a home screen offers "Split-Screen" as a mode choice; two
    players alternate moves on the same screen with a clear "whose turn"
    indicator; check is visibly indicated; checkmate/stalemate end the
    game with a clear message and a "new game" action.
- [ ] **2.4 — Deploy Split-Screen mode live**
  - Dependencies: 2.3
  - Files: none (deploy only)
  - DoD: `npm run deploy` succeeds; on the public `workers.dev` URL, two
    people can play a complete, legal game of chess on one screen from
    the starting position through to a checkmate or stalemate ending.
    **This is the first milestone: a real, live, playable game.**

---

## Phase 3 — VS Computer Mode

Goal: add a browser-side bot as the second player.

- [ ] **3.1 — Position scoring**
  - Dependencies: 1.2
  - Files: `src/ai.js`
  - DoD: given a board position, returns a numeric score using standard
    piece values (pawn 1, knight 3, bishop 3, rook 5, queen 9), with the
    sign convention documented (e.g. positive favors White).
- [ ] **3.2 — Minimax search with alpha-beta pruning, depth 2**
  - Dependencies: 3.1, 1.3
  - Files: `src/ai.js`
  - DoD: given a board and a side to move, returns the best legal move
    found by searching 2 half-moves deep with alpha-beta pruning, using
    only `rules.js` for legal moves (no external engine/API). Manually
    timed during development to confirm it answers within 2 seconds on
    ordinary hardware for a mid-game position (not just the opening).
- [ ] **3.3 — VS Computer mode wiring**
  - Dependencies: 3.2, 2.2, 2.1
  - Files: `src/vs-computer.js`, `src/app.js`, `public/index.html`
  - DoD: home screen offers "VS Computer"; after the human's move, the
    board shows a brief "thinking" state, then the bot's move plays
    automatically; check/checkmate/stalemate handled the same as
    Split-Screen, including the bot correctly delivering and detecting
    being put into checkmate.
- [ ] **3.4 — Deploy VS Computer mode live**
  - Dependencies: 3.3
  - Files: none (deploy only)
  - DoD: on the public URL, "VS Computer" is playable start-to-finish
    against the bot, including a full game ending in checkmate.

---

## Phase 4 — Online Room Mode

Goal: two players on separate devices, connected through a Durable Object.

- [ ] **4.1 — Durable Object skeleton and WebSocket accept**
  - Dependencies: 0.1, 1.2
  - Files: `src/room-do.js`, `src/worker.js`, `wrangler.jsonc`
  - DoD: `wrangler.jsonc` declares the Durable Object binding with
    `"new_sqlite_classes"` in its migrations array (not the legacy
    non-SQLite class list). `worker.js` routes a room request (e.g.
    `/room/<code>`) with a WebSocket upgrade header to
    `env.ROOM.getByName(roomCode)`. The Durable Object accepts the
    connection with `ctx.acceptWebSocket(server)` — never
    `server.accept()`. A test connection (e.g. from browser devtools)
    upgrades successfully and stays open.
- [ ] **4.2 — Room join and player identity**
  - Dependencies: 4.1
  - Files: `src/room-do.js`
  - DoD: the first two sockets to join a room are assigned White/Black
    and their chosen display name, stored with
    `ws.serializeAttachment()`; a third connection attempt gets a clear
    "room full" response instead of joining as a player;
    `ws.deserializeAttachment()` correctly recovers identity on later
    messages/reconnects.
- [ ] **4.3 — Server-side move validation and broadcast**
  - Dependencies: 4.2, 1.3
  - Files: `src/room-do.js` (imports `src/rules.js`)
  - DoD: the Durable Object holds the authoritative board for the room.
    On receiving `{"type": "move", "payload": {...}}` it validates the
    move using the same `rules.js` used client-side; illegal moves get a
    rejection sent back only to the sender and change nothing; legal
    moves update the saved board and are broadcast to both connected
    players. The position is saved to the Durable Object's storage after
    every move (no timers/alarms involved — this happens synchronously as
    part of handling the move).
- [ ] **4.4 — Online mode client wiring**
  - Dependencies: 4.3, 2.2, 2.1
  - Files: `src/online.js`, `src/app.js`, `public/index.html`
  - DoD: home screen offers "Online"; a player enters a display name and
    either creates a room (shown a short shareable room code) or joins an
    existing one by typing the code; the board updates live when the
    other player moves; refreshing the page and rejoining the same room
    code restores the same in-progress position (proving the "save after
    every move" behavior from 4.3 actually works end to end).
- [ ] **4.5 — Deploy Online mode live**
  - Dependencies: 4.4
  - Files: none (deploy only)
  - DoD: two separate browser sessions (e.g. a normal window and a
    private/incognito window, or two different devices) can create/join
    the same room code on the public deployed URL and play a complete
    legal game together, including a refresh-and-rejoin check on at least
    one of the two connections mid-game.

---

## Phase 5 — Wrap-up

- [ ] **5.1 — Cross-mode QA pass**
  - Dependencies: 2.4, 3.4, 4.5
  - Files: any file with a bug found during this pass
  - DoD: a manual pass through all three modes covering castling, en
    passant, promotion, check, checkmate, stalemate, illegal-move
    rejection, and (for Online) invalid/full room codes and
    refresh-and-rejoin. Any bug found gets fixed and noted here, or added
    as a new checkbox task if it's larger than a quick fix.
- [ ] **5.2 — Documentation sync**
  - Dependencies: 5.1
  - Files: `README.md`, `ProductSpec.md`
  - DoD: both docs are re-read against the finished app and updated
    wherever the build ended up differing from the original plan, so
    neither document describes anything as built that isn't, or omits
    anything that is.

---

## What's next

This file, `README.md`, and `ProductSpec.md` are the only things committed
so far — no game code exists yet. Tell me which task to start with (0.1 is
the natural first pick, since everything else depends on the deploy
pipeline existing), and I'll begin there.
