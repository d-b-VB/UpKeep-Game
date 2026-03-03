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

  function tileByKey(tiles) {
    const m = new Map();
    for (const t of tiles) m.set(t.key, t);
    return m;
  }

  function unitByKey(units) {
    const m = new Map();
    for (const u of units) m.set(u.key, u);
    return m;
  }

  function unitClass(state, type) {
    return state.unitDefs?.[type]?.cls || '';
  }

  function isLongWeapon(type) {
    return ['spearman', 'pikeman', 'lancer', 'longbow'].includes(type);
  }

  function prefersClosed(type) {
    return ['swordsman', 'infantry_sergeant', 'axman', 'worker', 'laborer', 'architect'].includes(type);
  }

  function pickTargetResource(state) {
    const order = state.resourceOrder || [];
    const avail = state.eco?.available || {};
    if (!order.length) return 'wood';

    // Maintain descending ladder: wood > livestock > crops > provisions > ...
    for (let i = 0; i < order.length - 1; i += 1) {
      const upper = Number(avail[order[i]] || 0);
      const lower = Number(avail[order[i + 1]] || 0);
      if (upper <= lower) return order[i];
    }

    const core = order.slice(0, 4);
    let target = core[0] || order[0];
    let best = Number.POSITIVE_INFINITY;
    for (const r of core) {
      const v = Number(avail[r] || 0);
      if (v < best) {
        best = v;
        target = r;
      }
    }
    return target;
  }

  function buildResourceBalancePlan(state) {
    const order = state.resourceOrder || [];
    const avail = state.eco?.available || {};
    const strongUpgradeFrom = new Set();
    const mildCaptureTargets = new Set();

    for (let i = 0; i < order.length - 1; i += 1) {
      const upperRes = order[i];
      const lowerRes = order[i + 1];
      const upper = Number(avail[upperRes] || 0);
      const lower = Number(avail[lowerRes] || 0);
      const hasGap = upper >= lower + 2;
      const strongGap = hasGap && upper >= 2 * Math.max(1, lower);

      if (strongGap) strongUpgradeFrom.add(upperRes);
      else if (hasGap) mildCaptureTargets.add(lowerRes);
    }

    return { strongUpgradeFrom, mildCaptureTargets };
  }

  function chooseUpgradeCandidates(state, targetResource, balancePlan) {
    const upgrades = state.legalTileUpgrades || [];
    const toPriority = { city: 10, town: 8, village: 6, palace: 5, estate: 4, manor: 3, keep: 4, stronghold: 3, outpost: 2 };
    const avail = state.eco?.available || {};
    const prodBy = state.productionByType || {};

    return upgrades
      .filter((u) => {
        const fromRes = prodBy[u.fromType];
        // Don't burn through a producer chain if we'd drop it below 2 available.
        if (!fromRes) return true;
        return Number(avail[fromRes] || 0) >= 2;
      })
      .map((u) => {
        const produced = prodBy[u.toType];
        let score = (toPriority[u.toType] || 0)
          + (produced === targetResource ? 12 : 0)
          + (u.toType === 'village' ? 2 : 0)
          + (u.toType === 'town' ? 3 : 0)
          + (u.toType === 'city' ? 4 : 0);

        const fromRes = prodBy[u.fromType];
        if (fromRes && Number(avail[fromRes] || 0) <= 2) score -= 20;
        if (fromRes && balancePlan?.strongUpgradeFrom?.has(fromRes)) score += 24;
        score += Math.random() * 1.2;
        return { type: 'upgrade-tile', key: u.key, toType: u.toType, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  function chooseTrainCandidates(state, targetResource) {
    const trains = state.legalTrains || [];
    if (!trains.length) return [];

    const rank = { homestead: 1, village: 2, town: 3, city: 4, manor: 2, estate: 3, palace: 4, outpost: 2, stronghold: 3, keep: 4 };
    const resourceAvail = state.eco?.available || {};
    const wood = resourceAvail.wood || 0;
    const livestock = resourceAvail.livestock || 0;
    const crops = resourceAvail.crops || 0;

    let soldierFocus = 'infantry';
    if (wood >= livestock && wood >= crops) soldierFocus = 'archer';
    else if (livestock >= wood && livestock >= crops) soldierFocus = 'cavalry';

    const owned = (state.tiles || []).filter((t) => t.owner === 'red');
    const upgradableOwned = owned.filter((t) => (state.upgradePaths?.[t.type] || []).length > 0).length;
    const workers = (state.units || []).filter((u) => ['worker', 'defworker'].includes(unitClass(state, u.type))).length;
    const homesteads = owned.filter((t) => t.type === 'homestead').length;
    const axmen = (state.units || []).filter((u) => u.player === 'red' && u.type === 'axman').length;
    const targetAxmen = homesteads >= 1 ? Math.max(1, homesteads - 1) : 0;
    const needWorkers = upgradableOwned > (workers * 1.6 + 1);

    return trains.filter((t) => {
      if (t.unitType !== 'axman') return true;
      return axmen < targetAxmen;
    }).map((t) => {
      const cls = unitClass(state, t.unitType);
      const isWorker = cls === 'worker' || cls === 'defworker';
      const isSoldier = ['infantry', 'archer', 'cavalry'].includes(cls);

      let score = (rank[t.tileType] || 0) * 8;
      score += (rank[t.tileType] >= 3 ? 8 : 0); // most advanced settlements first

      if (needWorkers) score += isWorker ? 12 : -4;
      else score += isSoldier ? 8 : -2;

      if (!needWorkers && isSoldier && cls === soldierFocus) score += 8;
      if (t.unitType === 'axman') score += axmen < targetAxmen ? 6 : -22;

      // if target resource is weak, prefer unit classes that don't lean on weak resources
      if (targetResource === 'wood' && cls === 'archer') score += 2;
      if (targetResource === 'livestock' && cls === 'cavalry') score += 2;
      if (targetResource === 'crops' && cls === 'infantry') score += 2;

      score += Math.random() * 2;
      return { type: 'train', key: t.key, unitType: t.unitType, score };
    }).sort((a, b) => b.score - a.score);
  }

  function scoreMove(unit, fromKey, toKey, state, targetResource, tileMap, unitMap, balancePlan) {
    const toTile = tileMap.get(toKey);
    const fromCell = keyToCell(fromKey);
    const toCell = keyToCell(toKey);
    const cls = unitClass(state, unit.type);
    const prod = state.productionByType?.[toTile?.type || ''];
    const friendlyAdj = (state.cells || []).filter((c) => {
      const k = `${c.q},${c.r}`;
      if (cubeDistance(c, toCell) !== 1) return false;
      const u = unitMap.get(k);
      return u && u.player === 'red';
    }).length;

    let score = 0;
    if (toTile?.owner === 'blue') score += 14;
    else if (!toTile?.owner) score += 6;

    if (prod === targetResource) score += 10;
    if (prod && balancePlan?.mildCaptureTargets?.has(prod)) score += 7;

    // stay grouped
    score += friendlyAdj * 2.5;

    const closed = Boolean(toTile && state.closedTiles?.[toKey]);
    if ((cls === 'cavalry' || isLongWeapon(unit.type)) && closed) score -= 8;
    if (prefersClosed(unit.type) && closed) score += 4;

    score += Math.max(0, 4 - cubeDistance(fromCell, toCell));
    score += Math.random() * 1.5;
    return score;
  }

  function chooseMoveCandidates(state, targetResource, balancePlan) {
    const tileMap = tileByKey(state.tiles || []);
    const unitMap = unitByKey(state.units || []);
    const out = [];

    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const moves = state.legalMovesByUnit?.[unit.key] || [];
      for (const toKey of moves) {
        const score = scoreMove(unit, unit.key, toKey, state, targetResource, tileMap, unitMap, balancePlan);
        out.push({ type: 'move', from: unit.key, to: toKey, score });
      }
    }

    return out.sort((a, b) => b.score - a.score);
  }

  function chooseShotCandidates(state) {
    const out = [];
    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const shots = state.legalShotsByUnit?.[unit.key] || [];
      for (const to of shots) out.push({ type: 'shoot', from: unit.key, to, score: 1 + Math.random() });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function chooseCandidates(state) {
    if (!state || state.currentPlayer !== 'red') return [];
    const targetResource = pickTargetResource(state);
    const balancePlan = buildResourceBalancePlan(state);

    return [
      ...chooseTrainCandidates(state, targetResource),
      ...chooseMoveCandidates(state, targetResource, balancePlan),
      ...chooseUpgradeCandidates(state, targetResource, balancePlan),
      ...chooseShotCandidates(state),
    ];
  }

  function chooseAction(state) {
    const candidates = chooseCandidates(state);
    return candidates.length ? candidates[0] : null;
  }

  globalScope.UpKeepEasyAI = { chooseAction, chooseCandidates };
}(window));
