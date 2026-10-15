// Certificate pinning for the API host (see docs/certificate-pinning.md before changing).
//
// We pin certificate AUTHORITY keys, never the server's own certificate: the API runs on
// Railway's shared *.up.railway.app certificate, which Railway renews every 60-90 days with
// a new key, and Let's Encrypt changes its intermediate (e.g. YE2) whenever it likes. Pinning
// either would lock every installed app out of the API at the next renewal.
//
// Pins are base64 SHA-256 hashes of each certificate's Subject Public Key Info (SPKI). A
// connection is allowed when ANY certificate in the verified chain matches ANY pin.
// `npm run check:pins` checks the live server against this list (EAS runs it before every build).

/** The chain the API serves today (Let's Encrypt). */
const PRIMARY = [
  { name: 'ISRG Root X1 (Let\'s Encrypt RSA root, to 2035)', spki: 'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=' },
  { name: 'ISRG Root X2 (Let\'s Encrypt ECDSA root, to 2040)', spki: 'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=' },
  { name: 'ISRG Root YE (Let\'s Encrypt generation-Y ECDSA root, to 2032)', spki: 'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=' },
];

/**
 * Backups: Google Trust Services roots, in case the host moves to Google-issued certificates.
 * Without them, a CA switch would lock out iOS apps until an app update (iOS pins can't expire).
 */
const BACKUP = [
  { name: 'GTS Root R1 (to 2036)', spki: 'hxqRlPTu1bMS/0DITB1SSu0vd4u/8l8TjPgfaAp63Gc=' },
  { name: 'GTS Root R2 (to 2036)', spki: 'Vfd95BwDeSQo+NUYxVEEIlvkOlWY2SalKK1lPhzOx78=' },
  { name: 'GTS Root R3 (to 2036)', spki: 'QXnt2YHvdHR3tJYmQIr0Paosp6t/nggsEGD4QJZ3Q0g=' },
  { name: 'GTS Root R4 (to 2036)', spki: 'mEflZT5enoR1FuXLgYYGqnVEoZvmf9c2bVBpiOjYQ0c=' },
];

/**
 * Android stops enforcing the pins this long after the build (fail-open), so an app that is
 * never updated can't be locked out forever. Each new build pushes the date forward.
 */
const ANDROID_EXPIRY_DAYS = 365;

module.exports = { PRIMARY, BACKUP, ANDROID_EXPIRY_DAYS, ALL: [...PRIMARY, ...BACKUP] };
