const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');
const resourcesEl = document.getElementById('resources');
const selectionEl = document.getElementById('selection');
const endTurnBtn = document.getElementById('end-turn');

const HEX_RADIUS = 48;
const MINI_RADIUS = 8.2;
const ORIGIN = { x: 370, y: 300 };
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

const tilePalettes = {
  forest: ['#1b5e20', '#2e7d32', '#6d4c41'],
  pasture: ['#b9e2a0', '#d7efc4', '#f0f7df'],
  farm: ['#cde6b8', '#ffd54f', '#cfb14f'],
  homestead: ['#bcaaa4', '#8d6e63', '#a1887f'],
  village: ['#d8b49c', '#c97b63', '#f1cf9d'],
  town: ['#a9b7c6', '#e89a9a', '#ffd57d'],
  city: ['#e3e3e3', '#cdd5db', '#a9b7c0'],
};

const resourceByType = {
  forest: 'wood',
  pasture: 'livestock',
  farm: 'crops',
  homestead: 'provisions',
  village: 'supplies',
  town: 'crafts',
  city: 'luxury',
};

const upgradePaths = {
  forest: ['pasture'],
  pasture: ['farm'],
  farm: ['homestead'],
  homestead: ['village'],
  village: ['town'],
  town: ['city'],
};

const upgradeCost = {
  pasture: { wood: 1 },
  farm: { livestock: 1 },
  homestead: { crops: 2 },
  village: { provisions: 2 },
  town: { supplies: 2 },
  city: { crafts: 2 },
};

const claimCost = { crops: 1 };

const symbolSets = {
  forest: ['🌲', '🌳', '🦌', '🍄'],
  pasture: ['🐄', '🐑', '🐐', '🐎'],
  farm: ['🌾', '🌽', '🌱', '🌿'],
  homestead: ['🏚️', '🦌', '🍄', '🥕', '🏠', '🌲'],
  village: ['🏡', '🐔', '🥬', '⛪', '🏫', '🐖'],
  town: ['🏘️', '🥖', '🍻', '🏤', '🕍', '🐖'],
  city: ['🏙️', '🥐', '🍷', '🏥', '🏫', '⛪'],
};

function keyOf(cell) { return `${cell.q},${cell.r}`; }
function randomType() { return weightedTypes[Math.floor(Math.random() * weightedTypes.length)]; }
function ownerColor(player) { return player === 'blue' ? '#3b82f6' : player === 'red' ? '#ef4444' : null; }

function buildRadiusCells(radius) {
  const result = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) result.push({ q, r });
  }
  return result;
}

const cells = buildRadiusCells(2);
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
  ['0,0', { player: 'blue', type: 'worker' }],
  ['1,0', { player: 'red', type: 'spearman' }],
]);

tiles.find((t) => keyOf(t) === '0,0').owner = 'blue';
tiles.find((t) => keyOf(t) === '1,0').owner = 'red';

const resources = {
  blue: { crops: 2, wood: 0, livestock: 0, provisions: 0, supplies: 0, crafts: 0, luxury: 0 },
  red: { crops: 2, wood: 0, livestock: 0, provisions: 0, supplies: 0, crafts: 0, luxury: 0 },
};

let currentPlayer = 'blue';
let selectedKey = null;

function axialToPixel({ q, r }) {
  return {
    x: ORIGIN.x + HEX_RADIUS * Math.sqrt(3) * (q + r / 2),
    y: ORIGIN.y + HEX_RADIUS * 1.5 * r,
  };
}

function polygonPoints(center, radius, angleDeg = -30) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i + angleDeg);
    return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`;
  }).join(' ');
}

function flatMiniCenter(q, r, sizeMini) {
  return {
    x: sizeMini * 1.5 * q,
    y: sizeMini * Math.sqrt(3) * (r + q / 2),
  };
}

function getCellByKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function isAdjacent(a, b) {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
}

function getTile(key) {
  return tiles.find((t) => keyOf(t) === key);
}

function canAfford(player, cost) {
  return Object.entries(cost).every(([k, v]) => (resources[player][k] || 0) >= v);
}

function spend(player, cost) {
  Object.entries(cost).forEach(([k, v]) => { resources[player][k] -= v; });
}

function harvest(player) {
  for (const tile of tiles) {
    if (tile.owner !== player) continue;
    const resource = resourceByType[tile.type];
    if (resource) resources[player][resource] += 1;
  }
}

function canMove(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey) || fromKey === toKey) return false;
  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  if (!isAdjacent(from, to)) return false;

  const unit = units.get(fromKey);
  const destinationUnit = units.get(toKey);
  if (!unit) return false;

  if (unit.player !== currentPlayer) return false;
  if (unit.type === 'worker') return !destinationUnit;
  if (unit.type === 'spearman') return !destinationUnit || destinationUnit.player !== unit.player;
  return false;
}

function getTargets(fromKey) {
  return cells.map(keyOf).filter((toKey) => canMove(fromKey, toKey));
}

function moveUnit(fromKey, toKey) {
  if (!canMove(fromKey, toKey)) return;
  const unit = units.get(fromKey);
  const destTile = getTile(toKey);
  if (!unit || !destTile) return;

  if (!destTile.owner && unit.type === 'worker') {
    if (!canAfford(unit.player, claimCost)) {
      statusText.textContent = `${unit.player.toUpperCase()} lacks crops to claim this tile.`;
      return;
    }
    spend(unit.player, claimCost);
    destTile.owner = unit.player;
  }

  if (!destTile.owner && unit.type === 'spearman') {
    destTile.owner = unit.player;
  }

  units.set(toKey, unit);
  units.delete(fromKey);
}

function upgradeSelectedTile(toType) {
  if (!selectedKey) return;
  const tile = getTile(selectedKey);
  const unit = units.get(selectedKey);
  if (!tile || !unit) return;
  if (unit.type !== 'worker' || unit.player !== currentPlayer || tile.owner !== currentPlayer) return;
  const cost = upgradeCost[toType];
  if (!cost || !canAfford(currentPlayer, cost)) return;

  spend(currentPlayer, cost);
  tile.type = toType;
  const set = symbolSets[toType];
  tile.symbols = Array.from({ length: 6 }, () => set[Math.floor(Math.random() * set.length)]);
  render();
}

function renderResources() {
  const p = resources[currentPlayer];
  resourcesEl.innerHTML = `
    <strong>${currentPlayer.toUpperCase()} resources</strong>
    <div class="resource-grid">
      <span>🌽 crops</span><span>${p.crops}</span>
      <span>🌲 wood</span><span>${p.wood}</span>
      <span>🐄 livestock</span><span>${p.livestock}</span>
      <span>🏚️ provisions</span><span>${p.provisions}</span>
      <span>🏡 supplies</span><span>${p.supplies}</span>
      <span>🏘️ crafts</span><span>${p.crafts}</span>
      <span>💎 luxury</span><span>${p.luxury}</span>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.85;">Claiming neutral tile with worker costs: 🌽 1.</div>
  `;
}

function renderSelectionPanel() {
  if (!selectedKey) {
    selectionEl.innerHTML = 'Select a tile/unit to see actions.';
    return;
  }

  const tile = getTile(selectedKey);
  const unit = units.get(selectedKey);
  if (!tile) return;

  let html = `<strong>Selected</strong><div>${tile.type} @ [${tile.q},${tile.r}]</div><div>owner: ${tile.owner || 'neutral'}</div>`;

  if (unit) html += `<div>unit: ${unit.type} (${unit.player})</div>`;

  if (unit && unit.type === 'worker' && unit.player === currentPlayer && tile.owner === currentPlayer) {
    const next = upgradePaths[tile.type] || [];
    next.forEach((toType, idx) => {
      const cost = upgradeCost[toType] || {};
      const afford = canAfford(currentPlayer, cost);
      html += `<button data-upgrade="${toType}" ${afford ? '' : 'disabled'}>Upgrade → ${toType} (cost: ${Object.entries(cost).map(([k, v]) => `${k} ${v}`).join(', ')})</button>`;
    });
  }

  selectionEl.innerHTML = html;
  selectionEl.querySelectorAll('button[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => upgradeSelectedTile(btn.dataset.upgrade));
  });
}

function renderStatus() {
  if (!selectedKey) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Select your unit (🔨 worker or spearman glyph).`;
    return;
  }

  const unit = units.get(selectedKey);
  if (!unit) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Tile selected.`;
    return;
  }
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${getTargets(selectedKey).length} legal adjacent moves.`;
}

function renderSpearmanGlyph(pos) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  shaft.setAttribute('x1', String(pos.x - 8));
  shaft.setAttribute('y1', String(pos.y + 8));
  shaft.setAttribute('x2', String(pos.x + 9));
  shaft.setAttribute('y2', String(pos.y - 9));
  shaft.setAttribute('stroke', '#fff');
  shaft.setAttribute('stroke-width', '3');
  shaft.setAttribute('stroke-linecap', 'round');

  const tip = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  tip.setAttribute('points', `${pos.x + 11},${pos.y - 11} ${pos.x + 4},${pos.y - 10} ${pos.x + 10},${pos.y - 4}`);
  tip.setAttribute('fill', '#fff');

  group.appendChild(shaft);
  group.appendChild(tip);
  return group;
}

function render() {
  board.innerHTML = '';
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();

  for (const tile of tiles) {
    const key = keyOf(tile);
    const pos = axialToPixel(tile);

    const hex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    hex.setAttribute('class', 'hex');
    hex.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 1));
    hex.setAttribute('fill', tilePalettes[tile.type][0]);
    hex.setAttribute('stroke', 'none');
    hex.dataset.key = key;
    board.appendChild(hex);

    const clipId = `clip-${key.replace(',', '-')}`;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    clipPoly.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 1));
    clipPath.appendChild(clipPoly);
    defs.appendChild(clipPath);
    board.appendChild(defs);

    const mosaicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mosaicGroup.setAttribute('clip-path', `url(#${clipId})`);

    const ownerTint = ownerColor(tile.owner);
    for (let rq = -2; rq <= 2; rq += 1) {
      for (let rr = -2; rr <= 2; rr += 1) {
        const rs = -rq - rr;
        if (Math.max(Math.abs(rq), Math.abs(rr), Math.abs(rs)) > 2) continue;
        const mini = flatMiniCenter(rq, rr, MINI_RADIUS);
        const miniPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        miniPoly.setAttribute('points', polygonPoints({ x: pos.x + mini.x, y: pos.y + mini.y }, MINI_RADIUS, 0));
        const idx = ((rq - rr) % 3 + 3) % 3;
        const baseColor = tilePalettes[tile.type][idx];
        miniPoly.setAttribute('fill', ownerTint && idx === 2 ? ownerTint : baseColor);
        miniPoly.setAttribute('stroke', 'none');
        mosaicGroup.appendChild(miniPoly);
      }
    }
    board.appendChild(mosaicGroup);

    if (selectedKey === key || targets.has(key)) {
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      outline.setAttribute('class', `hex ${selectedKey === key ? 'selected' : 'target'}`);
      outline.setAttribute('points', polygonPoints(pos, HEX_RADIUS - 1));
      outline.setAttribute('fill', 'none');
      outline.dataset.key = key;
      board.appendChild(outline);
    }

    tile.symbols.forEach((symbol, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const sx = pos.x + (HEX_RADIUS * 0.52) * Math.cos(angle);
      const sy = pos.y + (HEX_RADIUS * 0.52) * Math.sin(angle);
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
      group.appendChild(ring);

      if (unit.type === 'worker') {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', String(pos.x));
        icon.setAttribute('y', String(pos.y + 1));
        icon.setAttribute('class', 'unit-icon');
        icon.textContent = '🔨';
        group.appendChild(icon);
      } else {
        group.appendChild(renderSpearmanGlyph(pos));
      }
      board.appendChild(group);
    }
  }

  renderStatus();
  renderResources();
  renderSelectionPanel();
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

  selectedKey = clickedUnit || getTile(key) ? key : null;
  render();
});

endTurnBtn.addEventListener('click', () => {
  harvest(currentPlayer);
  currentPlayer = currentPlayer === 'blue' ? 'red' : 'blue';
  selectedKey = null;
  render();
});

render();
