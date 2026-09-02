# Security

This document describes AdsGenius's actual current security posture -- what's implemented, what depends on configuration, and what's explicitly not done yet. It's written to be checked against the code, not aspirational: every claim below points at a real mechanism in `api/index.ts` / `backend/src/server.ts` or `backend/prisma/schema.prisma`.

## Authentication

- Passwords are hashed with **bcrypt, cost factor 12**. Plaintext passwords are never stored or logged.
- Login is **timing-safe against user enumeration**: `bcrypt.compare` always runs, even for an email that doesn't exist, against a fixed dummy hash, so a failed login takes the same time whether the account exists or not.
- Login and registration are **rate-limited** independently per IP address and (for login) per email address, so brute-forcing a password or spamming account creation both hit a wall well before they'd succeed.
- Sessions are **JWTs (7-day expiry)** backed by a server-side `AuthSession` table. The table stores a **SHA-256 hash of the token**, never the token itself, and a session can be revoked server-side (logout) independent of the JWT's own expiry.
- `JWT_SECRET` is required at startup for any auth-related request; there is no default/fallback secret, so a misconfigured deployment fails closed rather than signing tokens with a guessable key.

## Multi-tenancy / data isolation

- Every data table is scoped by `workspaceId`, and every query that reads or writes a record re-derives the caller's `workspaceId` from their authenticated session -- a request can never be made to operate on another workspace's data by supplying a different ID in the request body or URL.
- Cross-references between a workspace's own records (e.g. a campaign referencing a product, an audience referencing a product) are validated to belong to the same workspace before being linked.

## Transport / API hardening

- **CORS fails closed.** If `FRONTEND_ORIGIN` isn't set, cross-origin requests are rejected outright rather than falling back to "allow any origin." Set it explicitly in every environment (comma-separated for multiple allowed origins).
- Standard **security headers** are set on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, and `Cross-Origin-Resource-Policy: cross-origin` (deliberately not `same-site`, since a legitimately CORS-allowed frontend can live on a different domain -- see `.env.example`).
- Request bodies are capped at 8MB (with a clean 413 response, not a crash) to bound memory use from the base64 product-photo upload path.
- All database access goes through Prisma's parameterized query builder -- there is no raw/string-concatenated SQL anywhere in the codebase, which rules out SQL injection as an attack class here.

## Secrets at rest

- **Meta access tokens are encrypted at rest** (AES-256-GCM) when `META_TOKEN_ENCRYPTION_KEY` is configured. Without it, tokens fall back to plaintext storage with a logged warning rather than breaking the integration -- **set this key before connecting any real customer's ad account** (see `.env.example` for how to generate one). A token encrypted under one key cannot be decrypted after the key is rotated or removed; affected connections need to be reconnected.
- No API keys, database credentials, or other secrets are committed to the repository -- `.env.example` documents every variable name and purpose without real values, and `.gitignore` excludes `.env`.

## Third-party data exposure

See `docs/THIRD_PARTY_SERVICES.md` for the full list of external services this product talks to and what each one sees. In summary: product/creative text and photos go to Anthropic and OpenAI for AI generation; a connected Meta ad account's read-only spend/campaign data comes from Meta's Graph API; order and delivery details go to ZR Express only when a real shipment is created.

## Known gaps / explicitly out of scope today

These are tracked, not hidden:

- **No 2FA / MFA.** Password + email is the only login factor today.
- **No audit log coverage across all sensitive actions** -- `AuditLog` exists and is used for order/shipment actions, but isn't yet applied to every data-changing endpoint.
- **No automated dependency vulnerability scanning** configured in CI yet (e.g. `npm audit` / Dependabot / Snyk) -- run one before a production launch with real customer data, and periodically afterward.
- **No formal penetration test** has been performed. The hardening above reflects secure-coding practice applied during development, not third-party security validation.
- **Campaign publishing to Meta is not implemented at all** (see the main README's Roadmap section) -- this was a deliberate scope decision, not an oversight: writing campaigns/ad sets/ads to a real ad account can spend real money, and doing that safely needs an explicit decision on write-scope and launch-safety defaults (e.g. campaigns always created paused) before any code is written, not after.
- **Rate limiting is in-memory**, reset on server restart and not shared across serverless function instances. It stops casual abuse; it is not a substitute for a real distributed rate limiter (e.g. Redis-backed) at higher scale.

## Reporting a vulnerability

Replace this section with real contact details and a disclosure policy before this document is shown to anyone outside your team.
