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
    const avoidCaptureFrom = new Set();

    for (let i = 0; i < order.length - 1; i += 1) {
      const upperRes = order[i];
      const lowerRes = order[i + 1];
      const upper = Number(avail[upperRes] || 0);
      const lower = Number(avail[lowerRes] || 0);
      const hasGap = upper >= lower + 2;
      const strongGap = hasGap && upper >= 2 * Math.max(1, lower);

      if (strongGap) {
        strongUpgradeFrom.add(upperRes);
        avoidCaptureFrom.add(upperRes);
      } else if (hasGap) {
        mildCaptureTargets.add(lowerRes);
      }
    }

    return { strongUpgradeFrom, mildCaptureTargets, avoidCaptureFrom };
  }

  function isWorkerClass(cls) {
    return cls === 'worker' || cls === 'defworker';
  }

  function strategicContext(state) {
    const tiles = state.tiles || [];
    const units = state.units || [];
    const ownedTiles = tiles.filter((t) => t.owner === 'red');
    const redUnits = units.filter((u) => u.player === 'red');
    const blueUnits = units.filter((u) => u.player === 'blue');
    const workers = redUnits.filter((u) => isWorkerClass(unitClass(state, u.type)));
    const workerCount = workers.length;

    let frontlineThreat = 0;
    for (const ru of redUnits) {
      const a = keyToCell(ru.key);
      for (const bu of blueUnits) {
        if (cubeDistance(a, keyToCell(bu.key)) <= 2) {
          frontlineThreat += 1;
          break;
        }
      }
    }

    const tileMap = tileByKey(tiles);
    let workerCaptureMoves = 0;
    const captureMovesByResource = {};
    for (const w of workers) {
      for (const toKey of state.legalMovesByUnit?.[w.key] || []) {
        const t = tileMap.get(toKey);
        const prod = state.productionByType?.[t?.type || ''];
        if (t && t.owner !== 'red' && prod) {
          workerCaptureMoves += 1;
          captureMovesByResource[prod] = (captureMovesByResource[prod] || 0) + 1;
        }
      }
    }

    const settlementUpgrades = (state.legalTileUpgrades || []).filter((u) => ['village', 'town', 'city'].includes(u.toType)).length;

    return {
      ownedCount: ownedTiles.length,
      workerCount,
      frontlineThreat,
      workerCaptureMoves,
      captureMovesByResource,
      settlementUpgrades,
      needExpansionPush: workerCaptureMoves > 0 || settlementUpgrades > 0 || ownedTiles.length < 16,
    };
  }

  function chooseUpgradeCandidates(state, targetResource, balancePlan, context) {
    const upgrades = state.legalTileUpgrades || [];
    const toPriority = { city: 10, town: 8, village: 6, palace: 5, estate: 4, manor: 3, keep: 4, stronghold: 3, outpost: 2 };
    const avail = state.eco?.available || {};
    const prodBy = state.productionByType || {};
    const order = state.resourceOrder || [];

    const owned = (state.tiles || []).filter((t) => t.owner === 'red');
    const countByType = {};
    for (const t of owned) countByType[t.type] = (countByType[t.type] || 0) + 1;

    const tierTargets = {
      homestead: Math.max(1, Math.floor((countByType.farm || 0) / 3)),
      village: Math.max(1, Math.floor((countByType.homestead || 0) / 3)),
      town: Math.max(1, Math.floor((countByType.village || 0) / 3)),
      city: Math.max(1, Math.floor((countByType.town || 0) / 3)),
      manor: Math.max(1, Math.floor((countByType.homestead || 0) / 4)),
      estate: Math.max(1, Math.floor((countByType.manor || 0) / 3)),
      palace: Math.max(1, Math.floor((countByType.estate || 0) / 3)),
      outpost: Math.max(1, Math.floor((countByType.village || 0) / 2)),
      stronghold: Math.max(1, Math.floor((countByType.town || 0) / 2)),
      keep: Math.max(1, Math.floor((countByType.city || 0) / 2)),
    };

    return upgrades
      .filter((u) => {
        if (['village', 'town', 'city', 'manor', 'estate', 'palace', 'outpost', 'stronghold', 'keep'].includes(u.toType)) return true;
        const fromRes = prodBy[u.fromType];
        if (!fromRes) return true;
        return Number(avail[fromRes] || 0) >= 2;
      })
      .map((u) => {
        const produced = prodBy[u.toType];
        const fromRes = prodBy[u.fromType];
        let score = (toPriority[u.toType] || 0)
          + (produced === targetResource ? 12 : 0)
          + (u.toType === 'village' ? 12 : 0)
          + (u.toType === 'town' ? 14 : 0)
          + (u.toType === 'city' ? 16 : 0);

        if (isWorkerClass(unitClass(state, u.unitType))) score += 8;
        if (context?.needExpansionPush && ['village', 'town', 'city', 'manor', 'estate', 'palace'].includes(u.toType)) score += 6;

        if (fromRes && Number(avail[fromRes] || 0) <= 2) score -= 20;
        if (fromRes && balancePlan?.strongUpgradeFrom?.has(fromRes)) score += 24;

        // Keep lower-tier resources above higher tiers; avoid burning scarce basics.
        const fromIdx = order.indexOf(fromRes);
        if (fromIdx >= 0 && fromIdx < order.length - 1) {
          const lowerRes = order[fromIdx + 1];
          const fromAvail = Number(avail[fromRes] || 0);
          const lowerAvail = Number(avail[lowerRes] || 0);
          if (fromAvail <= lowerAvail + 1) score -= 36;
        }

        // Explicit anti-loop guard: avoid forest->pasture when wood is already weak vs livestock.
        if (u.fromType === 'forest' && u.toType === 'pasture') {
          const wood = Number(avail.wood || 0);
          const livestock = Number(avail.livestock || 0);
          if (wood < livestock || wood < 4) score -= 70;
        }

        // If livestock is bloated relative to crops, strongly prefer pasture->farm.
        if (u.fromType === 'pasture' && u.toType === 'farm') {
          const livestock = Number(avail.livestock || 0);
          const crops = Number(avail.crops || 0);
          if (livestock >= crops + 2) score += 18;
          if (livestock >= 2 * Math.max(1, crops)) score += 14;
        }

        // Encourage staged progression (few farms -> homestead, few homesteads -> village, etc).
        const currentToType = countByType[u.toType] || 0;
        if (currentToType < (tierTargets[u.toType] || 0)) score += 16;
        else score -= 4;

        score += Math.random() * 1.2;
        return { type: 'upgrade-tile', key: u.key, toType: u.toType, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  function chooseTrainCandidates(state, targetResource, context) {
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
    const needWorkers = upgradableOwned > (workers * 1.3 + 1) || (context?.workerCaptureMoves || 0) > workers;

    return trains.filter((t) => {
      if (t.unitType !== 'axman') return true;
      return axmen < targetAxmen;
    }).map((t) => {
      const cls = unitClass(state, t.unitType);
      const isWorker = cls === 'worker' || cls === 'defworker';
      const isSoldier = ['infantry', 'archer', 'cavalry'].includes(cls);

      let score = (rank[t.tileType] || 0) * 8;
      score += (rank[t.tileType] >= 3 ? 8 : 0); // most advanced settlements first

      if (needWorkers) score += isWorker ? 18 : -8;
      else score += isSoldier ? 10 : -2;

      if (!needWorkers && isSoldier && cls === soldierFocus) score += 10;

      // Build army if enemy is nearby or if wood is strong enough to support military production.
      if (isSoldier && (context?.frontlineThreat || 0) > 0) score += 10;
      if (isSoldier && (resourceAvail.wood || 0) > (resourceAvail.livestock || 0) + 2) score += 5;
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
    const friendlyAdj = [
      `${toCell.q + 1},${toCell.r}`,
      `${toCell.q - 1},${toCell.r}`,
      `${toCell.q},${toCell.r + 1}`,
      `${toCell.q},${toCell.r - 1}`,
      `${toCell.q + 1},${toCell.r - 1}`,
      `${toCell.q - 1},${toCell.r + 1}`,
    ].filter((k) => {
      const u = unitMap.get(k);
      return u && u.player === 'red';
    }).length;

    let score = 0;
    if (toTile?.owner === 'blue') score += 10;
    else if (!toTile?.owner) score += 4;

    const isCapturing = toTile && toTile.owner !== 'red';
    if (prod === targetResource) score += 12;
    if (prod && balancePlan?.mildCaptureTargets?.has(prod)) score += 9;
    if (prod && balancePlan?.avoidCaptureFrom?.has(prod)) score -= 14;

    // Capturing any nearby resource producer is always valuable.
    if (isCapturing && prod) score += 18;

    const isWorker = isWorkerClass(cls);
    if (isWorker) {
      // Workers should stay busy: capture first, then move toward production tiles.
      if (isCapturing && prod) score += 22;
      if (isCapturing && !prod) score += 8;
      if (toTile?.owner === 'red' && prod === targetResource) score += 5;
      if (toTile?.owner === 'red' && !prod) score -= 6;
    }

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


  function actionId(action) {
    if (!action) return '';
    if (action.type === 'move') return `move:${action.from}->${action.to}`;
    if (action.type === 'upgrade-tile') return `upgrade:${action.key}->${action.toType}`;
    if (action.type === 'train') return `train:${action.key}:${action.unitType}`;
    if (action.type === 'shoot') return `shoot:${action.from}->${action.to}`;
    return '';
  }

  function buildWorkerOptionBoosts(state, targetResource) {
    const boosts = new Map();
    const reasons = new Map();
    const tiles = state.tiles || [];
    const tileMap = tileByKey(tiles);
    const avail = state.eco?.available || {};
    const prodBy = state.productionByType || {};
    const order = state.resourceOrder || [];
    const upgradesByKey = new Map();
    for (const u of state.legalTileUpgrades || []) {
      if (!upgradesByKey.has(u.key)) upgradesByKey.set(u.key, []);
      upgradesByKey.get(u.key).push(u.toType);
    }

    function projectedScore(projectedAvail) {
      let score = 0;
      for (let i = 0; i < order.length - 1; i += 1) {
        const upper = Number(projectedAvail[order[i]] || 0);
        const lower = Number(projectedAvail[order[i + 1]] || 0);
        score += (upper - lower) * 10;
        if (upper <= lower) score -= 30;
      }

      // Hard-balance pressure on core early resources.
      const wood = Number(projectedAvail.wood || 0);
      const livestock = Number(projectedAvail.livestock || 0);
      const crops = Number(projectedAvail.crops || 0);
      const provisions = Number(projectedAvail.provisions || 0);
      if (wood <= livestock) score -= 40;
      if (livestock <= crops) score -= 28;
      if (crops <= provisions) score -= 18;

      score += Number(projectedAvail.supplies || 0) * 3;
      score += Number(projectedAvail.crafts || 0) * 3;
      score += Number(projectedAvail.luxury || 0) * 4;
      score += Number(projectedAvail.support || 0) * 3;
      score += Number(projectedAvail.authority || 0) * 3;
      score += Number(projectedAvail.sovereignty || 0) * 4;
      return score;
    }

    function applyUpgrade(projectedAvail, workingTiles, key, toType) {
      const tile = workingTiles.get(key);
      if (!tile) return 0;
      const fromType = tile.type;
      const fromRes = prodBy[fromType];
      const toRes = prodBy[toType];
      if (fromRes) projectedAvail[fromRes] = Number(projectedAvail[fromRes] || 0) - 1;
      if (toRes) projectedAvail[toRes] = Number(projectedAvail[toRes] || 0) + 1;
      tile.type = toType;

      let score = 0;
      if (toRes === targetResource) score += 24;
      if (fromType === 'forest' && toType === 'pasture') {
        const wood = Number(projectedAvail.wood || 0);
        const livestock = Number(projectedAvail.livestock || 0);
        if (wood <= livestock + 1) score -= 120;
      }
      if (fromType === 'pasture' && toType === 'farm') {
        const livestock = Number(projectedAvail.livestock || 0);
        const crops = Number(projectedAvail.crops || 0);
        if (livestock >= crops + 1) score += 30;
        if (livestock >= crops + 4) score += 16;
      }
      if (fromType === 'farm' && toType === 'homestead' && Number(projectedAvail.crops || 0) >= 2) score += 18;
      if (fromType === 'homestead' && ['village', 'manor', 'outpost'].includes(toType)) score += 18;
      if (fromType === 'village' && toType === 'town') score += 16;
      if (fromType === 'town' && toType === 'city') score += 16;

      // Push structural progression when early tiers lag behind.
      const ownedTiles = [...workingTiles.values()].filter((t) => t.owner === 'red');
      const farms = ownedTiles.filter((t) => t.type === 'farm').length;
      const homesteads = ownedTiles.filter((t) => t.type === 'homestead').length;
      const villages = ownedTiles.filter((t) => t.type === 'village').length;
      if (fromType === 'farm' && toType === 'homestead' && homesteads < Math.max(1, Math.floor(farms / 4))) score += 20;
      if (fromType === 'homestead' && toType === 'village' && villages < Math.max(1, Math.floor(homesteads / 3))) score += 24;
      return score;
    }

    function applyMove(projectedAvail, workingTiles, toKey) {
      const t = workingTiles.get(toKey);
      if (!t) return 0;
      let score = 0;
      const prod = prodBy[t.type];
      if (t.owner !== 'red') {
        t.owner = 'red';
        score += 8;
        if (prod) {
          projectedAvail[prod] = Number(projectedAvail[prod] || 0) + 1;
          score += 10;
          if (prod === targetResource) score += 12;
        }
      }
      return score;
    }

    function makeWorkingTiles() {
      const out = new Map();
      for (const [k, t] of tileMap.entries()) out.set(k, { ...t });
      return out;
    }

    const workerUnits = (state.units || []).filter((u) => u.player === 'red' && isWorkerClass(unitClass(state, u.type))).slice(0, 10);
    for (const unit of workerUnits) {
      const moves = state.legalMovesByUnit?.[unit.key] || [];
      const options = [];

      // stay put, no upgrade
      options.push({
        label: `stay ${unit.key} (no upgrade)`,
        first: null,
        second: null,
      });

      // move only (no upgrade)
      for (const toKey of moves) {
        options.push({ label: `move ${unit.key}->${toKey} (no upgrade)`, first: { type: 'move', from: unit.key, to: toKey }, second: null });
      }

      // upgrade then move
      for (const toType of (upgradesByKey.get(unit.key) || [])) {
        for (const toKey of moves) {
          options.push({
            label: `upgrade ${unit.key}->${toType}, move to ${toKey}`,
            first: { type: 'upgrade-tile', key: unit.key, toType },
            second: { type: 'move', from: unit.key, to: toKey },
          });
        }
      }

      // move then upgrade (upgrade on arrival if path exists)
      for (const toKey of moves) {
        const dest = tileMap.get(toKey);
        const nexts = state.upgradePaths?.[dest?.type || ''] || [];
        for (const toType of nexts) {
          options.push({
            label: `move ${unit.key}->${toKey}, upgrade ${toKey}->${toType}`,
            first: { type: 'move', from: unit.key, to: toKey },
            second: { type: 'upgrade-tile', key: toKey, toType },
          });
        }
      }

      const scored = options.map((opt) => {
        const projectedAvail = { ...avail };
        const workingTiles = makeWorkingTiles();
        let actionScore = 0;

        const applyAction = (a) => {
          if (!a) return;
          if (a.type === 'move') actionScore += applyMove(projectedAvail, workingTiles, a.to);
          if (a.type === 'upgrade-tile') actionScore += applyUpgrade(projectedAvail, workingTiles, a.key, a.toType);
        };

        applyAction(opt.first);
        applyAction(opt.second);

        const ladder = projectedScore(projectedAvail);
        const finalScore = ladder + actionScore;
        return { ...opt, projectedAvail, finalScore, ladder, actionScore };
      }).sort((a, b) => b.finalScore - a.finalScore);

      const best = scored[0];
      const second = scored[1];
      if (!best) continue;

      const resSnap = `wood:${best.projectedAvail.wood || 0}, livestock:${best.projectedAvail.livestock || 0}, crops:${best.projectedAvail.crops || 0}, provisions:${best.projectedAvail.provisions || 0}`;
      const reason = `worker ${unit.key} evaluated ${scored.length} options; best = ${best.label} | projected ${resSnap} | score ${best.finalScore.toFixed(1)} (ladder ${best.ladder.toFixed(1)} + action ${best.actionScore.toFixed(1)})${second ? ` vs next ${second.finalScore.toFixed(1)} (${second.label})` : ''}`;

      if (best.first) {
        const id = actionId(best.first);
        boosts.set(id, (boosts.get(id) || 0) + 34);
        reasons.set(id, reason);
      }
      if (best.second) {
        const id2 = actionId(best.second);
        boosts.set(id2, (boosts.get(id2) || 0) + 16);
        if (!reasons.has(id2)) reasons.set(id2, reason);
      }
    }

    return { boosts, reasons };
  }

  function chooseCandidates(state) {
    if (!state || state.currentPlayer !== 'red') return [];
    const targetResource = pickTargetResource(state);
    const balancePlan = buildResourceBalancePlan(state);
    const context = strategicContext(state);

    let trains = chooseTrainCandidates(state, targetResource, context);
    let moves = chooseMoveCandidates(state, targetResource, balancePlan);
    let upgrades = chooseUpgradeCandidates(state, targetResource, balancePlan, context);
    let shots = chooseShotCandidates(state);

    const workerEval = buildWorkerOptionBoosts(state, targetResource);
    const workerBoosts = workerEval.boosts || new Map();
    const workerReasons = workerEval.reasons || new Map();
    const applyBoosts = (arr) => arr.map((a) => ({ ...a, score: (a.score || 0) + (workerBoosts.get(actionId(a)) || 0), reason: workerReasons.get(actionId(a)) || a.reason }));
    moves = applyBoosts(moves);
    upgrades = applyBoosts(upgrades);
    trains = applyBoosts(trains);
    shots = applyBoosts(shots);

    // IMPORTANT: compare all actions together by end-state score (not by action-type phase).
    const all = [...moves, ...upgrades, ...trains, ...shots];

    // Minor tactical nudges only, then global sort.
    for (const a of all) {
      if (a.type === 'move' && (context.captureMovesByResource?.[targetResource] || 0) > 0) a.score += 2;
      if (a.type === 'upgrade-tile' && (context.settlementUpgrades || 0) > 0) a.score += 2;
    }

    return all.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function chooseAction(state) {
    const candidates = chooseCandidates(state);
    return candidates.length ? candidates[0] : null;
  }

  globalScope.UpKeepEasyAI = { chooseAction, chooseCandidates };
}(window));
