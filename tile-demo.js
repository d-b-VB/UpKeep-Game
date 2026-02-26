const svg = document.getElementById('demo');

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

const tileTypes = Object.keys(tilePalettes);
const ownershipCols = [
  { owner: null, label: 'Neutral' },
  { owner: 'red', label: 'Red owner' },
  { owner: 'blue', label: 'Blue owner' },
];

function ownerColor(player) {
  return player === 'blue' ? '#3b82f6' : player === 'red' ? '#ef4444' : null;
}

function blendHex(colorA, colorB, weightA = 0.5) {
  if (!colorA || !colorB) return colorA || colorB || '#888';
  const a = colorA.replace('#', '');
  const b = colorB.replace('#', '');
  const wa = Math.max(0, Math.min(1, weightA));
  const wb = 1 - wa;
  const toInt = (hh) => parseInt(hh, 16);
  const toHex = (n) => Math.round(n).toString(16).padStart(2, '0');
  const ar = toInt(a.slice(0, 2)); const ag = toInt(a.slice(2, 4)); const ab = toInt(a.slice(4, 6));
  const br = toInt(b.slice(0, 2)); const bg = toInt(b.slice(2, 4)); const bb = toInt(b.slice(4, 6));
  return `#${toHex(ar * wa + br * wb)}${toHex(ag * wa + bg * wb)}${toHex(ab * wa + bb * wb)}`;
}

function hexPoints(cx, cy, r, angleDeg = -30) {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((60 * i + angleDeg) * Math.PI) / 180;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

function append(tag, attrs = {}, parent = svg) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent.appendChild(node);
  return node;
}

function drawTile(type, owner, cx, cy) {
  const palette = tilePalettes[type];
  const g = append('g', {});

  append('polygon', {
    points: hexPoints(cx, cy, 28),
    fill: palette[0],
    stroke: '#0b1220',
    'stroke-width': 1.5,
  }, g);

  const positions = [
    [cx - 9, cy - 10], [cx + 9, cy - 10], [cx - 12, cy + 2],
    [cx + 12, cy + 2], [cx - 9, cy + 14], [cx + 9, cy + 14],
  ];
  positions.forEach(([x, y], idx) => {
    const base = palette[idx % 3];
    const tint = ownerColor(owner);
    const fill = idx % 3 === 2 && tint ? blendHex(tint, base, 0.5) : base;
    append('polygon', {
      points: hexPoints(x, y, 8),
      fill,
      stroke: 'none',
    }, g);
  });
}

// Column headers
ownershipCols.forEach((c, i) => {
  const x = 380 + i * 220;
  const t = append('text', { x, y: 44, class: 'label' });
  t.textContent = c.label;
});

// Rows
const startY = 86;
const rowGap = 64;
tileTypes.forEach((type, row) => {
  const y = startY + row * rowGap;
  const rowText = append('text', { x: 300, y: y + 4, class: 'row-label' });
  rowText.textContent = type;

  ownershipCols.forEach((c, col) => {
    drawTile(type, c.owner, 380 + col * 220, y);
  });
});
