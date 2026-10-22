const express = require('express');
const { drawLotoNumbers } = require('./lib/loto');
const { askEightBall } = require('./lib/eight-ball');
const { parseSolveOptions, solve, renderText } = require('./lib/solve');
const { parseOptions, simulate, renderSvg } = require('./lib/universe');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/hello', (_request, response) => {
  response.type('text').send('Hello, world!');
});

app.get('/loto', (_request, response) => {
  response.json({ numbers: drawLotoNumbers() });
});

app.get('/loto/:count', (request, response) => {
  const input = request.params.count;
  const count = Number(input);

  if (!/^\d+$/.test(input) || count < 1 || count > 100) {
    response.status(400).json({ error: 'Draw count must be an integer from 1 to 100' });
    return;
  }

  const draws = Array.from({ length: count }, () => drawLotoNumbers());

  if (request.query.format === 'text') {
    response.type('text').send(draws.map((draw) => draw.join(', ')).join('\n'));
    return;
  }

  response.json(draws);
});

app.get('/8ball', (_request, response) => {
  response.json({ answer: askEightBall() });
});

app.get('/solve', (request, response) => {
  let options;
  try {
    options = parseSolveOptions(request.query);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }
  const result = solve(options);
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Cache-Control', 'no-store');
  if (options.format === 'text') {
    response.type('text').send(renderText(result));
    return;
  }
  response.json(result);
});

app.get('/universe', (request, response) => {
  let options;
  try {
    options = parseOptions(request.query);
  } catch (error) {
    response.status(400).json({ error: error.message });
    return;
  }
  const result = simulate(options);
  response.set('X-Content-Type-Options', 'nosniff');
  response.set('Cache-Control', 'no-store');
  if (options.format === 'svg') {
    response.type('image/svg+xml').send(renderSvg(result));
    return;
  }
  response.json(result);
});

app.use((_request, response) => {
  response.status(404).type('text').send('Not found');
});

if (require.main === module) {
  app.listen(port, '127.0.0.1', () => {
    console.log(`API listening at http://localhost:${port}`);
  });
}

module.exports = app;
