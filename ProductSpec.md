# Product Spec — D&D Chess

## 1. What the app does

D&D Chess is standard chess — same 8x8 board, same six piece types, same
legal moves, same win conditions (checkmate/stalemate) — with every piece
reskinned as a Dungeons & Dragons character class. The rules never change;
only the names, art, and flavor text change.

There is no Figma design file attached to this project, so the visual
design and the class theme below were designed from scratch to fit the
brief, rather than matched to mockups. If a real design file is provided
later, the CSS and piece art are the only things that should need to
change — the game logic is deliberately kept separate from how it looks
(see "Separation of concerns" below).

The app has three modes, selectable from a home screen:

| Mode | What it is | Who/what moves the black pieces |
|---|---|---|
| **Split-Screen** | Two people, one screen, one keyboard/mouse. They alternate turns; the board flips (or is clearly labeled) so it's obvious whose turn it is. | The second human, on their turn |
| **VS Computer** | One person plays White. | A bot running entirely in the browser (see §4) |
| **Online** | Two people, two devices/browsers, connected by a short room code. | The second human, over the network |

None of the three modes has accounts, logins, passwords, saved history,
chess clocks, ratings, or move export. A player is just a display name
typed in for that session. This is intentional — see §6 (Out of scope).

## 2. The D&D class theme

Each of the six chess piece types is reskinned as one D&D class, chosen to
match how that piece moves or its role on the board. Both sides (White/
Black) use the same class-per-piece-type mapping, just recolored (e.g. two
factions/colors of adventuring party), the way both sides in standard chess
use the same piece set in two colors.

| Chess piece | D&D class | Why |
|---|---|---|
| Pawn | **Monk** | Numerous, disciplined, trained fighters who form the front line and strike forward with quick, simple attacks (diagonal captures). |
| Knight | **Ranger** | Moves in an unpredictable, leaping L-shape — a scout that jumps past the front line to strike from an angle no one expects. |
| Bishop | **Cleric** | Moves on the diagonal, classically read as a "line of sight" or channeled power — a support/spellcaster role. |
| Rook | **Fighter** | Moves in straight lines with raw power — a heavy-hitting tank that holds a line. |
| Queen | **Sorcerer** | The most powerful piece, moving any direction, any distance — innate, sweeping magical power. |
| King | **Paladin** | The piece the whole game protects — a righteous leader who moves cautiously, one square at a time. |

This mapping lives in exactly one place in the code (a small config/data
module) so it can be changed later — e.g. if a real Figma file arrives —
without touching any chess logic.

Each piece is rendered with a label/icon showing its class name and a
simple class-themed glyph. Given the "no external libraries beyond what's
required" constraint, piece art starts as clean SVG icons or styled
Unicode chess glyphs recolored and labeled per class, not licensed D&D
artwork.

## 3. How the app is organized

### High-level architecture

```
Browser (client)                    Cloudflare Worker (server)
─────────────────                   ──────────────────────────
index.html + CSS                    worker.js
  │                                   ├─ serves static files (Assets)
  ├─ rules.js  ◄── shared ──────────► │  (same rules.js is bundled
  │   (also loaded here)              │   into the Durable Object)
  ├─ board-ui.js (renders board,      │
  │   handles clicks/drags)           └─ GameRoomDO (Durable Object,
  ├─ hotseat.js   (Split-Screen)          one per room code)
  ├─ ai.js        (VS Computer bot)        ├─ holds the authoritative
  └─ online.js    (Online mode:            │   board position
      opens a WebSocket to the             ├─ validates every move
      matching GameRoomDO)                 │   with rules.js
                                            └─ relays moves to both
                                                players over WebSocket
```

### Separation of concerns (why it's split this way)

- **`rules.js`** is the single source of truth for "is this move legal,
  and what does the board look like after it." It has no idea whether
  it's being used for hot-seat, vs-computer, or online play, and no idea
  what a Durable Object or a WebSocket is. This means the exact same file
  runs in the browser (for Split-Screen and VS Computer) and inside the
  Durable Object (for Online), so a player can never make a move online
  that the local UI wouldn't also consider illegal — one rulebook, no
  drift between client and server.
- **`board-ui.js`** only knows how to draw a board and turn clicks into
  "player tried to move from X to Y" — it asks `rules.js` whether that's
  allowed and re-renders based on the answer. All three modes reuse it.
- **`hotseat.js` / `ai.js` (+ its mode wrapper) / `online.js`** are the
  three thin "mode" layers. Each one just decides *where the other side's
  move comes from* (the same keyboard, the bot, or the network) and wires
  that into `board-ui.js` + `rules.js`. This is why hot-seat can ship
  first: it needs zero networking and no bot, just `rules.js` +
  `board-ui.js`.
- **`GameRoomDO`** (a Durable Object — see README for what that means) is
  the only mode-specific piece that lives on the server. It exists only
  for Online mode and holds nothing that the other two modes need.

### Planned file layout

```
/
├── README.md
├── ProductSpec.md
├── FEATUREROADMAP_workplan.md
├── package.json
├── wrangler.jsonc                 # Cloudflare Workers config (Assets + Durable Objects)
├── public/                        # static assets served as-is
│   ├── index.html                 # single page; mode screens are shown/hidden in it
│   ├── styles.css
│   └── pieces/                    # piece icons/art per class
└── src/
    ├── worker.js                  # Worker entry point: routes WS upgrades to the DO,
    │                               #   otherwise falls through to static Assets
    ├── rules.js                   # shared chess engine (see above) — no DOM, no network
    ├── theme.js                   # piece-type -> D&D class name/art mapping (table above)
    ├── board-ui.js                # renders the board; turns UI events into rules.js calls
    ├── hotseat.js                 # Split-Screen mode wiring
    ├── ai.js                      # minimax + alpha-beta bot (depth 2)
    ├── vs-computer.js             # VS Computer mode wiring (uses ai.js)
    ├── online.js                  # Online mode wiring: WebSocket client
    ├── room-do.js                 # GameRoomDO: the Durable Object class
    └── app.js                     # home screen: mode picker, boots the right mode module
```

This layout is a plan, not a commitment set in stone — if a task in the
workplan finds a better split, it's fine to adjust, as long as the
separation of concerns above (shared rules, thin mode layers) is kept.

## 4. The computer opponent

The bot is **minimax with alpha-beta pruning**, a standard game-playing
search algorithm explained here in plain terms:

- **Minimax**: the bot looks a few moves ahead, assuming it will always
  pick the best move for itself and that you will always pick the best
  move for you (hence "mini-max" — it minimizes your best outcome while
  maximizing its own).
- **Alpha-beta pruning**: a shortcut that lets the bot skip looking at
  branches of the search it can already prove won't matter, so it explores
  the same depth much faster without changing the result.
- **Search depth 2**: it looks two half-moves ahead (its move, then your
  best reply) before deciding. This keeps it fast enough to answer within
  two seconds, as required, without needing a Web Worker (a background
  browser thread) — though that's a fallback option if depth-2 search
  alone can't reliably hit two seconds on slower devices.
- **Scoring by piece values**: it scores a board position by adding up the
  point value of its own pieces and subtracting the value of yours (the
  standard chess piece values: pawn 1, knight/bishop 3, rook 5, queen 9),
  favoring positions where it has captured more/stronger pieces than it's
  lost.

No chess engine library, no external API — it's plain JavaScript using
`rules.js` to know which moves are legal.

## 5. Online mode, in plain terms

1. A player picks "Online," types a display name, and either creates a
   room (gets a short room code to share) or joins one (types a code).
2. Both players' browsers open a WebSocket (a persistent two-way
   connection, unlike a normal web request that ends after one reply) to
   the Worker, which routes each connection to that room code's Durable
   Object.
3. Every message sent over that connection is a small JSON object with a
   `type` (what kind of message it is) and a `payload` (its data) — e.g.
   `{"type": "move", "payload": {"from": "e2", "to": "e4"}}`.
4. The Durable Object is the referee: when it gets a move message, it
   checks that move against `rules.js` itself before doing anything else.
   If legal, it updates its saved board and sends a move message to both
   players. If illegal, it tells only the sender and nothing changes.
5. The Durable Object saves the current position after every move. If a
   player refreshes or reconnects, they rejoin the same game at the same
   position — there's no game clock, so there's no rush and nothing is
   lost by stepping away.

## 6. Out of scope (on purpose)

To keep this buildable and match the brief exactly, the following are
explicitly **not** included: user accounts/login/passwords, a persistent
user database, chess clocks/timers, player ratings, draw-by-repetition or
the fifty-move rule, an opening book (pre-programmed opening moves for the
bot), and move export (e.g. PGN files). If any of these come up later,
they're new scope to be discussed, not something to add quietly.
