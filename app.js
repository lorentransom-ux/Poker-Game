// ─── Chip Definitions ────────────────────────────────────────────
const CHIPS = [
  { id: 'white', label: '$5',  value: 5,   bgColor: '#F0F0F0', textColor: '#555',  borderColor: '#C0C0C0', shadow: '#999' },
  { id: 'red',   label: '$10', value: 10,  bgColor: '#CC2222', textColor: '#FFF',  borderColor: '#8B0000', shadow: '#500' },
  { id: 'blue',  label: '$25', value: 25,  bgColor: '#1155CC', textColor: '#FFF',  borderColor: '#003399', shadow: '#001' },
  { id: 'green', label: '$50', value: 50,  bgColor: '#1a7a1a', textColor: '#FFF',  borderColor: '#005500', shadow: '#002' },
  { id: 'black', label: '$100',value: 100, bgColor: '#222',    textColor: '#EEE',  borderColor: '#000',    shadow: '#000' },
];

// ─── State ───────────────────────────────────────────────────────
let state = {
  players: [
    { name: 'Dad',  chips: {} },
    { name: 'Son',  chips: {} },
  ],
  pot: {},
  history: [],   // stack of {players, pot} snapshots for undo
};

// Default starting chips
let startingChips = { white: 4, red: 4, blue: 4, green: 2, black: 2 };

// ─── Helpers ─────────────────────────────────────────────────────
function chipKeys() { return CHIPS.map(c => c.id); }

function emptyChips() {
  const obj = {};
  CHIPS.forEach(c => obj[c.id] = 0);
  return obj;
}

function chipValue(chips) {
  return CHIPS.reduce((sum, c) => sum + (chips[c.id] || 0) * c.value, 0);
}

function fmt(n) { return '$' + n.toLocaleString(); }

function potIsEmpty() {
  return CHIPS.every(c => (state.pot[c.id] || 0) === 0);
}

function cloneState() {
  return {
    players: state.players.map(p => ({ name: p.name, chips: { ...p.chips } })),
    pot: { ...state.pot }
  };
}

function pushHistory() {
  state.history.push(cloneState());
  if (state.history.length > 30) state.history.shift();
}

function showToast(msg, duration = 1600) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Setup Screen ────────────────────────────────────────────────
function initSetup() {
  // Player name cards
  const pCards = document.getElementById('player-setup-cards');
  pCards.innerHTML = '';
  state.players.forEach((p, i) => {
    pCards.innerHTML += `
      <div class="setup-card" style="max-width:420px; width:100%;">
        <h3>Player ${i+1} Name</h3>
        <input class="player-name-input" id="pname${i}"
          value="${p.name}" placeholder="Enter name" maxlength="14">
      </div>`;
  });

  // Chip count inputs
  const row = document.getElementById('chip-setup-row');
  row.innerHTML = '';
  CHIPS.forEach(c => {
    row.innerHTML += `
      <div class="chip-setup">
        <div class="chip-circle-sm"
          style="background:${c.bgColor}; color:${c.textColor}; border-color:${c.borderColor}">
          ${c.label}
        </div>
        <input class="chip-count-input" id="sc_${c.id}"
          type="number" min="0" max="99"
          value="${startingChips[c.id] || 0}">
        <span class="chip-val-label">${c.label}</span>
      </div>`;
  });
}

function startGame() {
  // Read player names
  state.players.forEach((p, i) => {
    const inp = document.getElementById(`pname${i}`);
    if (inp && inp.value.trim()) p.name = inp.value.trim();
  });

  // Read starting chip counts
  CHIPS.forEach(c => {
    const inp = document.getElementById(`sc_${c.id}`);
    startingChips[c.id] = parseInt(inp?.value || 0) || 0;
  });

  // Give chips to both players
  state.players.forEach(p => {
    p.chips = { ...startingChips };
  });
  state.pot = emptyChips();
  state.history = [];

  document.getElementById('setup').style.display = 'none';
  const g = document.getElementById('game');
  g.style.display = 'flex';
  renderGame();
}

function goSetup() {
  document.getElementById('game').style.display = 'none';
  document.getElementById('setup').style.display = 'flex';
  initSetup();
}

// ─── Game Rendering ──────────────────────────────────────────────
function renderGame() {
  renderPlayer(0);
  renderPlayer(1);
  renderPot();
}

function renderPlayer(idx) {
  const p = state.players[idx];
  const panel = document.getElementById(`player${idx}-panel`);
  const total = chipValue(p.chips);

  let chipsHtml = '';
  CHIPS.forEach(c => {
    const count = p.chips[c.id] || 0;
    const empty = count === 0 ? ' empty' : '';
    chipsHtml += `
      <div class="chip-btn-wrap">
        <button class="chip-btn${empty}"
          style="background:${c.bgColor}; color:${c.textColor}; border-color:${c.borderColor};
                 box-shadow:0 4px 0 ${c.shadow},0 2px 8px rgba(0,0,0,0.5)"
          onclick="betChip(${idx},'${c.id}')"
          title="Bet 1 ${c.label} chip"
          ${count === 0 ? 'disabled' : ''}>
          <span class="chip-count">${count}</span>
          <span class="chip-value">${c.label}</span>
        </button>
        <span class="chip-denom">${c.label}</span>
      </div>`;
  });

  const broke = total === 0;
  panel.innerHTML = `
    <div class="player-header">
      <div class="player-name">${escHtml(p.name)}</div>
      <div class="player-total">${fmt(total)}</div>
    </div>
    <div class="chips-grid">${chipsHtml}</div>
    <button class="allin-btn" onclick="allIn(${idx})" ${broke ? 'disabled' : ''}>
      🔥 ALL IN${broke ? ' (No chips)' : ' — ' + fmt(total)}
    </button>`;
}

function renderPot() {
  const pot = state.pot;
  const total = chipValue(pot);
  const empty = potIsEmpty();

  let chipHtml = '';
  if (empty) {
    chipHtml = '<div class="pot-empty-msg">♦ Pot is empty ♦</div>';
  } else {
    CHIPS.forEach(c => {
      const count = pot[c.id] || 0;
      if (count === 0) return;
      chipHtml += `
        <div class="pot-chip-item">
          <div class="pot-chip-circle"
            style="background:${c.bgColor}; color:${c.textColor}; border-color:${c.borderColor}">
            ${count}
          </div>
          <span class="pot-chip-count">${c.label}</span>
        </div>`;
    });
  }

  const totalDisplay = empty ? '—' : fmt(total);
  const colors = [
    'linear-gradient(135deg,#1a6b8a,#2196F3)',
    'linear-gradient(135deg,#7b1fa2,#c84fc8)'
  ];

  document.getElementById('pot-panel').innerHTML = `
    <div class="pot-half pot-half-top">
      <button class="win-btn" style="background:${colors[0]}"
        onclick="winPot(0)" ${empty ? 'disabled' : ''}>
        🏆 ${escHtml(state.players[0].name)} Wins!
      </button>
    </div>
    <div class="pot-center-row">
      <div class="pot-text-col">
        <span class="pot-text-vertical">Pot  ${totalDisplay}</span>
      </div>
      <div class="pot-chips">${chipHtml}</div>
    </div>
    <div class="pot-half pot-half-bottom">
      <button class="win-btn" style="background:${colors[1]}"
        onclick="winPot(1)" ${empty ? 'disabled' : ''}>
        🏆 ${escHtml(state.players[1].name)} Wins!
      </button>
    </div>`;
}

// ─── Game Actions ────────────────────────────────────────────────
function betChip(playerIdx, chipId) {
  const p = state.players[playerIdx];
  if ((p.chips[chipId] || 0) === 0) return;
  pushHistory();
  p.chips[chipId]--;
  state.pot[chipId] = (state.pot[chipId] || 0) + 1;
  renderGame();
  checkElimination();
}

function allIn(playerIdx) {
  const p = state.players[playerIdx];
  if (chipValue(p.chips) === 0) return;
  pushHistory();
  CHIPS.forEach(c => {
    state.pot[c.id] = (state.pot[c.id] || 0) + (p.chips[c.id] || 0);
    p.chips[c.id] = 0;
  });
  renderGame();
  showToast(`${p.name} is ALL IN! 🔥`, 2000);
  checkElimination();
}

function winPot(playerIdx) {
  if (potIsEmpty()) return;
  pushHistory();
  const p = state.players[playerIdx];
  const potVal = chipValue(state.pot);
  CHIPS.forEach(c => {
    p.chips[c.id] = (p.chips[c.id] || 0) + (state.pot[c.id] || 0);
  });
  state.pot = emptyChips();
  renderGame();
  showWinModal(p.name, potVal);
  checkElimination();
}

function checkElimination() {
  const broke = state.players.filter(p => chipValue(p.chips) === 0);
  if (broke.length === 1 && potIsEmpty()) {
    const winner = state.players.find(p => chipValue(p.chips) > 0);
    showGameOverModal(winner.name, chipValue(winner.chips));
  }
}

function undoAction() {
  if (state.history.length === 0) {
    showToast('Nothing to undo!');
    return;
  }
  const prev = state.history.pop();
  state.players = prev.players;
  state.pot = prev.pot;
  renderGame();
  showToast('↩ Undone!');
}

function newHand() {
  if (potIsEmpty()) {
    showToast('Pot is already empty — start betting!');
    return;
  }
  if (!confirm('Return all pot chips to players equally? (Split the pot)')) return;
  pushHistory();
  // Split pot as evenly as possible — give remainder to player 0
  CHIPS.forEach(c => {
    const total = state.pot[c.id] || 0;
    const half = Math.floor(total / 2);
    state.players[0].chips[c.id] = (state.players[0].chips[c.id] || 0) + (total - half);
    state.players[1].chips[c.id] = (state.players[1].chips[c.id] || 0) + half;
    state.pot[c.id] = 0;
  });
  renderGame();
  showToast('🔄 Pot split! Ready for next hand.');
}

// ─── Game Over Modal ─────────────────────────────────────────────
function showGameOverModal(name, total) {
  document.getElementById('gameover-name').textContent = name;
  document.getElementById('gameover-subtitle').textContent = `wins the game with ${fmt(total)}! 🎉`;
  document.getElementById('gameover-modal').style.display = 'flex';
}

function closeGameOverModal() {
  document.getElementById('gameover-modal').style.display = 'none';
}

function resetSamePlayers() {
  closeGameOverModal();
  state.players.forEach(p => {
    p.chips = { ...startingChips };
  });
  state.pot = emptyChips();
  state.history = [];
  renderGame();
  showToast('🔄 Fresh stacks! New game begins.', 2200);
}

// ─── Win Modal ───────────────────────────────────────────────────
function showWinModal(name, amount) {
  document.getElementById('win-name').textContent = `${name} Wins!`;
  document.getElementById('win-amount').textContent = `🏆 Took the pot — ${fmt(amount)}!`;
  const modal = document.getElementById('win-modal');
  modal.style.display = 'flex';
}

function closeWinModal() {
  document.getElementById('win-modal').style.display = 'none';
}

// ─── Util ────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ────────────────────────────────────────────────────────
initSetup();
