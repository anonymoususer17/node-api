const { randomInt } = require('node:crypto');

function drawLotoNumbers() {
  const pool = Array.from({ length: 40 }, (_, index) => index + 1);

  for (let index = 0; index < 6; index += 1) {
    const randomIndex = randomInt(index, pool.length);
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }

  return pool.slice(0, 6).sort((a, b) => a - b);
}

module.exports = { drawLotoNumbers };
