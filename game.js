const STORAGE_KEY = 'block-party-falling-save';
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const DEFAULT_SPEED = 5;
const COLORS = {
  I: '#70c4ff',
  O: '#ffd166',
  T: '#a78bfa',
  S: '#62e2c1',
  Z: '#ff84ad',
  J: '#6e9dff',
  L: '#ffad70'
};
const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};
const LINE_SCORES = [0, 100, 300, 500, 800];

const boardElement = document.getElementById('board');
const scoreElement = document.getElementById('scoreDisplay');
const bestElement = document.getElementById('bestDisplay');
const linesElement = document.getElementById('linesDisplay');
const messageElement = document.getElementById('gameMessage');
const nextPieceElement = document.getElementById('nextPiece');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const intervalDisplay = document.getElementById('intervalDisplay');
const pauseButton = document.getElementById('pauseBtn');
const restartButton = document.getElementById('restartBtn');

function makeBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function randomType() {
  const types = Object.keys(SHAPES);
  return types[Math.floor(Math.random() * types.length)];
}

function getStoredPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      best: Number.isFinite(saved?.best) && saved.best >= 0 ? saved.best : 0,
      speed: Number.isInteger(saved?.speed) && saved.speed >= 1 && saved.speed <= 10
        ? saved.speed
        : DEFAULT_SPEED
    };
  } catch {
    return { best: 0, speed: DEFAULT_SPEED };
  }
}

const preferences = getStoredPreferences();
const state = {
  board: makeBoard(),
  current: null,
  next: randomType(),
  score: 0,
  best: preferences.best,
  lines: 0,
  speed: preferences.speed,
  paused: false,
  over: false,
  message: 'Use the controls to move and rotate the falling block.',
  messageType: ''
};

let gravityTimer = null;
speedSlider.value = String(state.speed);

function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      best: state.best,
      speed: state.speed
    }));
  } catch {
    setMessage('Could not save your best score or speed in this browser.');
  }
}

function setMessage(text, type = '') {
  state.message = text;
  state.messageType = type;
  messageElement.textContent = text;
  messageElement.className = `game-message${type ? ` is-${type}` : ''}`;
}

function dropInterval() {
  return 1100 - state.speed * 100;
}

function currentLevel() {
  return Math.floor(state.lines / 10) + 1;
}

function collides(piece, x = piece.x, y = piece.y, shape = piece.shape) {
  for (let row = 0; row < shape.length; row += 1) {
    for (let column = 0; column < shape[row].length; column += 1) {
      if (!shape[row][column]) continue;
      const boardX = x + column;
      const boardY = y + row;
      if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) return true;
      if (boardY >= 0 && state.board[boardY][boardX]) return true;
    }
  }
  return false;
}

function spawnPiece() {
  const type = state.next;
  const shape = SHAPES[type].map((row) => row.slice());
  state.current = {
    type,
    color: COLORS[type],
    shape,
    x: Math.floor((BOARD_WIDTH - shape[0].length) / 2),
    y: 0
  };
  state.next = randomType();

  if (collides(state.current)) {
    state.over = true;
    state.best = Math.max(state.best, state.score);
    setMessage(`Game over — ${state.score.toLocaleString()} points. Start a new game to try again.`, 'over');
    savePreferences();
  }
}

function rotateShape(shape) {
  return shape[0].map((_, column) => shape.map((row) => row[column]).reverse());
}

function moveHorizontal(direction) {
  if (state.paused || state.over) return;
  if (!collides(state.current, state.current.x + direction)) {
    state.current.x += direction;
    render();
  }
}

function rotatePiece() {
  if (state.paused || state.over) return;
  const rotated = rotateShape(state.current.shape);
  const wallKicks = [0, -1, 1, -2, 2];
  const offset = wallKicks.find((shift) => !collides(
    state.current,
    state.current.x + shift,
    state.current.y,
    rotated
  ));

  if (offset !== undefined) {
    state.current.shape = rotated;
    state.current.x += offset;
    render();
  }
}

function clearFullRows() {
  const remaining = state.board.filter((row) => !row.every(Boolean));
  const cleared = BOARD_HEIGHT - remaining.length;
  if (cleared === 0) return 0;
  state.board = Array.from({ length: cleared }, () => Array(BOARD_WIDTH).fill(null)).concat(remaining);
  state.lines += cleared;
  state.score += (LINE_SCORES[cleared] || cleared * 200) * currentLevel();
  return cleared;
}

function lockPiece() {
  const piece = state.current;
  for (let row = 0; row < piece.shape.length; row += 1) {
    for (let column = 0; column < piece.shape[row].length; column += 1) {
      if (!piece.shape[row][column]) continue;
      const boardY = piece.y + row;
      if (boardY < 0) {
        state.over = true;
        state.best = Math.max(state.best, state.score);
        setMessage(`Game over — ${state.score.toLocaleString()} points. Start a new game to try again.`, 'over');
        savePreferences();
        return;
      }
      state.board[boardY][piece.x + column] = piece.color;
    }
  }

  const cleared = clearFullRows();
  state.best = Math.max(state.best, state.score);
  if (cleared > 0) {
    setMessage(`${cleared} ${cleared === 1 ? 'line' : 'lines'} cleared! Keep it up.`, 'good');
  } else {
    setMessage('Nice! Your next block is on its way.', '');
  }
  savePreferences();
  spawnPiece();
}

function moveDown(awardPoint = false) {
  if (state.paused || state.over) return;
  if (!collides(state.current, state.current.x, state.current.y + 1)) {
    state.current.y += 1;
    if (awardPoint) {
      state.score += 1;
      state.best = Math.max(state.best, state.score);
      savePreferences();
    }
  } else {
    lockPiece();
  }
  render();
}

function updateGravityTimer() {
  if (gravityTimer !== null) clearInterval(gravityTimer);
  gravityTimer = setInterval(() => {
    if (!state.paused && !state.over) moveDown();
  }, dropInterval());
}

function renderNextPiece() {
  nextPieceElement.replaceChildren();
  const shape = SHAPES[state.next];
  const preview = document.createElement('span');
  preview.className = 'next-shape';
  preview.style.gridTemplateColumns = `repeat(${shape[0].length}, 19px)`;
  preview.style.setProperty('--block-color', COLORS[state.next]);

  shape.forEach((row) => row.forEach((filled) => {
    const block = document.createElement('span');
    block.className = `next-block${filled ? '' : ' empty'}`;
    preview.appendChild(block);
  }));
  nextPieceElement.appendChild(preview);
}

function renderBoard() {
  boardElement.replaceChildren();
  const activeCells = new Set();
  const piece = state.current;

  if (piece) {
    piece.shape.forEach((row, rowIndex) => {
      row.forEach((filled, columnIndex) => {
        if (filled) activeCells.add(`${piece.y + rowIndex},${piece.x + columnIndex}`);
      });
    });
  }

  for (let row = 0; row < BOARD_HEIGHT; row += 1) {
    for (let column = 0; column < BOARD_WIDTH; column += 1) {
      const cell = document.createElement('div');
      const active = activeCells.has(`${row},${column}`);
      const color = active ? piece.color : state.board[row][column];
      cell.className = `cell${state.board[row][column] ? ' filled' : ''}${active ? ' active' : ''}`;
      cell.setAttribute('role', 'gridcell');
      if (color) cell.style.setProperty('--block-color', color);
      boardElement.appendChild(cell);
    }
  }

  if (state.paused || state.over) {
    const overlay = document.createElement('div');
    overlay.className = 'board-overlay';
    overlay.textContent = state.over ? 'Game over' : 'Paused';
    boardElement.appendChild(overlay);
  }
}

function render() {
  scoreElement.textContent = state.score.toLocaleString();
  bestElement.textContent = state.best.toLocaleString();
  linesElement.textContent = String(state.lines);
  speedValue.value = String(state.speed);
  intervalDisplay.textContent = `${dropInterval()} ms / row`;
  pauseButton.textContent = state.paused ? 'Resume' : 'Pause';
  pauseButton.disabled = state.over;
  messageElement.textContent = state.message;
  messageElement.className = `game-message${state.messageType ? ` is-${state.messageType}` : ''}`;
  renderBoard();
  renderNextPiece();
}

function startNewGame() {
  state.board = makeBoard();
  state.current = null;
  state.next = randomType();
  state.score = 0;
  state.lines = 0;
  state.paused = false;
  state.over = false;
  state.message = 'Use the controls to move and rotate the falling block.';
  state.messageType = '';
  spawnPiece();
  updateGravityTimer();
  render();
}

function togglePause() {
  if (state.over) return;
  state.paused = !state.paused;
  if (state.paused) {
    setMessage('Game paused. Resume when you are ready.', 'paused');
  } else {
    setMessage('Back in action — blocks are falling.', '');
  }
  render();
}

function performAction(action) {
  if (action === 'left') moveHorizontal(-1);
  if (action === 'right') moveHorizontal(1);
  if (action === 'down') moveDown(true);
  if (action === 'rotate') rotatePiece();
}

speedSlider.addEventListener('input', () => {
  state.speed = Number(speedSlider.value);
  savePreferences();
  updateGravityTimer();
  render();
});

pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', startNewGame);
document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => performAction(button.dataset.action));
});

document.addEventListener('keydown', (event) => {
  if (event.target === speedSlider) return;
  const actions = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'rotate',
    ' ': 'rotate'
  };
  const action = actions[event.key];
  if (action) {
    event.preventDefault();
    performAction(action);
  } else if (event.key.toLowerCase() === 'p') {
    togglePause();
  }
});

spawnPiece();
updateGravityTimer();
render();
