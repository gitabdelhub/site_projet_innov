// Plan B for the defence: starts the website AND the Elo API with one command.
//   npm run local
// Front: http://localhost:3000   API: http://localhost:5000
import { spawn, spawnSync } from 'node:child_process';

const isWin = process.platform === 'win32';
const python = ['python', 'python3', 'py'].find((cmd) => spawnSync(cmd, ['--version'], { shell: isWin }).status === 0);

const children = [];
const run = (name, cmd, args, opts = {}) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: isWin, ...opts });
  child.on('exit', (code) => console.log(`[${name}] stopped (${code})`));
  children.push(child);
};

if (python) {
  run('api', python, ['ml_backend/app.py'], { env: { ...process.env, PORT: '5000' } });
} else {
  console.warn('Python not found: the Elo prediction will run in the browser only.');
}
run('web', 'npx', ['vite', '--port', '3000', '--open'], {
  env: { ...process.env, VITE_API_URL: python ? 'http://localhost:5000' : '' },
});

const stop = () => {
  children.forEach((c) => c.kill());
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
