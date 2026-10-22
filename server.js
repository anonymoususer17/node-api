const express = require('express');
const { drawLotoNumbers } = require('./lib/loto');
const { askEightBall } = require('./lib/eight-ball');

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

app.use((_request, response) => {
  response.status(404).type('text').send('Not found');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`API listening at http://localhost:${port}`);
});
