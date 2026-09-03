# Changelog

This changelog tracks the transition of AdsGenius from a UI/demo-data prototype to a product backed by real data and real integrations. Entries are grouped by the audit finding they close (an internal finding ID, not a public issue tracker) so the reasoning behind each change stays traceable in the code comments.

## 2026-09-03 -- Dependency audit, and an automated test suite

- **Dependency vulnerability audit:** reviewed every pinned dependency against known CVEs (no live `npm audit` access in the environment this was done in -- see `docs/DEPENDENCY_AUDIT.md` for the full methodology and results). Raised `vite` from `^5.0.0` to `^5.4.21`, closing two dev-server-only CVEs (CVE-2025-31125, CVE-2025-62522). Flagged one ambiguous, unconfirmed finding (`cors`) and one pre-existing unpinned dependency (`@vercel/blob: "latest"`) for the maintainer to resolve with real `npm audit` access.
- **Automated tests (P11):** added a Vitest suite covering the security-sensitive helper functions (token hashing, rate limiting, email format validation, Meta token encryption) with no external dependencies, plus an integration suite -- run only when `DATABASE_URL` is set -- that drives real HTTP requests through the actual Express app to verify registration, login, and that one workspace's data cannot be read or referenced by another. Wired into CI (`.github/workflows/ci.yml`) so the unit tests run on every push and pull request. See `docs/TESTING.md`.
- **Two-factor authentication (P12):** optional TOTP-based 2FA (RFC 6238), compatible with any standard authenticator app -- QR code and manual-entry setup in Settings, one-time recovery codes for lost-device recovery, and a required second step at login once enabled. The TOTP secret is encrypted at rest with the same AES-256-GCM scheme already used for Meta access tokens; recovery codes are stored only as hashes and shown once. Implemented with Node's built-in `crypto` (HMAC-SHA1) rather than a new backend dependency; verified against the official RFC 6238 test vectors in `backend/src/__tests__/two-factor.test.ts`.

## 2026-09-02 -- Real campaigns, Campaign Builder, and a technical security pass

- **Campaigns & Campaign Builder (P03/P08):** added real `Campaign`/`AdSet`/`Ad` database tables. The Campaign Builder now reads real products/audiences/creatives and saves a real campaign plan to your account (`POST /api/campaigns`) instead of simulating a "MOCK MODE" launch. A new "Sync from Meta" action (`POST /api/campaigns/sync`) pulls real campaigns, ad sets, ads, and this-month spend/impressions/clicks from a connected Meta ad account, read-only. Publishing a saved plan *to* Meta was deliberately left out of scope -- see `docs/SECURITY.md`.
- **Technical security hardening:**
  - Meta access tokens are now encrypted at rest (AES-256-GCM) instead of stored in plaintext.
  - Added standard security response headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy`).
  - Added per-IP rate limiting to account registration (previously unprotected against spam signups).

## 2026-09-01/02 -- Real Meta integration, storage, and usage limits

- **P04 -- Meta (Facebook) Ads integration:** real OAuth connection to one Meta ad account per workspace, read-only `ads_read` scope. Surfaces real account name, currency, and monthly spend in Integrations and Dashboard.
- **P28 -- Real image storage:** AI-generated creative images are now stored via Vercel Blob instead of only as inline base64 data (which doesn't scale and bloats every API response that includes an image).
- **P05 -- Usage limits:** added an internal cap of 300 AI generations per workspace per calendar month (reusing the existing AI task audit trail), pending a real billing/subscription system.

## 2026-09-01 -- Removing fake UI and wiring real data end to end

- **P30:** removed a fake password-recovery flow (email/phone/QR) from the login page that had no backend behind it and would have silently failed to deliver anything to a real user. Replaced with an honest "not available yet" notice.
- **P21:** audited every page for buttons with no handler or a handler that did nothing. Wired the ones with a real backend behind them (Copywriter, Products -> Creative Studio, Product Analysis); disabled the rest with a clear explanation instead of leaving them silently inert.
- **P09:** rewired Dashboard, Campaigns, Analytics, Integrations, and the AI Optimizer off `DemoContext`'s fake data and onto real `/api/orders`, `/api/products`, and (once connected) real Meta ad data -- with an explicit "sample data" label anywhere a real data source doesn't exist yet, rather than presenting demo numbers as if they were real.
- **P22:** completed the account Settings page (profile, workspace, password change) against the real backend.

## Earlier

Foundational work -- authentication, the core Product/Order/Creative/Audience data model, the AI Creative Pack Engine, and the ZR Express courier integration -- predates this changelog's start and is reflected in the current schema and `docs/API.md` rather than itemized here.
