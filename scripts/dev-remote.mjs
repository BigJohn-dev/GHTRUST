// Run the staff portal in dev mode against the deployed API instead of a local backend.
// Usage: npm run dev:railway            (any OS, including Windows)
//        API_URL=https://other.host npm run dev:railway
import { spawn } from 'node:child_process';

const DEFAULT_API = 'https://ghtrust-production.up.railway.app';
const apiUrl = process.env.API_URL || DEFAULT_API;

console.log(`\n  Portal → ${apiUrl}\n`);
const child = spawn('npx', ['next', 'dev', '--turbopack', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
});
child.on('exit', (code) => process.exit(code ?? 0));
