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

app.get('/8ball', (_request, response) => {
  response.json({ answer: askEightBall() });
});

app.use((_request, response) => {
  response.status(404).type('text').send('Not found');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`API listening at http://localhost:${port}`);
});
