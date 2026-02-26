const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');
const resourcesEl = document.getElementById('resources');
const selectionEl = document.getElementById('selection');
const endTurnBtn = document.getElementById('end-turn');
const mosaicResolutionEl = document.getElementById('mosaic-resolution');
const mosaicResolutionValueEl = document.getElementById('mosaic-resolution-value');
const modeMenuEl = document.getElementById('mode-menu');
const start1pBtn = document.getElementById('start-1p');
const start2pBtn = document.getElementById('start-2p');

const HEX_RADIUS = 42;
const MINI_RADIUS = 8;
const ORIGIN = { x: 980, y: 860 };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MAP_RADIUS = 6; // 127 tiles
const SOLO_START_RADIUS = 2; // 19 tiles
let mosaicResolution = 50;

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
  forest: 'wood', pasture: 'livestock', farm: 'crops', homestead: 'provisions',
  village: 'supplies', town: 'crafts', city: 'luxury',
  manor: 'support', estate: 'authority', palace: 'sovereignty',
};

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

const UNIT_DEFS = {
  worker: { emoji: '🔨', cls: 'worker', terrainUpgrader: true },
  axman: { emoji: '🪓', cls: 'defworker', terrainUpgrader: true },
  laborer: { emoji: '♠️', cls: 'worker', terrainUpgrader: true },
  architect: { emoji: '📐', cls: 'worker', terrainUpgrader: true },
  rangehand: { emoji: '🪃', cls: 'archer', terrainUpgrader: false },
  surveyor: { emoji: '🧭', cls: 'defworker', terrainUpgrader: true },
  constable: { emoji: '🪪', cls: 'defworker', terrainUpgrader: true },

  spearman: { emoji: 'spear', cls: 'infantry', terrainUpgrader: false },
  swordsman: { emoji: '⚔️', cls: 'infantry', terrainUpgrader: false },
  pikeman: { emoji: 'spear', cls: 'infantry', terrainUpgrader: false },
  infantry_sergeant: { emoji: '🛡️', cls: 'infantry', terrainUpgrader: false },

  hunter: { emoji: '🏹', cls: 'archer', terrainUpgrader: false },
  longbow: { emoji: '🏹', cls: 'archer', terrainUpgrader: false },
  crossbow: { emoji: '🏹', cls: 'archer', terrainUpgrader: false },
  barrage_captain: { emoji: '🎖️', cls: 'archer', terrainUpgrader: false },

  horseman: { emoji: '🐎', cls: 'cavalry', terrainUpgrader: false },
  lancer: { emoji: '🗡️', cls: 'cavalry', terrainUpgrader: false },
  cavalry_archer: { emoji: '🐎🏹', cls: 'cavalry', terrainUpgrader: false },
  royal_knight: { emoji: '🐴👑', cls: 'cavalry', terrainUpgrader: false },
};

const unitUpkeep = {
  worker: { crops: 1 }, laborer: { crops: 1 }, axman: { provisions: 1 }, rangehand: { crops: 1 }, surveyor: { crops: 1, livestock: 1 },
  constable: { support: 1 }, architect: { crops: 1 },
  spearman: { crops: 1 }, swordsman: { crops: 1 }, pikeman: { crops: 1 }, infantry_sergeant: { support: 1 },
  hunter: { crops: 1, wood: 1 }, longbow: { wood: 1 }, crossbow: { wood: 1, crops: 1 }, barrage_captain: { authority: 1 },
  horseman: { crops: 1, livestock: 1 }, lancer: { crops: 1, livestock: 1 }, cavalry_archer: { crops: 1, wood: 1, livestock: 1 }, royal_knight: { sovereignty: 1 },
};

const freeUnitCondition = {
  worker: (tile) => tile.type === 'farm',
  laborer: (tile) => tile.type === 'farm',
  axman: (tile) => tile.type === 'forest',
  spearman: (tile) => tile.type === 'farm',
  horseman: (tile) => tile.type === 'pasture',
  rangehand: (tile) => tile.type === 'pasture',
  surveyor: (tile) => tile.type === 'pasture',
};

function movePointsFor(unitType) {
  if (['horseman', 'lancer', 'cavalry_archer', 'royal_knight'].includes(unitType)) return 3;
  if (unitType === 'surveyor') return 3;
  return 1;
}

function actionPointsFor(unitType) {
  if (unitType === 'architect') return 2;
  if (['crossbow', 'barrage_captain'].includes(unitType)) return 2;
  return 1;
}

const TRAIN_AT = {
  homestead: ['axman'],
  village: ['worker', 'spearman'],
  town: ['laborer', 'swordsman', 'horseman', 'hunter'],
  city: ['architect', 'pikeman', 'lancer', 'longbow'],
  manor: ['rangehand'],
  estate: ['surveyor'],
  palace: ['constable'],
  outpost: ['infantry_sergeant'],
  stronghold: ['barrage_captain'],
  keep: ['royal_knight'],
};

const UNIT_UPGRADE_OPTIONS = {
  village: { spearman: ['horseman', 'hunter'], axman: ['horseman', 'hunter'] },
  town: {
    horseman: ['lancer'], hunter: ['longbow'],
    spearman: ['lancer', 'longbow'], swordsman: ['lancer', 'longbow'],
  },
  city: {
    spearman: ['crossbow', 'cavalry_archer'],
    swordsman: ['crossbow', 'cavalry_archer'],
    axman: ['crossbow', 'cavalry_archer'],
    horseman: ['cavalry_archer'], lancer: ['cavalry_archer'],
    hunter: ['crossbow', 'cavalry_archer'], longbow: ['crossbow', 'cavalry_archer'],
  },
};

const upgradePaths = {
  forest: ['pasture'], pasture: ['farm'], farm: ['homestead'],
  homestead: ['village', 'manor', 'outpost'],
  village: ['town'], town: ['city'],
  manor: ['estate'], estate: ['palace'],
  outpost: ['stronghold'], stronghold: ['keep'],
};

const symbolSets = {
  manor: ['🏛️', '⚜️', '♦️', '🌸', '⚜️', '♦️'],
  estate: ['🏦', '♦️', '⚜️', '♦️', '⚜️', '♦️'],
  palace: ['🏟️', '👑', '⚜️', '👑', '⚜️', '👑'],
  outpost: ['🗼', '🛡️', '🗼', '🛡️', '🗼', '🛡️'],
  stronghold: ['🧱', '🗼', '🛡️', '🧱', '🗼', '🛡️'],
  keep: ['🏰', '🗼', '🧱', '🛡️', '🧱', '🛡️'],
};

const trees = ['🌲', '🌳', '🎄'];
const pastureAnimals = ['🐄', '🐑', '🐐', '🐎'];
const farmCrops = ['🌾', '🌽', '🌱', '🌿'];
const houses = ['🏠', '🏡'];
const community = ['⛪', '🏫', '🏥', '🏤', '🕍'];
const settlementAnimals = ['🐖', '🐓', '🦆', '🐔'];
const settlementVeg = ['🥕', '🥦', '🧄', '🥬', '🍅'];
const homesteadAnimals = ['🦌', '🐗', '🐇', '🦃'];
const homesteadVeg = ['🍄', '🥔', ...settlementVeg];

const BONUS_SYMBOLS = {
  forest: ['🪵', '🦉', '🦊', '🍄', '🦔', '🦌'],
  pasture: ['🐕', '🐇', '🦆', '🍀', '🌾', '🐑'],
  farm: ['🍓', '🍎', '🍐', '🐝', '🌻', '🧄'],
  homestead: ['🥔', '🐔', '🍄', '🧺', '🪵', '🥕'],
  village: ['🧀', '🥛', '🥚', '🍺', '🕯️', '🥖'],
  town: ['🍻', '🥖', '🕯️', '🪙', '🧵', '🧺'],
  city: ['🍷', '🥂', '💍', '🏛️', '🕯️', '🥐'],
  manor: ['⚜️', '🪙', '🧵', '🧾', '🕯️', '🍷'],
  estate: ['💠', '🎖️', '📜', '🧭', '🪙', '🧵'],
  palace: ['👑', '💎', '🏺', '📯', '🕯️', '🪙'],
  outpost: ['🛡️', '🧱', '🗡️', '🏹', '🧭', '📯'],
  stronghold: ['🛡️', '⚒️', '🏹', '📯', '🧱', '🗡️'],
  keep: ['👑', '🛡️', '📯', '🗡️', '⚔️', '🧱'],
};

const resourceKeys = ['wood', 'livestock', 'crops', 'provisions', 'supplies', 'crafts', 'luxury', 'support', 'authority', 'sovereignty'];

const resourceEmoji = {
  crops: '🌾', wood: '🪵', livestock: '🐑', provisions: '🥕', supplies: '📦',
  crafts: '🛠️', luxury: '💎', support: '🤝', authority: '⚖️', sovereignty: '👑',
};

function keyOf(cell) { return `${cell.q},${cell.r}`; }
function randomType() { return weightedTypes[Math.floor(Math.random() * weightedTypes.length)]; }
function ownerColor(player) { return player === 'blue' ? '#3b82f6' : player === 'red' ? '#ef4444' : null; }

function blendHex(colorA, colorB, weightA = 0.5) {
  if (!colorA || !colorB) return colorA || colorB || '#888';
  const a = colorA.replace('#', '');
  const b = colorB.replace('#', '');
  if (a.length !== 6 || b.length !== 6) return colorA;

  const wa = Math.max(0, Math.min(1, weightA));
  const wb = 1 - wa;
  const toInt = (hh) => parseInt(hh, 16);
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');

  const ar = toInt(a.slice(0, 2)); const ag = toInt(a.slice(2, 4)); const ab = toInt(a.slice(4, 6));
  const br = toInt(b.slice(0, 2)); const bg = toInt(b.slice(2, 4)); const bb = toInt(b.slice(4, 6));

  return `#${toHex(ar * wa + br * wb)}${toHex(ag * wa + bg * wb)}${toHex(ab * wa + bb * wb)}`;
}

function hexToRgb(hex) {
  const v = (hex || '').replace('#', '');
  if (v.length !== 6) return null;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function mixHexWeighted(entries) {
  let tw = 0;
  let r = 0; let g = 0; let b = 0;
  for (const e of entries) {
    const rgb = hexToRgb(e.color);
    if (!rgb || !e.weight || e.weight <= 0) continue;
    tw += e.weight;
    r += rgb.r * e.weight;
    g += rgb.g * e.weight;
    b += rgb.b * e.weight;
  }
  if (!tw) return '#888888';
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r / tw)}${toHex(g / tw)}${toHex(b / tw)}`;
}

function colorForTileShard(tile, shardIdx = 1) {
  const palette = tilePalettes[tile.type] || ['#888', '#888', '#888'];
  const baseColor = palette[shardIdx] || palette[1] || palette[0] || '#888';
  const ownerTint = ownerColor(tile.owner);
  if (!ownerTint) return baseColor;
  const softenedOwnerTint = blendHex(ownerTint, baseColor, 0.5);
  return shardIdx === 2 ? softenedOwnerTint : baseColor;
}

function productionQtyForTile(player, tile, tileSnapshot = tiles, unitSnapshot = units) {
  const prodKey = productionByType[tile.type];
  if (!prodKey || tile.owner !== player) return 0;

  const tileMap = new Map(tileSnapshot.map((t) => [keyOf(t), t]));
  const settlementTypes = new Set(Object.keys(structureUpkeep));
  const hasPalace = tileSnapshot.some((t) => t.owner === player && t.type === 'palace');
  const adjacentOwned = adjacentKeys(keyOf(tile)).map((k) => tileMap.get(k)).filter((t) => t && t.owner === player);

  let additive = 0;
  const occ = unitSnapshot.get(keyOf(tile));
  if (occ?.player === player && ['laborer', 'rangehand'].includes(occ.type)) additive += 1;
  additive += adjacentOwned.filter((t) => t.type === 'estate').length;

  for (const t of adjacentOwned) {
    const u = unitSnapshot.get(keyOf(t));
    if (u?.player === player && u.type === 'constable') {
      const here = unitSnapshot.get(keyOf(tile));
      if (here?.player === player) additive += 1;
    }
  }

  let qty = 1 + additive;
  if (settlementTypes.has(tile.type)) {
    const manorAdj = adjacentOwned.filter((t) => t.type === 'manor').length;
    if (manorAdj > 0) qty *= (2 ** manorAdj);
    if (hasPalace) qty *= 2;
  }

  return qty;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildSymbols(type) {
  if (type === 'forest') return Array.from({ length: 6 }, () => pick([...trees, '🦌']));
  if (type === 'pasture') return Array.from({ length: 6 }, () => pick(pastureAnimals));
  if (type === 'farm') return Array.from({ length: 6 }, () => pick(farmCrops));

  if (type === 'homestead') {
    // meaningful composition: exactly one tree, one veg, one animal, one house
    const base = [pick(trees), pick(homesteadVeg), pick(homesteadAnimals), pick(houses)];
    const filler = [pick([...homesteadVeg, ...homesteadAnimals]), pick([...homesteadVeg, ...homesteadAnimals])];
    return [...base, ...filler];
  }

  if (type === 'village') {
    // exactly 2 houses
    const out = [pick(houses), pick(houses), pick(settlementVeg), pick(settlementAnimals), pick(community), pick([...settlementVeg, ...settlementAnimals, ...community])];
    return out.sort(() => Math.random() - 0.5);
  }

  if (type === 'town') {
    // exactly 3 houses
    const out = [pick(houses), pick(houses), pick(houses), pick(settlementAnimals), pick(community), pick([...settlementAnimals, ...community])];
    return out.sort(() => Math.random() - 0.5);
  }

  if (type === 'city') {
    // exactly 4 houses
    const out = [pick(houses), pick(houses), pick(houses), pick(houses), pick(community), pick(community)];
    return out.sort(() => Math.random() - 0.5);
  }

  return symbolSets[type] ? [...symbolSets[type]] : ['⬜', '⬜', '⬜', '⬜', '⬜', '⬜'];
}

function buildRadiusCells(radius) {
  const result = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) result.push({ q, r });
  }
  return result;
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

function polygonVertices(center, radius, angleDeg = -30) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i + angleDeg);
    return [center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle)];
  });
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]; const yi = polygon[i][1];
    const xj = polygon[j][0]; const yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py))
      && (px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function cubeDistance(a, b) {
  const aq = a.q; const ar = a.r; const as = -aq - ar;
  const bq = b.q; const br = b.r; const bs = -bq - br;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

let cells = [];
let cellKeys = new Set();
let tiles = [];
let units = new Map();
let gameMode = null; // 'solo' | 'duo'

function makeTile(cell) {
  const type = randomType();
  return { ...cell, type, owner: null, symbols: buildSymbols(type) };
}

function addCellTile(cell) {
  const key = keyOf(cell);
  if (cellKeys.has(key)) return;
  cells.push(cell);
  cellKeys.add(key);
  tiles.push(makeTile(cell));
}

function withinFiniteMap(cell) {
  return cubeDistance({ q: 0, r: 0 }, cell) <= MAP_RADIUS;
}

function ensureTile(q, r) {
  const cell = { q, r };
  if (gameMode === 'duo' && !withinFiniteMap(cell)) return null;
  addCellTile(cell);
  return getTile(`${q},${r}`);
}

function placeStart(q, r, player, type = 'axman') {
  const tile = ensureTile(q, r);
  if (!tile) return;
  tile.type = 'homestead';
  tile.owner = player;
  tile.symbols = buildSymbols('homestead');
  units.set(`${q},${r}`, { player, type, movesLeft: movePointsFor(type), actionsLeft: actionPointsFor(type) });
}

function setupDuoGame() {
  cells = buildRadiusCells(MAP_RADIUS);
  cellKeys = new Set(cells.map(keyOf));
  tiles = cells.map((cell) => makeTile(cell));
  units = new Map();
  placeStart(-MAP_RADIUS, MAP_RADIUS, 'blue');
  placeStart(MAP_RADIUS, -MAP_RADIUS, 'red');
  resetTurnActions('blue');
  resetTurnActions('red');
}

function revealSoloTiles() {
  if (gameMode !== 'solo') return;
  const unitsNow = [...units.entries()].filter(([, u]) => u.player === 'blue');
  for (const [key, unit] of unitsNow) {
    const from = getCellByKey(key);
    const movement = movePointsFor(unit.type);
    const range = isArcher(unit.type) ? archerRange(unit.type) : 1;
    const interactRadius = Math.max(1, movement + range);
    for (let dq = -interactRadius; dq <= interactRadius; dq += 1) {
      for (let dr = Math.max(-interactRadius, -dq - interactRadius); dr <= Math.min(interactRadius, -dq + interactRadius); dr += 1) {
        ensureTile(from.q + dq, from.r + dr);
      }
    }
  }
}

function setupSoloGame() {
  cells = buildRadiusCells(SOLO_START_RADIUS);
  cellKeys = new Set(cells.map(keyOf));
  tiles = cells.map((cell) => makeTile(cell));
  units = new Map();
  placeStart(0, 0, 'blue');
  resetTurnActions('blue');
  revealSoloTiles();
}

function startGame(mode) {
  gameMode = mode;
  currentPlayer = 'blue';
  selectedKey = null;
  lastDebug = mode === 'solo' ? 'Solo mode: new tiles reveal as units approach them.' : '';
  resourceFocus = null;
  resourceHover = null;
  if (mode === 'solo') setupSoloGame(); else setupDuoGame();
  modeMenuEl.classList.add('hidden');
  render();
}

let currentPlayer = 'blue';
let selectedKey = null;
let lastDebug = '';
let resourceFocus = null; // { resource, mode: 'produced'|'used' }
let resourceHover = null; // temporary hover focus

function getTile(key) { return tiles.find((t) => keyOf(t) === key); }
function getCellByKey(key) { const [q, r] = key.split(',').map(Number); return { q, r }; }
function isAdjacent(a, b) { return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r); }

function computeEconomy(player, tileSnapshot = tiles, unitSnapshot = units) {
  const produced = Object.fromEntries(resourceKeys.map((k) => [k, 0]));
  const used = Object.fromEntries(resourceKeys.map((k) => [k, 0]));

  for (const tile of tileSnapshot) {
    if (tile.owner !== player) continue;

    const prodKey = productionByType[tile.type];
    if (prodKey) produced[prodKey] += productionQtyForTile(player, tile, tileSnapshot, unitSnapshot);

    const sNeed = structureUpkeep[tile.type] || {};
    for (const [res, amt] of Object.entries(sNeed)) used[res] += amt;

    const unit = unitSnapshot.get(keyOf(tile));
    if (!unit || unit.player !== player) continue;
    if (freeUnitCondition[unit.type]?.(tile)) continue;
    const uNeed = unitUpkeep[unit.type] || {};
    for (const [res, amt] of Object.entries(uNeed)) used[res] += amt;
  }

  const available = Object.fromEntries(resourceKeys.map((k) => [k, produced[k] - used[k]]));
  return { produced, used, available };
}


function getResourceContributors(player, resource, mode, tileSnapshot = tiles, unitSnapshot = units) {
  const out = new Set();
  for (const tile of tileSnapshot) {
    if (tile.owner !== player) continue;
    const key = keyOf(tile);

    if (mode === 'produced') {
      const prodKey = productionByType[tile.type];
      if (prodKey === resource && productionQtyForTile(player, tile, tileSnapshot, unitSnapshot) > 0) out.add(key);
      continue;
    }

    if (((structureUpkeep[tile.type] || {})[resource] || 0) > 0) out.add(key);
    const u = unitSnapshot.get(key);
    if (u && u.player === player && !freeUnitCondition[u.type]?.(tile) && ((unitUpkeep[u.type] || {})[resource] || 0) > 0) out.add(key);
  }
  return out;
}

function economyDeficits(player, tileSnapshot = tiles, unitSnapshot = units) {
  const eco = computeEconomy(player, tileSnapshot, unitSnapshot);
  return Object.entries(eco.available).filter(([, v]) => v < 0).map(([k, v]) => `${k} ${v}`);
}

function cloneUnits(src) {
  const m = new Map();
  for (const [k, v] of src.entries()) m.set(k, { ...v });
  return m;
}

function isActionSustainable(player, mutator) {
  const tSnap = tiles.map((t) => ({ ...t }));
  const uSnap = cloneUnits(units);
  mutator(tSnap, uSnap);
  return economyDeficits(player, tSnap, uSnap).length === 0;
}

function canSupportTileUpgrade(player, fromType, toType) {
  const { produced, used } = computeEconomy(player);
  const fromNeed = structureUpkeep[fromType] || {};
  const toNeed = structureUpkeep[toType] || {};

  // Upgrades are allowed if the upgraded tile's own upkeep can be supported,
  // regardless of unrelated shortages elsewhere in the economy.
  for (const [res, amt] of Object.entries(toNeed)) {
    const prior = fromNeed[res] || 0;
    const afterUse = used[res] - prior + amt;
    if (produced[res] < afterUse) return false;
  }
  return true;
}

function canClaimUpkeepTileNow(player, tileType, tileSnapshot = tiles, unitSnapshot = units) {
  const need = structureUpkeep[tileType] || {};
  const eco = computeEconomy(player, tileSnapshot, unitSnapshot);
  for (const [res, amt] of Object.entries(need)) {
    if ((eco.available[res] || 0) < amt) return false;
  }
  return true;
}

function canSupportUnitUpgrade(player, fromType, toType, key) {
  const eco = computeEconomy(player);
  const tile = getTile(key);
  const fromUpkeep = unitUpkeep[fromType] || {};
  const toUpkeep = unitUpkeep[toType] || {};

  // If upgraded unit will be free on this tile, always supportable.
  if (tile && freeUnitCondition[toType]?.(tile)) return true;

  for (const [res, toAmt] of Object.entries(toUpkeep)) {
    const fromAmt = freeUnitCondition[fromType]?.(tile) ? 0 : (fromUpkeep[res] || 0);
    const afterUse = eco.used[res] - fromAmt + toAmt;
    if (eco.produced[res] < afterUse) return false;
  }
  return true;
}

function nearestProducerDistance(player, resource, fromTile) {
  const producers = tiles.filter((t) => t.owner === player && productionByType[t.type] === resource);
  if (producers.length === 0) return 999;
  return Math.min(...producers.map((p) => cubeDistance(fromTile, p)));
}

function enforceShortages(player) {
  const logs = [];
  for (const resource of resourceKeys) {
    const { produced, used } = computeEconomy(player);
    let deficit = used[resource] - produced[resource];
    if (deficit <= 0) continue;

    const unitConsumers = [];
    for (const [key, unit] of units.entries()) {
      if (unit.player !== player) continue;
      const tile = getTile(key);
      if (!tile || freeUnitCondition[unit.type]?.(tile)) continue;
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
      unit.movesLeft = movePointsFor(unit.type);
      unit.actionsLeft = actionPointsFor(unit.type);
    }
  }
}

function isMeleeMilitary(unitType) {
  return ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant', 'horseman', 'lancer', 'royal_knight', 'axman'].includes(unitType);
}

function unitAtKey(key) {
  return units.get(key);
}

function adjacentKeys(key) {
  const c = getCellByKey(key);
  return DIRECTIONS
    .map(([dq, dr]) => `${c.q + dq},${c.r + dr}`)
    .filter((k) => cellKeys.has(k));
}

function terrainClosed(tileType) {
  return ['forest', 'town', 'city', 'outpost', 'stronghold', 'keep'].includes(tileType);
}

function isTileClosedFor(player, key) {
  const tile = getTile(key);
  if (!tile) return true;
  if (terrainClosed(tile.type)) return true;

  // Pikeman closes adjacent tiles for enemies only.
  for (const nKey of adjacentKeys(key)) {
    const u = unitAtKey(nKey);
    if (u?.type === 'pikeman' && u.player !== player) return true;
  }

  // Spearman shield wall closes adjacent tiles for enemies only.
  for (const nKey of adjacentKeys(key)) {
    const spear = unitAtKey(nKey);
    if (!spear || spear.type !== 'spearman') continue;
    if (spear.player === player) continue;

    const friends = adjacentKeys(key)
      .map((k) => unitAtKey(k))
      .filter((u) => u && u.player === spear.player && isMeleeMilitary(u.type));

    if (friends.length >= 2) return true; // spear + another friendly melee military unit
  }

  return false;
}

function canUseLongWeaponFrom(key, unitType) {
  // Longbow remains ineffective from closed spaces.
  if (unitType !== 'longbow') return true;
  const unit = unitAtKey(key);
  const player = unit?.player || currentPlayer;
  return !isTileClosedFor(player, key);
}

function isCavalry(unitType) {
  return ['horseman', 'lancer', 'cavalry_archer', 'royal_knight'].includes(unitType);
}

function getCavalryDestinations(fromKey, unit) {
  const maxSteps = Math.max(1, unit.movesLeft);
  const startPlayer = unit.player;
  const queue = [{ key: fromKey, steps: 0 }];
  const bestSteps = new Map([[fromKey, 0]]);
  const destinations = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    for (const nextKey of adjacentKeys(current.key)) {
      const step = current.steps + 1;
      if (step > maxSteps) continue;

      const occ = unitAtKey(nextKey);
      const friendlyOcc = occ && occ.player === startPlayer;

      const nextClosed = isTileClosedFor(startPlayer, nextKey);

      // Cavalry may pass through open tiles and friendlies, but not through hostile units.
      const hostileOcc = occ && occ.player !== startPlayer;
      const canPass = !nextClosed && !hostileOcc;
      const canStop = !friendlyOcc; // cannot end on a friendly-occupied tile

      if (canStop) {
        destinations.add(nextKey);
      }

      if (canPass) {
        const seen = bestSteps.get(nextKey);
        if (seen === undefined || step < seen) {
          bestSteps.set(nextKey, step);
          queue.push({ key: nextKey, steps: step });
        }
      }
    }
  }

  destinations.delete(fromKey);
  return destinations;
}

function getSurveyorReach(fromKey, unit) {
  const maxSteps = Math.max(1, unit.movesLeft);
  const startPlayer = unit.player;
  const queue = [{ key: fromKey, steps: 0 }];
  const bestSteps = new Map([[fromKey, 0]]);
  const parent = new Map();
  const destinations = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    for (const nextKey of adjacentKeys(current.key)) {
      const step = current.steps + 1;
      if (step > maxSteps) continue;

      const occ = unitAtKey(nextKey);
      const friendlyOcc = occ && occ.player === startPlayer;
      const hostileOcc = occ && occ.player !== startPlayer;
      const nextClosed = isTileClosedFor(startPlayer, nextKey);

      const canPass = !nextClosed && !hostileOcc;
      const canStop = !occ; // surveyor ends on empty tile only

      if (canStop) destinations.add(nextKey);

      if (canPass) {
        const seen = bestSteps.get(nextKey);
        if (seen === undefined || step < seen) {
          bestSteps.set(nextKey, step);
          parent.set(nextKey, current.key);
          queue.push({ key: nextKey, steps: step });
        }
      }
    }
  }

  destinations.delete(fromKey);
  return { destinations, parent };
}

function reconstructPath(parent, startKey, endKey) {
  const path = [endKey];
  let cur = endKey;
  while (cur !== startKey) {
    cur = parent.get(cur);
    if (!cur) break;
    path.push(cur);
  }
  return path.reverse();
}

function explainMoveFailure(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey)) return 'Move invalid: out of map bounds.';
  if (fromKey === toKey) return 'Move invalid: source and destination are the same tile.';

  const unit = units.get(fromKey);
  if (!unit) return 'Move invalid: no unit selected on source tile.';
  if (unit.player !== currentPlayer) return `Move invalid: it is ${currentPlayer}'s turn.`;
  if (unit.movesLeft <= 0) return 'Move invalid: unit has no moves left this turn.';

  if (unit.type === 'surveyor') {
    const reach = getSurveyorReach(fromKey, unit);
    if (!reach.destinations.has(toKey)) return 'Move invalid: surveyor can only end on highlighted open-path destinations.';
  } else if (isCavalry(unit.type)) {
    const targets = getCavalryDestinations(fromKey, unit);
    if (!targets.has(toKey)) return 'Move invalid: cavalry can only end on highlighted destinations reached through open-path routing.';
  } else {
    const from = getCellByKey(fromKey);
    const to = getCellByKey(toKey);
    if (!isAdjacent(from, to)) return 'Move invalid: destination is not adjacent.';
  }

  const destUnit = units.get(toKey);
  if (destUnit && destUnit.player === unit.player) return 'Move invalid: destination occupied by your own unit.';

  if (destUnit && destUnit.player !== unit.player) {
    const canAttackMoveArcher = ['crossbow', 'barrage_captain'].includes(unit.type);
    if (isArcher(unit.type) && !canAttackMoveArcher) return `Move invalid: ${unit.type} cannot attack-move; use ranged attack.`;
    if (canAttackMoveArcher && unit.actionsLeft <= 0) return `Move invalid: ${unit.type} has no attack actions left.`;
    if (['spearman', 'pikeman', 'lancer'].includes(unit.type) && isTileClosedFor(unit.player, toKey)) {
      return `Attack invalid: ${unit.type} cannot attack into closed terrain.`;
    }
  }

  return 'Move invalid by rule constraints.';
}

function canMove(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey) || fromKey === toKey) return false;

  const unit = units.get(fromKey);
  const destinationUnit = units.get(toKey);
  if (!unit || unit.player !== currentPlayer || unit.movesLeft <= 0) return false;
  if (destinationUnit && destinationUnit.player === unit.player) return false;

  if (unit.type === 'surveyor') {
    const reach = getSurveyorReach(fromKey, unit);
    if (!reach.destinations.has(toKey)) return false;
  } else if (isCavalry(unit.type)) {
    const targets = getCavalryDestinations(fromKey, unit);
    if (!targets.has(toKey)) return false;
  } else {
    const from = getCellByKey(fromKey);
    const to = getCellByKey(toKey);
    if (!isAdjacent(from, to)) return false;
  }

  if (destinationUnit && destinationUnit.player !== unit.player) {
    const canAttackMoveArcher = ['crossbow', 'barrage_captain'].includes(unit.type);
    if (isArcher(unit.type) && !canAttackMoveArcher) return false;
    if (canAttackMoveArcher && unit.actionsLeft <= 0) return false;
    if (['spearman', 'pikeman', 'lancer'].includes(unit.type) && isTileClosedFor(unit.player, toKey)) return false;
  }

  return true;
}

function isArcher(unitType) {
  return UNIT_DEFS[unitType]?.cls === 'archer';
}

function archerRange(unitType) {
  return ['longbow', 'barrage_captain'].includes(unitType) ? 2 : 1;
}

function canRangedAttack(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey) || fromKey === toKey) return false;
  const attacker = units.get(fromKey);
  const target = units.get(toKey);
  if (!attacker || !target) return false;
  if (attacker.player !== currentPlayer || target.player === currentPlayer) return false;
  if (!isArcher(attacker.type) || attacker.actionsLeft <= 0) return false;
  if (!canUseLongWeaponFrom(fromKey, attacker.type)) return false;

  const movedThisTurn = attacker.movesLeft < movePointsFor(attacker.type);

  // Hunter/Longbow/Cavalry Archer cannot shoot into closed terrain after moving.
  if (movedThisTurn && ['hunter', 'longbow', 'cavalry_archer'].includes(attacker.type) && isTileClosedFor(attacker.player, toKey)) return false;

  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  const dist = cubeDistance(from, to);
  return dist >= 1 && dist <= archerRange(attacker.type);
}

function getAttackTargets(fromKey) {
  return cells.map(keyOf).filter((toKey) => canRangedAttack(fromKey, toKey));
}

function explainAttackFailure(fromKey, toKey) {
  const attacker = units.get(fromKey);
  const target = units.get(toKey);
  if (!attacker) return 'Attack invalid: no selected unit.';
  if (!isArcher(attacker.type)) return `Attack invalid: ${attacker.type} is not an archer.`;
  if (attacker.player !== currentPlayer) return `Attack invalid: it is ${currentPlayer}'s turn.`;
  if (attacker.actionsLeft <= 0) return 'Attack invalid: unit has no actions left.';
  if (!target) return 'Attack invalid: no enemy unit on target tile.';
  if (target.player === currentPlayer) return 'Attack invalid: cannot target your own unit.';
  if (!canUseLongWeaponFrom(fromKey, attacker.type)) return `Attack invalid: ${attacker.type} cannot fire from closed terrain.`;
  const movedThisTurn = attacker.movesLeft < movePointsFor(attacker.type);
  if (movedThisTurn && ['hunter', 'longbow', 'cavalry_archer'].includes(attacker.type) && isTileClosedFor(attacker.player, toKey)) return `Attack invalid: ${attacker.type} cannot shoot into closed terrain after moving.`;
  const from = getCellByKey(fromKey);
  const to = getCellByKey(toKey);
  const dist = cubeDistance(from, to);
  const range = archerRange(attacker.type);
  return `Attack invalid: target is out of range (distance ${dist}, range ${range}).`;
}

function rangedAttack(fromKey, toKey) {
  if (!canRangedAttack(fromKey, toKey)) {
    lastDebug = explainAttackFailure(fromKey, toKey);
    return false;
  }
  const attacker = units.get(fromKey);
  const target = units.get(toKey);
  if (!attacker || !target) return false;
  units.delete(toKey);
  attacker.actionsLeft -= 1;
  lastDebug = `Attack ok: ${attacker.type} shot ${target.type} at ${toKey}.`;
  return true;
}

function getMoveTargets(fromKey) {
  const unit = units.get(fromKey);
  if (!unit) return [];
  if (unit.type === 'surveyor') return [...getSurveyorReach(fromKey, unit).destinations];
  if (isCavalry(unit.type)) return [...getCavalryDestinations(fromKey, unit)];
  return tiles.map(keyOf).filter((toKey) => canMove(fromKey, toKey));
}

function getTargets(fromKey) {
  const moveTargets = getMoveTargets(fromKey);
  const attackTargets = getAttackTargets(fromKey);
  return [...new Set([...moveTargets, ...attackTargets])];
}


function moveEconomyWarning(fromKey, toKey, nextMoves) {
  const tSnap = tiles.map((t) => ({ ...t }));
  const uSnap = cloneUnits(units);
  const srcUnit = uSnap.get(fromKey);
  if (!srcUnit) return '';

  uSnap.delete(fromKey);
  uSnap.set(toKey, { ...srcUnit, movesLeft: nextMoves });

  const t = tSnap.find((x) => keyOf(x) === toKey);
  if (t) {
    const beforeOwner = t.owner;
    const upkeepRequired = Boolean(structureUpkeep[t.type]);
    if (beforeOwner === currentPlayer) {
      t.owner = currentPlayer;
    } else if (!upkeepRequired) {
      // Resource tiles/homestead can always be claimed.
      t.owner = currentPlayer;
    } else if (canClaimUpkeepTileNow(currentPlayer, t.type, tSnap, uSnap)) {
      t.owner = currentPlayer;
    } else {
      // Not enough stream to maintain this newly captured upkeep-bearing tile.
      t.owner = null;
    }
  }

  const deficits = economyDeficits(currentPlayer, tSnap, uSnap);
  if (!deficits.length) return '';
  return `Warning: move may cause shortages (${deficits.join(', ')}). Units/tiles farthest from producers may be disbanded at turn rollover.`;
}

function moveUnit(fromKey, toKey) {
  if (!canMove(fromKey, toKey)) {
    lastDebug = explainMoveFailure(fromKey, toKey);
    return;
  }

  const unit = units.get(fromKey);
  const destTile = getTile(toKey);
  if (!unit || !destTile) return;

  let usedSteps = 1;
  let surveyorPath = null;
  if (unit.type === 'surveyor') {
    const reach = getSurveyorReach(fromKey, unit);
    surveyorPath = reconstructPath(reach.parent, fromKey, toKey);
    usedSteps = Math.max(1, surveyorPath.length - 1);
  }

  const nextMoves = isCavalry(unit.type) ? 0 : Math.max(0, unit.movesLeft - usedSteps);
  const priorOwner = destTile.owner;
  const warning = moveEconomyWarning(fromKey, toKey, nextMoves);

  const defeated = units.get(toKey) && units.get(toKey).player !== unit.player;

  // Movement never blocked by economy; shortages resolve on turn rollover.
  unit.movesLeft = nextMoves;
  if (defeated && ['crossbow', 'barrage_captain'].includes(unit.type)) unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
  units.set(toKey, unit);
  units.delete(fromKey);

  // Surveyor claims every tile along a multi-step route.
  if (unit.type === 'surveyor' && surveyorPath) {
    for (const k of surveyorPath.slice(0, -1)) {
      const t = getTile(k);
      if (!t) continue;
      const needsUpkeep = Boolean(structureUpkeep[t.type]);
      if (!needsUpkeep || canClaimUpkeepTileNow(unit.player, t.type)) {
        t.owner = unit.player;
      } else {
        t.owner = null;
      }
    }
  }

  let claimText = '';
  const upkeepRequired = Boolean(structureUpkeep[destTile.type]);
  if (priorOwner === currentPlayer) {
    claimText = 'holding friendly territory';
  } else if (!upkeepRequired) {
    // Resource tiles (including homestead) are always claimable.
    destTile.owner = currentPlayer;
    claimText = priorOwner ? `captured ${priorOwner} territory` : 'claimed neutral tile';
  } else if (canClaimUpkeepTileNow(currentPlayer, destTile.type)) {
    destTile.owner = currentPlayer;
    claimText = priorOwner ? `captured ${priorOwner} territory` : 'claimed neutral tile';
  } else {
    destTile.owner = null;
    claimText = priorOwner
      ? `contested enemy tile and left it neutral (insufficient ${destTile.type} upkeep stream)`
      : 'stood on neutral tile without claiming (insufficient upkeep stream)';
  }

  lastDebug = `Move ok: ${unit.type} moved to ${toKey}, ${claimText}. ${warning}`.trim();
  revealSoloTiles();
}

function upgradeSelectedTile(toType) {
  if (!selectedKey) return;
  const tile = getTile(selectedKey);
  const unit = units.get(selectedKey);
  if (!tile || !unit) return;
  if (unit.player !== currentPlayer || tile.owner !== currentPlayer) return;
  if (!UNIT_DEFS[unit.type]?.terrainUpgrader) {
    lastDebug = `${unit.type} cannot upgrade terrain.`;
    return;
  }
  if (unit.actionsLeft <= 0) {
    lastDebug = `${unit.type} has no actions left.`;
    return;
  }

  if (!canSupportTileUpgrade(currentPlayer, tile.type, toType)) {
    lastDebug = `Upgrade blocked: ${toType} upkeep is not currently supportable.`;
    return;
  }

  unit.actionsLeft -= 1;
  tile.type = toType;
  tile.symbols = buildSymbols(toType);
  lastDebug = `Upgrade ok: ${selectedKey} -> ${toType}.`;
  render();
}

function trainUnitAt(key, unitType) {
  const tile = getTile(key);
  if (!tile || tile.owner !== currentPlayer || units.get(key)) return;

  if (!isActionSustainable(currentPlayer, (_tSnap, uSnap) => {
    uSnap.set(key, { player: currentPlayer, type: unitType, movesLeft: 0, actionsLeft: 0 });
  })) {
    lastDebug = `Training blocked: ${unitType} would create shortage for ${currentPlayer}.`;
    return;
  }

  units.set(key, { player: currentPlayer, type: unitType, movesLeft: 0, actionsLeft: 0 });
  lastDebug = `Training ok: ${unitType} at ${key}.`;
  render();
}

function upgradeUnitAt(key, newType) {
  const tile = getTile(key);
  const unit = units.get(key);
  if (!tile || !unit || unit.player !== currentPlayer || unit.actionsLeft <= 0) return;

  if (!canSupportUnitUpgrade(currentPlayer, unit.type, newType, key)) {
    lastDebug = `Unit upgrade blocked: ${newType} upkeep is not currently supportable.`;
    return;
  }

  unit.type = newType;
  unit.actionsLeft -= 1;
  lastDebug = `Unit upgrade ok: ${key} -> ${newType}.`;
  render();
}

function renderResources() {
  const eco = computeEconomy(currentPlayer);
  resourcesEl.innerHTML = `
    <strong>${currentPlayer.toUpperCase()} economy</strong>
    <table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:6px;">
      <thead><tr><th style="text-align:left;">Resource</th><th>Prod</th><th>Use</th><th>Avail</th></tr></thead>
      <tbody>
        ${resourceKeys.map((k) => {
          const avail = eco.available[k];
          const availStyle = avail < 0 ? 'color:#ef4444;font-weight:700;text-align:center;' : 'text-align:center;';
          const isFocused = resourceFocus?.resource === k;
          const chipStyle = isFocused ? 'background:#334155;border-color:#94a3b8;' : 'background:transparent;border-color:#475569;';
          return `<tr>
            <td><button data-resource-toggle="${k}" style="border:1px solid;${chipStyle}color:#e2e8f0;border-radius:7px;padding:1px 6px;cursor:pointer;">${resourceEmoji[k] || ''}</button> ${k}</td>
            <td data-resource-hover="${k}" data-resource-mode="produced" style="text-align:center;cursor:help;">${eco.produced[k]}</td>
            <td data-resource-hover="${k}" data-resource-mode="used" style="text-align:center;cursor:help;">${eco.used[k]}</td>
            <td style="${availStyle}">${avail}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:6px;font-size:12px;opacity:.85;">Click resource emoji to cycle production/usage highlights. Hover Prod/Use numbers for temporary highlight.</div>
  `;

  resourcesEl.querySelectorAll('[data-resource-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const resource = btn.getAttribute('data-resource-toggle');
      if (!resourceFocus || resourceFocus.resource !== resource) {
        resourceFocus = { resource, mode: 'produced' };
      } else if (resourceFocus.mode === 'produced') {
        resourceFocus = { resource, mode: 'used' };
      } else {
        resourceFocus = null;
      }
      render();
    });
  });

  resourcesEl.querySelectorAll('[data-resource-hover]').forEach((cell) => {
    cell.addEventListener('mouseenter', () => {
      resourceHover = { resource: cell.getAttribute('data-resource-hover'), mode: cell.getAttribute('data-resource-mode') };
      render();
    });
    cell.addEventListener('mouseleave', () => {
      resourceHover = null;
      render();
    });
  });

  resourcesEl.addEventListener('mouseleave', () => {
    if (!resourceHover) return;
    resourceHover = null;
    render();
  }, { once: true });
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

  if (unit && unit.player === currentPlayer && tile.owner === currentPlayer && UNIT_DEFS[unit.type]?.terrainUpgrader && unit.actionsLeft > 0) {
    const next = upgradePaths[tile.type] || [];
    for (const toType of next) html += `<button data-upgrade-terrain="${toType}">Upgrade Terrain → ${toType}</button>`;
  }

  if (!unit && tile.owner === currentPlayer && TRAIN_AT[tile.type]?.length) {
    for (const ut of TRAIN_AT[tile.type]) html += `<button data-train-unit="${ut}">Train ${ut}</button>`;
  }

  if (unit && unit.player === currentPlayer) {
    const uOpts = UNIT_UPGRADE_OPTIONS[tile.type]?.[unit.type] || [];
    for (const newType of uOpts) html += `<button data-upgrade-unit="${newType}">Upgrade Unit → ${newType}</button>`;
  }

  html += `<div style="margin-top:8px;font-size:12px;opacity:.9;"><strong>Debug:</strong> ${lastDebug || '—'}</div>`;

  selectionEl.innerHTML = html;
  selectionEl.querySelectorAll('button[data-upgrade-terrain]').forEach((btn) => {
    btn.addEventListener('click', () => upgradeSelectedTile(btn.dataset.upgradeTerrain));
  });
  selectionEl.querySelectorAll('button[data-train-unit]').forEach((btn) => {
    btn.addEventListener('click', () => trainUnitAt(selectedKey, btn.dataset.trainUnit));
  });
  selectionEl.querySelectorAll('button[data-upgrade-unit]').forEach((btn) => {
    btn.addEventListener('click', () => upgradeUnitAt(selectedKey, btn.dataset.upgradeUnit));
  });
}

function renderStatus(logs = []) {
  if (logs.length) {
    statusText.textContent = logs.join(' | ');
    return;
  }

  if (!selectedKey) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Move/upgrade diagnostics shown in Debug panel.`;
    return;
  }

  const unit = units.get(selectedKey);
  if (!unit) {
    statusText.textContent = `${currentPlayer.toUpperCase()} turn. Tile selected. ${lastDebug || ''}`;
    return;
  }
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${getMoveTargets(selectedKey).length} moves, ${getAttackTargets(selectedKey).length} shots. M:${unit.movesLeft} A:${unit.actionsLeft}. ${lastDebug || ''}`;
}

function drawSpear(group, x1, y1, x2, y2, width = 3) {
  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  shaft.setAttribute('x1', String(x1));
  shaft.setAttribute('y1', String(y1));
  shaft.setAttribute('x2', String(x2));
  shaft.setAttribute('y2', String(y2));
  shaft.setAttribute('stroke', '#fff');
  shaft.setAttribute('stroke-width', String(width));
  shaft.setAttribute('stroke-linecap', 'round');
  group.appendChild(shaft);

  const dx = x2 - x1; const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const px = -uy; const py = ux;
  const tipLen = 7;
  const baseX = x2 - ux * tipLen;
  const baseY = y2 - uy * tipLen;

  const tip = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  tip.setAttribute('points', `${x2},${y2} ${baseX + px * 3.2},${baseY + py * 3.2} ${baseX - px * 3.2},${baseY - py * 3.2}`);
  tip.setAttribute('fill', '#fff');
  group.appendChild(tip);
}

function renderSpearmanGlyph(pos) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  drawSpear(group, pos.x - 8, pos.y + 8, pos.x + 10, pos.y - 10, 3);
  return group;
}

function renderPikemanGlyph(pos) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  drawSpear(group, pos.x - 11, pos.y + 10, pos.x + 11, pos.y - 10, 2.8);
  drawSpear(group, pos.x - 11, pos.y - 10, pos.x + 11, pos.y + 10, 2.8);
  return group;
}

function renderLancerGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const horse = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  horse.setAttribute('x', String(pos.x - 3));
  horse.setAttribute('y', String(pos.y + 2));
  horse.setAttribute('text-anchor', 'middle');
  horse.setAttribute('class', 'unit-icon');
  horse.textContent = '🐎';
  g.appendChild(horse);

  // Flipped lance direction.
  drawSpear(g, pos.x + 12, pos.y + 9, pos.x - 14, pos.y - 12, 4);
  return g;
}

function renderLongbowGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const bow = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bow.setAttribute('x', String(pos.x));
  bow.setAttribute('y', String(pos.y + 1));
  bow.setAttribute('class', 'unit-icon');
  bow.style.fontSize = '18px';
  bow.textContent = '🏹';
  g.appendChild(bow);
  drawSpear(g, pos.x - 9, pos.y + 10, pos.x + 11, pos.y - 11, 2.6);
  return g;
}

function renderCrossbowGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const swords = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  swords.setAttribute('x', String(pos.x));
  swords.setAttribute('y', String(pos.y + 3));
  swords.setAttribute('class', 'unit-icon');
  swords.style.fontSize = '16px';
  swords.style.opacity = '0.9';
  swords.textContent = '⚔️';
  g.appendChild(swords);

  const bow = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bow.setAttribute('x', String(pos.x));
  bow.setAttribute('y', String(pos.y - 1));
  bow.setAttribute('class', 'unit-icon');
  bow.style.fontSize = '17px';
  bow.textContent = '🏹';
  g.appendChild(bow);
  return g;
}

function renderCavalryArcherGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const horse = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  horse.setAttribute('x', String(pos.x));
  horse.setAttribute('y', String(pos.y + 4));
  horse.setAttribute('class', 'unit-icon');
  horse.style.fontSize = '17px';
  horse.textContent = '🐎';
  g.appendChild(horse);

  const bow = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  bow.setAttribute('x', String(pos.x));
  bow.setAttribute('y', String(pos.y - 9));
  bow.setAttribute('class', 'unit-icon');
  bow.style.fontSize = '14px';
  bow.textContent = '🏹';
  g.appendChild(bow);
  return g;
}

function renderUnitGlyph(unit, pos, group) {
  if (unit.type === 'pikeman') {
    group.appendChild(renderPikemanGlyph(pos));
    return;
  }
  if (unit.type === 'lancer') {
    group.appendChild(renderLancerGlyph(pos));
    return;
  }
  if (unit.type === 'longbow') {
    group.appendChild(renderLongbowGlyph(pos));
    return;
  }
  if (unit.type === 'crossbow') {
    group.appendChild(renderCrossbowGlyph(pos));
    return;
  }
  if (unit.type === 'cavalry_archer') {
    group.appendChild(renderCavalryArcherGlyph(pos));
    return;
  }
  const emoji = UNIT_DEFS[unit.type]?.emoji || '❓';
  if (emoji === 'spear') {
    group.appendChild(renderSpearmanGlyph(pos));
    return;
  }
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  icon.setAttribute('x', String(pos.x));
  icon.setAttribute('y', String(pos.y + 1));
  icon.setAttribute('class', 'unit-icon');
  icon.textContent = emoji;
  group.appendChild(icon);
}

function render(logs = []) {
  if (resourceHover) {
    const hoveredCell = document.querySelector('[data-resource-hover]:hover');
    if (!hoveredCell) resourceHover = null;
  }
  board.innerHTML = '';
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();
  const activeFocus = resourceHover || resourceFocus;
  const focusedKeys = activeFocus ? getResourceContributors(currentPlayer, activeFocus.resource, activeFocus.mode) : null;

  const tileCenters = tiles.map((tile) => ({ tile, pos: axialToPixel(tile), poly: polygonVertices(axialToPixel(tile), HEX_RADIUS) }));
  const tileMap = new Map(tiles.map((t) => [keyOf(t), t]));

  // Dominant-bleed mosaic with adjustable resolution.
  const mosaicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mosaicGroup.setAttribute('pointer-events', 'none');
  const edgeCutoff = (HEX_RADIUS * 1.2) ** 2;
  const fadeEnd = edgeCutoff * 1.18;

  if (mosaicResolution <= 1) {
    for (const tc of tileCenters) {
      const solidPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      solidPoly.setAttribute('points', polygonPoints(tc.pos, HEX_RADIUS));
      solidPoly.setAttribute('fill', colorForTileShard(tc.tile, 1));
      solidPoly.setAttribute('stroke', 'none');
      mosaicGroup.appendChild(solidPoly);
    }
  } else {
    const miniRadius = Math.max(2.8, HEX_RADIUS / (1 + mosaicResolution * 0.06));
    const gridRange = Math.ceil((MAP_RADIUS + 2) * (HEX_RADIUS / miniRadius) * 2.7);
    const globalMini = [];
    for (let mq = -gridRange; mq <= gridRange; mq += 1) {
      for (let mr = -gridRange; mr <= gridRange; mr += 1) {
        const miniPos = axialToPixel({ q: mq, r: mr }, miniRadius);
        globalMini.push({ mq, mr, pos: miniPos, idx: ((mq - mr) % 3 + 3) % 3 });
      }
    }

    for (const mini of globalMini) {
      const candidates = [];
      let minDist = Infinity;
      const nearTiles = [];
      for (const tc of tileCenters) {
        const dx = tc.pos.x - mini.pos.x;
        const dy = tc.pos.y - mini.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist) minDist = d2;
        if (d2 <= fadeEnd) {
          nearTiles.push(tc);
          const color = colorForTileShard(tc.tile, mini.idx);
          candidates.push({ color, weight: 1 / (Math.sqrt(d2) + 1) });
        }
      }
      if (!candidates.length || minDist > fadeEnd) continue;

      const samplePts = [[mini.pos.x, mini.pos.y], ...polygonVertices(mini.pos, miniRadius)];
      let insideCount = 0;
      for (const [sx, sy] of samplePts) {
        let insideAny = false;
        for (const tc of nearTiles) {
          if (pointInPolygon(sx, sy, tc.poly)) { insideAny = true; break; }
        }
        if (insideAny) insideCount += 1;
      }
      const insideRatio = insideCount / samplePts.length;
      const overhang = Math.max(0, 1 - insideRatio);
      if (overhang > 0) {
        const bgWeight = 0.45 * (overhang ** 1.5);
        candidates.push({ color: '#0b1230', weight: bgWeight });
      }

      const miniPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      miniPoly.setAttribute('points', polygonPoints(mini.pos, miniRadius));
      miniPoly.setAttribute('fill', mixHexWeighted(candidates));
      miniPoly.setAttribute('stroke', 'none');
      mosaicGroup.appendChild(miniPoly);
    }
  }
  board.appendChild(mosaicGroup);

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

    if (focusedKeys) {
      const isFocus = focusedKeys.has(key);
      const filterPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      filterPoly.setAttribute('points', polygonPoints(pos, HEX_RADIUS));
      filterPoly.setAttribute('fill', isFocus ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)');
      filterPoly.setAttribute('pointer-events', 'none');
      board.appendChild(filterPoly);
    }

    if (selectedKey === key || targets.has(key)) {
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      outline.setAttribute('class', `hex ${selectedKey === key ? 'selected' : 'target'}`);
      outline.setAttribute('points', polygonPoints(pos, HEX_RADIUS));
      outline.setAttribute('fill', 'none');
      outline.dataset.key = key;
      board.appendChild(outline);
    }

    if (tile.owner === currentPlayer) {
      const verts = polygonVertices(pos, HEX_RADIUS);
      for (let i = 0; i < 6; i += 1) {
        const [x1, y1] = verts[i];
        const [x2, y2] = verts[(i + 1) % 6];
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        let nearestNeighbor = null;
        let best = Infinity;
        for (const [dq, dr] of DIRECTIONS) {
          const n = tileMap.get(`${tile.q + dq},${tile.r + dr}`);
          if (!n) continue;
          const nPos = axialToPixel(n);
          const d = (nPos.x - mx) ** 2 + (nPos.y - my) ** 2;
          if (d < best) {
            best = d;
            nearestNeighbor = n;
          }
        }

        if (nearestNeighbor?.owner === tile.owner) continue;

        const edge = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        edge.setAttribute('x1', String(x1));
        edge.setAttribute('y1', String(y1));
        edge.setAttribute('x2', String(x2));
        edge.setAttribute('y2', String(y2));
        edge.setAttribute('stroke', ownerColor(tile.owner));
        edge.setAttribute('stroke-width', '3');
        edge.setAttribute('stroke-linecap', 'round');
        edge.setAttribute('pointer-events', 'none');
        board.appendChild(edge);
      }
    }

    const houses = new Set(['🏠', '🏡']);
    tile.symbols.forEach((symbol, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const sx = pos.x + (HEX_RADIUS * 0.5) * Math.cos(angle);
      const sy = pos.y + (HEX_RADIUS * 0.5) * Math.sin(angle);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(sx));
      text.setAttribute('y', String(sy + 5));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'symbol');
      if (houses.has(symbol)) {
        text.style.fontSize = '15px';
        text.style.stroke = 'rgba(10,14,28,0.95)';
        text.style.strokeWidth = '1.6px';
        text.style.paintOrder = 'stroke';
      }
      text.textContent = symbol;
      board.appendChild(text);
    });

    const prodBoost = productionQtyForTile(tile.owner, tile) - 1;
    if (tile.owner && prodBoost > 0) {
      const fillerPool = BONUS_SYMBOLS[tile.type] || ['✨', '✦', '·', '•', '✧', '◦'];
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 180) * (60 * i);
        const sx = pos.x + (HEX_RADIUS * 0.68) * Math.cos(angle);
        const sy = pos.y + (HEX_RADIUS * 0.68) * Math.sin(angle);
        const f = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        f.setAttribute('x', String(sx));
        f.setAttribute('y', String(sy + 3));
        f.setAttribute('text-anchor', 'middle');
        f.setAttribute('class', 'symbol');
        f.style.fontSize = '6.5px';
        f.style.opacity = '0.9';
        f.textContent = fillerPool[(i + Math.max(1, prodBoost)) % fillerPool.length];
        board.appendChild(f);
      }
    }

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
      ring.style.stroke = 'none';
      group.appendChild(ring);

      const selected = selectedKey === key;
      const isCurrent = unit.player === currentPlayer;
      const moveReady = isCurrent && unit.movesLeft > 0;
      const actionReady = isCurrent && unit.actionsLeft > 0;
      const moveColor = selected ? '#facc15' : (moveReady ? '#ffffff' : '#111111');
      const actionColor = selected ? '#facc15' : (actionReady ? '#ffffff' : '#111111');
      const ringWidth = selected ? 4 : 2.5;
      const rr = 17;

      function addRingHalf(isTop, color) {
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const y = pos.y;
        const xLeft = pos.x - rr;
        const xRight = pos.x + rr;
        const sweep = isTop ? 1 : 0;
        arc.setAttribute('d', `M ${xLeft} ${y} A ${rr} ${rr} 0 0 ${sweep} ${xRight} ${y}`);
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', color);
        arc.setAttribute('stroke-width', String(ringWidth));
        arc.setAttribute('stroke-linecap', 'round');
        group.appendChild(arc);
      }

      // Top half = action state (hands), bottom half = move state (feet).
      addRingHalf(true, actionColor);
      addRingHalf(false, moveColor);

      renderUnitGlyph(unit, pos, group);
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
    selectedKey = key;
    render();
    return;
  }

  if (selectedKey && canRangedAttack(selectedKey, key)) {
    rangedAttack(selectedKey, key);
    render();
    return;
  }

  if (selectedKey && units.get(selectedKey)) {
    const selectedUnit = units.get(selectedKey);
    if (selectedUnit && isArcher(selectedUnit.type) && units.get(key)) {
      lastDebug = explainAttackFailure(selectedKey, key);
    } else if (!canMove(selectedKey, key)) {
      lastDebug = explainMoveFailure(selectedKey, key);
    }
  }

  selectedKey = (clickedUnit || getTile(key)) ? key : null;
  render();
});

endTurnBtn.addEventListener('click', () => {
  const logs = gameMode === 'solo'
    ? [...enforceShortages('blue')]
    : [...enforceShortages('blue'), ...enforceShortages('red')];
  currentPlayer = gameMode === 'solo' ? 'blue' : (currentPlayer === 'blue' ? 'red' : 'blue');
  resetTurnActions(currentPlayer);
  revealSoloTiles();
  selectedKey = null;
  lastDebug = 'Turn advanced. Economy table reflects continuous produced/used/available flow.';
  render(logs);
});

start1pBtn?.addEventListener('click', () => startGame('solo'));
start2pBtn?.addEventListener('click', () => startGame('duo'));

if (mosaicResolutionValueEl) mosaicResolutionValueEl.textContent = String(mosaicResolution);
mosaicResolutionEl?.addEventListener('input', () => {
  mosaicResolution = Number(mosaicResolutionEl.value) || 1;
  if (mosaicResolutionValueEl) mosaicResolutionValueEl.textContent = String(mosaicResolution);
  render();
});

render();
