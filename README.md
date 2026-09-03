# AdsGenius

AdsGenius is a workspace-based platform for e-commerce and cash-on-delivery (COD) sellers -- built with the Algeria market in mind (default currency DZD, default country DZ) but not hard-coded to it -- to manage products, orders, ad creatives, audiences, and Meta (Facebook/Instagram) ad campaigns from one place.

This document is the entry point for anyone evaluating, deploying, or extending the codebase: what it does, how it's built, how to run it, and where the rest of the documentation lives.

## What it does

- **Products** -- catalog with cost/price/margin fields (`baseCost`, `salePrice`, `shippingCost`, `packagingCost`, expected cancellation/return rates) used everywhere else in the app for real profit math, not estimates.
- **Orders** -- order intake (including a public, unauthenticated order form per product for COD checkout links), status tracking (`confirmed` -> `shipped` -> `delivered` / `cancelled` / `returned`), and real shipment creation through the ZR Express (Procolis) courier API for Algeria.
- **Creatives & Copywriter** -- AI-assisted ad copy generation (via Anthropic Claude) tied to a real product and angle, plus a manual creative library.
- **AI Creative Pack Engine** -- upload a product photo, get an AI analysis (positioning, target customer, objections) and 2-3 AI-generated creative concepts, with AI image generation via OpenAI for each concept.
- **Audience Lab** -- manual or AI-suggested (Claude) audience targeting profiles (age/gender/location/interests) per product.
- **Campaigns & Campaign Builder** -- build and save a campaign plan (product, objective, destination, budget, audiences, creatives) as a real record in your account. Campaigns are also synced read-only from a connected Meta ad account (see Integrations) so real spend/impressions/clicks show up next to your saved plans. Publishing a saved plan *to* Meta (creating a live, spending campaign) is intentionally not implemented -- see [Roadmap](#roadmap--known-gaps).
- **Dashboard & Analytics** -- real KPIs computed from your own orders/products (revenue, net profit, delivery rate, cancellation rate) plus real ad spend/ROAS/CAC/CPA once a Meta ad account is connected (only computed when the ad account's currency matches your workspace currency, to avoid silently mixing currencies).
- **Integrations** -- real OAuth connection to one Meta ad account per workspace (read-only `ads_read` scope). Other providers (website, delivery) are shown but not yet wired to a real connection.
- **AI Optimizer** -- surfaces AI-generated recommendations; clearly labeled as sample output until it's backed by a connected ad account with enough real spend history.
- **Multi-user workspaces** -- a workspace has members with roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`); all data is scoped by `workspaceId` end to end.
- **Settings** -- workspace profile (name, country, currency, timezone) and account password management.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts |
| Backend | Express 5 (TypeScript), served two ways: `api/index.ts` as a Vercel serverless function, `backend/src/server.ts` as a standalone process for local dev -- **these two files must stay byte-identical**, enforced by CI (see below) |
| Database | PostgreSQL via Prisma ORM 6 (built and tested against [Neon](https://neon.tech)) |
| Auth | Email/password, bcrypt (cost 12), JWT access tokens (7-day expiry) backed by a server-side session table (SHA-256 token hashes, revocable), timing-safe login (dummy-hash comparison for non-existent emails), per-IP and per-email rate limiting on login/register |
| AI | Anthropic Claude (copywriting, product/creative analysis, audience suggestions), OpenAI (`gpt-image-1` by default, for AI creative image generation) |
| Ad platform | Meta Marketing API (Graph API v26.0), OAuth authorization-code flow, `ads_read` scope only |
| File storage | Vercel Blob for AI-generated creative images (falls back to inline base64 storage if not configured) |
| Delivery | ZR Express / Procolis courier API (Algeria) |
| Hosting | Vercel (frontend as a static build + API as serverless functions) |

## Repository layout

```
api/index.ts              Vercel serverless entrypoint (the real backend)
backend/src/server.ts     Byte-identical copy, run as a normal Express server for local dev
backend/prisma/schema.prisma   Database schema
backend/prisma/migrations/     Versioned SQL migrations
src/                       Frontend (pages, components, contexts, lib)
src/pages/                 One file per route (Dashboard, Products, Campaigns, ...)
src/contexts/DemoContext.tsx + src/data/demoData.ts   Legacy sample-data provider, still used by a
                           couple of illustrative-only surfaces; everything under Pending work in
                           the changelog below reads/writes real data instead.
docs/                      This documentation set
```

## Getting started (local development)

1. **Install dependencies**
   ```
   npm install
   ```
   `postinstall` runs `prisma generate` automatically.

2. **Configure environment variables** -- copy `.env.example` to `.env` and fill in at minimum `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_ORIGIN` (e.g. `http://localhost:5173`). Every variable is documented inline in `.env.example`, including which features degrade gracefully vs. which are hard requirements.

3. **Run the database migrations**
   ```
   npx prisma migrate deploy --schema backend/prisma/schema.prisma
   ```

4. **Run the app** -- two processes, in two terminals:
   ```
   npm run dev              # Vite frontend, http://localhost:5173
   npx tsx backend/src/server.ts   # API, http://localhost:4000 by default (PORT)
   ```
   Set `VITE_API_URL=http://localhost:4000` if the frontend needs to reach a separately-hosted API.

5. **Build for production**
   ```
   npm run build             # tsc && vite build
   ```

## Deploying (Vercel)

`vercel.json` builds `api/index.ts` as a serverless function (with `backend/**` bundled alongside it, since it imports from there) and the frontend as a static build. Set every required environment variable from `.env.example` in the Vercel project settings before the first deploy. See `docs/SECURITY.md` for which variables are security-critical (`JWT_SECRET`, `META_TOKEN_ENCRYPTION_KEY`) and must never be left unset in production.

## The `api/index.ts` / `backend/src/server.ts` mirror

The same backend code exists in two files because Vercel's serverless model and a normal long-running Express process need different entrypoints, but there is exactly one implementation to reason about, test, and audit. CI diffs the two files on every change and fails the build if they diverge. **Any backend change must be applied to both files identically** -- copy, don't hand-edit twice.

## Documentation

- [`docs/SECURITY.md`](docs/SECURITY.md) -- what's implemented, what's configuration-dependent, and what's explicitly out of scope today.
- [`docs/API.md`](docs/API.md) -- endpoint reference.
- [`docs/THIRD_PARTY_SERVICES.md`](docs/THIRD_PARTY_SERVICES.md) -- every external service the product talks to and what data it sees.
- [`docs/DEPENDENCY_AUDIT.md`](docs/DEPENDENCY_AUDIT.md) -- known-CVE review of pinned dependencies and what to check with `npm audit`.
- [`docs/TESTING.md`](docs/TESTING.md) -- how to run the automated test suite, including the integration tests that need a database.
- [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md) and [`docs/TERMS_OF_SERVICE.md`](docs/TERMS_OF_SERVICE.md) -- drafts to adapt and have reviewed by a lawyer before publishing publicly (see the notice at the top of each).
- [`CHANGELOG.md`](CHANGELOG.md) -- what's shipped, in what order, and why.

## Roadmap / known gaps

Tracked deliberately rather than hidden:

- **Publishing campaigns to Meta** (creating a real, live, spending campaign from the Campaign Builder) is not implemented. Today the Builder only saves a local plan, and Campaigns only reads real data back from Meta -- see `docs/SECURITY.md` for why this was scoped out rather than guessed at.
- **Billing** is an internal usage cap (300 AI generations/workspace/month), not real subscriptions/payments -- there is no payment provider integration yet.
- **One Meta ad account per workspace.** Choosing between several ad accounts a user manages isn't built.
- **Other integrations** (website/e-commerce platform, other couriers) shown in Integrations are illustrative only, not real connections.
- Several list endpoints use a hard page-size cap (200) rather than real cursor pagination -- fine at current scale, worth revisiting before a workspace has thousands of rows.
