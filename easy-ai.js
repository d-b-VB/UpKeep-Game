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

<<<<<<< codex/create-simple-browser-based-hex-game-demo-t50bsc
  function chooseTrainCandidates(state) {
    const trains = state.legalTrains || [];
    if (!trains.length) return [];

    const tilePriority = {
      city: 12,
      town: 11,
      village: 10,
      estate: 7,
      manor: 6,
      stronghold: 5,
      outpost: 4,
      palace: 3,
      keep: 2,
      homestead: 1,
    };

    const unitPenalty = {
      axman: -6,
      worker: 2,
      laborer: 2,
      spearman: 1,
      hunter: 2,
      swordsman: 2,
      horseman: 1,
      architect: 2,
      pikeman: 1,
      lancer: 1,
      longbow: 2,
      constable: 1,
      rangehand: 1,
      surveyor: 1,
      infantry_sergeant: 1,
      barrage_captain: 1,
      royal_knight: 1,
    };

    const redAxmen = (state.units || []).filter((u) => u.player === 'red' && u.type === 'axman').length;

    return trains
      .map((t) => ({
        type: 'train',
        key: t.key,
        unitType: t.unitType,
        score: (tilePriority[t.tileType] || 0) + (unitPenalty[t.unitType] || 0) - (t.unitType === 'axman' ? redAxmen : 0),
      }))
      .sort((a, b) => b.score - a.score);
  }

  function chooseUpgradeCandidates(state) {
    const upgrades = state.legalTileUpgrades || [];
    if (!upgrades.length) return [];

    const toPriority = {
      city: 16,
      town: 13,
      village: 10,
      palace: 8,
      estate: 7,
      manor: 6,
      keep: 6,
      stronghold: 5,
      outpost: 4,
      homestead: 3,
      farm: 2,
      pasture: 1,
    };

    return upgrades
      .map((u) => ({
        type: 'upgrade-tile',
        key: u.key,
        toType: u.toType,
        score: (toPriority[u.toType] || 0) + (u.toType === 'village' ? 2 : 0) + (u.toType === 'town' ? 3 : 0) + (u.toType === 'city' ? 4 : 0),
      }))
      .sort((a, b) => b.score - a.score);
  }

  function chooseMoveCandidates(state) {
    const ownerMap = tileOwnerByKey(state.tiles || []);
    const unitMap = unitByKey(state.units || []);
    const moveActions = [];

=======
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
>>>>>>> main
    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const moves = (state.legalMovesByUnit && state.legalMovesByUnit[unit.key]) || [];
      for (const toKey of moves) {
        const s = scoreDestination(unit.key, toKey, state, unitMap, ownerMap);
        moveActions.push({ type: 'move', from: unit.key, to: toKey, score: s });
      }
    }

    moveActions.sort((a, b) => b.score - a.score);
<<<<<<< codex/create-simple-browser-based-hex-game-demo-t50bsc
    return moveActions;
  }

  function chooseShotCandidates(state) {
    const out = [];
    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const shots = (state.legalShotsByUnit && state.legalShotsByUnit[unit.key]) || [];
      for (const to of shots) out.push({ type: 'shoot', from: unit.key, to, score: 1 });
    }
    return out;
  }

  function chooseCandidates(state) {
    if (!state || state.currentPlayer !== 'red') return [];

    // Prioritize growth first, then force-preserving movement, then ranged picks.
    return [
      ...chooseUpgradeCandidates(state),
      ...chooseTrainCandidates(state),
      ...chooseMoveCandidates(state),
      ...chooseShotCandidates(state),
    ];
  }

  function chooseAction(state) {
    const candidates = chooseCandidates(state);
    return candidates.length ? candidates[0] : null;
  }

  globalScope.UpKeepEasyAI = { chooseAction, chooseCandidates };
=======
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
>>>>>>> main
}(window));
