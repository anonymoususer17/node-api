const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOptions, simulate, tick, renderSvg } = require('../lib/universe');
const app = require('../server');

test('Life rule handles all 512 possible center/neighborhood configurations', () => {
  for (let mask = 0; mask < 512; mask += 1) {
    const cells = new Uint8Array(25);
    let bit = 0;
    let count = 0;
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        cells[y * 5 + x] = (mask >> bit++) & 1;
        if (x !== 2 || y !== 2) count += cells[y * 5 + x];
      }
    }
    assert.equal(tick(cells, 5, 5)[12], Number(count === 3 || (count === 2 && cells[12] === 1)), `mask ${mask}`);
  }
});

test('a blinker spanning the boundary oscillates without mutating the input', () => {
  const cells = new Uint8Array(25);
  cells[10] = cells[11] = cells[14] = 1;
  const copy = cells.slice();
  const next = tick(cells, 5, 5);
  assert.deepEqual(Array.from(next.entries()).filter(([, v]) => v).map(([i]) => i), [5, 10, 15]);
  assert.deepEqual(tick(next, 5, 5), cells);
  assert.deepEqual(cells, copy);
});

function referenceStep(rows) {
  const h = rows.length;
  const w = rows[0].length;
  return rows.map((row, y) => [...row].map((cell, x) => {
    const offsets = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const n = offsets.filter(([dx, dy]) => rows[(y + dy + h) % h][(x + dx + w) % w] === '1').length;
    return n === 3 || (cell === '1' && n === 2) ? '1' : '0';
  }).join(''));
}

test('timelines match an independent simulation; counts match cell data', () => {
  const options = parseOptions({ seed: 'hello-world', width: '12', height: '13', steps: '25' });
  const result = simulate(options);
  assert.deepEqual(simulate(options), result);
  assert.notDeepEqual(simulate({ ...options, seed: 'another' }).frames[0].original, result.frames[0].original);
  assert.equal(result.frames.length, 26);
  const changed = new Set();
  for (const [i, frame] of result.frames.entries()) {
    if (i) {
      assert.deepEqual(frame.original, referenceStep(result.frames[i - 1].original));
      assert.deepEqual(frame.altered, referenceStep(result.frames[i - 1].altered));
    }
    let different = 0;
    frame.original.forEach((row, y) => [...row].forEach((cell, x) => {
      const delta = Number(cell !== frame.altered[y][x]);
      assert.equal(Number(frame.difference[y][x]), delta);
      if (delta) { different++; changed.add(`${x},${y}`); }
    }));
    assert.equal(frame.differentCells, different);
    assert.equal(frame.aliveOriginal, frame.original.join('').replaceAll('0', '').length);
    assert.equal(frame.aliveAltered, frame.altered.join('').replaceAll('0', '').length);
  }
  const { x, y, before, after } = result.intervention;
  assert.equal(result.frames[0].differentCells, 1);
  assert.equal(Number(result.frames[0].original[y][x]), before);
  assert.equal(Number(result.frames[0].altered[y][x]), after);
  assert.equal(result.summary.cellsEverDifferent, changed.size);
  assert.equal(result.summary.peakDifferentCells, Math.max(...result.frames.map(f => f.differentCells)));
  assert.equal(result.summary.finalDifferentCells, result.frames.at(-1).differentCells);
});

test('restored version reproduces the original default experiment', () => {
  assert.deepEqual(simulate(parseOptions({ seed: 'hello-world' })).summary, {
    initialDifferentCells: 1,
    finalDifferentCells: 145,
    peakDifferentCells: 319,
    firstPeakGeneration: 24,
    cellsEverDifferent: 938,
    firstIdenticalGeneration: null,
  });
  const empty = simulate(parseOptions({ seed: 'empty', density: '0' }));
  assert.equal(empty.summary.firstIdenticalGeneration, 1);
  assert.equal(empty.summary.cellsEverDifferent, 1);
  assert.equal(empty.summary.finalDifferentCells, 0);
});

test('Life validation rejects excessive work, ambiguity and unsafe seeds', () => {
  for (const query of [
    { seed: '' }, { seed: '<script>' }, { seed: 'a'.repeat(65) }, { seed: ['a', 'b'] },
    { width: '11' }, { width: '65' }, { height: '49' }, { steps: '121' },
    { steps: '0' }, { steps: '1.5' }, { density: '-1' }, { density: '101' },
    { format: 'html' }, { typo: '1' }, { steps: '1e2' },
  ]) assert.throws(() => parseOptions(query), undefined, JSON.stringify(query));
  assert.match(parseOptions({}).seed, /^[a-f0-9]{16}$/);
});

test('SVG animation has matching frame timings and discrete values', () => {
  const svg = renderSvg(simulate(parseOptions({ seed: 'hello', steps: '4' })));
  assert.match(svg, /^<svg/);
  assert.doesNotMatch(svg, /NaN|undefined|<script/);
  const animations = [...svg.matchAll(/<animate [^>]+/g)];
  assert.equal(animations.length, 8);
  for (const [tag] of animations) {
    const times = tag.match(/keyTimes="([^"]+)"/)[1].split(';').map(Number);
    const values = tag.match(/values="([^"]+)"/)[1].split(';');
    assert.equal(times.length, values.length);
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), 1);
    assert.ok(times.every((value, i) => i === 0 || value > times[i - 1]));
  }
});

test('Life HTTP routes: replay, SVG, invalid inputs and maximum size', async t => {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const get = path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
  const response = await get('/universe?seed=hello-world&steps=5');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(await (await get(result.links.json)).json(), result);
  const svg = await get(result.links.animation);
  assert.match(svg.headers.get('content-type'), /^image\/svg\+xml/);
  assert.equal(svg.headers.get('x-content-type-options'), 'nosniff');
  assert.match(await svg.text(), /One pixel\. Two futures\./);
  for (const query of ['seed=a&seed=b', 'width=999999', 'format=html', 'steps=0', 'seed=%3Cscript%3E', 'seed[x]=1']) {
    const invalid = await get(`/universe?${query}`);
    assert.equal(invalid.status, 400, query);
    assert.equal(typeof (await invalid.json()).error, 'string');
  }
  const max = await get('/universe?seed=max&width=64&height=48&steps=120&format=svg');
  assert.equal(max.status, 200);
  assert.ok((await max.text()).endsWith('</svg>'));
});
