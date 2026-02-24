const board = document.getElementById('hex-board');

const hammer = document.getElementById('hammer');

const statusText = document.getElementById('status');

const HEX_RADIUS = 52;
const ORIGIN = { x: 260, y: 205 };
const DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const cells = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

let hammerPos = { q: 0, r: 0 };

function keyOf(cell) {
  return `${cell.q},${cell.r}`;
}

function axialToPixel({ q, r }) {
  const x = ORIGIN.x + HEX_RADIUS * Math.sqrt(3) * (q + r / 2);
  const y = ORIGIN.y + HEX_RADIUS * 1.5 * r;
  return { x, y };
}

function polygonPoints(center, radius) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`;
  }).join(' ');
}

function isAdjacent(a, b) {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

function moveHammerTo(cell) {
  hammerPos = { ...cell };
  render();
}

function renderStatus() {
  statusText.textContent = `Hammer is on (${hammerPos.q}, ${hammerPos.r}). Select any highlighted neighboring hex.`;
}

function render() {
  board.innerHTML = '';

  const hammerPixel = axialToPixel(hammerPos);
  hammer.style.left = `${hammerPixel.x + 12}px`;
  hammer.style.top = `${hammerPixel.y + 12}px`;

  const positions = new Map(cells.map((cell) => [keyOf(cell), axialToPixel(cell)]));

  for (const cell of cells) {
    const pos = positions.get(keyOf(cell));
    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('class', 'hex');
    hex.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 4));
    hex.dataset.q = String(cell.q);
    hex.dataset.r = String(cell.r);

    const adjacent = isAdjacent(hammerPos, cell);
    const isHammerCell = cell.q === hammerPos.q && cell.r === hammerPos.r;

    if (adjacent && !isHammerCell) {
      hex.classList.add('adjacent');
      hex.setAttribute('tabindex', '0');
      hex.setAttribute('role', 'button');
      hex.setAttribute('aria-label', `Move hammer to (${cell.q}, ${cell.r})`);
    }

    board.appendChild(hex);
  }

  renderStatus();
}

board.addEventListener('click', (event) => {
  const hex = event.target.closest('polygon.hex.adjacent');
  if (!hex) return;
  moveHammerTo({ q: Number(hex.dataset.q), r: Number(hex.dataset.r) });
});

board.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const hex = event.target.closest('polygon.hex.adjacent');
  if (!hex) return;
  event.preventDefault();
  moveHammerTo({ q: Number(hex.dataset.q), r: Number(hex.dataset.r) });
});

render();
