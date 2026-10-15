# Stanbic APIs: GH Trust mapping and status

All OpenAPI files are in `backend/app/integrations/stanbic/specs/`. Everything Stanbic-specific
switches on only with `PAYMENT_PROVIDER=stanbic`; Monnify stays the default until then.

## Wallet top-ups: Fundable Virtual ID

**This is Stanbic's virtual account product** (files `fvid-*.json`, `nuban-generator_3.0.0.json`).
It works differently from Monnify: there is **no "create account" call**.

1. Stanbic gives GH Trust a **4-digit prefix** (`STANBIC_FVID_PREFIX`).
2. Each customer's account number = prefix + a 5-digit serial we allocate + the check digit from
   Stanbic's **Nuban Generator** (bank code 221). One prefix = 99,999 customers.
3. A transfer to that number from any bank lands in GH Trust's pooled wallet account at Stanbic.
4. **Transaction history by prefix** lists every payment (other banks and Stanbic-to-Stanbic are
   separate lists). Each record has a `checksum` and `sessionId`.
5. The **Checksum Validator** confirms a record is genuine (`isValid`, amount, account) before
   we credit anything.

Code: `backend/app/modules/payments/stanbic_fvid.py`.

- Account numbers are allocated at sign-up (`WalletService.provision_payment_rail`), stored in
  `stanbic_virtual_accounts` (migration `027`). A failure leaves the customer signed in, and the
  `retry_wallet_accounts` job finishes it.
- Wallets are credited by polling: the `credit_stanbic_payments` job runs every 2 minutes, reads
  today's and yesterday's history, validates each checksum, and credits once per `sessionId`. A
  forged or mismatched record is rejected; one Stanbic can't confirm right now is retried next run;
  a payment to an unknown number is logged (`stanbic_fvid_unknown_account`) and not credited.
- Push notifications (instant credit) are not built: their format isn't in any file Stanbic gave.
  Polling works without them, and stays as the safety net once they are.

## Transfers out (withdrawals and loan payouts)

- NPS single transfer, transfer status and name enquiry: `portal_sandbox.py`, `StanbicClient`.
- **Bank codes:** Stanbic routes on 6-digit institution codes; the app and older saved accounts
  use 3-digit CBN codes. `bank_codes.py` converts using Stanbic's **Bank List**, which gives both
  codes per bank. Unknown codes are refused, never guessed. With Stanbic as the rail, the app's
  bank picker shows Stanbic's list.

## Other products

| Product | File | Use |
|---|---|---|
| Account Opening 2.0 + status | `account-opening_2.0.0.json`, `account-opening-status_1.0.0.json` | Full bank accounts (CASA). **Not** for the wallet |
| Current Account Opening | `current-account-opening_1.0.0.json` | Current account for an existing CIF. **Not** for the wallet |
| Transaction History | `transaction-history-service_1.0.0.json` | Settlement account statement |
| Credit Check | `credit-check_2.0.0.json` | Optional (`STANBIC_CREDIT_CHECK_ENABLED`) |
| Nuban Generator (Bank-Test) | `nuban-generator_3.0.0.json` | Check digit for our virtual account numbers |

## Status of our sandbox access

- App **"GH Trust Sandbox"** subscribed to **Bank-Test** (Default Plan). Keys are valid (the OAuth
  token is issued).
- Every call is still refused with **"Invalid Account or Client ID"** / **"This account number is
  not profiled for this Client Id"**: Stanbic has to **profile our Client ID to an account**.

## Still needed from Stanbic

1. **Profile our Client ID** for every subscribed product (Bank-Test, Fundable Virtual ID, NPS Funds Transfer).
2. **Our 4-digit Fundable Virtual ID prefix** (sandbox now, live later).
3. **Sandbox test accounts:** a funded source (settlement) account for NPS transfers, and test destination accounts.
4. **A way to simulate a payment** into a sandbox virtual account.
5. **Push notification details:** format, how to register our URL, retries.
6. **The name senders see** when paying a customer's virtual account.
7. **What NPS response codes mean** (success / processing / failed), and whether a repeated `clientRefId` is ignored or pays twice.
8. **Live URLs and live keys** (into Railway, never by email or chat).

## Sandbox env (`backend/.env`, not Railway)

```env
STANBIC_MOCK=false
STANBIC_PORTAL_SANDBOX=true
STANBIC_CLIENT_ID=
STANBIC_CLIENT_SECRET=
STANBIC_FVID_PREFIX=                 # from Stanbic
STANBIC_SETTLEMENT_ACCOUNT_NUMBER=   # from Stanbic: source for NPS transfers
# PAYMENT_PROVIDER=stanbic           # only when testing the Stanbic rail locally
```

Subscribe each product in the portal (Default Plan) with the same app ("GH Trust Sandbox").
