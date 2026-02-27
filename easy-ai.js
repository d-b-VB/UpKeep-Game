(function initEasyAI(globalScope) {
  function keyToCell(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  function cubeDistance(a, b) {
    const as = -a.q - a.r;
    const bs = -b.q - b.r;
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(as - bs));
  }

  function tileOwnerByKey(tiles) {
    const m = new Map();
    for (const t of tiles) m.set(t.key, t.owner);
    return m;
  }

  function unitByKey(units) {
    const m = new Map();
    for (const u of units) m.set(u.key, u);
    return m;
  }

  function scoreDestination(fromKey, toKey, state, unitMap, ownerMap) {
    const fromCell = keyToCell(fromKey);
    const toCell = keyToCell(toKey);
    let score = 0;

    const defender = unitMap.get(toKey);
    if (defender && defender.player !== 'red') score += 30;

    const owner = ownerMap.get(toKey);
    if (owner === 'blue') score += 16;
    else if (owner === null || owner === undefined) score += 7;

    let nearestBlue = 999;
    for (const unit of state.units) {
      if (unit.player !== 'blue') continue;
      nearestBlue = Math.min(nearestBlue, cubeDistance(toCell, keyToCell(unit.key)));
    }
    if (nearestBlue < 999) score += (8 - Math.min(8, nearestBlue));

    score += Math.min(3, cubeDistance(fromCell, toCell));
    return score;
  }

  function chooseBestTrain(state) {
    const trains = state.legalTrains || [];
    if (!trains.length) return null;
    const priority = {
      homestead: 10,
      village: 9,
      town: 8,
      city: 7,
      manor: 6,
      estate: 5,
      outpost: 6,
      stronghold: 5,
      keep: 4,
      palace: 4,
    };

    const best = [...trains].sort((a, b) => {
      const pa = priority[a.tileType] || 0;
      const pb = priority[b.tileType] || 0;
      if (pa !== pb) return pb - pa;
      return a.unitType.localeCompare(b.unitType);
    })[0];

    return { type: 'train', key: best.key, unitType: best.unitType };
  }

  function chooseBestUpgrade(state) {
    const upgrades = state.legalTileUpgrades || [];
    if (!upgrades.length) return null;

    const weight = {
      forest: 2,
      pasture: 2,
      farm: 3,
      homestead: 4,
      village: 6,
      town: 7,
      manor: 6,
      estate: 7,
      outpost: 5,
      stronghold: 6,
    };

    const best = [...upgrades].sort((a, b) => {
      const wa = (weight[a.toType] || 0) - (weight[a.fromType] || 0);
      const wb = (weight[b.toType] || 0) - (weight[b.fromType] || 0);
      if (wa !== wb) return wb - wa;
      return a.toType.localeCompare(b.toType);
    })[0];

    return { type: 'upgrade-tile', key: best.key, toType: best.toType };
  }

  function chooseAction(state) {
    if (!state || state.currentPlayer !== 'red') return null;

    const ownerMap = tileOwnerByKey(state.tiles || []);
    const unitMap = unitByKey(state.units || []);

    const moveActions = [];
    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const moves = (state.legalMovesByUnit && state.legalMovesByUnit[unit.key]) || [];
      for (const toKey of moves) {
        const s = scoreDestination(unit.key, toKey, state, unitMap, ownerMap);
        moveActions.push({ type: 'move', from: unit.key, to: toKey, score: s });
      }
    }

    moveActions.sort((a, b) => b.score - a.score);
    if (moveActions.length) return moveActions[0];

    const trainAction = chooseBestTrain(state);
    if (trainAction) return trainAction;

    const upgradeAction = chooseBestUpgrade(state);
    if (upgradeAction) return upgradeAction;

    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const shots = (state.legalShotsByUnit && state.legalShotsByUnit[unit.key]) || [];
      if (shots.length) return { type: 'shoot', from: unit.key, to: shots[0] };
    }

    return null;
  }

  globalScope.UpKeepEasyAI = { chooseAction };
}(window));
