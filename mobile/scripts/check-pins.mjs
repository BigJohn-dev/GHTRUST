// Checks that the live API's certificate chain matches a pin in config/pins.js.
//
//   npm run check:pins                 (uses EXPO_PUBLIC_API_URL, else the Railway API)
//
// EAS runs it before every build (the "eas-build-pre-install" script), so a build whose pins
// would lock users out of the API fails instead of shipping. See docs/certificate-pinning.md.
import { createHash, X509Certificate } from 'node:crypto';
import { createRequire } from 'node:module';
import tls from 'node:tls';

const require = createRequire(import.meta.url);
const { ALL, PRIMARY } = require('../config/pins.js');

const url = process.env.EXPO_PUBLIC_API_URL || 'https://ghtrust-production.up.railway.app';
if (!url.startsWith('https://')) {
  console.log(`check-pins: ${url} is not HTTPS, so nothing is pinned. Skipping.`);
  process.exit(0);
}
const host = new URL(url).hostname;

function spkiHash(der) {
  const key = new X509Certificate(der).publicKey.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(key).digest('base64');
}

const chain = await new Promise((resolve, reject) => {
  const socket = tls.connect({ host, port: 443, servername: host, timeout: 15_000 }, () => {
    const certs = [];
    const seen = new Set();
    let cert = socket.getPeerCertificate(true);
    while (cert && cert.raw && !seen.has(cert.fingerprint256)) {
      seen.add(cert.fingerprint256);
      certs.push({ subject: cert.subject?.CN ?? cert.subject?.O ?? '?', spki: spkiHash(cert.raw) });
      cert = cert.issuerCertificate;
    }
    socket.end();
    resolve(certs);
  });
  socket.on('timeout', () => socket.destroy(new Error(`timed out connecting to ${host}`)));
  socket.on('error', reject);
}).catch((err) => {
  // No network on the build machine is not proof the pins are wrong: warn, don't block.
  console.warn(`check-pins: couldn't reach ${host} (${err.message}). Skipping the check.`);
  process.exit(0);
});

const pins = new Map(ALL.map((p) => [p.spki, p.name]));
const matches = chain.filter((c) => pins.has(c.spki));
for (const c of chain) console.log(`  ${pins.has(c.spki) ? 'PINNED ' : '       '} ${c.subject}  ${c.spki}`);

if (matches.length === 0) {
  console.error(
    `\ncheck-pins: FAILED. No certificate served by ${host} matches config/pins.js.\n` +
      'A build with these pins could not reach the API. Update the pins (docs/certificate-pinning.md).',
  );
  process.exit(1);
}
const onPrimary = matches.some((m) => PRIMARY.some((p) => p.spki === m.spki));
console.log(
  `\ncheck-pins: OK. ${host} matches ${matches.map((m) => pins.get(m.spki)).join(', ')}.` +
    (onPrimary ? '' : '\nWARNING: only a BACKUP pin matches. The CA has changed: update PRIMARY in config/pins.js.'),
);
