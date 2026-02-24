const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');

const HEX_RADIUS = 52;
const ORIGIN = { x: 260, y: 205 };
const DIRECTIONS = [
  [1, 0], [1, -1], [0, -1],
  [-1, 0], [-1, 1], [0, 1],
];

const tilePool = [
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

const cells = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

const tiles = cells.map((cell) => ({
  ...cell,
  type: tilePool[Math.floor(Math.random() * tilePool.length)],
  owner: null,
  symbols: Array.from({ length: 6 }, () => {
    const set = symbolSets[tilePool[Math.floor(Math.random() * tilePool.length)]];
    return set[Math.floor(Math.random() * set.length)];
  }),
}));

tiles[0].type = 'homestead';
tiles[1].type = 'farm';
tiles[2].type = 'forest';

const units = new Map([
  ['0,0', { player: 'blue', type: 'worker', emoji: '🔨' }],
  ['1,0', { player: 'red', type: 'spear', emoji: '↗️' }],
]);
tiles.find((t) => keyOf(t) === '0,0').owner = 'blue';
tiles.find((t) => keyOf(t) === '1,0').owner = 'red';

let selectedKey = null;

function keyOf(cell) {
  return `${cell.q},${cell.r}`;
}

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

function isAdjacent(a, b) {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

function getCellByKey(key) {
  const [q, r] = key.split(',').map(Number);
  return cells.find((c) => c.q === q && c.r === r);
}

function canMove(fromKey, toKey) {
  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  if (!from || !to || !isAdjacent(from, to)) return false;

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

function moveUnit(fromKey, toKey) {
  const unit = units.get(fromKey);
  if (!unit || !canMove(fromKey, toKey)) return;
  units.set(toKey, unit);
  units.delete(fromKey);
  tiles.find((t) => keyOf(t) === toKey).owner = unit.player;
}

function getTargets(fromKey) {
  return cells
    .map((c) => keyOf(c))
    .filter((toKey) => canMove(fromKey, toKey));
}

function renderStatus() {
  if (!selectedKey) {
    statusText.textContent = 'Select a unit: blue worker 🔨 or red spear ↗️ to begin.';
    return;
  }

  const unit = units.get(selectedKey);
  const targets = getTargets(selectedKey).length;
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${targets} legal adjacent moves.`;
}

function render() {
  board.innerHTML = '';

  for (const tile of tiles) {
    const key = keyOf(tile);
    const pos = axialToPixel(tile);

    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('class', 'hex');
    hex.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 4));
    hex.setAttribute('fill', tileColors[tile.type] || '#ffffff');
    hex.dataset.key = key;
    if (selectedKey === key) hex.classList.add('selected');

    if (selectedKey && getTargets(selectedKey).includes(key)) {
      hex.classList.add('target');
    }

    board.appendChild(hex);

    tile.symbols.forEach((symbol, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const sx = pos.x + (HEX_RADIUS * 0.48) * Math.cos(angle);
      const sy = pos.y + (HEX_RADIUS * 0.48) * Math.sin(angle);

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
      const unitGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      unitGroup.dataset.key = key;

      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(pos.x));
      ring.setAttribute('cy', String(pos.y));
      ring.setAttribute('r', '19');
      ring.setAttribute('class', 'unit-ring');
      ring.setAttribute('fill', unit.player === 'blue' ? '#2563eb' : '#dc2626');

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', String(pos.x));
      icon.setAttribute('y', String(pos.y + 1));
      icon.setAttribute('class', 'unit-icon');
      icon.textContent = unit.emoji;

      unitGroup.appendChild(ring);
      unitGroup.appendChild(icon);
      board.appendChild(unitGroup);
    }
  }

  renderStatus();
}

board.addEventListener('click', (event) => {
  const target = event.target.closest('[data-key]');
  if (!target) return;

  const key = target.dataset.key;
  const clickedUnit = units.get(key);

  if (selectedKey && canMove(selectedKey, key)) {
    moveUnit(selectedKey, key);
    selectedKey = null;
    render();
    return;
  }

  if (clickedUnit) {
    selectedKey = key;
  } else {
    selectedKey = null;
  }

  render();
});

render();
