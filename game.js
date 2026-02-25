const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');
const resourcesEl = document.getElementById('resources');
const selectionEl = document.getElementById('selection');
const endTurnBtn = document.getElementById('end-turn');

const HEX_RADIUS = 44;
const MINI_RADIUS = 8;
const ORIGIN = { x: 620, y: 520 };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MAP_RADIUS = 4; // 61 tiles

const weightedTypes = [
  ...Array(64).fill('forest'),
  ...Array(32).fill('pasture'),
  ...Array(16).fill('farm'),
  ...Array(8).fill('homestead'),
  ...Array(4).fill('village'),
  ...Array(2).fill('town'),
  ...Array(1).fill('city'),
  ...Array(1).fill('manor'),
  ...Array(1).fill('outpost'),
];

const tilePalettes = {
  forest: ['#1b5e20', '#2e7d32', '#6d4c41'],
  pasture: ['#b9e2a0', '#d7efc4', '#f0f7df'],
  farm: ['#cde6b8', '#ffd54f', '#cfb14f'],
  homestead: ['#bcaaa4', '#8d6e63', '#a1887f'],
  village: ['#d8b49c', '#c97b63', '#f1cf9d'],
  town: ['#a9b7c6', '#e89a9a', '#ffd57d'],
  city: ['#e3e3e3', '#cdd5db', '#a9b7c0'],
  manor: ['#d7c7af', '#b79d86', '#cbb8a0'],
  estate: ['#d5d9f6', '#b8c2f6', '#9eaaf5'],
  palace: ['#f3e5ab', '#e8d26e', '#f0ce5a'],
  outpost: ['#cbbeb5', '#a88f86', '#8f7b72'],
  stronghold: ['#b0b0b0', '#8f8f8f', '#cacaca'],
  keep: ['#d0c2ac', '#b6a58b', '#988a72'],
};

const productionByType = {
  forest: 'wood',
  pasture: 'livestock',
  farm: 'crops',
  homestead: 'provisions',
  village: 'supplies',
  town: 'crafts',
  city: 'luxury',
  manor: 'support',
  estate: 'authority',
  palace: 'sovereignty',
};

// Explicit upkeep logic aligned with your rules + the broader chains discussed.
const structureUpkeep = {
  village: { wood: 1 },
  town: { wood: 1, crops: 1, supplies: 1 },
  city: { wood: 1, crops: 1, livestock: 1, supplies: 1, crafts: 1 },
  manor: { supplies: 1 },
  estate: { support: 1, supplies: 1, crafts: 1 },
  palace: { authority: 1, support: 1, supplies: 1, crafts: 1, luxury: 1 },
  outpost: { supplies: 1 },
  stronghold: { crafts: 1 },
  keep: { luxury: 1 },
};

const unitUpkeep = {
  woodsman: { provisions: 1 },
  spearman: { crops: 1 },
};

const freeUnitCondition = {
  woodsman: (tile) => tile.type === 'forest',
  spearman: (tile) => tile.type === 'farm',
};

const upgradePaths = {
  forest: ['pasture'],
  pasture: ['farm'],
  farm: ['homestead'],
  homestead: ['village', 'manor', 'outpost'],
  village: ['town'],
  town: ['city'],
  manor: ['estate'],
  estate: ['palace'],
  outpost: ['stronghold'],
  stronghold: ['keep'],
};

const claimCost = { crops: 1 };

const symbolSets = {
  forest: ['🌲', '🌳', '🦌', '🍄'],
  pasture: ['🐄', '🐑', '🐐', '🐎'],
  farm: ['🌾', '🌽', '🌱', '🌿'],
  homestead: ['🌲', '🥕', '🐐', '🏚️', '🍄', '🐓'],
  village: ['🏡', '🐔', '🥬', '⛪', '🏫', '🐖'],
  town: ['🏘️', '🥖', '🍻', '🏤', '🕍', '🐖'],
  city: ['🏙️', '🥐', '🍷', '🏥', '🏫', '⛪'],
  manor: ['🏛️', '⚜️', '♦️', '🌸', '⚜️', '♦️'],
  estate: ['🏦', '♦️', '⚜️', '♦️', '⚜️', '♦️'],
  palace: ['🏟️', '👑', '⚜️', '👑', '⚜️', '👑'],
  outpost: ['🗼', '🛡️', '🗼', '🛡️', '🗼', '🛡️'],
  stronghold: ['🧱', '🗼', '🛡️', '🧱', '🗼', '🛡️'],
  keep: ['🏰', '🗼', '🧱', '🛡️', '🧱', '🛡️'],
};

const resourceKeys = [
  'crops', 'wood', 'livestock', 'provisions', 'supplies', 'crafts', 'luxury', 'support', 'authority', 'sovereignty',
];

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

const cells = buildRadiusCells(MAP_RADIUS);
const cellKeys = new Set(cells.map(keyOf));

const tiles = cells.map((cell) => {
  const type = randomType();
  return {
    ...cell,
    type,
    owner: null,
    symbols: Array.from({ length: 6 }, () => pickSymbol(type)),
  };
});

const units = new Map();

function placeStart(q, r, player) {
  const tile = tiles.find((t) => t.q === q && t.r === r);
  if (!tile) return;
  tile.type = 'homestead';
  tile.owner = player;
  tile.symbols = Array.from({ length: 6 }, () => pickSymbol('homestead'));
  units.set(`${q},${r}`, { player, type: 'woodsman', movesLeft: 1, actionsLeft: 1 });
}

placeStart(-MAP_RADIUS, MAP_RADIUS, 'blue');
placeStart(MAP_RADIUS, -MAP_RADIUS, 'red');

const resources = {
  blue: Object.fromEntries(resourceKeys.map((k) => [k, 0])),
  red: Object.fromEntries(resourceKeys.map((k) => [k, 0])),
};
resources.blue.crops = 2;
resources.red.crops = 2;

let currentPlayer = 'blue';
let selectedKey = null;

function pickSymbol(type) {
  const set = symbolSets[type] || ['⬜'];
  return set[Math.floor(Math.random() * set.length)];
}

function axialToPixel({ q, r }, radius = HEX_RADIUS) {
  return {
    x: ORIGIN.x + radius * Math.sqrt(3) * (q + r / 2),
    y: ORIGIN.y + radius * 1.5 * r,
  };
}

function polygonPoints(center, radius, angleDeg = -30) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i + angleDeg);
    return `${center.x + radius * Math.cos(angle)},${center.y + radius * Math.sin(angle)}`;
  }).join(' ');
}

function getCellByKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function getTile(key) {
  return tiles.find((t) => keyOf(t) === key);
}

function isAdjacent(a, b) {
  return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);
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
    const resource = productionByType[tile.type];
    if (resource) resources[player][resource] += 1;
  }
}

function cubeDistance(a, b) {
  const aq = a.q; const ar = a.r; const as = -aq - ar;
  const bq = b.q; const br = b.r; const bs = -bq - br;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

function nearestProducerDistance(player, resource, fromTile) {
  const producers = tiles.filter((t) => t.owner === player && productionByType[t.type] === resource);
  if (producers.length === 0) return 999;
  return Math.min(...producers.map((p) => cubeDistance(fromTile, p)));
}

function calculateProduction(player) {
  const out = Object.fromEntries(resourceKeys.map((k) => [k, 0]));
  for (const tile of tiles) {
    if (tile.owner !== player) continue;
    const resource = productionByType[tile.type];
    if (resource) out[resource] += 1;
  }
  return out;
}

function calculateNeeds(player) {
  const out = Object.fromEntries(resourceKeys.map((k) => [k, 0]));

  for (const tile of tiles) {
    if (tile.owner !== player) continue;

    const sNeed = structureUpkeep[tile.type] || {};
    for (const [resource, amount] of Object.entries(sNeed)) out[resource] += amount;

    const unit = units.get(keyOf(tile));
    if (!unit || unit.player !== player) continue;
    if (freeUnitCondition[unit.type]?.(tile)) continue;

    const uNeed = unitUpkeep[unit.type] || {};
    for (const [resource, amount] of Object.entries(uNeed)) out[resource] += amount;
  }

  return out;
}

function enforceShortages(player) {
  const logs = [];

  for (const resource of resourceKeys) {
    const production = calculateProduction(player)[resource];
    const need = calculateNeeds(player)[resource];
    let deficit = need - production;
    if (deficit <= 0) continue;

    const unitConsumers = [];
    for (const [key, unit] of units.entries()) {
      if (unit.player !== player) continue;
      const tile = getTile(key);
      if (!tile) continue;
      if (freeUnitCondition[unit.type]?.(tile)) continue;
      const amount = (unitUpkeep[unit.type] || {})[resource] || 0;
      if (!amount) continue;
      unitConsumers.push({ key, amount, dist: nearestProducerDistance(player, resource, tile), unitType: unit.type });
    }
    unitConsumers.sort((a, b) => b.dist - a.dist);

    for (const u of unitConsumers) {
      if (deficit <= 0) break;
      units.delete(u.key);
      logs.push(`${player} disbanded ${u.unitType} at ${u.key} (short ${resource})`);
      deficit -= u.amount;
    }

    if (deficit <= 0) continue;

    const structureConsumers = [];
    for (const tile of tiles) {
      if (tile.owner !== player) continue;
      const amount = (structureUpkeep[tile.type] || {})[resource] || 0;
      if (!amount) continue;
      structureConsumers.push({ tile, amount, dist: nearestProducerDistance(player, resource, tile) });
    }
    structureConsumers.sort((a, b) => b.dist - a.dist);

    for (const s of structureConsumers) {
      if (deficit <= 0) break;
      s.tile.owner = null;
      units.delete(keyOf(s.tile));
      logs.push(`${player} lost ${s.tile.type} at ${keyOf(s.tile)} (short ${resource})`);
      deficit -= s.amount;
    }
  }

  return logs;
}

function resetTurnActions(player) {
  for (const unit of units.values()) {
    if (unit.player === player) {
      unit.movesLeft = 1;
      unit.actionsLeft = 1;
    }
  }
}

function canMove(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey) || fromKey === toKey) return false;
  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  if (!isAdjacent(from, to)) return false;

  const unit = units.get(fromKey);
  const destinationUnit = units.get(toKey);
  if (!unit || unit.player !== currentPlayer || unit.movesLeft <= 0) return false;

  if (unit.type === 'woodsman') return !destinationUnit;
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

  if (!destTile.owner && unit.type === 'woodsman') {
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

  unit.movesLeft -= 1;
  units.set(toKey, unit);
  units.delete(fromKey);
}

function upgradeSelectedTile(toType) {
  if (!selectedKey) return;
  const tile = getTile(selectedKey);
  const unit = units.get(selectedKey);
  if (!tile || !unit) return;
  if (unit.type !== 'woodsman' || unit.player !== currentPlayer || tile.owner !== currentPlayer) return;
  if (unit.actionsLeft <= 0) return;

  unit.actionsLeft -= 1;
  tile.type = toType;
  tile.symbols = Array.from({ length: 6 }, () => pickSymbol(toType));
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
      <span>🫱 support</span><span>${p.support}</span>
      <span>🫅 authority</span><span>${p.authority}</span>
      <span>👑 sovereignty</span><span>${p.sovereignty}</span>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.85;">Woodsman claiming cost: 🌽 1.</div>
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
  if (unit) html += `<div>unit: ${unit.type} (${unit.player}) M:${unit.movesLeft} A:${unit.actionsLeft}</div>`;

  if (unit && unit.type === 'woodsman' && unit.player === currentPlayer && tile.owner === currentPlayer && unit.actionsLeft > 0) {
    const next = upgradePaths[tile.type] || [];
    next.forEach((toType) => {
      html += `<button data-upgrade="${toType}">Upgrade → ${toType}</button>`;
    });
  }

  selectionEl.innerHTML = html;
  selectionEl.querySelectorAll('button[data-upgrade]').forEach((btn) => {
    btn.addEventListener('click', () => upgradeSelectedTile(btn.dataset.upgrade));
  });
}

function renderStatus(logs = []) {
  if (logs.length) {
    statusText.textContent = logs.join(' | ');
    return;
  }

  if (!selectedKey) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Select your woodsman (🪓) or spearman.`;
    return;
  }

  const unit = units.get(selectedKey);
  if (!unit) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Tile selected.`;
    return;
  }
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${getTargets(selectedKey).length} legal adjacent moves. M:${unit.movesLeft} A:${unit.actionsLeft}`;
}

function renderSpearmanGlyph(pos) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  shaft.setAttribute('x1', String(pos.x - 8));
  shaft.setAttribute('y1', String(pos.y + 8));
  shaft.setAttribute('x2', String(pos.x + 10));
  shaft.setAttribute('y2', String(pos.y - 10));
  shaft.setAttribute('stroke', '#fff');
  shaft.setAttribute('stroke-width', '3');
  shaft.setAttribute('stroke-linecap', 'round');

  const tip = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  tip.setAttribute('points', `${pos.x + 12},${pos.y - 12} ${pos.x + 5},${pos.y - 11} ${pos.x + 11},${pos.y - 5}`);
  tip.setAttribute('fill', '#fff');

  group.appendChild(shaft);
  group.appendChild(tip);
  return group;
}

function render(logs = []) {
  board.innerHTML = '';
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();

  // Global mini lattice once, then per-tile clipping => mathematically aligned boundaries.
  const globalMini = [];
  for (let mq = -64; mq <= 64; mq += 1) {
    for (let mr = -64; mr <= 64; mr += 1) {
      const miniPos = axialToPixel({ q: mq, r: mr }, MINI_RADIUS);
      if (miniPos.x < -100 || miniPos.x > 1600 || miniPos.y < -100 || miniPos.y > 1400) continue;
      globalMini.push({ mq, mr, pos: miniPos, idx: ((mq - mr) % 3 + 3) % 3 });
    }
  }

  for (const tile of tiles) {
    const key = keyOf(tile);
    const pos = axialToPixel(tile);

    const clickableHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    clickableHex.setAttribute('class', 'hex');
    clickableHex.setAttribute('points', polygonPoints(pos, HEX_RADIUS));
    clickableHex.setAttribute('fill', 'transparent');
    clickableHex.setAttribute('stroke', 'none');
    clickableHex.dataset.key = key;
    board.appendChild(clickableHex);

    const clipId = `clip-${key.replace(',', '-')}`;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.setAttribute('id', clipId);
    const clipHex = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    clipHex.setAttribute('points', polygonPoints(pos, HEX_RADIUS));
    clipPath.appendChild(clipHex);
    defs.appendChild(clipPath);
    board.appendChild(defs);

    const ownerTint = ownerColor(tile.owner);
    const mosaicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    mosaicGroup.setAttribute('clip-path', `url(#${clipId})`);
    mosaicGroup.setAttribute('pointer-events', 'none');

    for (const mini of globalMini) {
      if (Math.abs(mini.pos.x - pos.x) > HEX_RADIUS + MINI_RADIUS * 4) continue;
      if (Math.abs(mini.pos.y - pos.y) > HEX_RADIUS + MINI_RADIUS * 4) continue;
      const miniPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      miniPoly.setAttribute('points', polygonPoints(mini.pos, MINI_RADIUS));
      const baseColor = tilePalettes[tile.type][mini.idx];
      miniPoly.setAttribute('fill', ownerTint && mini.idx === 2 ? ownerTint : baseColor);
      miniPoly.setAttribute('stroke', 'none');
      mosaicGroup.appendChild(miniPoly);
    }
    board.appendChild(mosaicGroup);

    if (selectedKey === key || targets.has(key)) {
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      outline.setAttribute('class', `hex ${selectedKey === key ? 'selected' : 'target'}`);
      outline.setAttribute('points', polygonPoints(pos, HEX_RADIUS));
      outline.setAttribute('fill', 'none');
      outline.dataset.key = key;
      board.appendChild(outline);
    }

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
      group.setAttribute('pointer-events', 'none');

      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(pos.x));
      ring.setAttribute('cy', String(pos.y));
      ring.setAttribute('r', '17');
      ring.setAttribute('class', 'unit-ring');
      ring.setAttribute('fill', unit.player === 'blue' ? '#2563eb' : '#dc2626');
      group.appendChild(ring);

      if (unit.type === 'woodsman') {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', String(pos.x));
        icon.setAttribute('y', String(pos.y + 1));
        icon.setAttribute('class', 'unit-icon');
        icon.textContent = '🪓';
        group.appendChild(icon);
      } else {
        group.appendChild(renderSpearmanGlyph(pos));
      }

      board.appendChild(group);
    }
  }

  renderStatus(logs);
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

  selectedKey = (clickedUnit || getTile(key)) ? key : null;
  render();
});

endTurnBtn.addEventListener('click', () => {
  harvest(currentPlayer);
  const logs = [...enforceShortages('blue'), ...enforceShortages('red')];
  currentPlayer = currentPlayer === 'blue' ? 'red' : 'blue';
  resetTurnActions(currentPlayer);
  selectedKey = null;
  render(logs);
});

resetTurnActions('blue');
resetTurnActions('red');
render();
