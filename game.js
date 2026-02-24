const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');

const HEX_RADIUS = 48;
const ORIGIN = { x: 380, y: 310 };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const weightedTypes = [
  ...Array(64).fill('forest'),
  ...Array(32).fill('pasture'),
  ...Array(16).fill('farm'),
  ...Array(8).fill('homestead'),
  ...Array(4).fill('village'),
  ...Array(2).fill('town'),
  ...Array(1).fill('city'),
];

const tileColors = {
  forest: '#4e8a4e',
  pasture: '#cdecb0',
  farm: '#f7e9a0',
  homestead: '#5a3e24',
  village: '#c4a56c',
  town: '#a05252',
  city: '#cccccc',
};

const closedTiles = new Set(['forest', 'town', 'city']);

const symbolSets = {
  forest: ['🌲', '🌳', '🎄'],
  pasture: ['🐄', '🐑', '🐐', '🐎'],
  farm: ['🌾', '🌽', '🌱', '🌿'],
  homestead: ['🏚️', '🦌', '🍄', '🥕', '🏠', '🌲'],
  village: ['🏡', '🐔', '🥬', '⛪', '🏫', '🐖'],
  town: ['🏠', '🏡', '🐓', '🏤', '🕍', '🐖'],
  city: ['🏠', '🏡', '🏥', '🏫', '⛪', '🏤'],
};

function keyOf(cell) {
  return `${cell.q},${cell.r}`;
}

function randomType() {
  return weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
}

function buildRadiusCells(radius) {
  const result = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) {
      result.push({ q, r });
    }
  }
  return result;
}

const cells = buildRadiusCells(2); // 19 hexes
const cellKeys = new Set(cells.map(keyOf));

const tiles = cells.map((cell) => {
  const type = randomType();
  const set = symbolSets[type];
  return {
    ...cell,
    type,
    owner: null,
    symbols: Array.from({ length: 6 }, () => set[Math.floor(Math.random() * set.length)]),
  };
});

const units = new Map([
  ['0,0', { player: 'blue', type: 'worker', emoji: '🔨' }],
  ['1,0', { player: 'red', type: 'spear', emoji: '↗️' }],
]);

tiles.find((t) => keyOf(t) === '0,0').owner = 'blue';
tiles.find((t) => keyOf(t) === '1,0').owner = 'red';

let selectedKey = null;

function axialToPixel({ q, r }) {
  return {
    x: ORIGIN.x + HEX_RADIUS * Math.sqrt(3) * (q + r / 2),
    y: ORIGIN.y + HEX_RADIUS * 1.5 * r,
  };
}

function polygonPoints(center, radius) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`;
  }).join(' ');
}

function getCellByKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function isAdjacent(a, b) {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

function canMove(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey) || fromKey === toKey) return false;

  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  if (!isAdjacent(from, to)) return false;

  const unit = units.get(fromKey);
  const destinationUnit = units.get(toKey);
  const destTile = tiles.find((t) => keyOf(t) === toKey);

  if (!unit || !destTile) return false;
  if (unit.type === 'worker') return !destinationUnit;

  if (unit.type === 'spear') {
    if (!destinationUnit) return true;
    return destinationUnit.player !== unit.player && !closedTiles.has(destTile.type);
  }

  return false;
}

function getTargets(fromKey) {
  return cells.map(keyOf).filter((toKey) => canMove(fromKey, toKey));
}

function moveUnit(fromKey, toKey) {
  if (!canMove(fromKey, toKey)) return;
  const unit = units.get(fromKey);
  units.set(toKey, unit);
  units.delete(fromKey);
  const destTile = tiles.find((t) => keyOf(t) === toKey);
  destTile.owner = unit.player;
}

function renderStatus() {
  if (!selectedKey) {
    statusText.textContent = 'Select a unit: blue worker 🔨 or red spear ↗️ to begin.';
    return;
  }

  const unit = units.get(selectedKey);
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${getTargets(selectedKey).length} legal adjacent moves.`;
}

function render() {
  board.innerHTML = '';
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();

  for (const tile of tiles) {
    const key = keyOf(tile);
    const pos = axialToPixel(tile);

    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('class', 'hex');
    hex.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 3));
    hex.setAttribute('fill', tileColors[tile.type] || '#ffffff');
    hex.dataset.key = key;
    if (selectedKey === key) hex.classList.add('selected');
    if (targets.has(key)) hex.classList.add('target');
    board.appendChild(hex);

    tile.symbols.forEach((symbol, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const sx = pos.x + (HEX_RADIUS * 0.5) * Math.cos(angle);
      const sy = pos.y + (HEX_RADIUS * 0.5) * Math.sin(angle);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(sx));
      text.setAttribute('y', String(sy + 5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'symbol');
      text.textContent = symbol;
      board.appendChild(text);
    });

    const unit = units.get(key);
    if (unit) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.dataset.key = key;

      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(pos.x));
      ring.setAttribute('cy', String(pos.y));
      ring.setAttribute('r', '18');
      ring.setAttribute('class', 'unit-ring');
      ring.setAttribute('fill', unit.player === 'blue' ? '#2563eb' : '#dc2626');

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', String(pos.x));
      icon.setAttribute('y', String(pos.y + 1));
      icon.setAttribute('class', 'unit-icon');
      icon.textContent = unit.emoji;

      group.appendChild(ring);
      group.appendChild(icon);
      board.appendChild(group);
    }
  }

  renderStatus();
}

board.addEventListener('click', (event) => {
  const clicked = event.target.closest('[data-key]');
  if (!clicked) return;

  const key = clicked.dataset.key;
  const clickedUnit = units.get(key);

  if (selectedKey && canMove(selectedKey, key)) {
    moveUnit(selectedKey, key);
    selectedKey = null;
    render();
    return;
  }

  selectedKey = clickedUnit ? key : null;
  render();
});

render();
