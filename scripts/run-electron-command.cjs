const { spawn } = require('child_process');
const path = require('path');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const electronBinary =
  process.platform === 'win32'
    ? path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')
    : path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron');

const child = spawn(electronBinary, process.argv.slice(2), {
  stdio: 'inherit',
  env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
