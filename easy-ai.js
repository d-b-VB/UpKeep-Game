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

  function chooseAction(state) {
    if (!state || state.currentPlayer !== 'red') return null;

    const ownerMap = tileOwnerByKey(state.tiles || []);
    const unitMap = unitByKey(state.units || []);

    let bestMove = null;
    let bestMoveScore = -Infinity;

    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const moves = (state.legalMovesByUnit && state.legalMovesByUnit[unit.key]) || [];
      for (const toKey of moves) {
        const s = scoreDestination(unit.key, toKey, state, unitMap, ownerMap);
        if (s > bestMoveScore) {
          bestMoveScore = s;
          bestMove = { type: 'move', from: unit.key, to: toKey };
        }
      }
    }

    if (bestMove) return bestMove;

    for (const unit of state.units || []) {
      if (unit.player !== 'red') continue;
      const shots = (state.legalShotsByUnit && state.legalShotsByUnit[unit.key]) || [];
      if (shots.length) return { type: 'shoot', from: unit.key, to: shots[0] };
    }

    return null;
  }

  globalScope.UpKeepEasyAI = { chooseAction };
}(window));
