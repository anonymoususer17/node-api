const { createHash, randomBytes } = require('node:crypto');

const VERSION = 'life-torus-v1';

function parseOptions(query) {
  const allowed = new Set(['seed', 'width', 'height', 'steps', 'density', 'format']);
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.has(key) || typeof value !== 'string') {
      throw new Error(`Unknown or repeated parameter: ${key}`);
    }
  }
  const integer = (key, fallback, min, max) => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
      throw new Error(`${key} must be an integer from ${min} to ${max}`);
    }
    return Number(value);
  };
  const seed = query.seed ?? randomBytes(8).toString('hex');
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(seed)) {
    throw new Error('seed must contain 1 to 64 letters, digits, underscores, or hyphens');
  }
  const format = query.format ?? 'json';
  if (!['json', 'svg'].includes(format)) throw new Error('format must be json or svg');
  return {
    seed, format,
    width: integer('width', 40, 12, 64),
    height: integer('height', 24, 12, 48),
    steps: integer('steps', 80, 1, 120),
    density: integer('density', 35, 0, 100),
  };
}

function seededRandom(seed) {
  let state = createHash('sha256').update(`${VERSION}:${seed}`).digest().readUInt32LE(0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function tick(cells, width, height) {
  const next = new Uint8Array(cells.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx || dy) neighbors += cells[((y + dy + height) % height) * width + (x + dx + width) % width];
        }
      }
      const i = y * width + x;
      next[i] = Number(neighbors === 3 || (cells[i] === 1 && neighbors === 2));
    }
  }
  return next;
}

function rows(cells, width, height) {
  return Array.from({ length: height }, (_, y) => cells.slice(y * width, (y + 1) * width).join(''));
}

function simulate({ seed, width, height, steps, density }) {
  const random = seededRandom(seed);
  let original = Uint8Array.from({ length: width * height }, () => Number(random() < density / 100));
  let altered = original.slice();
  const x = Math.floor(width / 2);
  const y = Math.floor(height / 2);
  const index = y * width + x;
  const before = original[index];
  altered[index] ^= 1;
  const affected = new Set();
  const frames = [];
  for (let generation = 0; generation <= steps; generation += 1) {
    const difference = original.map((cell, i) => cell ^ altered[i]);
    difference.forEach((cell, i) => { if (cell) affected.add(i); });
    frames.push({
      generation,
      original: rows(original, width, height),
      altered: rows(altered, width, height),
      difference: rows(difference, width, height),
      aliveOriginal: original.reduce((a, b) => a + b, 0),
      aliveAltered: altered.reduce((a, b) => a + b, 0),
      differentCells: difference.reduce((a, b) => a + b, 0),
    });
    if (generation < steps) {
      original = tick(original, width, height);
      altered = tick(altered, width, height);
    }
  }
  const peak = frames.reduce((best, frame) => frame.differentCells > best.differentCells ? frame : best);
  const query = new URLSearchParams({ seed, width, height, steps, density });
  return {
    title: 'One Pixel, Two Futures',
    version: VERSION,
    seed,
    parameters: { width, height, steps, density },
    rules: {
      name: "Conway's Game of Life",
      birth: [3], survival: [2, 3], neighborhood: 'Eight surrounding cells',
      boundary: 'Toroidal: opposite edges connect',
      encoding: 'Rows of 0 (dead) and 1 (alive); coordinates start at zero in the top-left',
    },
    intervention: { x, y, before, after: before ^ 1, generation: 0 },
    summary: {
      initialDifferentCells: 1,
      finalDifferentCells: frames.at(-1).differentCells,
      peakDifferentCells: peak.differentCells,
      firstPeakGeneration: peak.generation,
      cellsEverDifferent: affected.size,
      firstIdenticalGeneration: frames.find(frame => frame.differentCells === 0)?.generation ?? null,
    },
    note: 'A deterministic cellular automaton, not a forecast of the real world. One change may spread or disappear; divergence is not guaranteed.',
    links: { json: `/universe?${query}`, animation: `/universe?${query}&format=svg` },
    frames,
  };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

function pathForRows(grid) {
  const parts = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '1') parts.push(`M${x * 8},${y * 8}h6v6h-6z`);
    }
  });
  return parts.join('') || 'M0,0';
}

function renderSvg(result) {
  const { width, height, steps } = result.parameters;
  const panelWidth = width * 8;
  const panelHeight = height * 8;
  const panelSlot = Math.max(312, panelWidth);
  const canvasWidth = panelSlot * 3 + 144;
  const canvasHeight = panelHeight + 380;
  const gap = 24;
  // Hold the final state for two seconds before restarting the experiment.
  const duration = (steps + 1) * 0.12 + 2;
  const keyTimes = result.frames.map((_, i) => (i * 0.12 / duration).toFixed(6)).concat('1').join(';');
  const panels = [
    ['original', '01 / ORIGINAL WORLD', '#65efcd'],
    ['altered', '02 / ONE CELL FLIPPED', '#f4c779'],
    ['difference', '03 / WHERE FUTURES DISAGREE', '#ee88be'],
  ].map(([key, label, color], i) => {
    const paths = result.frames.map(frame => pathForRows(frame[key]));
    return `<g transform="translate(${48 + i * (panelSlot + gap)},180)">
      <text y="-23" fill="${color}" class="label">${label}</text>
      <rect x="-10" y="-10" width="${panelSlot + 18}" height="${panelHeight + 18}" rx="6" fill="#101d2b" stroke="#293646"/>
      <path transform="translate(${(panelSlot - panelWidth) / 2},0)" fill="${color}" d="${paths[0]}"><animate attributeName="d" calcMode="discrete" dur="${duration}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${paths.concat(paths.at(-1)).join(';')}"/></path>
    </g>`;
  }).join('');
  const timeline = result.frames.map((frame, i) => `${48 + i / steps * (canvasWidth - 96)},${canvasHeight - 93 - frame.differentCells / (width * height) * 48}`).join(' ');
  const generationLabels = result.frames.map((frame, i) => {
    const visibility = result.frames.map((_, j) => i === j ? 'visible' : 'hidden');
    return `<text x="${canvasWidth - 48}" y="109" text-anchor="end" fill="#c6d2df" font-size="14" visibility="${visibility[0]}">GEN ${String(frame.generation).padStart(3, '0')} / ${steps}<animate attributeName="visibility" calcMode="discrete" dur="${duration}s" repeatCount="indefinite" keyTimes="${keyTimes}" values="${visibility.concat(visibility.at(-1)).join(';')}"/></text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-labelledby="title description">
  <title id="title">One Pixel, Two Futures</title>
  <desc id="description">Two seeded Game of Life worlds differ initially by one central cell. The third panel highlights differing cells. Peak difference: ${result.summary.peakDifferentCells} of ${width * height} cells. Animation loops and holds the final generation for two seconds.</desc>
  <style>text{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.label{font-size:12px;letter-spacing:1px}</style>
  <rect width="100%" height="100%" fill="#09121d"/>
  <rect x="48" y="35" width="24" height="4" fill="#65efcd"/>
  <text x="84" y="41" fill="#8ca3ba" class="label">THE CONSEQUENCE ENGINE / ${VERSION}</text>
  <text x="48" y="87" fill="#f3f7fc" font-size="34" font-weight="bold">One pixel. Two futures.</text>
  <text x="48" y="116" fill="#a4b5c7" font-size="14">Same rules. Same starting world. One cell changed. Watch what survives.</text>
  ${generationLabels}${panels}
  <text x="48" y="${canvasHeight - 155}" fill="#ee88be" class="label">DIFFERENT CELLS / FULL EXPERIMENT</text>
  <polyline points="${timeline}" fill="none" stroke="#ee88be" stroke-width="2"/>
  <text x="48" y="${canvasHeight - 62}" fill="#d8e4ef" font-size="14">PEAK ${result.summary.peakDifferentCells}/${width * height} · EVER DIFFERENT ${result.summary.cellsEverDifferent} · FINAL ${result.summary.finalDifferentCells}</text>
  <text x="48" y="${canvasHeight - 37}" fill="#8ca3ba" font-size="12">SEED ${escapeXml(result.seed)} · ${width}×${height} · INITIAL DENSITY ${result.parameters.density}% · WRAPPING EDGES</text>
  <text x="48" y="${canvasHeight - 17}" fill="#8ca3ba" font-size="11">A deterministic experiment. Changes can spread or vanish. Not a real-world prediction. Replay this seed as JSON to inspect every cell.</text>
  </svg>`;
}

module.exports = { parseOptions, simulate, tick, renderSvg };
