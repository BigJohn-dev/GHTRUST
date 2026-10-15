# Certificate pinning

The app only talks to the API over a connection whose certificate chain includes a key we
trust. Someone who intercepts the connection with a different certificate is refused, even if
the phone has been made to trust that certificate (a "trusted" interception proxy, a rogue
or compromised certificate authority).

## What is pinned, and why roots

| Pin | Why |
|---|---|
| ISRG Root X1, ISRG Root X2, ISRG Root YE | Let's Encrypt's roots: the API's chain today (checked live: `npm run check:pins`) |
| GTS Root R1–R4 | Backups: Google Trust Services, the likeliest other CA if the host ever switches |

Pins are on **certificate authority roots**, not on the API's own certificate:

- The API runs on Railway's shared `*.up.railway.app` certificate. Railway renews it every
  60–90 days, usually with a new key. A pin on it would lock every installed app out of the
  API at the next renewal, and only an app-store update would fix it.
- Let's Encrypt changes its intermediate certificate (today `YE2`) without notice. Same problem.
- Roots last for years (X1 to 2035, YE to 2032, X2 to 2040).

What this still guarantees: an attacker needs a certificate for **our hostname** from **one
of these CAs**, which requires control of the domain. Interception with any other CA, or with
a certificate the user was tricked into installing, fails.

## How it's enforced

Built-in platform pinning, configured at build time (`mobile/plugins/withApiPinning.js`,
pins in `mobile/config/pins.js`), in **preview and production builds only**. Development
builds aren't pinned (they use plain HTTP to a laptop).

| | Mechanism | Covers |
|---|---|---|
| Android | Network Security Config `<pin-set>` | Every HTTPS connection to the API: `expo/fetch` (the app's fetch), React Native fetch/WebSocket, the native document uploader |
| iOS | App Transport Security `NSPinnedDomains` (CA identities) | All URLSession traffic: `expo/fetch`, React Native fetch, the document uploader. Release builds also stop allowing plain HTTP anywhere |

We don't use a pinning library: they hook React Native's networking, which `expo/fetch`
bypasses, so the API traffic would silently stay unpinned.

Only the API host is pinned. Expo updates, Sentry and the Monnify card page are not.

**Known gap:** on iOS, React Native's WebSocket (live support chat) may not go through
URLSession, so the chat socket may be protected by normal certificate checks only. No money
moves over it, and the sign-in token it sends is short-lived.

## Safety nets

1. **Every EAS build checks the pins against the live API first** (`eas-build-pre-install`
   runs `scripts/check-pins.mjs`). If no certificate the server presents matches a pin, the
   build fails instead of shipping an app that can't connect.
2. **Android pins expire 12 months after the build**, after which Android stops enforcing
   them, so an old, never-updated app can't be locked out forever. Each new build moves the
   date forward. iOS has no expiry, which is why the backup pins matter.
3. **Seven pins across two CAs**, so a root or CA change on the host doesn't lock anyone out.

## Rotation plan

**Every release:** the build runs the check automatically. Read its output in the EAS log.

**Monthly** (or when Railway announces certificate changes): `cd mobile && npm run check:pins`.

- `OK`: nothing to do.
- `OK` + `WARNING: only a BACKUP pin matches`: the host changed CA. Apps still connect (the
  backups worked). Move the new CA's roots into `PRIMARY`, keep the old ones in `BACKUP` for
  at least a year, build and release.
- `FAILED`: the host uses a CA that isn't pinned. **Installed apps on iOS can't reach the API**
  (Android ones until their pins expire). Add the new chain's root pins, build and release
  urgently, and set `APP_MIN_VERSION_*` on the API to push everyone to the fixed version.

**Moving the API to its own domain** (e.g. `api.ghtrust.ng`): set the new `EXPO_PUBLIC_API_URL`
and run `npm run check:pins` against it **before** building. Pins follow the host
automatically, but they must match that host's CA. If the CA is different, add its roots.

**Adding a pin:** get the root certificate, then:

```bash
openssl x509 -in root.pem -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
```

**Never** pin the server's own certificate or the intermediate, and never ship fewer than two
pins (the plugin refuses).

## Testing a build

Normal use proves pinning doesn't block the real API. To prove it blocks interception, route
a test phone through an intercepting proxy (mitmproxy, Charles) with its certificate
installed. The app must fail to load data while ordinary websites still work.
