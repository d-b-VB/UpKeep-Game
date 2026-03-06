const board = document.getElementById('hex-board');
const boardWrap = document.getElementById('board-wrap');
const statusText = document.getElementById('status');
const resourcesEl = document.getElementById('resources');
const selectionEl = document.getElementById('selection');
const endTurnBtn = document.getElementById('end-turn');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomResetBtn = document.getElementById('zoom-reset');
const zoomInBtn = document.getElementById('zoom-in');
const helpToggleBtn = document.getElementById('help-toggle');
const modeMenuEl = document.getElementById('mode-menu');
const start1pBtn = document.getElementById('start-1p');
const start2pBtn = document.getElementById('start-2p');
const startEasyAiBtn = document.getElementById('start-easy-ai');
const startOnlineBtn = document.getElementById('start-online');
const onlineConnectEl = document.getElementById('online-connect');
const onlineHostOfferBtn = document.getElementById('online-host-offer');
const onlineJoinAnswerBtn = document.getElementById('online-join-answer');
const onlineHostApplyAnswerBtn = document.getElementById('online-host-apply-answer');
const onlineLocalSignalEl = document.getElementById('online-local-signal');
const onlineRemoteSignalEl = document.getElementById('online-remote-signal');
const onlineStatusEl = document.getElementById('online-status');
const primitivityIndexEl = document.getElementById('primitivity-index');
const primitivityIndexValueEl = document.getElementById('primitivity-index-value');

const HEX_RADIUS = 42;
const MINI_RADIUS = 8;
const ORIGIN = { x: 980, y: 860 };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MAP_RADIUS = 6; // 127 tiles
const SOLO_START_RADIUS = 2; // 19 tiles
const ULTRA_MOSAIC = { name: 'Ultra', miniRadius: 5.2 };

// Spawn distribution from chained percentages driven by primitivity index P.
// P% forest, then P% of remainder to pasture, then farm, then homestead.
// Remaining pool: 50% settlement line, 25% great-house line, 25% fortification line.
// Each line allocates P% to level-1, P% of remainder to level-2, rest to level-3.
let primitivityIndex = 85;
let spawnPercentages = {};
let weightedTypes = [];

function computeSpawnDistribution(primitivityPct) {
  const p = Math.max(0, Math.min(1, primitivityPct / 100));
  let rem = 1;

  const forest = rem * p; rem -= forest;
  const pasture = rem * p; rem -= pasture;
  const farm = rem * p; rem -= farm;
  const homestead = rem * p; rem -= homestead;

  const settlementPool = rem * 0.5;
  const greatHousePool = rem * 0.25;
  const fortPool = rem * 0.25;

  function split3(pool) {
    let r = pool;
    const l1 = r * p; r -= l1;
    const l2 = r * p; r -= l2;
    const l3 = r;
    return [l1, l2, l3];
  }

  const [village, town, city] = split3(settlementPool);
  const [manor, estate, palace] = split3(greatHousePool);
  const [outpost, stronghold, keep] = split3(fortPool);

  return {
    forest: forest * 100,
    pasture: pasture * 100,
    farm: farm * 100,
    homestead: homestead * 100,
    village: village * 100,
    town: town * 100,
    city: city * 100,
    manor: manor * 100,
    estate: estate * 100,
    palace: palace * 100,
    outpost: outpost * 100,
    stronghold: stronghold * 100,
    keep: keep * 100,
  };
}

function buildWeightedTypes(percentages, scale = 10000) {
  const out = [];
  for (const [type, pct] of Object.entries(percentages)) {
    const count = Math.max(1, Math.round((pct / 100) * scale));
    for (let i = 0; i < count; i += 1) out.push(type);
  }
  return out;
}

function applyPrimitivityIndex(value) {
  primitivityIndex = Math.max(15, Math.min(100, Number(value) || 85));
  spawnPercentages = computeSpawnDistribution(primitivityIndex);
  weightedTypes = buildWeightedTypes(spawnPercentages);
  if (primitivityIndexValueEl) primitivityIndexValueEl.textContent = `${primitivityIndex}%`;
}

applyPrimitivityIndex(primitivityIndex);

const tilePalettes = {
  forest: ['#1b5e20', '#2e7d32', '#6d4c41'],
  pasture: ['#b9e2a0', '#d7efc4', '#f0f7df'],
  farm: ['#cde6b8', '#ffd54f', '#cfb14f'],
  homestead: ['#bcaaa4', '#8d6e63', '#a1887f'],
  village: ['#d8b49c', '#c97b63', '#f1cf9d'],
  town: ['#afc1d6', '#d2b1bd', '#e6d2ac'],
  city: ['#e3e3e3', '#cdd5db', '#a9b7c0'],
  manor: ['#c3ab8e', '#8a5f44', '#e0ceb8'],
  estate: ['#d5d9f6', '#b8c2f6', '#9eaaf5'],
  palace: ['#201a2b', '#e6e6f0', '#7b57c6'],
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
  rangehand: { emoji: 'sling', cls: 'archer', terrainUpgrader: false },
  surveyor: { emoji: '🧭', cls: 'defworker', terrainUpgrader: true },
  constable: { emoji: '♣️', cls: 'defworker', terrainUpgrader: true },

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
  royal_knight: { emoji: '🐴', cls: 'cavalry', terrainUpgrader: false },
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
  if (unitType === 'surveyor') return 2;
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
  outpost: {
    spearman: ['hunter', 'horseman'],
    hunter: ['spearman', 'horseman'],
    horseman: ['spearman', 'hunter'],
    swordsman: ['longbow', 'lancer'],
    longbow: ['swordsman', 'lancer'],
    lancer: ['swordsman', 'longbow'],
    pikeman: ['crossbow', 'cavalry_archer'],
    crossbow: ['pikeman', 'cavalry_archer'],
    cavalry_archer: ['pikeman', 'crossbow'],
    infantry_sergeant: ['barrage_captain', 'royal_knight'],
    barrage_captain: ['infantry_sergeant', 'royal_knight'],
    royal_knight: ['infantry_sergeant', 'barrage_captain'],
  },
  stronghold: {
    spearman: ['swordsman', 'pikeman', 'infantry_sergeant', 'hunter', 'longbow', 'crossbow', 'barrage_captain', 'horseman', 'lancer', 'cavalry_archer', 'royal_knight'],
    swordsman: ['spearman', 'pikeman', 'infantry_sergeant', 'hunter', 'longbow', 'crossbow', 'barrage_captain', 'horseman', 'lancer', 'cavalry_archer', 'royal_knight'],
    pikeman: ['spearman', 'swordsman', 'infantry_sergeant', 'hunter', 'longbow', 'crossbow', 'barrage_captain', 'horseman', 'lancer', 'cavalry_archer', 'royal_knight'],
    infantry_sergeant: ['spearman', 'swordsman', 'pikeman', 'hunter', 'longbow', 'crossbow', 'barrage_captain', 'horseman', 'lancer', 'cavalry_archer', 'royal_knight'],
    hunter: ['longbow', 'crossbow', 'barrage_captain'],
    longbow: ['hunter', 'crossbow', 'barrage_captain'],
    crossbow: ['hunter', 'longbow', 'barrage_captain'],
    barrage_captain: ['hunter', 'longbow', 'crossbow'],
    horseman: ['lancer', 'cavalry_archer', 'royal_knight'],
    lancer: ['horseman', 'cavalry_archer', 'royal_knight'],
    cavalry_archer: ['horseman', 'lancer', 'royal_knight'],
    royal_knight: ['horseman', 'lancer', 'cavalry_archer'],
  },
  keep: {
    spearman: ['horseman', 'lancer', 'royal_knight', 'hunter', 'longbow', 'crossbow', 'barrage_captain'],
    swordsman: ['horseman', 'lancer', 'royal_knight', 'hunter', 'longbow', 'crossbow', 'barrage_captain'],
    pikeman: ['horseman', 'lancer', 'royal_knight', 'hunter', 'longbow', 'crossbow', 'barrage_captain'],
    infantry_sergeant: ['horseman', 'lancer', 'royal_knight', 'hunter', 'longbow', 'crossbow', 'barrage_captain'],
    horseman: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    lancer: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    cavalry_archer: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    royal_knight: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    hunter: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    longbow: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    crossbow: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
    barrage_captain: ['spearman', 'swordsman', 'pikeman', 'infantry_sergeant'],
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

const resourceToTileType = {
  wood: 'forest', livestock: 'pasture', crops: 'farm', provisions: 'homestead',
  supplies: 'village', crafts: 'town', luxury: 'city',
  support: 'manor', authority: 'estate', sovereignty: 'palace',
};

function resourceMosaicHtml(resource) {
  const tileType = resourceToTileType[resource];
  const palette = tilePalettes[tileType] || ['#64748b', '#94a3b8', '#cbd5e1'];
  return `<span class="mosaic-hexcluster" aria-hidden="true"><span style="background:${palette[0]}"></span><span style="background:${palette[1]}"></span><span style="background:${palette[2]}"></span></span>`;
}

function resourceEmojiWithMosaic(resource) {
  return `<span class="resource-emoji-wrap">${resourceMosaicHtml(resource)}<span class="resource-emoji">${resourceEmoji[resource] || ''}</span></span>`;
}

const tileDescriptions = {
  forest: 'Wood source; naturally closed terrain.',
  pasture: 'Livestock source and cavalry-friendly territory.',
  farm: 'Crop source; supports many early unit lines.',
  homestead: 'Provision-producing base for branching upgrades.',
  village: 'Entry settlement that trains workers/spearmen.',
  town: 'Mid-tier settlement unlocking broader unit options.',
  city: 'High-tier settlement with advanced unit training.',
  manor: 'Great-house tier 1 producing support line resources.',
  estate: 'Great-house tier 2 with stronger authority economy.',
  palace: 'Great-house tier 3 producing sovereignty.',
  outpost: 'Fortification tier 1, closed to enemies.',
  stronghold: 'Fortification tier 2 with adjacent closure control.',
  keep: 'Fortification tier 3 with strong defensive utility.',
};

const unitDescriptions = {
  worker: 'Basic terrain upgrader with low upkeep.',
  laborer: 'Upgrader variant for settlement growth paths.',
  axman: 'Defensive worker line and terrain upgrader.',
  architect: 'Advanced upgrader with two actions per turn.',
  rangehand: 'Ranged great-house unit with mobility utility.',
  surveyor: 'Two-step upgrader unit with mobility utility.',
  constable: 'High-tier great-house defender.',
  spearman: 'Infantry core; useful for zone control.',
  swordsman: 'Direct melee infantry option.',
  pikeman: 'Infantry with strong anti-space control role.',
  infantry_sergeant: 'Outpost-trained defensive infantry.',
  hunter: 'Early archer line from towns.',
  longbow: 'Long-range archer line from cities.',
  crossbow: 'Advanced archer with extra action economy.',
  barrage_captain: 'Stronghold-trained elite archer.',
  horseman: 'Fast cavalry for expansion and flanking.',
  lancer: 'Fast cavalry with follow-through movement.',
  cavalry_archer: 'Hybrid cavalry/ranged pressure unit.',
  royal_knight: 'Keep-trained elite cavalry unit.',
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
  return baseColor;
}

function accentColorForTileShard(tile, shardIdx = 1) {
  if (shardIdx !== 2 || !tile.owner) return null;
  const palette = tilePalettes[tile.type] || ['#888', '#888', '#888'];
  const baseColor = palette[2] || palette[1] || palette[0] || '#888';
  return blendHex(ownerColor(tile.owner), baseColor, 0.5);
}

function productionQtyForTile(player, tile, tileSnapshot = tiles, unitSnapshot = units) {
  const prodKey = productionByType[tile.type];
  if (!prodKey || tile.owner !== player) return 0;

  const tileMap = new Map(tileSnapshot.map((t) => [keyOf(t), t]));
  const settlementTypes = new Set(Object.keys(structureUpkeep));
  const palaceCount = tileSnapshot.filter((t) => t.owner === player && t.type === 'palace').length;
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
    if (palaceCount > 0) qty *= (1 + palaceCount);
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
let gameMode = null; // 'solo' | 'duo' | 'easy-ai' | 'online'
let startInProgress = false;

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

function revealExpandingTiles() {
  if (gameMode !== 'solo' && gameMode !== 'easy-ai' && gameMode !== 'online') return;
  const unitsNow = [...units.entries()].filter(([, u]) => {
    if (gameMode === 'solo') return u.player === 'blue';
    return true; // easy-ai + online reveal around both sides.
  });
  const edgeBuffer = gameMode === 'easy-ai' ? 3 : 0;
  for (const [key, unit] of unitsNow) {
    const from = getCellByKey(key);
    const movement = movePointsFor(unit.type);
    const range = isArcher(unit.type) ? archerRange(unit.type) : 1;
    const interactRadius = Math.max(1, movement + range + edgeBuffer);
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
  revealExpandingTiles();
}

function startGame(mode) {
  if (startInProgress) return;
  startInProgress = true;

  if (start1pBtn) start1pBtn.disabled = true;
  if (start2pBtn) start2pBtn.disabled = true;
  if (startEasyAiBtn) startEasyAiBtn.disabled = true;
  if (startOnlineBtn) startOnlineBtn.disabled = true;
  const label = mode === 'solo' ? '1-player' : mode === 'easy-ai' ? 'easy AI' : '2-player';
  if (statusText) statusText.textContent = `Starting ${label} game...`;
  if (modeMenuEl) modeMenuEl.classList.add('hidden');

  // Let the menu hide paint first so startup work doesn't look like a frozen click.
  requestAnimationFrame(() => {
  gameMode = mode;
  currentPlayer = 'blue';
  selectedKey = null;
  lastDebug = mode === 'solo'
    ? 'Solo mode: new tiles reveal as units approach them.'
    : mode === 'easy-ai'
      ? 'Easy AI mode: red side is controlled by heuristic AI.'
      : '';
  resourceFocus = null;
  resourceHover = null;
  applyPrimitivityIndex(primitivityIndexEl?.value || primitivityIndex);
  if (mode === 'solo') setupSoloGame(); else setupDuoGame();
  if (mode === 'easy-ai') revealExpandingTiles();
  render();
  startInProgress = false;
  });
}

function buildEasyAiState() {
  const legalTrains = [];
  const legalTileUpgrades = [];

  for (const tile of tiles) {
    const key = keyOf(tile);
    if (tile.owner !== currentPlayer) continue;

    if (!units.get(key)) {
      const trainable = TRAIN_AT[tile.type] || [];
      for (const unitType of trainable) {
        if (canSupportUnitSpawn(currentPlayer, unitType, key)) {
          legalTrains.push({ key, unitType, tileType: tile.type });
        }
      }
    }

    const unit = units.get(key);
    if (unit && unit.player === currentPlayer && UNIT_DEFS[unit.type]?.terrainUpgrader && unit.actionsLeft > 0) {
      const upgrades = upgradePaths[tile.type] || [];
      for (const toType of upgrades) {
        if (canSupportTileUpgrade(currentPlayer, tile.type, toType)) {
          legalTileUpgrades.push({ key, fromType: tile.type, toType, unitType: unit.type });
        }
      }
    }
  }

  return {
    currentPlayer,
    cells: cells.map((c) => ({ ...c })),
    tiles: tiles.map((t) => ({ ...t, key: keyOf(t) })),
    units: [...units.entries()].map(([key, unit]) => ({ key, ...unit })),
    legalMovesByUnit: Object.fromEntries(
      [...units.entries()]
        .filter(([, unit]) => unit.player === currentPlayer)
        .map(([fromKey]) => [fromKey, getMoveTargets(fromKey)]),
    ),
    legalShotsByUnit: Object.fromEntries(
      [...units.entries()]
        .filter(([, unit]) => unit.player === currentPlayer)
        .map(([fromKey]) => [fromKey, getAttackTargets(fromKey)]),
    ),
    legalTrains,
    legalTileUpgrades,
    eco: computeEconomy(currentPlayer),
    resourceOrder: [...resourceKeys],
    productionByType: { ...productionByType },
    upgradePaths: { ...upgradePaths },
    unitDefs: { ...UNIT_DEFS },
    closedTiles: Object.fromEntries(tiles.map((t) => [keyOf(t), isTileClosedFor(currentPlayer, keyOf(t))])),
  };
}

function deficitScore(player, tSnap = tiles, uSnap = units) {
  const eco = computeEconomy(player, tSnap, uSnap);
  return resourceKeys.reduce((sum, r) => sum + Math.max(0, -(eco.available[r] || 0)), 0);
}

function aiActionWouldCauseShortage(action, player = 'red') {
  if (!action) return true;

  const beforeScore = deficitScore(player);
  const tSnap = tiles.map((t) => ({ ...t }));
  const uSnap = cloneUnits(units);

  if (action.type === 'move') {
    if (!canMove(action.from, action.to)) return true;
    const unit = uSnap.get(action.from);
    const dest = tSnap.find((t) => keyOf(t) === action.to);
    if (!unit || !dest) return true;

    uSnap.delete(action.from);
    const lancerStepCost = unit.type === 'lancer'
      ? Math.max(1, (getLancerMoveInfo(action.from, action.to, unit)?.path?.length || 2) - 1)
      : 1;
    const moved = {
      ...unit,
      movesLeft: unit.type === 'lancer'
        ? Math.max(0, unit.movesLeft - lancerStepCost)
        : (isCavalry(unit.type) ? 0 : Math.max(0, unit.movesLeft - 1)),
    };
    uSnap.set(action.to, moved);

    applyTileControlAfterMove(dest, player, moved.type, tSnap, uSnap);
  } else if (action.type === 'shoot') {
    if (!canRangedAttack(action.from, action.to)) return true;
    uSnap.delete(action.to);
  } else if (action.type === 'train') {
    const tile = tSnap.find((t) => keyOf(t) === action.key);
    if (!tile || uSnap.get(action.key)) return true;
    uSnap.set(action.key, { player, type: action.unitType, movesLeft: 0, actionsLeft: 0 });
  } else if (action.type === 'upgrade-tile') {
    const tile = tSnap.find((t) => keyOf(t) === action.key);
    if (!tile) return true;
    tile.type = action.toType;
  } else {
    return true;
  }

  const afterScore = deficitScore(player, tSnap, uSnap);
  return afterScore > beforeScore;
}

function runEasyAiTurn() {
  if (gameMode !== 'easy-ai' || currentPlayer !== 'red') return;
  const planner = window.UpKeepEasyAI;
  if (!planner || (!planner.chooseCandidates && !planner.chooseAction)) {
    lastDebug = 'Easy AI unavailable: planner file missing.';
    return;
  }

  let acted = false;
  for (let i = 0; i < 18; i += 1) {
    const state = buildEasyAiState();
    const candidates = planner.chooseCandidates
      ? planner.chooseCandidates(state)
      : [planner.chooseAction(state)].filter(Boolean);

    let executed = false;
    for (const action of candidates) {
      if (!action || aiActionWouldCauseShortage(action, 'red')) continue;
      if ((action.score || 0) < -60) continue;

      if (action.type === 'move' && canMove(action.from, action.to)) {
        moveUnit(action.from, action.to);
        acted = true;
        executed = true;
        break;
      }
      if (action.type === 'shoot' && canRangedAttack(action.from, action.to)) {
        rangedAttack(action.from, action.to);
        acted = true;
        executed = true;
        break;
      }
      if (action.type === 'train' && trainUnitAt(action.key, action.unitType)) {
        acted = true;
        executed = true;
        break;
      }
      if (action.type === 'upgrade-tile' && upgradeTileAt(action.key, action.toType)) {
        acted = true;
        executed = true;
        break;
      }
    }

    if (!executed) break;
  }

  if (!acted) lastDebug = 'Easy AI: no action available; passing turn.';

  const logs = [...enforceShortages('blue'), ...enforceShortages('red')];
  currentPlayer = 'blue';
  resetTurnActions('blue');
  selectedKey = null;
  revealExpandingTiles();
  render(logs);
}

let currentPlayer = 'blue';
let selectedKey = null;
let lastDebug = '';
let resourceFocus = null; // { resource, mode: 'produced'|'used' }
let resourceHover = null; // temporary hover focus

let boardZoom = 1;
let boardBaseWidth = 2200;
let boardBaseHeight = 1900;
let boardViewMinX = 0;
let boardViewMinY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;
let animationFrameHandle = null;
const activeAnimations = [];
let showActionHelp = false;

let onlineRole = null; // 'host' | 'guest'
let onlinePeer = null;
let onlineChannel = null;
let onlineConnected = false;
let onlineReadyToPlay = false;

function setOnlineStatus(msg) {
  if (onlineStatusEl) onlineStatusEl.textContent = msg;
  lastDebug = msg;
}

function isOnlineGuest() {
  return gameMode === 'online' && onlineRole === 'guest';
}

function isOnlineHost() {
  return gameMode === 'online' && onlineRole === 'host';
}

function serializeState() {
  return {
    gameMode,
    currentPlayer,
    cells: cells.map((c) => ({ ...c })),
    tiles: tiles.map((t) => ({ ...t })),
    units: [...units.entries()].map(([key, unit]) => ({ key, ...unit })),
  };
}

function applySerializedState(payload) {
  if (!payload) return;
  gameMode = payload.gameMode || 'online';
  currentPlayer = payload.currentPlayer || 'blue';
  cells = (payload.cells || []).map((c) => ({ ...c }));
  cellKeys = new Set(cells.map(keyOf));
  tiles = (payload.tiles || []).map((t) => ({ ...t }));
  units = new Map((payload.units || []).map((u) => [u.key, {
    player: u.player,
    type: u.type,
    movesLeft: u.movesLeft,
    actionsLeft: u.actionsLeft,
  }]));
  selectedKey = null;
  render();
}

function sendOnlineMessage(obj) {
  if (!onlineChannel || onlineChannel.readyState !== 'open') return;
  onlineChannel.send(JSON.stringify(obj));
}

function syncOnlineStateIfHost() {
  if (!isOnlineHost() || !onlineConnected) return;
  sendOnlineMessage({ type: 'state', payload: serializeState() });
}

function requestOnlineAction(action) {
  if (!isOnlineGuest()) return false;
  if (!onlineConnected) {
    setOnlineStatus('Not connected: cannot send action.');
    return true;
  }
  sendOnlineMessage({ type: 'action', payload: action });
  setOnlineStatus('Action sent to host...');
  return true;
}

async function waitIceDone(pc) {
  if (!pc) return;
  if (pc.iceGatheringState === 'complete') return;
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 2200);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

function resetOnlineConnection() {
  try { onlineChannel?.close(); } catch (e) { void e; }
  try { onlinePeer?.close(); } catch (e) { void e; }
  onlineChannel = null;
  onlinePeer = null;
  onlineConnected = false;
  onlineReadyToPlay = false;
}

function wireDataChannel(channel) {
  onlineChannel = channel;
  onlineChannel.onopen = () => {
    onlineConnected = true;
    setOnlineStatus(onlineRole === 'host' ? 'Connected as Player 1 (host, blue).' : 'Connected as Player 2 (guest, red).');
    if (modeMenuEl) modeMenuEl.classList.add('hidden');

    if (onlineRole === 'host') {
      gameMode = 'online';
      currentPlayer = 'blue';
      selectedKey = null;
      setupDuoGame();
      render();
      syncOnlineStateIfHost();
    } else {
      gameMode = 'online';
      currentPlayer = 'blue';
      selectedKey = null;
      render();
      setOnlineStatus('Connected as Player 2 (guest, red). Waiting for Player 1 state...');
    }
  };

  onlineChannel.onmessage = (ev) => {
    let msg = null;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (!msg) return;

    if (msg.type === 'state' && onlineRole === 'guest') {
      applySerializedState(msg.payload);
      setOnlineStatus('Synced with host.');
      return;
    }

    if (msg.type === 'action' && onlineRole === 'host') {
      const a = msg.payload || {};
      let changed = false;
      if (a.type === 'move' && canMove(a.from, a.to)) {
        moveUnit(a.from, a.to);
        selectedKey = a.to;
        changed = true;
      } else if (a.type === 'shoot' && canRangedAttack(a.from, a.to)) {
        rangedAttack(a.from, a.to);
        changed = true;
      } else if (a.type === 'train') {
        changed = Boolean(trainUnitAt(a.key, a.unitType));
      } else if (a.type === 'upgrade-tile') {
        changed = Boolean(upgradeTileAt(a.key, a.toType));
      } else if (a.type === 'upgrade-unit') {
        const before = units.get(a.key)?.type;
        upgradeUnitAt(a.key, a.newType);
        changed = before !== units.get(a.key)?.type;
      } else if (a.type === 'end-turn') {
        const logs = [...enforceShortages('blue'), ...enforceShortages('red')];
        currentPlayer = currentPlayer === 'blue' ? 'red' : 'blue';
        resetTurnActions(currentPlayer);
        revealExpandingTiles();
        selectedKey = null;
        render(logs);
        changed = true;
      }

      if (changed) {
        render();
        syncOnlineStateIfHost();
      }
    }
  };

  onlineChannel.onclose = () => {
    onlineConnected = false;
    setOnlineStatus('Connection closed.');
  };
}

async function hostCreateOffer() {
  resetOnlineConnection();
  onlineRole = 'host';
  onlinePeer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  const channel = onlinePeer.createDataChannel('upkeep');
  wireDataChannel(channel);
  const offer = await onlinePeer.createOffer();
  await onlinePeer.setLocalDescription(offer);
  await waitIceDone(onlinePeer);
  if (onlineLocalSignalEl) onlineLocalSignalEl.value = JSON.stringify(onlinePeer.localDescription);
  setOnlineStatus('Host offer created. Share it with your opponent.');
}

async function joinCreateAnswer() {
  resetOnlineConnection();
  onlineRole = 'guest';
  onlinePeer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
  onlinePeer.ondatachannel = (event) => wireDataChannel(event.channel);
  const raw = onlineRemoteSignalEl?.value?.trim();
  if (!raw) { setOnlineStatus('Paste host offer first.'); return; }
  const offer = JSON.parse(raw);
  await onlinePeer.setRemoteDescription(offer);
  const answer = await onlinePeer.createAnswer();
  await onlinePeer.setLocalDescription(answer);
  await waitIceDone(onlinePeer);
  if (onlineLocalSignalEl) onlineLocalSignalEl.value = JSON.stringify(onlinePeer.localDescription);
  setOnlineStatus('Join answer created. Send it to the host.');
}

async function hostApplyAnswer() {
  if (!onlinePeer || onlineRole !== 'host') { setOnlineStatus('Create host offer first.'); return; }
  const raw = onlineRemoteSignalEl?.value?.trim();
  if (!raw) { setOnlineStatus('Paste join answer first.'); return; }
  const answer = JSON.parse(raw);
  await onlinePeer.setRemoteDescription(answer);
  setOnlineStatus('Answer applied. Waiting for data channel...');
}

function applyBoardZoom() {

  board.style.width = `${Math.round(boardBaseWidth * boardZoom)}px`;
  board.style.height = `${Math.round(boardBaseHeight * boardZoom)}px`;
  board.setAttribute('viewBox', `${boardViewMinX} ${boardViewMinY} ${boardBaseWidth} ${boardBaseHeight}`);
}

function startMoveAnimation(fromKey, toKey, unit) {
  const from = axialToPixel(getCellByKey(fromKey));
  const to = axialToPixel(getCellByKey(toKey));
  activeAnimations.push({
    type: 'move',
    unit: { ...unit },
    from,
    to,
    fromKey,
    toKey,
    start: performance.now(),
    duration: 220,
  });
  tickAnimations();
}

function startShotAnimation(fromKey, toKey, player) {
  const from = axialToPixel(getCellByKey(fromKey));
  const to = axialToPixel(getCellByKey(toKey));
  activeAnimations.push({
    type: 'shot',
    from,
    to,
    player,
    start: performance.now(),
    duration: 180,
  });
  tickAnimations();
}

function tickAnimations() {
  if (animationFrameHandle) return;
  const step = () => {
    const now = performance.now();
    for (let i = activeAnimations.length - 1; i >= 0; i -= 1) {
      const a = activeAnimations[i];
      a.t = Math.max(0, Math.min(1, (now - a.start) / a.duration));
      if (a.t >= 1) activeAnimations.splice(i, 1);
    }
    render();
    if (activeAnimations.length) {
      animationFrameHandle = requestAnimationFrame(step);
    } else {
      animationFrameHandle = null;
    }
  };
  animationFrameHandle = requestAnimationFrame(step);
}

function getTile(key) { return tiles.find((t) => keyOf(t) === key); }
function getCellByKey(key) { const [q, r] = key.split(',').map(Number); return { q, r }; }
function isAdjacent(a, b) { return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r); }


function isMilitaryUnitType(unitType) {
  const cls = UNIT_DEFS[unitType]?.cls;
  return cls === 'infantry' || cls === 'archer' || cls === 'cavalry';
}

function isUnitUpkeepFree(player, key, unit, tileSnapshot = tiles) {
  const tileMap = new Map(tileSnapshot.map((t) => [keyOf(t), t]));
  const tile = tileMap.get(key);
  if (!tile || !unit) return false;
  if (freeUnitCondition[unit.type]?.(tile)) return true;

  if (!isMilitaryUnitType(unit.type)) return false;

  const ownFort = tile.owner === player && ['outpost', 'stronghold', 'keep'].includes(tile.type);
  if (ownFort) return true;

  const hasAdjacentOwnedKeep = adjacentKeys(key).some((adjKey) => {
    const adjTile = tileMap.get(adjKey);
    return adjTile && adjTile.owner === player && adjTile.type === 'keep';
  });
  if (hasAdjacentOwnedKeep) return true;

  return false;
}

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
    if (isUnitUpkeepFree(player, keyOf(tile), unit, tileSnapshot)) continue;
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
    if (u && u.player === player && !isUnitUpkeepFree(player, key, u, tileSnapshot) && ((unitUpkeep[u.type] || {})[resource] || 0) > 0) out.add(key);
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
  const unit = units.get(key) || { player, type: fromType };
  const fromUpkeep = unitUpkeep[fromType] || {};
  const toUpkeep = unitUpkeep[toType] || {};

  // If upgraded unit will be free on this tile, always supportable.
  if (tile && isUnitUpkeepFree(player, key, { ...unit, type: toType }, tiles)) return true;

  for (const [res, toAmt] of Object.entries(toUpkeep)) {
    const fromAmt = (tile && isUnitUpkeepFree(player, key, { ...unit, type: fromType }, tiles)) ? 0 : (fromUpkeep[res] || 0);
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
      if (!tile || isUnitUpkeepFree(player, key, unit, tiles)) continue;
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

function isDirectCaptureMilitary(unitType) {
  const cls = UNIT_DEFS[unitType]?.cls;
  if (!['infantry', 'archer', 'cavalry'].includes(cls)) return false;
  // Great-house line and worker-style units can contest, but cannot directly flip enemy tiles.
  return !['axman', 'worker', 'laborer', 'architect', 'rangehand', 'surveyor', 'constable'].includes(unitType);
}

function applyTileControlAfterMove(tile, moverPlayer, moverType, tileSnapshot = tiles, unitSnapshot = units) {
  const wasEnemy = Boolean(tile.owner) && tile.owner !== moverPlayer;
  const upkeepRequired = Boolean(structureUpkeep[tile.type]);

  if (tile.owner === moverPlayer) {
    return { claimText: 'holding friendly territory' };
  }

  if (wasEnemy && !isDirectCaptureMilitary(moverType)) {
    tile.owner = null;
    return { claimText: `contested ${tile.type} and left it neutral (non-military capture rule)` };
  }

  if (!upkeepRequired) {
    tile.owner = moverPlayer;
    return { claimText: wasEnemy ? 'captured enemy territory' : 'claimed neutral tile' };
  }

  if (canClaimUpkeepTileNow(moverPlayer, tile.type, tileSnapshot, unitSnapshot)) {
    tile.owner = moverPlayer;
    return { claimText: wasEnemy ? 'captured enemy territory' : 'claimed neutral tile' };
  }

  tile.owner = null;
  return {
    claimText: wasEnemy
      ? `contested enemy tile and left it neutral (insufficient ${tile.type} upkeep stream)`
      : 'stood on neutral tile without claiming (insufficient upkeep stream)',
  };
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

function terrainClosedForPlayer(tile, player) {
  if (!tile) return true;
  if (tile.type === 'forest') return true;

  if (['town', 'city'].includes(tile.type)) {
    // Settlements are closed only when enemy-owned.
    return Boolean(tile.owner) && tile.owner !== player;
  }

  if (['outpost', 'stronghold', 'keep'].includes(tile.type)) {
    // Fortifications are open to their owner, closed otherwise.
    return tile.owner !== player;
  }

  return false;
}

function isTileClosedFor(player, key) {
  const tile = getTile(key);
  if (!tile) return true;
  if (terrainClosedForPlayer(tile, player)) return true;

  // Enemy strongholds and keeps close adjacent tiles.
  for (const nKey of adjacentKeys(key)) {
    const nTile = getTile(nKey);
    if (!nTile) continue;
    if (nTile.owner && nTile.owner !== player && ['stronghold', 'keep'].includes(nTile.type)) {
      return true;
    }
  }

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

function dynamicClosureOwnerFor(player, key) {
  const tile = getTile(key);
  if (!tile || tile.type === 'forest') return null;
  if (terrainClosedForPlayer(tile, player)) return null;

  for (const nKey of adjacentKeys(key)) {
    const nTile = getTile(nKey);
    if (!nTile) continue;
    if (nTile.owner && nTile.owner !== player && ['stronghold', 'keep'].includes(nTile.type)) {
      return nTile.owner;
    }
  }

  for (const nKey of adjacentKeys(key)) {
    const u = unitAtKey(nKey);
    if (u?.type === 'pikeman' && u.player !== player) return u.player;
  }

  for (const nKey of adjacentKeys(key)) {
    const spear = unitAtKey(nKey);
    if (!spear || spear.type !== 'spearman' || spear.player === player) continue;
    const friends = adjacentKeys(key)
      .map((k) => unitAtKey(k))
      .filter((u) => u && u.player === spear.player && isMeleeMilitary(u.type));
    if (friends.length >= 2) return spear.player;
  }

  return null;
}

function isTileDynamicallyClosedFor(player, key) {
  return Boolean(dynamicClosureOwnerFor(player, key));
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

function getLancerRouteMap(fromKey, unit) {
  const maxSteps = Math.max(1, unit.movesLeft);
  const startPlayer = unit.player;
  const queue = [{ key: fromKey, steps: 0, usedKill: false, path: [fromKey], defeatedKey: null }];
  const seen = new Set([`${fromKey}|0`]);
  const routes = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    for (const nextKey of adjacentKeys(current.key)) {
      const step = current.steps + 1;
      if (step > maxSteps) continue;

      if (isTileClosedFor(startPlayer, nextKey)) continue;

      const occ = unitAtKey(nextKey);
      const friendlyOcc = occ && occ.player === startPlayer;
      const hostileOcc = occ && occ.player !== startPlayer;

      if (friendlyOcc) continue;
      if (hostileOcc && current.usedKill) continue;

      const usedKill = current.usedKill || hostileOcc;
      const defeatedKey = hostileOcc ? nextKey : current.defeatedKey;
      const path = [...current.path, nextKey];
      const stateKey = `${nextKey}|${usedKill ? 1 : 0}`;

      if (!routes.has(nextKey) || step > (routes.get(nextKey)?.path?.length || 0) - 1) {
        routes.set(nextKey, { path, defeatedKey });
      }

      if (!seen.has(stateKey)) {
        seen.add(stateKey);
        queue.push({ key: nextKey, steps: step, usedKill, path, defeatedKey });
      }
    }
  }

  routes.delete(fromKey);
  return routes;
}

function getLancerMoveInfo(fromKey, toKey, unit = units.get(fromKey)) {
  if (!unit || unit.type !== 'lancer') return null;
  return getLancerRouteMap(fromKey, unit).get(toKey) || null;
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

  if (unit.type === 'lancer') {
    const info = getLancerMoveInfo(fromKey, toKey, unit);
    if (!info) return 'Move invalid: lancer destination is unreachable within 3 open tiles (with at most one pass-through attack).';
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

  if (unit.type === 'lancer') {
    if (!getLancerMoveInfo(fromKey, toKey, unit)) return false;
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

  // Rangehand can shoot only before moving.
  if (movedThisTurn && attacker.type === 'rangehand') return false;


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
  if (movedThisTurn && attacker.type === 'rangehand') return 'Attack invalid: rangehand cannot attack after moving.';
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
  startShotAnimation(fromKey, toKey, attacker.player);
  units.delete(toKey);
  attacker.actionsLeft -= 1;
  lastDebug = `Attack ok: ${attacker.type} shot ${target.type} at ${toKey}.`;
  return true;
}

function getMoveTargets(fromKey) {
  const unit = units.get(fromKey);
  if (!unit) return [];
  if (unit.type === 'lancer') return [...getLancerRouteMap(fromKey, unit).keys()];
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
    applyTileControlAfterMove(t, currentPlayer, srcUnit.type, tSnap, uSnap);
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

  let lancerMoveInfo = null;
  if (unit.type === 'lancer') lancerMoveInfo = getLancerMoveInfo(fromKey, toKey, unit);
  const lancerStepCost = unit.type === 'lancer'
    ? Math.max(1, (lancerMoveInfo?.path?.length || 2) - 1)
    : 1;
  const nextMoves = unit.type === 'lancer'
    ? Math.max(0, unit.movesLeft - lancerStepCost)
    : (isCavalry(unit.type) ? 0 : Math.max(0, unit.movesLeft - 1));
  const warning = moveEconomyWarning(fromKey, toKey, nextMoves);

  let defeated = units.get(toKey) && units.get(toKey).player !== unit.player;
  let passThroughDefeat = null;
  if (unit.type === 'lancer') {
    passThroughDefeat = lancerMoveInfo?.defeatedKey || null;
    if (passThroughDefeat && passThroughDefeat !== toKey) defeated = true;
  }

  // Movement never blocked by economy; shortages resolve on turn rollover.
  unit.movesLeft = nextMoves;
  if (defeated && ['crossbow', 'barrage_captain'].includes(unit.type)) unit.actionsLeft = Math.max(0, unit.actionsLeft - 1);
  if (passThroughDefeat) units.delete(passThroughDefeat);
  units.set(toKey, unit);
  units.delete(fromKey);
  startMoveAnimation(fromKey, toKey, unit);

  const { claimText } = applyTileControlAfterMove(destTile, currentPlayer, unit.type, tiles, units);
  const lancerKillText = passThroughDefeat ? ` pass-through eliminated enemy at ${passThroughDefeat}.` : '';

  lastDebug = `Move ok: ${unit.type} moved to ${toKey}, ${claimText}.${lancerKillText} ${warning}`.trim();
  revealExpandingTiles();
}

function upgradeTileAt(key, toType) {
  const tile = getTile(key);
  const unit = units.get(key);
  if (!tile || !unit) return false;
  if (unit.player !== currentPlayer || tile.owner !== currentPlayer) return false;
  if (!UNIT_DEFS[unit.type]?.terrainUpgrader) {
    lastDebug = `${unit.type} cannot upgrade terrain.`;
    return false;
  }
  if (unit.actionsLeft <= 0) {
    lastDebug = `${unit.type} has no actions left.`;
    return false;
  }

  if (!canSupportTileUpgrade(currentPlayer, tile.type, toType)) {
    lastDebug = `Upgrade blocked: ${toType} upkeep is not currently supportable.`;
    return false;
  }

  unit.actionsLeft -= 1;
  tile.type = toType;
  tile.symbols = buildSymbols(toType);
  lastDebug = `Upgrade ok: ${key} -> ${toType}.`;
  render();
  return true;
}

function upgradeSelectedTile(toType) {
  if (!selectedKey) return;
  upgradeTileAt(selectedKey, toType);
}

function canSupportUnitSpawn(player, unitType, key) {
  const eco = computeEconomy(player);
  const tile = getTile(key);
  if (!tile) return false;
  if (isUnitUpkeepFree(player, key, { player, type: unitType }, tiles)) return true;
  const need = unitUpkeep[unitType] || {};
  for (const [res, amt] of Object.entries(need)) {
    const afterUse = eco.used[res] + amt;
    if (eco.produced[res] < afterUse) return false;
  }
  return true;
}

function trainUnitAt(key, unitType) {
  const tile = getTile(key);
  if (!tile || tile.owner !== currentPlayer || units.get(key)) return false;

  if (!canSupportUnitSpawn(currentPlayer, unitType, key)) {
    lastDebug = `Training blocked: ${unitType} upkeep is not currently supportable.`;
    return false;
  }

  units.set(key, { player: currentPlayer, type: unitType, movesLeft: 0, actionsLeft: 0 });
  lastDebug = `Training ok: ${unitType} at ${key}.`;
  render();
  return true;
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
      <thead><tr><th style="text-align:left;">Resource</th><th>Produced / Used</th><th>Avail</th></tr></thead>
      <tbody>
        ${resourceKeys.map((k) => {
          const avail = eco.available[k];
          const availStyle = avail < 0 ? 'color:#ef4444;font-weight:700;text-align:center;' : 'text-align:center;';
          const isFocused = resourceFocus?.resource === k;
          const chipStyle = isFocused ? 'background:#334155;border-color:#94a3b8;' : 'background:transparent;border-color:#475569;';
          const divider = (k === 'provisions' || k === 'support') ? '<tr class="resource-row-divider"><td colspan="4"></td></tr>' : '';
          return `${divider}<tr>
            <td><button data-resource-toggle="${k}" class="resource-toggle-btn" style="border:1px solid;${chipStyle}color:#e2e8f0;border-radius:7px;padding:1px 6px;cursor:pointer;">${resourceEmojiWithMosaic(k)}</button> ${k}</td>
            <td data-resource-hover="${k}" data-resource-mode="produced" style="text-align:center;cursor:help;">${eco.produced[k]} / ${eco.used[k]}</td>
            <td style="${availStyle}">${avail}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:6px;font-size:12px;opacity:.85;">Click resource emoji to cycle production/usage highlights. Hover Produced/Used for temporary highlight.</div>
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


function formatCostChip(resource, amount, state = 'new') {
  const emoji = resourceEmoji[resource] || '•';
  return `<span class="cost-chip ${state}">${resourceEmojiWithMosaic(resource)} ${amount}</span>`;
}

function missingResourcesForUnitSpawn(player, unitType, key) {
  const tile = getTile(key);
  if (!tile) return new Set(Object.keys(unitUpkeep[unitType] || {}));
  if (isUnitUpkeepFree(player, key, { player, type: unitType }, tiles)) return new Set();
  const eco = computeEconomy(player);
  const missing = new Set();
  const need = unitUpkeep[unitType] || {};
  for (const [res, amt] of Object.entries(need)) {
    if ((eco.available[res] || 0) < amt) missing.add(res);
  }
  return missing;
}

function missingResourcesForTileUpgrade(player, fromType, toType) {
  const { produced, used } = computeEconomy(player);
  const fromNeed = structureUpkeep[fromType] || {};
  const toNeed = structureUpkeep[toType] || {};
  const missing = new Set();
  for (const [res, amt] of Object.entries(toNeed)) {
    const prior = fromNeed[res] || 0;
    const afterUse = (used[res] || 0) - prior + amt;
    if ((produced[res] || 0) < afterUse) missing.add(res);
  }
  return missing;
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
    for (const toType of next) {
      const toNeed = structureUpkeep[toType] || {};
      const fromNeed = structureUpkeep[tile.type] || {};
      const missing = missingResourcesForTileUpgrade(currentPlayer, tile.type, toType);
      const blocked = missing.size > 0;
      let costHtml = '<span class="action-costs">';
      for (const [res, amt] of Object.entries(toNeed)) {
        const prior = fromNeed[res] || 0;
        const isNew = amt > prior;
        const displayAmt = isNew ? (amt - prior) : amt;
        const state = missing.has(res) ? 'missing' : (isNew ? 'new' : 'existing');
        costHtml += formatCostChip(res, displayAmt, state);
      }
      costHtml += '</span>';
      const producedRes = productionByType[toType] || null;
      const producedBadge = producedRes ? resourceEmojiWithMosaic(producedRes) : "";
      html += `<button class="action-btn ${blocked ? 'blocked' : ''}" data-upgrade-terrain="${toType}" ${blocked ? 'disabled' : ''}>Upgrade Terrain → ${toType} ${producedBadge}${costHtml}</button>`;
      if (showActionHelp) {
        html += `<div class="action-help">${tileDescriptions[toType] || 'Upgrade terrain to unlock next-tier options.'}</div>`;
      }
    }
  }

  if (!unit && tile.owner === currentPlayer && TRAIN_AT[tile.type]?.length) {
    for (const ut of TRAIN_AT[tile.type]) {
      const missing = missingResourcesForUnitSpawn(currentPlayer, ut, selectedKey);
      const blocked = missing.size > 0 || !canSupportUnitSpawn(currentPlayer, ut, selectedKey);
      const cost = unitUpkeep[ut] || {};
      let costHtml = '<span class="action-costs">';
      for (const [res, amt] of Object.entries(cost)) {
        const state = missing.has(res) ? 'missing' : 'new';
        costHtml += formatCostChip(res, amt, state);
      }
      costHtml += '</span>';
      html += `<button class="action-btn ${blocked ? 'blocked' : ''}" data-train-unit="${ut}" ${blocked ? 'disabled' : ''}>Train ${(UNIT_DEFS[ut]?.emoji || '❓')} ${ut}${costHtml}</button>`;
      if (showActionHelp) {
        html += `<div class="action-help">${unitDescriptions[ut] || 'Trainable unit.'}</div>`;
      }
    }
  }

  if (unit && unit.player === currentPlayer) {
    const uOpts = UNIT_UPGRADE_OPTIONS[tile.type]?.[unit.type] || [];
    for (const newType of uOpts) {
      const blocked = !canSupportUnitUpgrade(currentPlayer, unit.type, newType, selectedKey);
      const cost = unitUpkeep[newType] || {};
      const prev = unitUpkeep[unit.type] || {};
      const missing = new Set();
      const eco = computeEconomy(currentPlayer);
      for (const [res, amt] of Object.entries(cost)) {
        const afterUse = (eco.used[res] || 0) - (prev[res] || 0) + amt;
        if ((eco.produced[res] || 0) < afterUse) missing.add(res);
      }
      let costHtml = '<span class="action-costs">';
      for (const [res, amt] of Object.entries(cost)) {
        const prior = prev[res] || 0;
        const isNew = amt > prior;
        const displayAmt = isNew ? (amt - prior) : amt;
        const state = missing.has(res) ? 'missing' : (isNew ? 'new' : 'existing');
        costHtml += formatCostChip(res, displayAmt, state);
      }
      costHtml += '</span>';
      html += `<button class="action-btn ${blocked ? 'blocked' : ''}" data-upgrade-unit="${newType}" ${blocked ? 'disabled' : ''}>Upgrade Unit → ${(UNIT_DEFS[newType]?.emoji || '❓')} ${newType}${costHtml}</button>`;
      if (showActionHelp) {
        html += `<div class="action-help">${unitDescriptions[newType] || 'Unit upgrade option.'}</div>`;
      }
    }
  }

  html += `<div style="margin-top:8px;font-size:12px;opacity:.9;white-space:pre-wrap;"><strong>Debug:</strong> ${lastDebug || '—'}</div>`;

  selectionEl.innerHTML = html;
  selectionEl.querySelectorAll('button[data-upgrade-terrain]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (requestOnlineAction({ type: 'upgrade-tile', key: selectedKey, toType: btn.dataset.upgradeTerrain })) return;
      upgradeSelectedTile(btn.dataset.upgradeTerrain);
      syncOnlineStateIfHost();
    });
  });
  selectionEl.querySelectorAll('button[data-train-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (requestOnlineAction({ type: 'train', key: selectedKey, unitType: btn.dataset.trainUnit })) return;
      trainUnitAt(selectedKey, btn.dataset.trainUnit);
      syncOnlineStateIfHost();
    });
  });
  selectionEl.querySelectorAll('button[data-upgrade-unit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (requestOnlineAction({ type: 'upgrade-unit', key: selectedKey, newType: btn.dataset.upgradeUnit })) return;
      upgradeUnitAt(selectedKey, btn.dataset.upgradeUnit);
      syncOnlineStateIfHost();
    });
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

  // Level lance, pointing right.
  drawSpear(g, pos.x - 15, pos.y - 2, pos.x + 15, pos.y - 2, 3.6);
  return g;
}

function renderSlingGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  // Ends close together at top; long hanging straps to cradle.
  path.setAttribute('d', `M ${pos.x - 1.6} ${pos.y - 13} C ${pos.x - 2.4} ${pos.y - 8}, ${pos.x - 4.8} ${pos.y - 3}, ${pos.x} ${pos.y + 2} C ${pos.x + 4.8} ${pos.y - 3}, ${pos.x + 2.4} ${pos.y - 8}, ${pos.x + 1.6} ${pos.y - 13}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#f8fafc');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  g.appendChild(path);

  const rock = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  rock.setAttribute('cx', String(pos.x));
  rock.setAttribute('cy', String(pos.y + 0.8));
  rock.setAttribute('r', '2.6');
  rock.setAttribute('fill', '#cbd5e1');
  rock.setAttribute('stroke', '#0f172a');
  rock.setAttribute('stroke-width', '1.1');
  g.appendChild(rock);
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

function renderRoyalKnightGlyph(pos) {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const horse = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  horse.setAttribute('x', String(pos.x));
  horse.setAttribute('y', String(pos.y + 2));
  horse.setAttribute('text-anchor', 'middle');
  horse.setAttribute('dominant-baseline', 'middle');
  horse.setAttribute('class', 'unit-icon');
  horse.textContent = '🐴';
  g.appendChild(horse);

  const crown = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  crown.setAttribute('x', String(pos.x + 1));
  crown.setAttribute('y', String(pos.y - 8));
  crown.setAttribute('text-anchor', 'middle');
  crown.setAttribute('dominant-baseline', 'middle');
  crown.setAttribute('class', 'unit-icon');
  crown.style.fontSize = '12px';
  crown.textContent = '👑';
  g.appendChild(crown);
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
  if (unit.type === 'royal_knight') {
    group.appendChild(renderRoyalKnightGlyph(pos));
    return;
  }
  if (unit.type === 'rangehand') {
    group.appendChild(renderSlingGlyph(pos));
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
  revealExpandingTiles();
  if (resourceHover) {
    const hoveredCell = document.querySelector('[data-resource-hover]:hover');
    if (!hoveredCell) resourceHover = null;
  }
  board.innerHTML = '';
  applyBoardZoom();
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();
  const activeFocus = resourceHover || resourceFocus;
  const focusedKeys = activeFocus ? getResourceContributors(currentPlayer, activeFocus.resource, activeFocus.mode) : null;

  const tileCenters = tiles.map((tile) => ({ tile, pos: axialToPixel(tile), poly: polygonVertices(axialToPixel(tile), HEX_RADIUS) }));
  const tileMap = new Map(tiles.map((t) => [keyOf(t), t]));

  if (tileCenters.length) {
    const pad = HEX_RADIUS * 2.2;
    const minX = Math.min(...tileCenters.map((tc) => tc.pos.x - HEX_RADIUS)) - pad;
    const maxX = Math.max(...tileCenters.map((tc) => tc.pos.x + HEX_RADIUS)) + pad;
    const minY = Math.min(...tileCenters.map((tc) => tc.pos.y - HEX_RADIUS)) - pad;
    const maxY = Math.max(...tileCenters.map((tc) => tc.pos.y + HEX_RADIUS)) + pad;
    boardViewMinX = Math.floor(minX);
    boardViewMinY = Math.floor(minY);
    boardBaseWidth = Math.max(800, Math.ceil(maxX - minX));
    boardBaseHeight = Math.max(700, Math.ceil(maxY - minY));
  }

  // Dominant-bleed mosaic with adjustable resolution.
  const mosaicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mosaicGroup.setAttribute('pointer-events', 'none');
  const edgeCutoff = (HEX_RADIUS * 1.2) ** 2;
  const fadeEnd = edgeCutoff * 1.18;

  const preset = ULTRA_MOSAIC;
  if (!preset.miniRadius) {
    for (const tc of tileCenters) {
      const solidPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      solidPoly.setAttribute('points', polygonPoints(tc.pos, HEX_RADIUS));
      solidPoly.setAttribute('fill', colorForTileShard(tc.tile, 1));
      solidPoly.setAttribute('stroke', 'none');
      mosaicGroup.appendChild(solidPoly);

      if (tc.tile.owner) {
        const accent = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        accent.setAttribute('points', polygonPoints(tc.pos, HEX_RADIUS * 0.36));
        accent.setAttribute('fill', accentColorForTileShard(tc.tile, 2) || '#ffffff');
        accent.setAttribute('stroke', 'none');
        accent.setAttribute('opacity', '0.95');
        mosaicGroup.appendChild(accent);
      }
    }
  } else {
    const miniRadius = preset.miniRadius;
    const minQ = Math.min(...tiles.map((t) => t.q));
    const maxQ = Math.max(...tiles.map((t) => t.q));
    const minR = Math.min(...tiles.map((t) => t.r));
    const maxR = Math.max(...tiles.map((t) => t.r));
    const pad = 8;
    const qStart = Math.floor((minQ - pad) * (HEX_RADIUS / miniRadius));
    const qEnd = Math.ceil((maxQ + pad) * (HEX_RADIUS / miniRadius));
    const rStart = Math.floor((minR - pad) * (HEX_RADIUS / miniRadius));
    const rEnd = Math.ceil((maxR + pad) * (HEX_RADIUS / miniRadius));

    const globalMini = [];
    for (let mq = qStart; mq <= qEnd; mq += 1) {
      for (let mr = rStart; mr <= rEnd; mr += 1) {
        const miniPos = axialToPixel({ q: mq, r: mr }, miniRadius);
        globalMini.push({ mq, mr, pos: miniPos, idx: ((mq - mr) % 3 + 3) % 3 });
      }
    }

    for (const mini of globalMini) {
      const nearTiles = [];
      let minDist = Infinity;
      for (const tc of tileCenters) {
        const dx = tc.pos.x - mini.pos.x;
        const dy = tc.pos.y - mini.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist) minDist = d2;
        if (d2 <= fadeEnd) nearTiles.push(tc);
      }
      if (!nearTiles.length || minDist > fadeEnd) continue;

      const centerHits = nearTiles.filter((tc) => pointInPolygon(mini.pos.x, mini.pos.y, tc.poly));
      const primaryTile = centerHits[0] || null;
      if (!primaryTile) continue;

      // Keep interiors pure (single parent tile color). Blend only at true cross-tile overlap.
      const samplePts = polygonVertices(mini.pos, miniRadius);
      const overlapCounts = new Map([[primaryTile, samplePts.length]]);
      let insideAnyCount = samplePts.length;

      for (const [sx, sy] of samplePts) {
        const hits = nearTiles.filter((tc) => pointInPolygon(sx, sy, tc.poly));
        if (!hits.length) {
          insideAnyCount -= 1;
          continue;
        }

        if (hits.some((tc) => tc !== primaryTile)) {
          overlapCounts.set(primaryTile, Math.max(0, (overlapCounts.get(primaryTile) || 0) - 1));
          for (const tc of hits) {
            overlapCounts.set(tc, (overlapCounts.get(tc) || 0) + 1);
          }
        }
      }

      const candidates = [...overlapCounts.entries()]
        .filter(([, count]) => count > 0)
        .map(([tc, count]) => ({ color: colorForTileShard(tc.tile, mini.idx), weight: count }));

      const overhang = Math.max(0, 1 - (insideAnyCount / samplePts.length));
      if (overhang > 0) {
        const bgWeight = 0.45 * (overhang ** 1.5);
        candidates.push({ color: '#0b1230', weight: bgWeight });
      }

      const miniPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      miniPoly.setAttribute('points', polygonPoints(mini.pos, miniRadius));
      miniPoly.setAttribute('fill', mixHexWeighted(candidates));
      miniPoly.setAttribute('stroke', 'none');
      mosaicGroup.appendChild(miniPoly);

      if (mini.idx === 2 && primaryTile.tile.owner) {
        const accent = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        accent.setAttribute('points', polygonPoints(mini.pos, miniRadius * 0.5));
        accent.setAttribute('fill', accentColorForTileShard(primaryTile.tile, 2) || '#ffffff');
        accent.setAttribute('stroke', 'none');
        accent.setAttribute('opacity', '0.95');
        mosaicGroup.appendChild(accent);
      }
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

    if (isTileDynamicallyClosedFor(currentPlayer, key)) {
      const threatOwner = dynamicClosureOwnerFor(currentPlayer, key);
      const xColor = ownerColor(threatOwner) || '#ef4444';
      const verts = polygonVertices(pos, HEX_RADIUS * 0.86);
      for (let i = 0; i < 6; i += 2) {
        const [x1, y1] = verts[i];
        const [x2, y2] = verts[(i + 1) % 6];
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const sz = 4.2;

        const a = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        a.setAttribute('x1', String(mx - sz));
        a.setAttribute('y1', String(my - sz));
        a.setAttribute('x2', String(mx + sz));
        a.setAttribute('y2', String(my + sz));
        a.setAttribute('stroke', xColor);
        a.setAttribute('stroke-width', '1.9');
        a.setAttribute('stroke-linecap', 'round');
        a.setAttribute('pointer-events', 'none');
        board.appendChild(a);

        const b = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        b.setAttribute('x1', String(mx + sz));
        b.setAttribute('y1', String(my - sz));
        b.setAttribute('x2', String(mx - sz));
        b.setAttribute('y2', String(my + sz));
        b.setAttribute('stroke', xColor);
        b.setAttribute('stroke-width', '1.9');
        b.setAttribute('stroke-linecap', 'round');
        b.setAttribute('pointer-events', 'none');
        board.appendChild(b);
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
      const greatHouseHead = ['manor', 'estate', 'palace'].includes(tile.type) && i === 0;
      if (houses.has(symbol) || greatHouseHead) {
        text.style.fontSize = '19.5px';
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
    const hasIncomingMoveAnim = activeAnimations.some((a) => a.type === 'move' && a.toKey === key && (a.t || 0) < 1);
    if (unit && !hasIncomingMoveAnim) {
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
      const moveColor = selected ? '#facc15' : '#ffffff';
      const actionColor = selected ? '#facc15' : '#ffffff';
      const spentColor = '#111111';
      const ringWidth = selected ? 4 : 2.5;
      const rr = 17;

      function addRingSegment(startDeg, endDeg, color) {
        const start = (Math.PI / 180) * startDeg;
        const end = (Math.PI / 180) * endDeg;
        const x1 = pos.x + rr * Math.cos(start);
        const y1 = pos.y + rr * Math.sin(start);
        const x2 = pos.x + rr * Math.cos(end);
        const y2 = pos.y + rr * Math.sin(end);
        const delta = ((endDeg - startDeg) % 360 + 360) % 360;
        const largeArc = delta > 180 ? 1 : 0;
        const sweep = 1;
        const arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arc.setAttribute('d', `M ${x1} ${y1} A ${rr} ${rr} 0 ${largeArc} ${sweep} ${x2} ${y2}`);
        arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', color);
        arc.setAttribute('stroke-width', String(ringWidth));
        arc.setAttribute('stroke-linecap', 'round');
        group.appendChild(arc);
      }

      const cls = UNIT_DEFS[unit.type]?.cls;
      if (cls === 'infantry' || cls === 'cavalry') {
        // Melee military uses a full white/black outline based only on movement readiness.
        const meleeReadyColor = (isCurrent && unit.movesLeft > 0) ? '#ffffff' : '#111111';
        const meleeRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        meleeRing.setAttribute('cx', String(pos.x));
        meleeRing.setAttribute('cy', String(pos.y));
        meleeRing.setAttribute('r', String(rr));
        meleeRing.setAttribute('fill', 'none');
        meleeRing.setAttribute('stroke', meleeReadyColor);
        meleeRing.setAttribute('stroke-width', String(ringWidth));
        group.appendChild(meleeRing);
      } else if (unit.type === 'surveyor') {
        // Top third = action, two bottom thirds = two movement steps.
        addRingSegment(-150, -30, isCurrent && unit.actionsLeft > 0 ? actionColor : spentColor);
        addRingSegment(-30, 90, isCurrent && unit.movesLeft >= 1 ? moveColor : spentColor);
        addRingSegment(90, 210, isCurrent && unit.movesLeft >= 2 ? moveColor : spentColor);
      } else if (unit.type === 'architect') {
        // Two top thirds = actions, bottom third = movement.
        addRingSegment(-150, -30, isCurrent && unit.actionsLeft >= 1 ? actionColor : spentColor);
        addRingSegment(-30, 90, isCurrent && unit.actionsLeft >= 2 ? actionColor : spentColor);
        addRingSegment(90, 210, isCurrent && unit.movesLeft > 0 ? moveColor : spentColor);
      } else {
        // Default split: top half action, bottom half movement.
        addRingSegment(180, 360, isCurrent && unit.actionsLeft > 0 ? actionColor : spentColor);
        addRingSegment(0, 180, isCurrent && unit.movesLeft > 0 ? moveColor : spentColor);
      }

      renderUnitGlyph(unit, pos, group);
      board.appendChild(group);
    }
  }

  for (const anim of activeAnimations) {
    const t = anim.t || 0;
    if (anim.type === 'move') {
      const ease = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
      const x = anim.from.x + (anim.to.x - anim.from.x) * ease;
      const y = anim.from.y + (anim.to.y - anim.from.y) * ease;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', String(x));
      ring.setAttribute('cy', String(y));
      ring.setAttribute('r', '17');
      ring.setAttribute('class', 'unit-ring');
      ring.setAttribute('fill', anim.unit.player === 'blue' ? '#2563eb' : '#dc2626');
      ring.style.stroke = '#ffffff';
      ring.style.strokeWidth = '2.4px';
      group.appendChild(ring);
      renderUnitGlyph(anim.unit, { x, y }, group);
      board.appendChild(group);
    }

    if (anim.type === 'shot') {
      const x = anim.from.x + (anim.to.x - anim.from.x) * t;
      const y = anim.from.y + (anim.to.y - anim.from.y) * t;
      const angle = Math.atan2(anim.to.y - anim.from.y, anim.to.x - anim.from.x);
      const len = 16;
      const tailX = x - Math.cos(angle) * len;
      const tailY = y - Math.sin(angle) * len;

      const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      shaft.setAttribute('x1', String(tailX));
      shaft.setAttribute('y1', String(tailY));
      shaft.setAttribute('x2', String(x));
      shaft.setAttribute('y2', String(y));
      shaft.setAttribute('stroke', '#f8fafc');
      shaft.setAttribute('stroke-width', '2.4');
      shaft.setAttribute('stroke-linecap', 'round');
      board.appendChild(shaft);

      const head = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const hx1 = x;
      const hy1 = y;
      const hx2 = x - Math.cos(angle - 0.35) * 7;
      const hy2 = y - Math.sin(angle - 0.35) * 7;
      const hx3 = x - Math.cos(angle + 0.35) * 7;
      const hy3 = y - Math.sin(angle + 0.35) * 7;
      head.setAttribute('points', `${hx1},${hy1} ${hx2},${hy2} ${hx3},${hy3}`);
      head.setAttribute('fill', '#f8fafc');
      board.appendChild(head);

      const f1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const f2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const fx = tailX;
      const fy = tailY;
      const fa = angle + Math.PI / 2;
      const fb = angle - Math.PI / 2;
      f1.setAttribute('x1', String(fx));
      f1.setAttribute('y1', String(fy));
      f1.setAttribute('x2', String(fx + Math.cos(fa) * 5));
      f1.setAttribute('y2', String(fy + Math.sin(fa) * 5));
      f2.setAttribute('x1', String(fx));
      f2.setAttribute('y1', String(fy));
      f2.setAttribute('x2', String(fx + Math.cos(fb) * 5));
      f2.setAttribute('y2', String(fy + Math.sin(fb) * 5));
      for (const f of [f1, f2]) {
        f.setAttribute('stroke', '#f8fafc');
        f.setAttribute('stroke-width', '2');
        f.setAttribute('stroke-linecap', 'round');
        board.appendChild(f);
      }
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

  const selectedUnit = selectedKey ? units.get(selectedKey) : null;
  const targetUnit = units.get(key);
  if (selectedKey && selectedUnit && targetUnit && targetUnit.player !== selectedUnit.player && isArcher(selectedUnit.type) && canRangedAttack(selectedKey, key)) {
    let useRanged = true;
    if (['crossbow', 'barrage_captain'].includes(selectedUnit.type) && canMove(selectedKey, key)) {
      useRanged = window.confirm('Use ranged attack?\nOK = ranged attack (stay in place)\nCancel = melee move-attack');
    }
    if (useRanged) {
      if (requestOnlineAction({ type: 'shoot', from: selectedKey, to: key })) return;
      rangedAttack(selectedKey, key);
      render();
      syncOnlineStateIfHost();
      return;
    }
  }

  if (selectedKey && canMove(selectedKey, key)) {
    if (requestOnlineAction({ type: 'move', from: selectedKey, to: key })) return;
    moveUnit(selectedKey, key);
    selectedKey = key;
    render();
    syncOnlineStateIfHost();
    return;
  }

  if (selectedKey && canRangedAttack(selectedKey, key)) {
    if (requestOnlineAction({ type: 'shoot', from: selectedKey, to: key })) return;
    rangedAttack(selectedKey, key);
    render();
    syncOnlineStateIfHost();
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
  syncOnlineStateIfHost();
});

endTurnBtn.addEventListener('click', () => {
  if (isOnlineGuest()) {
    requestOnlineAction({ type: 'end-turn' });
    return;
  }

  if (gameMode === 'easy-ai' && currentPlayer === 'red') {
    lastDebug = 'Wait for AI to complete its turn.';
    render();
    return;
  }

  const logs = gameMode === 'solo'
    ? [...enforceShortages('blue')]
    : [...enforceShortages('blue'), ...enforceShortages('red')];

  if (gameMode === 'easy-ai') {
    currentPlayer = 'red';
    resetTurnActions('red');
    selectedKey = null;
    lastDebug = 'AI is thinking...';
    render(logs);
    window.setTimeout(runEasyAiTurn, 180);
    return;
  }

  currentPlayer = gameMode === 'solo' ? 'blue' : (currentPlayer === 'blue' ? 'red' : 'blue');
  resetTurnActions(currentPlayer);
  revealExpandingTiles();
  selectedKey = null;
  lastDebug = 'Turn advanced. Economy table reflects continuous produced/used/available flow';
  render(logs);
  syncOnlineStateIfHost();
});

start1pBtn?.addEventListener('click', () => startGame('solo'));
start2pBtn?.addEventListener('click', () => startGame('duo'));
startEasyAiBtn?.addEventListener('click', () => startGame('easy-ai'));
startOnlineBtn?.addEventListener('click', () => {
  if (onlineConnectEl) onlineConnectEl.open = true;
  setOnlineStatus('Open handshake panel and start host/join flow.');
});
onlineHostOfferBtn?.addEventListener('click', () => hostCreateOffer().catch((e) => setOnlineStatus(`Host offer error: ${e.message}`)));
onlineJoinAnswerBtn?.addEventListener('click', () => joinCreateAnswer().catch((e) => setOnlineStatus(`Join answer error: ${e.message}`)));
onlineHostApplyAnswerBtn?.addEventListener('click', () => hostApplyAnswer().catch((e) => setOnlineStatus(`Apply answer error: ${e.message}`)));

zoomInBtn?.addEventListener('click', () => {
  boardZoom = Math.min(2.0, Number((boardZoom + 0.1).toFixed(2)));
  render();
});

zoomOutBtn?.addEventListener('click', () => {
  boardZoom = Math.max(0.5, Number((boardZoom - 0.1).toFixed(2)));
  render();
});

zoomResetBtn?.addEventListener('click', () => {
  boardZoom = 1;
  render();
});

helpToggleBtn?.addEventListener('click', () => {
  showActionHelp = !showActionHelp;
  helpToggleBtn.textContent = showActionHelp ? '❔ Help: On' : '❔ Help: Off';
  renderSelectionPanel();
});

primitivityIndexEl?.addEventListener('input', () => {
  applyPrimitivityIndex(primitivityIndexEl.value);
});


if (boardWrap) {
  boardWrap.addEventListener('mousedown', (event) => {
    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartScrollLeft = boardWrap.scrollLeft;
    panStartScrollTop = boardWrap.scrollTop;
    boardWrap.classList.add('panning');
  });

  window.addEventListener('mousemove', (event) => {
    if (!isPanning) return;
    const dx = event.clientX - panStartX;
    const dy = event.clientY - panStartY;
    boardWrap.scrollLeft = panStartScrollLeft - dx;
    boardWrap.scrollTop = panStartScrollTop - dy;
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
    boardWrap.classList.remove('panning');
  });

  boardWrap.addEventListener('mouseleave', () => {
    if (!isPanning) return;
    isPanning = false;
    boardWrap.classList.remove('panning');
  });
}

function initInstructionDiagrams() {
  const upkeepInfo = {
    forest: 'Produces wood. No structure upkeep.',
    pasture: 'Produces livestock. No structure upkeep.',
    farm: 'Produces crops. No structure upkeep.',
    homestead: 'Produces provisions. Gateway to 3 branches.',
    village: 'Upkeep: 1 wood.',
    town: 'Upkeep: 1 wood, 1 crops, 1 supplies.',
    city: 'Upkeep: 1 wood, 1 crops, 1 livestock, 1 supplies, 1 crafts.',
    manor: 'Upkeep: 1 supplies.',
    estate: 'Upkeep: 1 support, 1 supplies, 1 crafts.',
    palace: 'Upkeep: 1 authority, 1 support, 1 supplies, 1 crafts, 1 luxury.',
    outpost: 'Requires village support. Closed to enemies.',
    stronghold: 'Requires town support. Adjacent tiles closed to enemies.',
    keep: 'Requires city support. Adjacent military upkeep relief.',
  };
  document.querySelectorAll('[data-upkeep-target]').forEach((btn) => {
    const target = btn.getAttribute('data-upkeep-target');
    if (!btn.dataset.mosaicDecorated && tilePalettes[target]) {
      btn.dataset.mosaicDecorated = '1';
      const label = btn.textContent.trim();
      const palette = tilePalettes[target];
      btn.innerHTML = `<span class="diagram-tile-triangle" aria-hidden="true"><span style="background:${palette[0]}"></span><span style="background:${palette[1]}"></span><span style="background:${palette[2]}"></span></span><span class="diagram-label">${label}</span>`;
    }

    btn.addEventListener('click', () => {
      const panel = btn.closest('.progression-diagram')?.querySelector('.diagram-info');
      if (panel) panel.textContent = upkeepInfo[target] || 'No data.';
    });
  });
}

initInstructionDiagrams();
render();
