function parseSolveOptions(query) {
  for (const [key, value] of Object.entries(query)) {
    if (!['numbers', 'target', 'format'].includes(key) || typeof value !== 'string') {
      throw new Error(`Unknown or repeated parameter: ${key}`);
    }
  }
  const input = query.numbers ?? '3,3,8,8';
  if (!/^\d{1,3}(,\d{1,3}){1,4}$/.test(input)) {
    throw new Error('numbers must be 2 to 5 comma-separated integers from 1 to 100');
  }
  const numbers = input.split(',').map(Number);
  if (numbers.some(n => n < 1 || n > 100)) {
    throw new Error('numbers must be 2 to 5 comma-separated integers from 1 to 100');
  }
  const target = query.target ?? '24';
  if (!/^-?\d{1,7}$/.test(target) || Math.abs(Number(target)) > 1000000) {
    throw new Error('target must be an integer from -1000000 to 1000000');
  }
  const format = query.format ?? 'text';
  if (!['text', 'json'].includes(format)) throw new Error('format must be text or json');
  return { numbers, target: Number(target), format };
}

function rational(n, d = 1n) {
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n;
  let b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}

function valueText(value) {
  return value.d === 1n ? String(value.n) : `${value.n}/${value.d}`;
}

function* combine(a, b) {
  yield { ...rational(a.n * b.d + b.n * a.d, a.d * b.d), op: '+', left: a, right: b };
  yield { ...rational(a.n * b.n, a.d * b.d), op: '*', left: a, right: b };
  yield { ...rational(a.n * b.d - b.n * a.d, a.d * b.d), op: '-', left: a, right: b };
  yield { ...rational(b.n * a.d - a.n * b.d, a.d * b.d), op: '-', left: b, right: a };
  if (b.n) yield { ...rational(a.n * b.d, a.d * b.n), op: '/', left: a, right: b };
  if (a.n) yield { ...rational(b.n * a.d, b.d * a.n), op: '/', left: b, right: a };
}

function describe(node, steps) {
  if (!node.op) return valueText(node);
  const left = describe(node.left, steps);
  const right = describe(node.right, steps);
  steps.push({ left: valueText(node.left), operator: node.op, right: valueText(node.right), result: valueText(node) });
  return `(${left} ${node.op} ${right})`;
}

function solve({ numbers, target }) {
  const wanted = BigInt(target);
  const fullMask = (1 << numbers.length) - 1;
  const values = Array.from({ length: fullMask + 1 }, () => new Map());
  let closest;
  const distance = node => {
    const n = node.n - wanted * node.d;
    return n < 0n ? -n : n;
  };
  const result = (node, exact) => {
    const steps = [];
    const expression = describe(node, steps);
    return {
      numbers, target, exact, expression,
      result: valueText(node),
      distance: valueText(rational(distance(node), node.d)),
      steps,
      rules: 'Use every supplied number exactly once, with +, -, *, / and parentheses. Fractions and negative intermediate results are allowed. No concatenation, powers, or factorials.',
    };
  };
  for (let mask = 1; mask <= fullMask; mask += 1) {
    if ((mask & (mask - 1)) === 0) {
      const node = rational(BigInt(numbers[Math.log2(mask)]));
      values[mask].set(valueText(node), node);
      continue;
    }
    // Every binary expression partitions its leaves into two disjoint subsets.
    // Equal values on the same subset are interchangeable in every later operation.
    for (let left = (mask - 1) & mask; left; left = (left - 1) & mask) {
      const right = mask ^ left;
      if (left > right) continue;
      for (const a of values[left].values()) {
        for (const b of values[right].values()) {
          for (const node of combine(a, b)) {
            if (mask === fullMask) {
              if (node.n === wanted * node.d) return result(node, true);
              if (!closest || distance(node) * closest.d < distance(closest) * node.d) closest = node;
            } else {
              const key = valueText(node);
              if (!values[mask].has(key)) values[mask].set(key, node);
            }
          }
        }
      }
    }
  }
  return result(closest, false);
}

function renderText(result) {
  const operand = value => value.includes('/') || value.startsWith('-') ? `(${value})` : value;
  const lines = [
    `Make ${result.target} using ${result.numbers.join(', ')}.`,
    'Use each number once. Allowed: + - * / and parentheses.',
    '',
    result.exact ? `${result.expression} = ${result.result}` : `No exact solution under these rules. Closest: ${result.expression} = ${result.result}`,
    '',
    ...result.steps.map((step, i) => `${i + 1}. ${operand(step.left)} ${step.operator} ${operand(step.right)} = ${step.result}`),
  ];
  if (!result.exact) lines.push('', `Distance from target: ${result.distance}`);
  return lines.join('\n') + '\n';
}

module.exports = { parseSolveOptions, solve, renderText };
