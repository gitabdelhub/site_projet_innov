// Minimal Stockfish (asm.js worker build) wrapper for Node
const { Worker } = require('worker_threads');
const SF = require('path').join(__dirname, '..', 'public', 'stockfish.js');
function engine() {
  const code = `
    const __wt = require('worker_threads');
    globalThis.postMessage = (m) => __wt.parentPort.postMessage(m);
    globalThis.close = () => process.exit(0);
    globalThis.importScripts = function(){}; globalThis.self = globalThis; globalThis.location = { href: 'http://x/stockfish.js' };
    __wt.parentPort.on('message', (m) => globalThis.onmessage && globalThis.onmessage({ data: m }));
    require('vm').runInThisContext(require('fs').readFileSync(${JSON.stringify(SF)}, 'utf8'));`;
  const w = new Worker(code, { eval: true });
  let listener = null;
  w.on('message', (m) => listener && listener(String(m)));
  const send = (s) => w.postMessage(s);
  return {
    // returns { best, score } score in cp from side to move (mate => ±100000)
    analyse: (fen, depth = 14) => new Promise((res) => {
      let score = 0;
      listener = (l) => {
        const cp = l.match(/score cp (-?\d+)/), mt = l.match(/score mate (-?\d+)/);
        if (cp) score = +cp[1];
        if (mt) score = +mt[1] > 0 ? 100000 - +mt[1] : -100000 - +mt[1];
        if (l.startsWith('bestmove')) res({ best: l.split(' ')[1], score });
      };
      send('position fen ' + fen); send('go depth ' + depth);
    }),
    quit: () => w.terminate(),
  };
}
module.exports = { engine };
