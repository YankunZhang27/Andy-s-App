const RUNES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const OWN_BLOCK = 28;
const PEER_BLOCK = 8;
const MINI_BLOCK = 20;

function generateCovenCode() {
  let code = '';
  for (let i = 0; i < 6; i++) code += RUNES[Math.floor(Math.random() * RUNES.length)];
  return code;
}

class TetromancyApp {
  constructor() {
    this.engine = null;
    this.connection = null;
    this.animId = null;
    this.lastTime = 0;
    this.peers = new Map(); // id -> { name, avatar, ctx, cardEl, scoreEl }
    this.you = null;
    this.roomCode = '';
    this.hasSentGameOver = false;
    this.heldKeys = new Set();
    this.repeatTimers = new Map();

    this._cacheDom();
    this._wireLanding();
    this._wireGameControls();
    this._wireKeyboard();
    this._spawnSparks();
  }

  _cacheDom() {
    this.landingScreen = document.getElementById('landing-screen');
    this.gameScreen = document.getElementById('game-screen');
    this.connectStatus = document.getElementById('connect-status');
    this.codeBoxes = Array.from(document.querySelectorAll('.code-box'));
    this.activeRoomCodeEl = document.getElementById('active-room-code');
    this.ownCanvas = document.getElementById('own-canvas');
    this.ownCtx = this.ownCanvas.getContext('2d');
    this.ownOverlay = document.getElementById('own-overlay');
    this.holdCtx = document.getElementById('hold-canvas').getContext('2d');
    this.nextCtxs = Array.from(document.querySelectorAll('.next-canvas')).map((c) => c.getContext('2d'));
    this.statScore = document.getElementById('stat-score');
    this.statLines = document.getElementById('stat-lines');
    this.statLevel = document.getElementById('stat-level');
    this.peerWall = document.getElementById('peer-wall');
    this.wallEmptyNote = document.getElementById('wall-empty-note');
    this.pauseModal = document.getElementById('pause-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.gameoverTitle = document.getElementById('gameover-title');
    this.gameoverMessage = document.getElementById('gameover-message');
  }

  _spawnSparks() {
    const field = document.getElementById('sparkfield');
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 70 + 10 + '%';
      s.style.animationDelay = (Math.random() * 10).toFixed(2) + 's';
      s.style.opacity = (0.3 + Math.random() * 0.4).toFixed(2);
      field.appendChild(s);
    }
  }

  _wireLanding() {
    document.getElementById('cast-btn').addEventListener('click', () => {
      this._startGame(generateCovenCode());
    });

    document.getElementById('join-btn').addEventListener('click', () => {
      this.codeBoxes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.codeBoxes[0].focus();
    });

    document.getElementById('code-go-btn').addEventListener('click', () => this._submitJoinCode());

    this.codeBoxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        box.value = box.value.slice(-1).toUpperCase();
        if (box.value && this.codeBoxes[i + 1]) this.codeBoxes[i + 1].focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && this.codeBoxes[i - 1]) this.codeBoxes[i - 1].focus();
        if (e.key === 'Enter') this._submitJoinCode();
      });
    });
  }

  _submitJoinCode() {
    const code = this.codeBoxes.map((b) => b.value).join('');
    if (code.length !== 6) {
      this._showConnectStatus('Enter all six characters of the Coven Code.', true);
      return;
    }
    this._startGame(code);
  }

  _showConnectStatus(message, isError) {
    this.connectStatus.textContent = message;
    this.connectStatus.classList.toggle('error', !!isError);
  }

  async _startGame(code) {
    this.roomCode = code.toUpperCase();
    this._showConnectStatus(`Summoning the coven at ${this.roomCode}…`, false);

    this.engine = new TetrisEngine();
    this.hasSentGameOver = false;
    this.connection = new RoomConnection(this.roomCode);
    this._wireConnection();

    try {
      await this.connection.connect();
    } catch {
      this._showConnectStatus('Could not reach the coven. Check your connection and try again.', true);
      return;
    }
  }

  _wireConnection() {
    const c = this.connection;

    c.onWelcome = (you, players) => {
      this.you = you;
      this.activeRoomCodeEl.textContent = this.roomCode;
      players.forEach((p) => { if (p.id !== you.id) this._addPeerCard(p); });
      this._enterGameScreen();
    };
    c.onPeerJoined = (player) => this._addPeerCard(player);
    c.onPeerState = (msg) => this._updatePeerBoard(msg);
    c.onPeerLeft = (id) => this._removePeerCard(id);
    c.onPeerGameOver = (id) => this._markPeerToppled(id);
    c.onGarbage = (amount) => { if (this.engine) this.engine.addGarbage(amount); };
    c.onWinner = (id) => this._showWinner(id);
    c.onClose = () => {};
  }

  _enterGameScreen() {
    this.landingScreen.classList.remove('active');
    this.gameScreen.classList.add('active');
    this.ownOverlay.classList.add('hidden');
    this.gameoverModal.classList.add('hidden');
    this._updateWallEmptyNote();
    this.lastTime = performance.now();
    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  _addPeerCard(player) {
    if (this.peers.has(player.id)) return;
    const card = document.createElement('div');
    card.className = 'board-card';
    card.dataset.id = player.id;
    card.innerHTML = `
      <canvas width="${10 * PEER_BLOCK}" height="${20 * PEER_BLOCK}"></canvas>
      <div class="board-who">
        <span class="wiz-avatar">${player.avatar}</span>
        <div><div class="board-name">${player.name}</div><div class="board-score">0 pts</div></div>
      </div>`;
    this.peerWall.appendChild(card);
    this.peers.set(player.id, {
      name: player.name,
      ctx: card.querySelector('canvas').getContext('2d'),
      cardEl: card,
      scoreEl: card.querySelector('.board-score'),
    });
    this._updateWallEmptyNote();
  }

  _removePeerCard(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.cardEl.remove();
    this.peers.delete(id);
    this._updateWallEmptyNote();
  }

  _markPeerToppled(id) {
    const peer = this.peers.get(id);
    if (peer) peer.cardEl.classList.add('toppled');
  }

  _updateWallEmptyNote() {
    this.wallEmptyNote.classList.toggle('hidden', this.peers.size > 0);
  }

  _updatePeerBoard(msg) {
    const peer = this.peers.get(msg.id);
    if (!peer) return;
    renderPeerBoard(peer.ctx, msg, PEER_BLOCK);
    peer.scoreEl.textContent = `${msg.score.toLocaleString()} pts`;
    if (msg.alive === false) this._markPeerToppled(msg.id);
  }

  _showWinner(id) {
    const youWon = this.you && id === this.you.id;
    this.gameoverTitle.textContent = youWon ? 'You Outlasted the Coven' : 'The Coven Has Spoken';
    const name = youWon ? 'You' : (this.peers.get(id)?.name || 'A rival wizard');
    this.gameoverMessage.textContent = youWon
      ? 'Every other apprentice has toppled. Your spells alone still stand.'
      : `${name} outlasted the rest of the coven this round.`;
    this.gameoverModal.classList.remove('hidden');
  }

  _loop(time) {
    const dt = time - this.lastTime;
    this.lastTime = time;

    if (this.engine) {
      this.engine.tick(dt);
      renderOwnBoard(this.ownCtx, this.engine, OWN_BLOCK);
      renderMiniPreview(this.holdCtx, this.engine.hold, MINI_BLOCK);
      this.engine.queue.forEach((type, i) => {
        if (this.nextCtxs[i]) renderMiniPreview(this.nextCtxs[i], type, MINI_BLOCK);
      });
      this.statScore.textContent = this.engine.score.toLocaleString();
      this.statLines.textContent = this.engine.lines;
      this.statLevel.textContent = this.engine.level;

      if (this.connection) this.connection.sendState(this.engine.serialize());

      if (!this.engine.alive && !this.hasSentGameOver) {
        this.hasSentGameOver = true;
        this.ownOverlay.textContent = 'Your spells have run out. Still scrying the coven…';
        this.ownOverlay.classList.remove('hidden');
      }
    }

    this.animId = requestAnimationFrame((t) => this._loop(t));
  }

  _wireGameControls() {
    document.getElementById('copy-code-btn').addEventListener('click', () => {
      navigator.clipboard?.writeText(this.roomCode).catch(() => {});
    });
    document.getElementById('leave-btn').addEventListener('click', () => this._leaveGame());
    document.getElementById('resume-btn').addEventListener('click', () => this._togglePause());
    document.getElementById('quit-from-pause-btn').addEventListener('click', () => this._leaveGame());
    document.getElementById('quit-from-gameover-btn').addEventListener('click', () => this._leaveGame());
  }

  _togglePause() {
    if (!this.engine) return;
    this.engine.isPaused = !this.engine.isPaused;
    this.pauseModal.classList.toggle('hidden', !this.engine.isPaused);
  }

  _leaveGame() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.connection) this.connection.close();
    this.connection = null;
    this.engine = null;
    this.peers.forEach((peer) => peer.cardEl.remove());
    this.peers.clear();
    this.you = null;

    this.pauseModal.classList.add('hidden');
    this.gameoverModal.classList.add('hidden');
    this.gameScreen.classList.remove('active');
    this.landingScreen.classList.add('active');
    this.codeBoxes.forEach((b) => { b.value = ''; });
    this._showConnectStatus('', false);
  }

  _wireKeyboard() {
    const isTypingTarget = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

    document.addEventListener('keydown', (e) => {
      if (!this.engine || isTypingTarget(e.target)) return;
      const key = e.key;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(key)) e.preventDefault();
      if (this.heldKeys.has(key)) return;
      this.heldKeys.add(key);

      switch (key) {
        case 'ArrowLeft': this._startRepeat(key, () => this.engine.moveLeft()); break;
        case 'ArrowRight': this._startRepeat(key, () => this.engine.moveRight()); break;
        case 'ArrowDown': this._startRepeat(key, () => this.engine.softDrop(), 0, 40); break;
        case 'ArrowUp': case 'x': case 'X': this.engine.rotate(1); break;
        case 'z': case 'Z': this.engine.rotate(-1); break;
        case ' ': this.engine.hardDrop(); break;
        case 'c': case 'C': case 'Shift': this.engine.holdPiece(); break;
        case 'p': case 'P': case 'Escape': this._togglePause(); break;
      }
    });

    document.addEventListener('keyup', (e) => {
      this.heldKeys.delete(e.key);
      this._clearRepeat(e.key);
    });
  }

  _startRepeat(key, action, delay = 180, interval = 50) {
    action();
    this._clearRepeat(key);
    const loop = () => {
      action();
      this.repeatTimers.set(key, setTimeout(loop, interval));
    };
    this.repeatTimers.set(key, setTimeout(loop, delay));
  }

  _clearRepeat(key) {
    const t = this.repeatTimers.get(key);
    if (t) { clearTimeout(t); this.repeatTimers.delete(key); }
  }
}

document.addEventListener('DOMContentLoaded', () => { new TetromancyApp(); });
