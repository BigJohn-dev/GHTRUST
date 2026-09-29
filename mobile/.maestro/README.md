# End-to-end tests (Maestro)

Real-app flows on an Android emulator or phone: sign-up, unlock with the PIN, starting an
application, adding a payout account, and reporting a problem. They drive the app by its
visible text, so they double as a check that key wording didn't change by accident.

## Run locally

1. Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
2. Start the API with test data and mocked providers:
   `cd backend && python scripts/dev_server.py --reset --wallet`
3. Build and install a release APK that talks to it. From an emulator, the host is `10.0.2.2`:
   ```bash
   cd mobile
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 EXPO_PUBLIC_ALLOW_INSECURE_API=1 npx expo run:android --variant release
   ```
   `EXPO_PUBLIC_ALLOW_INSECURE_API=1` is for this test build only; real builds refuse plain HTTP.
4. Run the flows: `maestro test .maestro`

Flows run in the order in `config.yaml`, sharing one install: `01-sign-up` creates the
account the others use. Restart the dev server with `--reset` before each full run.

## In CI

`.github/workflows/e2e-android.yml` runs the same flows on an emulator. Start it by hand
from the Actions tab ("Run workflow"); it takes about 30–40 minutes, so it isn't part of
every pull request.

## Not covered here

Funding the wallet and repaying need a bank transfer; test them with
`backend/scripts/dev_credit_wallet.py` or on staging (see `docs/mobile-qa-checklist.md`).
Push notifications and biometrics need a real phone.
