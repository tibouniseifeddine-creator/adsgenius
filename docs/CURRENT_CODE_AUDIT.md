# AdsGenius — Current Code Audit V1

**Branch audited:** `main`  
**Audit date:** 2026-08-14  
**Purpose:** Establish the current prototype baseline before any architectural refactor.

> No production refactor is authorized from this document alone. This audit records what is observable in the current GitHub baseline and assigns a preliminary KEEP / MOVE / MERGE / REWRITE / DELETE disposition.

---

## 1. Executive Assessment

The current repository is a **frontend prototype**, not yet the target production application architecture.

The repository contains a React/Vite application with multiple product-oriented pages, reusable UI components, contexts, types, local data, and service classes. The current package configuration is frontend-only: React 18, React Router, Recharts, Lucide, Tailwind/PostCSS, TypeScript and Vite are present; there is no backend, database, Prisma, PostgreSQL, Tauri or mobile application layer in the audited `main` baseline. fileciteturn18file0L2-L10

The most important finding is that the existing service layer is **simulation/mock logic**, not real production integrations. AIService explicitly returns simulated analysis, MetaService reports a mock connection and returns placeholder campaign operations, DeliveryService generates fake tracking data, and OrderService returns in-memory placeholder results. fileciteturn22file0L2-L10 fileciteturn23file0L2-L10 fileciteturn24file0L2-L10 fileciteturn25file0L2-L10

Therefore the current code should be treated as a **UI/product prototype and source of reusable concepts**, not as a production backend foundation.

---

## 2. Repository Structure Observed

The `src` tree currently contains:

```text
src/
├── App.tsx
├── components/
├── contexts/
├── data/
├── hooks/
├── index.css
├── main.tsx
├── pages/
├── services/
├── types/
└── utils/
```

This is a reasonable prototype-level separation, but it is not yet feature/domain architecture. fileciteturn16file0L2-L10

The repository includes dedicated contexts for authentication, demo state, and language. fileciteturn19file0L2-L10

The current pages cover substantial product concepts including AI Optimizer, Analytics, Audience Lab, Campaign Builder, Campaigns, Copywriter, Creative Studio, Dashboard, Integrations, Login, Orders and Product Analysis. fileciteturn20file0L2-L2

---

## 3. Preliminary Disposition Matrix

### Root / tooling

| Area | Current role | Preliminary action | Reason |
|---|---|---|---|
| `package.json` | Vite/React prototype configuration | **REWRITE / MOVE** | Must evolve into workspace/multi-platform architecture; retain useful dependencies only. |
| `package-lock.json` | npm lockfile | **REWRITE** | Depends on final package manager/workspace decision. |
| `index.html` | Web entry point | **KEEP / ADAPT** | Useful for web renderer; not sufficient as complete desktop/mobile packaging strategy. |
| `postcss.config.js` | CSS tooling | **KEEP / ADAPT** | Likely reusable if Tailwind remains. |
| `.gitignore` | Repository hygiene | **KEEP / REVIEW** | Retain and extend for desktop/mobile/backend artifacts and secrets. |

### Application entry points

| Area | Action | Reason |
|---|---|---|
| `src/main.tsx` | **KEEP / REWRITE** | Preserve renderer bootstrap concept; adapt to final application shell. |
| `src/App.tsx` | **REWRITE** | Current application routing/composition should move toward feature/domain architecture. |
| `src/pages/App.tsx` | **MERGE / REWRITE** | Naming indicates overlapping application-root responsibility; must be resolved to avoid architectural confusion. |

### Contexts

| File | Action | Reason |
|---|---|---|
| `AuthContext.tsx` | **MOVE / REWRITE** | Authentication state should consume a typed API client/auth module rather than remain UI-owned. |
| `LanguageContext.tsx` | **KEEP / MOVE** | Internationalization is important and reusable; move toward dedicated i18n architecture. |
| `DemoContext.tsx` | **DELETE from production path / PRESERVE as reference** | Demo state must not become production state. Existing demo concepts can inform fixtures/tests. |

The presence of a dedicated DemoContext confirms that demo/prototype state is part of the current architecture and must be explicitly separated from production state. fileciteturn19file0L2-L10

### Data

| Area | Action | Reason |
|---|---|---|
| `src/data/demoData.ts` | **PRESERVE as fixture reference / MOVE or DELETE from production path** | Large demo dataset is useful for UI fixtures but cannot be the production source of truth. |
| `src/data/translations.ts` | **KEEP / MOVE** | Translation content is reusable; move to proper i18n structure and validate localization. |

### Services

| File | Action | Reason |
|---|---|---|
| `AIService.ts` | **REWRITE** | It is explicitly simulated and must become a backend AI capability with provider abstraction. fileciteturn22file0L2-L10 |
| `MetaService.ts` | **REWRITE** | It is explicitly mock-only; must become isolated Meta integration through backend OAuth/API modules. fileciteturn23file0L2-L10 |
| `DeliveryService.ts` | **REWRITE** | Current tracking/shipment operations are fabricated placeholders; replace with provider adapter architecture. fileciteturn24file0L2-L10 |
| `OrderService.ts` | **REWRITE** | Current methods return empty/placeholder data and must become persistent backend domain operations. fileciteturn25file0L2-L10 |

### Pages

The current pages should **not be deleted** merely because their architecture is prototype-level. They represent substantial UX/product work and should be audited individually for reusable UI, workflows, terminology and requirements.

Preliminary rule:

`pages/* → MOVE / REFACTOR into feature modules`, not blind deletion.

High-value candidates for preservation as product concepts include:
- Dashboard
- Campaigns
- Campaign Builder
- Analytics
- AI Optimizer
- Creative Studio
- Copywriter
- Audience Lab
- Product Analysis
- Orders
- Integrations

These map strongly to the product direction in the Master Spec, but their current data/service wiring must be replaced progressively.

### Shared UI

The current component structure includes dashboard components, layout components and reusable UI components such as Badge, Button, Card, Input and Select. These are strong candidates for **KEEP / MOVE** into a design-system/shared UI layer after visual and accessibility review. fileciteturn14file0L2-L2

---

## 4. Critical Architecture Findings

### Finding A — No production backend in the audited main baseline

The current `package.json` contains only frontend build/development scripts and frontend dependencies. fileciteturn18file0L2-L10

**Severity:** Critical for production architecture.

**Decision:** Build a separate backend/domain/API layer rather than embedding production business logic into React.

### Finding B — AI is completely simulated

`AIService` returns hard-coded analysis, generated creatives, copy and audience examples. Its campaign analysis returns an empty array and its creative score is a fixed simulated score. fileciteturn22file0L2-L10

**Severity:** Critical.

**Decision:** Replace with backend AI modules and provider abstraction; retain current method names only as conceptual references, not as final architecture.

### Finding C — Meta integration is mock-only

`MetaService.connect()` explicitly returns a mock connection message. Campaign creation returns generated fake IDs, insights return an empty array, and budget/pause operations always return success. fileciteturn23file0L2-L10

**Severity:** Critical.

**Decision:** No UI may treat these methods as real platform actions. Production Meta integration must be server-side, permission-aware and auditable.

### Finding D — Delivery integration is simulated

The current delivery service fabricates tracking numbers and always returns an example status/location. fileciteturn24file0L2-L10

**Severity:** Critical for COD/profit intelligence.

**Decision:** Replace with a provider abstraction and real provider adapters after API capability verification.

### Finding E — Orders are not persistent

The current order service returns an empty order list, reports successful status updates without persistence, and generates local IDs. fileciteturn25file0L2-L10

**Severity:** Critical.

**Decision:** Orders become a backend/PostgreSQL domain with auditability and delivery-state synchronization.

### Finding F — Demo architecture is mixed with product architecture

The presence of `DemoContext` and `demoData` means prototype data has a first-class path in the current app. fileciteturn19file0L2-L10

**Severity:** High.

**Decision:** Create a strict boundary between fixtures/demo mode and production repositories/API clients.

### Finding G — Application structure is page-centric rather than domain/feature-centric

The current `src` structure separates `pages`, `services`, `contexts`, `data`, `types`, etc. This is acceptable for a prototype, but the target system requires domain boundaries and shared contracts. fileciteturn16file0L2-L10

**Severity:** High.

**Decision:** Refactor toward feature/domain modules after requirements and architecture are frozen.

---

## 5. Reuse Strategy

### Preserve aggressively

The following should be preserved as references and potentially reused:
- Visual design
- Layout concepts
- Navigation concepts
- Reusable UI components
- Page workflows
- Translation content
- Type vocabulary where it remains valid
- Demo fixtures as test/design fixtures
- Product terminology

### Do not preserve blindly

Do not preserve as production architecture:
- mock services
- hard-coded AI outputs
- fabricated Meta operations
- fabricated delivery tracking
- in-memory order operations
- demo contexts as source of truth
- page components containing hidden business rules

---

## 6. Target Transformation

Current:

```text
React Pages
   ↓
Contexts
   ↓
Mock Services
   ↓
Demo Data
```

Target:

```text
Desktop / Mobile / Web UI
          ↓
Feature Modules
          ↓
Typed API Client
          ↓
Backend API
          ↓
Domain Services
     ┌────┼─────────────┐
     ↓    ↓             ↓
 PostgreSQL   AI Layer   Integrations
                         ├── Meta
                         ├── Google
                         ├── TikTok
                         └── Shipping Providers
```

---

## 7. Priority Refactor Order

Do not refactor all pages at once.

Recommended order after Product Requirements V2 and Architecture V2:

1. Repository/workspace foundation
2. Shared types and validation
3. Authentication/session architecture
4. Backend/domain foundation
5. Database/PostgreSQL
6. API client
7. Product domain
8. Campaign domain
9. Creative domain
10. Analytics/diagnosis
11. AI layer
12. Meta integration
13. Orders/delivery/profit loop
14. Country packs
15. Desktop/mobile packaging
16. Testing/security/observability

---

## 8. Items Requiring Deeper File-Level Audit

The current document is a **structural and service-level baseline audit**. Before any major refactor, the following must receive deeper individual review:

- Every page file
- Every component
- Every type definition
- Every utility
- Every translation key
- Every import/dependency relationship
- Every route
- Every state mutation
- Every use of localStorage
- Every external URL/API reference
- Authentication flow
- Error/loading states
- Accessibility
- Responsive behavior
- Security-sensitive code

This second pass should produce a detailed inventory if required before Architecture V2 is frozen.

---

## 9. Current Disposition Summary

| Category | Preliminary disposition |
|---|---|
| UI/design work | **KEEP / MOVE / REFINE** |
| Reusable UI components | **KEEP / MOVE** |
| Product page concepts | **KEEP / REFACTOR** |
| Demo data | **PRESERVE AS FIXTURES** |
| Demo context | **REMOVE FROM PRODUCTION PATH** |
| Translation data | **KEEP / RESTRUCTURE** |
| Types | **AUDIT / MOVE TO SHARED DOMAIN CONTRACTS** |
| AIService | **REWRITE** |
| MetaService | **REWRITE** |
| DeliveryService | **REWRITE** |
| OrderService | **REWRITE** |
| Frontend entry/routing | **REFACTOR** |
| Current project architecture | **REPLACE PROGRESSIVELY** |
| Existing visual/product ideas | **DO NOT DISCARD** |

---

## 10. Gate Before Architecture V2

Architecture V2 must not be frozen until:

- Competitor Gap Matrix is validated
- Current code audit is sufficiently complete
- Product Requirements V2 identifies P0/P1/P2 capabilities
- Major existing UI is mapped to the new domain model
- Production integrations are identified
- Security boundaries are defined

### Golden rule

> **Reuse the prototype's valuable product and UI work; do not reuse its mock production architecture.**
