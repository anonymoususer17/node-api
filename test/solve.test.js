const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSolveOptions, solve, renderText } = require('../lib/solve');
const app = require('../server');

// Independent rational arithmetic and parser for verifying returned expressions.
function fraction(n, d = 1n) {
  assert.notEqual(d, 0n);
  if (d < 0n) return fraction(-n, -d);
  function gcd(a, b) { return b === 0n ? a : gcd(b, a % b); }
  const g = gcd(n < 0n ? -n : n, d);
  return [n / g, d / g];
}
function operate([a, b], op, [c, d]) {
  switch (op) {
    case '+': return fraction(a * d + c * b, b * d);
    case '-': return fraction(a * d - c * b, b * d);
    case '*': return fraction(a * c, b * d);
    case '/': return fraction(a * d, b * c);
    default: throw new Error('Unexpected operator');
  }
}
function readValue(text) { const [n, d = '1'] = text.split('/'); return fraction(BigInt(n), BigInt(d)); }
function check(result) {
  const tokens = result.expression.match(/\d+|[()+*/-]/g);
  const leaves = [];
  let index = 0;
  function parse() {
    const token = tokens[index++];
    if (token !== '(') {
      assert.match(token, /^\d+$/);
      leaves.push(Number(token));
      return fraction(BigInt(token));
    }
    const a = parse();
    const op = tokens[index++];
    const b = parse();
    assert.equal(tokens[index++], ')');
    return operate(a, op, b);
  }
  assert.deepEqual(parse(), readValue(result.result));
  assert.equal(index, tokens.length);
  assert.deepEqual(leaves.sort((a, b) => a - b), [...result.numbers].sort((a, b) => a - b));
  assert.equal(result.steps.length, result.numbers.length - 1);
  for (const step of result.steps) {
    assert.deepEqual(operate(readValue(step.left), step.operator, readValue(step.right)), readValue(step.result));
  }
  assert.equal(result.exact, result.result === String(result.target));
}

test('fractional solutions are exact and use every number once', () => {
  for (const numbers of ['3,3,8,8', '1,3,4,6', '2,5,7,10,25']) {
    const result = solve(parseSolveOptions({ numbers }));
    check(result);
    assert.equal(result.exact, true);
    assert.equal(result.distance, '0');
  }
  const text = renderText(solve(parseSolveOptions({})));
  assert.match(text, /8 \/ \(1\/3\) = 24/);
});

test('impossible targets return the closest result, including negative targets', () => {
  for (const target of [100, -100]) {
    const result = solve({ numbers: [1, 1, 1, 1], target });
    check(result);
    assert.equal(result.exact, false);
    assert.equal(result.result, target === 100 ? '4' : '-2');
    assert.equal(result.distance, target === 100 ? '96' : '98');
  }
});

test('duplicates, zero and negative intermediate results work without dividing by zero', () => {
  for (const target of [0, -1, -5, 1, 7]) {
    check(solve({ numbers: [2, 2, 3], target }));
  }
  assert.equal(solve({ numbers: [2, 2], target: 0 }).exact, true);
});

// Exhaustive pair reduction is a separate search from the subset-based solver.
function enumerate(values) {
  if (values.length === 1) return values;
  const results = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < values.length; j++) {
      if (i === j) continue;
      const rest = values.filter((_, k) => k !== i && k !== j);
      for (const op of ['+', '-', '*', '/']) {
        if (op === '/' && values[j][0] === 0n) continue;
        results.push(...enumerate([...rest, operate(values[i], op, values[j])]));
      }
    }
  }
  return results;
}

test('closest-result claims match an independent exhaustive search', () => {
  for (const numbers of [[1, 2, 3], [3, 3, 8], [7, 11, 13], [1, 1, 1]]) {
    const candidates = enumerate(numbers.map(n => fraction(BigInt(n))));
    for (const target of [-23, -1, 0, 4, 24, 100]) {
      const result = solve({ numbers, target });
      check(result);
      const [distanceN, distanceD] = readValue(result.distance);
      for (const [n, d] of candidates) {
        let delta = n - BigInt(target) * d;
        if (delta < 0n) delta = -delta;
        assert.ok(distanceN * d <= delta * distanceD);
      }
    }
  }
});

test('largest inputs remain exact and replay deterministically', () => {
  const options = { numbers: [97, 89, 83, 79, 73], target: 1000000 };
  const result = solve(options);
  check(result);
  assert.deepEqual(solve(options), result);
});

test('invalid and excessive inputs are rejected', () => {
  for (const query of [
    { numbers: '1' }, { numbers: '1,2,3,4,5,6' }, { numbers: '0,2' },
    { numbers: '101,2' }, { numbers: '1.5,2' }, { numbers: '2,-1' },
    { numbers: ['1,2', '3,4'] }, { target: '1000001' }, { target: '-1000001' },
    { target: 'NaN' }, { target: '1e3' }, { target: '3.5' },
    { format: 'html' }, { other: '1' }, { numbers: '1,'.repeat(10000) },
  ]) assert.throws(() => parseSolveOptions(query), undefined, JSON.stringify(query).slice(0, 100));
});

test('HTTP examples, content types, validation and existing APIs', async t => {
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const get = path => fetch(`http://127.0.0.1:${server.address().port}${path}`);
  const response = await get('/solve?numbers=3,3,8,8&target=24');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/plain/);
  assert.match(await response.text(), /8 \/ \(1\/3\) = 24/);
  for (const path of ['/solve?numbers=1,3,4,6&target=24', '/solve?numbers=2,5,7,10,25&target=813', '/solve?numbers=1,1,1,1&target=100']) {
    const result = await get(path + '&format=json');
    assert.equal(result.status, 200);
    check(await result.json());
  }
  for (const query of ['numbers=3,3,8,8&numbers=1,2', 'target=24&target=25', 'numbers=1,2,3,4,5,6', 'format=svg']) {
    const response = await get('/solve?' + query);
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal(await (await get('/hello')).text(), 'Hello, world!');
  assert.equal((await (await get('/loto')).json()).numbers.length, 6);
  assert.equal((await (await get('/loto/10')).json()).length, 10);
  assert.equal((await (await get('/loto/10?format=text')).text()).split('\n').length, 10);
  assert.equal((await get('/loto/101')).status, 400);
  assert.equal(typeof (await (await get('/8ball')).json()).answer, 'string');
  assert.equal((await get('/missing')).status, 404);
});
