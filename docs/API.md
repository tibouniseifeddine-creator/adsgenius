# API Reference

Base URL: same origin as the frontend in production (Vercel serves both), or `VITE_API_URL` in local dev. All request/response bodies are JSON unless noted.

**Auth:** endpoints marked 🔒 require `Authorization: Bearer <token>` (the JWT returned by login/register). Unmarked endpoints are public by design (health check, the two `/api/public/*` endpoints used by the customer-facing order form, and the Meta OAuth callback, which Meta redirects the browser to directly with no way to attach a header).

Every endpoint returns `{ error: string }` with a 4xx/5xx status on failure; error messages are written to be safe to show a user (no stack traces or internal details are ever returned -- see `docs/SECURITY.md`).

## Auth

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` | Create a user + a new workspace (`{ email, password, name, businessName }`). Rate-limited per IP. |
| `POST /api/auth/login` | `{ email, password }` -> `{ user, token }`, or `{ twoFactorRequired: true, pendingToken }` if the account has 2FA enabled (see below). Rate-limited per IP and per email. |
| `GET /api/auth/me` | Current user + workspace, from the bearer token. |
| `POST /api/auth/logout` | Revokes the current session server-side. |
| `PATCH /api/auth/password` 🔒 | Change password (`{ currentPassword, newPassword }`). |

## Two-factor authentication (TOTP)

| Method & path | Purpose |
|---|---|
| `GET /api/auth/2fa/status` 🔒 | `{ enabled, recoveryCodesRemaining }`. |
| `POST /api/auth/2fa/setup` 🔒 | Generates a new TOTP secret; returns `{ secret, otpauthUrl }` for a QR code / manual entry. Not active until confirmed via `/verify`. 400 if 2FA is already enabled. |
| `POST /api/auth/2fa/verify` 🔒 | `{ code }` -- confirms the code from `/setup` matches, turns 2FA on, and returns `{ enabled: true, recoveryCodes }`. The recovery codes are shown exactly once and cannot be retrieved again afterward. |
| `POST /api/auth/2fa/disable` 🔒 | `{ password }` -- requires the current password, same as `PATCH /api/auth/password`. |
| `POST /api/auth/2fa/recovery-codes` 🔒 | `{ code }` -- regenerates recovery codes (invalidating any unused ones) without touching whether 2FA itself is on. |
| `POST /api/auth/2fa/login-verify` | Public (by necessity -- the caller isn't logged in yet). `{ pendingToken, code }` or `{ pendingToken, recoveryCode }` -> `{ user, token }`. `pendingToken` comes from `/api/auth/login`'s `twoFactorRequired` response and expires after 5 minutes. Rate-limited per IP and per pending token. |

## Workspace

| Method & path | Purpose |
|---|---|
| `GET /api/workspace` 🔒 | Current workspace profile. |
| `PATCH /api/workspace` 🔒 | Update `name` / `country` / `currency` / `timezone`. |

## Meta (Facebook) integration

| Method & path | Purpose |
|---|---|
| `GET /api/integrations/meta` 🔒 | Connection status. Never returns the access token. |
| `GET /api/integrations/meta/connect` 🔒 | Returns the Facebook OAuth dialog URL to redirect the browser to. |
| `GET /api/integrations/meta/callback` | Public -- Meta redirects here after the user approves/denies access. Verifies a signed, short-lived state token to attribute the callback to the right workspace. |
| `DELETE /api/integrations/meta` 🔒 | Disconnect. |
| `GET /api/integrations/meta/insights` 🔒 | Real account-level ad spend for the current month. |

## Campaigns

| Method & path | Purpose |
|---|---|
| `GET /api/campaigns` 🔒 | List campaigns (both locally-saved drafts and campaigns synced from Meta), newest first. |
| `POST /api/campaigns` 🔒 | Save a campaign plan built in the Campaign Builder. Does **not** publish anything to Meta. |
| `DELETE /api/campaigns/:id` 🔒 | Delete a draft campaign (synced-from-Meta campaigns can't be deleted here -- manage them in Meta Ads Manager). |
| `POST /api/campaigns/sync` 🔒 | Pull real campaigns/ad sets/ads + this-month insights from the connected Meta ad account. Read-only; rate-limited to 6/hour per workspace. |

## Products

| Method & path | Purpose |
|---|---|
| `GET /api/products` 🔒 | List products. |
| `POST /api/products` 🔒 | Create a product. |
| `GET /api/public/products/:id` | Public -- product info needed to render the customer-facing order form. |

## Creatives

| Method & path | Purpose |
|---|---|
| `GET /api/creatives` 🔒 | List creatives. |
| `POST /api/creatives` 🔒 | Manually add a creative. |
| `POST /api/creatives/generate-copy` 🔒 | AI-generate ad copy for a product + angle (Anthropic Claude). Subject to the monthly AI usage cap. |

## AI Creative Pack Engine

| Method & path | Purpose |
|---|---|
| `POST /api/creative-packs/analyze` 🔒 | Analyze a product photo (AI) and start a creative pack. |
| `GET /api/creative-packs` 🔒 | List creative packs. |
| `GET /api/creative-packs/:id` 🔒 | One creative pack with its concepts. |
| `PATCH /api/creative-packs/:id` 🔒 | Update pack metadata. |
| `POST /api/creative-packs/:id/concepts` 🔒 | Generate concept ideas (AI). |
| `POST /api/creative-packs/:id/concepts/:conceptId/regenerate` 🔒 | Regenerate one concept (AI). |
| `POST /api/creative-packs/:id/concepts/:conceptId/generate-image` 🔒 | Generate the concept's image (OpenAI); stored via Vercel Blob if configured. |
| `POST /api/creative-packs/:id/concepts/:conceptId/add-to-creative` 🔒 | Promote a concept into a real Creative row. |

## Audiences

| Method & path | Purpose |
|---|---|
| `GET /api/audiences` 🔒 | List audiences. |
| `POST /api/audiences` 🔒 | Manually add an audience. |
| `DELETE /api/audiences/:id` 🔒 | Delete an audience. |
| `POST /api/audiences/generate` 🔒 | AI-suggest 2-3 candidate audiences for a product (Anthropic Claude). |

## Orders & delivery

| Method & path | Purpose |
|---|---|
| `GET /api/orders` 🔒 | List orders. |
| `POST /api/orders` 🔒 | Create an order (internal use). |
| `PATCH /api/orders/:id` 🔒 | Update order status/fields. |
| `POST /api/public/orders` | Public -- customer-facing COD order submission from the order form. Rate-limited per IP. |
| `GET /api/delivery/zr-express/test` 🔒 | Verify ZR Express credentials are configured and working. |
| `POST /api/orders/:id/ship` 🔒 | Create a real shipment with ZR Express for a confirmed order. |

## Misc

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness/config check -- reports whether `DATABASE_URL`/`JWT_SECRET` are set, not their values. |

## Rate limits in effect

| Scope | Limit |
|---|---|
| Login, per IP | 20 / 15 min |
| Login, per email | 8 / 15 min |
| Register, per IP | 8 / hour |
| 2FA login-verify, per IP | 15 / 15 min |
| 2FA login-verify, per pending token | 8 / 15 min |
| Public order submission, per IP | 10 / 10 min |
| AI generation endpoints, per workspace | 40 / hour, plus a 300/calendar-month hard cap |
| Meta campaign sync, per workspace | 6 / hour |

Limits are in-memory per server instance -- see the "Known gaps" section of `docs/SECURITY.md`.
