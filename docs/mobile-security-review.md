# Mobile app security review

Status as of the Phase 7 quality work. What the app does today, the decisions behind it,
and what's left before launch.

## Summary

| Area | Status |
|---|---|
| Transport | HTTPS required in release builds (the app refuses to start otherwise) |
| Tokens and secrets on the phone | Keychain / Keystore only; access token in memory; PINs never stored |
| Screenshots / screen recording | Blocked on every PIN screen and the new-phone approval code; iOS app-switcher blur |
| Backups | Android `allowBackup: false`; Keychain items are `WHEN_UNLOCKED_THIS_DEVICE_ONLY` |
| Logging | Diagnostics only in development builds; crash reports carry no personal data |
| Certificate pinning | **Not enabled** (decision below) |
| Rooted / jailbroken phones | **No detection yet** (decision below) |

## What's stored on the phone

All in `mobile/src/auth/storage.ts`, through `expo-secure-store` (iOS Keychain with
`WHEN_UNLOCKED_THIS_DEVICE_ONLY`, Android Keystore-backed). Nothing is stored in plain
AsyncStorage or files. On the web preview everything is memory-only.

| Key | What | Why it's safe |
|---|---|---|
| `ghtrust.refresh_token` | 30-day refresh token | Rotated on every use; reuse of an old one revokes the session server-side |
| `ghtrust.device_token` | Proof this phone is trusted | Hashed server-side; revoked from "Signed-in devices" or "Sign out of all devices" |
| `ghtrust.device_id` | Random install ID | Not secret; lets a re-sign-in replace the old session |
| `ghtrust.first_name` | For "Welcome back" | Not sensitive |
| `ghtrust.biometric`, `ghtrust.push_off`, `ghtrust.intro_seen` | Preferences | Not sensitive |

- The **access token** lives only in memory and expires quickly.
- **PINs are never stored** on the phone. The server keeps salted hashes, and wrong
  attempts are limited and locked.
- Biometric unlock releases nothing: it's a local check that stands in for typing the PIN
  on a phone that's already trusted.

## Screen protection

`mobile/src/lib/useSecureScreen.ts` (`expo-screen-capture`):

- **Screenshots and recording blocked:**
  - every screen with the PIN keypad: sign-in PIN, unlock, PIN setup and changes, and the
    transaction PIN sheet;
  - the screen that shows the code for approving a new phone.

  Scammers commonly ask victims to "send a screenshot". On Android this also hides these
  screens from the recent-apps thumbnail.
- **iOS app switcher:** the app is blurred there, so balances aren't visible.

Not blocked: statements, receipts and the loan offer. Customers legitimately screenshot
these as proof of payment.

## Transport and certificate pinning

**Today:**
- All traffic is HTTPS (TLS terminated by Railway).
- `mobile/src/api/config.ts` throws at start-up in a release build whose
  `EXPO_PUBLIC_API_URL` isn't `https://`.
- Every request carries an `X-Request-ID`, which the API reuses in its logs and Sentry events.

**Decision: no certificate pinning for launch.**
- Railway's certificates are issued by Let's Encrypt and rotate about every 60–90 days,
  and the intermediate can change. A pinned app then refuses to connect until customers
  update. For a lending app that means missed repayments, which is a worse failure than
  the risk pinning removes.
- There is no maintained Expo module for pinning; it would need a custom native module.

**Revisit when:**
- the API moves behind GH Trust's own domain with a certificate we control (pin the
  public key of our own intermediate plus a backup key); or
- a regulator or partner bank requires pinning.

## Rooted and jailbroken phones

**Decision: no detection for launch.** It's easy to bypass and has false positives on
some budget Android phones, which would block legitimate customers. The real protections
are server-side:
- every sign-in on a new phone needs approval from a trusted phone, or BVN and PIN plus
  a 24-hour hold on withdrawals;
- money movement needs the transaction PIN;
- attempts are rate-limited and locked.

**Later, if fraud data shows a need:** add a *warning* (not a block) using a maintained
library such as `jail-monkey` (it needs a development build), and report the signal to
the API so risk rules can use it.

## Crash reporting and privacy

`mobile/src/lib/monitoring.ts` (Sentry):

- **Off by default.** It's enabled only when `EXPO_PUBLIC_SENTRY_DSN` is set at build
  time, and never on web.
- **What's reported:** server errors (5xx) and app exceptions. Expected failures (wrong
  PIN, offline, validation) aren't reported.
- **Personal data:** only the customer's internal ID is attached. Request bodies,
  headers and query strings are stripped (`sendDefaultPii: false`).
- **Linking to the server:** each report is tagged with the backend `request_id`. The
  backend tags its own Sentry events with the same ID
  (`backend/app/core/middleware.py`), so the two can be matched.
- **Source maps** are not uploaded yet. To get readable stack traces, add the
  `@sentry/react-native/expo` config plugin with your Sentry org and project, and set
  `SENTRY_AUTH_TOKEN` as an EAS secret.

## Before launch

- [ ] Set `EXPO_PUBLIC_API_URL` (https) for the **production** EAS environment on expo.dev.
      `eas.json` only sets it for `preview`.
- [ ] Create a Sentry project; set `EXPO_PUBLIC_SENTRY_DSN` for preview and production builds.
- [ ] Add the Sentry config plugin and `SENTRY_AUTH_TOKEN` for source maps.
- [ ] Run the real-device checks in `docs/mobile-qa-checklist.md`.
- [ ] Penetration test of the API and app by an independent tester (recommended before public launch).
