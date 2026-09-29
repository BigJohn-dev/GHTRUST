# Mobile app: real-device checklist

Run before every store release, on a **preview build** (`eas build --profile preview`)
pointed at staging. Automated coverage:
- **Unit tests:** `cd mobile && npm test` (formatting, PIN rules, error wording,
  repayment and withdrawal maths, application form checks).
- **End-to-end flows:** `mobile/.maestro/` (see its README).

What's left needs a real phone.

## Test phones

| Phone | Why |
|---|---|
| Budget Android, 2–3 GB RAM, Android 10–12 (e.g. Tecno Spark, Itel, Infinix) | Most customers; slow CPU, small screen |
| Mid-range Android, Android 14+ (e.g. Samsung A-series) | Notification permission prompt, biometrics |
| iPhone with Face ID, current iOS | Face ID, iOS permission flows |
| Small screen (≤ 5.5") | Nothing cut off; buttons reachable |

## Performance (budget Android)

- [ ] **Cold start:** splash to Home in under 4 s on 4G.
- [ ] **Home:** scrolls smoothly (enable "Profile GPU rendering"; bars mostly under the line).
- [ ] **Transactions:** a list of 100+ items scrolls without blank gaps; the next page loads before the end.
- [ ] **Offer screen:** expanding the schedule and agreement doesn't stutter.
- [ ] **Memory:** after 10 minutes of use the app isn't killed when switching to the camera and back (face check, document photos).

## Slow and flaky networks

In Developer options, set the network to 3G, or use a throttling hotspot.

- [ ] Every screen shows a skeleton while loading, not a blank page.
- [ ] **Airplane mode:**
  - lists show a friendly error with Retry;
  - no raw error text appears;
  - turning the network back on recovers.
- [ ] **Repay and withdraw with the network dropped after tapping:**
  - retrying doesn't charge or pay out twice (idempotency);
  - the result is shown when you come back.
- [ ] **Uploads:** a document upload on 3G finishes, or fails with a clear message and can be retried.

## Accessibility

- [ ] **TalkBack (Android) and VoiceOver (iOS):**
  - every button, PIN key, tile and tab reads a sensible label;
  - checkboxes read their state;
  - status badges are announced.
- [ ] **Largest system font size:**
  - text wraps rather than overlapping;
  - PIN pad keys are still tappable;
  - amounts aren't cut off.
- [ ] **Touch targets:** at least 44 × 44 pt (PIN keys, back buttons, filter chips).
- [ ] **Colour:** errors and statuses are distinguishable without colour (text or icons carry the meaning).

## Security behaviour

- [ ] **Screenshots:** a screenshot on a PIN screen, the transaction PIN sheet or the new-phone code screen is blocked (Android shows "can't take screenshot"; iOS records a black screen).
- [ ] **iOS app switcher:** the app is blurred.
- [ ] **Auto-lock:** backgrounding for 5 minutes and returning asks for PIN or biometrics.
- [ ] **Uninstall and reinstall:** you're signed out, and the old session disappears from "Signed-in devices" on another phone.
- [ ] **Sign out of all devices:** another signed-in phone is signed out within a minute.

## Push notifications (needs `eas init`, credentials and the worker running)

- [ ] **Permission:** the notification offer during setup shows the system prompt; "Not now" doesn't prompt.
- [ ] **Money in:** a notification arrives within about a minute; tapping it opens the receipt.
- [ ] **Sign-in request:** signing in on a second phone notifies the first; tapping opens the approval screen.
- [ ] **Security switch:** turning notifications off in Security stops pushes; turning it back on resumes them.

## Journeys, end to end on staging

- [ ] Sign up (BVN, SMS code, face check, consent, PIN, transaction PIN, biometrics, notifications).
- [ ] Sign in on a trusted phone with the PIN; sign in on a new phone with approval.
- [ ] Apply for each product type; upload documents with the camera and from files; submit.
- [ ] **Staff approve in the admin portal, then the customer:**
  1. gets a notification;
  2. reviews the offer;
  3. accepts it with the PIN;
  4. staff pay out;
  5. the customer is notified and the loan appears.
- [ ] Fund the wallet by transfer; repay the next instalment; pay off early.
- [ ] Add a payout account; withdraw; check the receipt; a failed withdrawal returns the money.
- [ ] Report a problem from a receipt; staff reply in the admin portal; the customer is notified and sees the reply.
