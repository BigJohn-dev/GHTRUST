// Run the app (Expo Go / dev build) against the deployed test API instead of a local backend.
// Usage: npm run start:railway            (any OS, including Windows)
//        API_URL=https://other.host npm run start:railway
import { spawn } from 'node:child_process';

const DEFAULT_API = 'https://ghtrust-production.up.railway.app';
const apiUrl = process.env.API_URL || DEFAULT_API;

console.log(`\n  App → ${apiUrl}\n`);
const child = spawn('npx', ['expo', 'start', '--clear', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl },
});
child.on('exit', (code) => process.exit(code ?? 0));
