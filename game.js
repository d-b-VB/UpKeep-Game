const board = document.getElementById('hex-board');
const statusText = document.getElementById('status');
const resourcesEl = document.getElementById('resources');
const selectionEl = document.getElementById('selection');
const endTurnBtn = document.getElementById('end-turn');

const HEX_RADIUS = 42;
const MINI_RADIUS = 8;
const ORIGIN = { x: 980, y: 860 };
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const MAP_RADIUS = 6; // 127 tiles

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
  architect: { emoji: '🧱', cls: 'worker', terrainUpgrader: true },
  rangehand: { emoji: '🪃', cls: 'defworker', terrainUpgrader: true },
  surveyor: { emoji: '📐', cls: 'defworker', terrainUpgrader: true },
  constable: { emoji: '🪪', cls: 'defworker', terrainUpgrader: true },

  spearman: { emoji: 'spear', cls: 'infantry', terrainUpgrader: false },
  swordsman: { emoji: '⚔️', cls: 'infantry', terrainUpgrader: false },
  pikeman: { emoji: 'spear', cls: 'infantry', terrainUpgrader: false },
  infantry_sergeant: { emoji: '🛡️', cls: 'infantry', terrainUpgrader: false },

  hunter: { emoji: '🏹', cls: 'archer', terrainUpgrader: true },
  longbow: { emoji: '🏹', cls: 'archer', terrainUpgrader: true },
  crossbow: { emoji: '🏹', cls: 'archer', terrainUpgrader: true },
  barrage_captain: { emoji: '🎖️', cls: 'archer', terrainUpgrader: true },
  slinger: { emoji: '🪃', cls: 'defworker', terrainUpgrader: true }, // alias of rangehand

  horseman: { emoji: '🐎', cls: 'cavalry', terrainUpgrader: false },
  lancer: { emoji: '🗡️', cls: 'cavalry', terrainUpgrader: false },
  cavalry_archer: { emoji: '🐎🏹', cls: 'cavalry', terrainUpgrader: false },
  royal_knight: { emoji: '🐴👑', cls: 'cavalry', terrainUpgrader: false },
};

const unitUpkeep = {
  worker: { crops: 1 }, laborer: { crops: 1 }, axman: { provisions: 1 }, rangehand: { crops: 1 }, surveyor: { crops: 1, livestock: 1 },
  constable: { support: 1 }, architect: { crops: 1 },
  spearman: { crops: 1 }, swordsman: { crops: 1 }, pikeman: { crops: 1 }, infantry_sergeant: { support: 1 },
  hunter: { crops: 1, wood: 1 }, longbow: { wood: 1 }, crossbow: { wood: 1, crops: 1 }, barrage_captain: { authority: 1 }, slinger: { crops: 1 },
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

const resourceKeys = ['crops', 'wood', 'livestock', 'provisions', 'supplies', 'crafts', 'luxury', 'support', 'authority', 'sovereignty'];

const resourceEmoji = {
  crops: '🌾', wood: '🪵', livestock: '🐑', provisions: '🥕', supplies: '📦',
  crafts: '🛠️', luxury: '💎', support: '🤝', authority: '⚖️', sovereignty: '👑',
};

function keyOf(cell) { return `${cell.q},${cell.r}`; }
function randomType() { return weightedTypes[Math.floor(Math.random() * weightedTypes.length)]; }
function ownerColor(player) { return player === 'blue' ? '#3b82f6' : player === 'red' ? '#ef4444' : null; }
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

function cubeDistance(a, b) {
  const aq = a.q; const ar = a.r; const as = -aq - ar;
  const bq = b.q; const br = b.r; const bs = -bq - br;
  return Math.max(Math.abs(aq - bq), Math.abs(ar - br), Math.abs(as - bs));
}

const cells = buildRadiusCells(MAP_RADIUS);
const cellKeys = new Set(cells.map(keyOf));
const tiles = cells.map((cell) => {
  const type = randomType();
  return { ...cell, type, owner: null, symbols: buildSymbols(type) };
});
const units = new Map();

function placeStart(q, r, player) {
  const tile = tiles.find((t) => t.q === q && t.r === r);
  if (!tile) return;
  tile.type = 'homestead';
  tile.owner = player;
  tile.symbols = buildSymbols('homestead');
  units.set(`${q},${r}`, { player, type: 'axman', movesLeft: 1, actionsLeft: 1 });
}
placeStart(-MAP_RADIUS, MAP_RADIUS, 'blue');
placeStart(MAP_RADIUS, -MAP_RADIUS, 'red');

let currentPlayer = 'blue';
let selectedKey = null;
let lastDebug = '';

function getTile(key) { return tiles.find((t) => keyOf(t) === key); }
function getCellByKey(key) { const [q, r] = key.split(',').map(Number); return { q, r }; }
function isAdjacent(a, b) { return DIRECTIONS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r); }

function computeEconomy(player, tileSnapshot = tiles, unitSnapshot = units) {
  const produced = Object.fromEntries(resourceKeys.map((k) => [k, 0]));
  const used = Object.fromEntries(resourceKeys.map((k) => [k, 0]));

  for (const tile of tileSnapshot) {
    if (tile.owner !== player) continue;

    const prodKey = productionByType[tile.type];
    if (prodKey) produced[prodKey] += 1;

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
      unit.actionsLeft = 1;
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
  // Spears/pikes/lances may be used while LEAVING closed spaces (per updated rule).
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
      if (occ && occ.player === startPlayer) continue;

      const nextClosed = isTileClosedFor(startPlayer, nextKey);

      // You may pass THROUGH open tiles only.
      const canPass = !nextClosed && !occ;
      const canStop = true; // can end in open or closed, with or without enemy

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

function explainMoveFailure(fromKey, toKey) {
  if (!cellKeys.has(fromKey) || !cellKeys.has(toKey)) return 'Move invalid: out of map bounds.';
  if (fromKey === toKey) return 'Move invalid: source and destination are the same tile.';

  const unit = units.get(fromKey);
  if (!unit) return 'Move invalid: no unit selected on source tile.';
  if (unit.player !== currentPlayer) return `Move invalid: it is ${currentPlayer}'s turn.`;
  if (unit.movesLeft <= 0) return 'Move invalid: unit has no moves left this turn.';

  if (isCavalry(unit.type)) {
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

  if (isCavalry(unit.type)) {
    const targets = getCavalryDestinations(fromKey, unit);
    if (!targets.has(toKey)) return false;
  } else {
    const from = getCellByKey(fromKey);
    const to = getCellByKey(toKey);
    if (!isAdjacent(from, to)) return false;
  }

  if (destinationUnit && destinationUnit.player !== unit.player) {
    if (['spearman', 'pikeman', 'lancer'].includes(unit.type) && isTileClosedFor(unit.player, toKey)) return false;
  }

  return true;
}

function getTargets(fromKey) {
  const unit = units.get(fromKey);
  if (!unit) return [];
  if (isCavalry(unit.type)) return [...getCavalryDestinations(fromKey, unit)];
  return cells.map(keyOf).filter((toKey) => canMove(fromKey, toKey));
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
    if (beforeOwner === currentPlayer || beforeOwner == null) {
      t.owner = currentPlayer;
    } else {
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

  const nextMoves = isCavalry(unit.type) ? 0 : unit.movesLeft - 1;
  const priorOwner = destTile.owner;
  const warning = moveEconomyWarning(fromKey, toKey, nextMoves);

  // Movement never blocked by economy; shortages resolve on turn rollover.
  unit.movesLeft = nextMoves;
  units.set(toKey, unit);
  units.delete(fromKey);

  let claimText = '';
  if (priorOwner === currentPlayer) {
    claimText = 'holding friendly territory';
  } else if (priorOwner === null) {
    destTile.owner = currentPlayer;
    if (economyDeficits(currentPlayer).length > 0) {
      // Optional claim fallback for risky land.
      destTile.owner = null;
      claimText = 'stood on neutral tile without claiming (would create shortage)';
    } else {
      claimText = 'claimed neutral tile';
    }
  } else {
    // Stepping onto enemy territory captures it unless that would cause shortage; then neutralize it.
    destTile.owner = currentPlayer;
    if (economyDeficits(currentPlayer).length > 0) {
      destTile.owner = null;
      claimText = `contested enemy tile and left it neutral (claim would create shortage)`;
    } else {
      claimText = `captured ${priorOwner} territory`;
    }
  }

  lastDebug = `Move ok: ${unit.type} moved to ${toKey}, ${claimText}. ${warning}`.trim();
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

  if (!isActionSustainable(currentPlayer, (tSnap, uSnap) => {
    const t = tSnap.find((x) => keyOf(x) === selectedKey);
    if (t) t.type = toType;
    const u = uSnap.get(selectedKey);
    if (u) u.actionsLeft -= 1;
  })) {
    lastDebug = `Upgrade blocked: would create shortage for ${currentPlayer}.`;
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

  if (!isActionSustainable(currentPlayer, (_tSnap, uSnap) => {
    const u = uSnap.get(key);
    if (!u) return;
    u.type = newType;
    u.actionsLeft -= 1;
  })) {
    lastDebug = `Unit upgrade blocked: ${newType} would create shortage for ${currentPlayer}.`;
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
          return `<tr><td>${resourceEmoji[k] || ''} ${k}</td><td style="text-align:center;">${eco.produced[k]}</td><td style="text-align:center;">${eco.used[k]}</td><td style="${availStyle}">${avail}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:6px;font-size:12px;opacity:.85;">Continuous model: produced and used every turn; negative values are shortages (red).</div>
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
  statusText.textContent = `${unit.player.toUpperCase()} ${unit.type} selected. ${getTargets(selectedKey).length} legal moves. M:${unit.movesLeft} A:${unit.actionsLeft}. ${lastDebug || ''}`;
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

function renderUnitGlyph(unit, pos, group) {
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
  board.innerHTML = '';
  const targets = selectedKey ? new Set(getTargets(selectedKey)) : new Set();

  const globalMini = [];
  for (let mq = -86; mq <= 86; mq += 1) {
    for (let mr = -86; mr <= 86; mr += 1) {
      const miniPos = axialToPixel({ q: mq, r: mr }, MINI_RADIUS);
      globalMini.push({ mq, mr, pos: miniPos, idx: ((mq - mr) % 3 + 3) % 3 });
    }
  }

  const tileCenters = tiles.map((tile) => ({ tile, pos: axialToPixel(tile) }));
  const tileMap = new Map(tiles.map((t) => [keyOf(t), t]));

  // Dominant-bleed mosaic with map-edge cutoff: skip mini hexes too far from any map tile center.
  const mosaicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mosaicGroup.setAttribute('pointer-events', 'none');
  const edgeCutoff = (HEX_RADIUS * 1.2) ** 2;

  for (const mini of globalMini) {
    let best = null;
    let bestDist = Infinity;
    for (const tc of tileCenters) {
      const dx = tc.pos.x - mini.pos.x;
      const dy = tc.pos.y - mini.pos.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = tc.tile;
      }
    }
    if (!best || bestDist > edgeCutoff) continue;

    const ownerTint = ownerColor(best.owner);
    const miniPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    miniPoly.setAttribute('points', polygonPoints(mini.pos, MINI_RADIUS));
    const baseColor = tilePalettes[best.type][mini.idx] || '#888';
    miniPoly.setAttribute('fill', ownerTint && mini.idx === 2 ? ownerTint : baseColor);
    miniPoly.setAttribute('stroke', 'none');
    mosaicGroup.appendChild(miniPoly);
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

  if (selectedKey && !canMove(selectedKey, key) && units.get(selectedKey)) {
    lastDebug = explainMoveFailure(selectedKey, key);
  }

  selectedKey = (clickedUnit || getTile(key)) ? key : null;
  render();
});

endTurnBtn.addEventListener('click', () => {
  const logs = [...enforceShortages('blue'), ...enforceShortages('red')];
  currentPlayer = currentPlayer === 'blue' ? 'red' : 'blue';
  resetTurnActions(currentPlayer);
  selectedKey = null;
  lastDebug = 'Turn advanced. Economy table reflects continuous produced/used/available flow.';
  render(logs);
});

resetTurnActions('blue');
resetTurnActions('red');
render();
