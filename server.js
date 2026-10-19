const http = require('node:http');
const { randomInt } = require('node:crypto');

const port = Number(process.env.PORT) || 3000;

function drawLotoNumbers() {
  const pool = Array.from({ length: 40 }, (_, index) => index + 1);

  for (let index = 0; index < 6; index += 1) {
    const randomIndex = randomInt(index, pool.length);
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }

  return pool.slice(0, 6).sort((a, b) => a - b);
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/hello') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Hello, world!');
    return;
  }

  if (request.method === 'GET' && request.url === '/loto') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ numbers: drawLotoNumbers() }));
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`API listening at http://localhost:${port}`);
});
