// Stockfish 18 lite for Node: the very same engine the website runs in the browser
const initEngine = require('stockfish');

async function engine() {
  const sf = await initEngine('lite-single');
  let listener = null;
  sf.listener = (line) => listener && listener(String(line));
  sf.sendCommand('uci');
  return {
    // White-POV centipawn score, like evaluatePositions() in src/lib/analysis.ts
    evaluate: (fen, go) => new Promise((resolve) => {
      let score = 0;
      const whiteToMove = fen.split(' ')[1] === 'w';
      listener = (l) => {
        if (/ (upper|lower)bound/.test(l)) return;
        const cp = l.match(/score cp (-?\d+)/), mt = l.match(/score mate (-?\d+)/);
        if (cp) score = +cp[1];
        if (mt) score = +mt[1] > 0 ? 10000 - +mt[1] : -10000 - +mt[1];
        if (l.startsWith('bestmove')) resolve(whiteToMove ? score : -score);
      };
      sf.sendCommand('position fen ' + fen);
      sf.sendCommand(go);
    }),
    // returns { best, score } score in cp from side to move (mate => ±100000)
    analyse: (fen, depth = 14) => new Promise((resolve) => {
      let score = 0;
      listener = (l) => {
        if (/ (upper|lower)bound/.test(l)) return;
        const cp = l.match(/score cp (-?\d+)/), mt = l.match(/score mate (-?\d+)/);
        if (cp) score = +cp[1];
        if (mt) score = +mt[1] > 0 ? 100000 - +mt[1] : -100000 - +mt[1];
        if (l.startsWith('bestmove')) resolve({ best: l.split(' ')[1], score });
      };
      sf.sendCommand('position fen ' + fen);
      sf.sendCommand('go depth ' + depth);
    }),
    quit: () => sf.sendCommand('quit'),
  };
}
module.exports = { engine };
