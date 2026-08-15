# AdsGenius — Decision Log

## D001 — Master project baseline
- **Status:** Accepted
- **Decision:** Keep a permanent project specification inside the Git repository.
- **Reason:** Prevent repeated work, contradictory instructions, architectural drift, and loss of project context.

## D002 — Product form factor
- **Status:** Accepted
- **Decision:** AdsGenius is being designed as a multi-platform application for Windows, macOS, Android and iOS/iPadOS, rather than a browser-only SaaS product.
- **Reason:** This is the current product direction agreed for the project.

## D003 — Market-gap-first methodology
- **Status:** Accepted
- **Decision:** Competitor and market-gap research must happen before final architecture freeze and major refactoring.
- **Reason:** The goal is to build a globally differentiated product rather than reproduce existing tools.

## D004 — Current GitHub project is the baseline
- **Status:** Accepted
- **Decision:** The existing GitHub repository is preserved as the prototype baseline. Existing work is audited before deletion or major rewrite.
- **Reason:** Avoid losing useful UI/work and avoid repeating the Kimi workflow problems.

## D005 — Controlled development workflow
- **Status:** Accepted
- **Decision:** Major changes should be incremental, reviewable, documented and tested rather than one large uncontrolled rebuild.
- **Reason:** Reduce duplication, regression risk and coding-agent drift.

## D006 — Preferred technical direction
- **Status:** Provisional
- **Decision:** React + TypeScript + Tauri 2 is the current preferred multi-platform direction, with a separate backend and PostgreSQL.
- **Reason:** The current prototype already contains substantial React/Vite UI that may be reusable.
- **Caveat:** Final architecture remains provisional until competitor-gap research and full code audit are complete.

## D007 — Global Core + Country Packs
- **Status:** Accepted as a design principle
- **Decision:** Build a global core with country-specific capabilities isolated into country packs/integrations.
- **Reason:** Support international expansion without coupling the core to Algeria-specific logic.

## D008 — Controlled AI autonomy
- **Status:** Accepted
- **Decision:** AI automation uses explicit permission levels from analysis/recommendation through approved execution and user-defined rule automation.
- **Reason:** Protect user control and advertising accounts while allowing future automation.

## D009 — Phase 0 package manager strategy
- **Status:** Accepted for Phase 0
- **Decision:** Keep npm as the package manager for the current single-package React/Vite prototype. Defer the pnpm workspace migration until the target multi-package architecture is actually introduced.
- **Context:** The target architecture anticipates shared client, backend, and package workspaces, but the current repository is still a single frontend prototype.
- **Reason:** Avoid a structural migration that would add risk without delivering Phase 0 value. Preserve the existing lockfile/tooling conventions while establishing reproducible engineering checks.
- **Consequence:** Phase 0 uses npm commands. The future workspace migration must be explicit, reviewed, and documented rather than introduced as an incidental tooling change.

## D010 — Phase 0 quality tooling
- **Status:** Accepted for Phase 0
- **Decision:** Use TypeScript strict checking, ESLint, Prettier, and Vitest for the current React/Vite prototype.
- **Reason:** These tools fit the existing Vite/TypeScript stack and provide a small, incremental engineering foundation without changing product behavior.
- **Consequence:** The repository now has reproducible quality commands and CI coverage for typecheck, lint, tests, and production build.

## D011 — Phase 1 workspace transition
- **Status:** Accepted
- **Decision:** Introduce npm workspaces in Phase 1 for `backend` and shared packages while retaining the existing root React/Vite application in place.
- **Reason:** Phase 1 now implements the target architecture's first backend/shared-contract boundaries. Moving the prototype wholesale is explicitly deferred.
- **Consequence:** Future feature migration can proceed incrementally behind stable contracts instead of requiring a repository rewrite.

## D012 — Phase 1 database foundation
- **Status:** Accepted
- **Decision:** Use PostgreSQL with Prisma as the initial database access and migration foundation.
- **Reason:** The approved database design names PostgreSQL as the production system of record and explicitly calls for Prisma schema/migrations.
- **Consequence:** Phase 1 contains only an infrastructure marker table. Product/domain tables remain deferred to their respective roadmap phases.

## D013 — Phase 1 infrastructure adapters
- **Status:** Accepted
- **Decision:** Introduce interfaces for object storage and background jobs without selecting production vendors yet.
- **Reason:** The architecture requires these boundaries, while the roadmap intentionally leaves the queue/storage technology open until infrastructure constraints are evaluated.
- **Consequence:** In-memory/no-op implementations are limited to development scaffolding and cannot be treated as production integrations.

## D014 — Phase 3 product economics model
- **Status:** Accepted
- **Decision:** Persist products and variants in PostgreSQL under workspace ownership, use Prisma Decimal for monetary fields, and calculate expected net margin/break-even from base cost, fulfillment costs, and expected cancellation/return rates.
- **Reason:** Phase 3 requires precise monetary handling and economics that reflect the COD-oriented business model rather than demo-only prices.
- **Consequence:** Product calculations remain provider-neutral. Shipping-provider and actual order outcomes are deferred to Phase 7, where expected versus actual profit can be reconciled.

## D015 — Phase 3 prototype migration boundary
- **Status:** Accepted
- **Decision:** Migrate the Products screen to the persisted API while preserving the broader prototype UI and DemoContext for features not yet covered by their roadmap phases.
- **Reason:** Phase 3 requires core product operations to stop depending on demo product state without prematurely rewriting unrelated screens.
- **Consequence:** Later phases can migrate other domains incrementally behind the same API/shared-contract pattern.

## D016 — Phase 4 creative lineage and AI boundary
- **Status:** Accepted
- **Decision:** Persist Creative, CreativeVersion, CreativeAsset, and CreativeCopy as workspace-scoped domain records, and persist AITask, AIPromptVersion, and AIUsage as the traceability boundary for AI capabilities.
- **Reason:** Creative outputs must remain attributable to their product/context and to the exact provider/model/prompt version that produced them.
- **Consequence:** Phase 4 exposes a provider-neutral AI orchestration interface and a MOCK provider only. Production AI credentials/providers are intentionally deferred; no provider secret is placed in the client.

## D017 — Phase 4 asset storage boundary
- **Status:** Accepted
- **Decision:** Creative assets store an internal storage key or an external media reference; binary storage remains behind the existing server-side Storage interface.
- **Reason:** The architecture requires object storage for media while the roadmap does not yet freeze a production storage vendor.
- **Consequence:** Phase 4 does not upload media directly from the client to an unapproved vendor or embed storage credentials in application code.

## D018 — Phase 5 provider-neutral campaign hierarchy
- **Status:** Accepted
- **Decision:** Persist Audience, Campaign, AdSet, and Ad as workspace-scoped provider-neutral entities. Provider-specific IDs and external mutations remain outside the core domain and are deferred to the dedicated integration phases.
- **Reason:** Phase 5 must replace prototype campaign state with a stable domain model before Meta or other advertising-provider integrations are introduced.
- **Consequence:** Campaigns can reference workspace-owned products, audiences, creative versions, and copy assets; tracking configuration is stored as provider-neutral JSON; campaign readiness is validated server-side before READY/ACTIVE states are allowed.

## D019 — Phase 5 pre-launch validation gate
- **Status:** Accepted
- **Decision:** A campaign cannot become READY or ACTIVE unless it contains at least one ad set and every ad set contains at least one ad with workspace-valid creative/copy references.
- **Reason:** Prevent incomplete campaign structures from being treated as launchable while external publishing remains intentionally out of scope.
- **Consequence:** The campaign builder creates the hierarchy as DRAFT, then promotes it to READY only after the server-side validation gate passes.

## D020 — Phase 6 analytics normalization and diagnosis boundary
- **Status:** Accepted
- **Decision:** Introduce `PerformanceSnapshot` as the normalized analytics ingestion boundary, with explicit metric provenance and deterministic KPI calculations. Campaign diagnosis is persisted separately as evidence-backed `PerformanceDiagnosis` records with `AnalyticsRecommendation` children.
- **Reason:** Phase 6 must distinguish reported, calculated and estimated information and preserve the exact data window/evidence used for diagnosis.
- **Consequence:** Analytics logic remains provider-neutral. External advertising integrations are not introduced in Phase 6; snapshots can be ingested by future adapters without coupling the domain to Meta or another provider.

## D021 — Phase 6 recommendation safety
- **Status:** Accepted
- **Decision:** Phase 6 recommendations are advisory only and require approval by default. No recommendation endpoint executes an external campaign mutation.
- **Reason:** The Master Spec requires controlled, auditable automation and Phase 8 is the first dedicated real Meta integration phase.
- **Consequence:** Campaign Detective can identify evidence-backed next actions now, while actual external execution remains deferred.

## D022 — Phase 6 AI explanation boundary
- **Status:** Accepted
- **Decision:** Campaign diagnosis may use the existing Phase 4 MOCK AI provider through the same AI orchestration boundary to produce an assistive explanation. Production AI providers remain deferred.
- **Reason:** This validates the AI-assisted diagnosis contract without prematurely introducing provider credentials or production integrations.
- **Consequence:** AI output is explicitly labeled as mock/assistive and cannot override deterministic analytics facts or execute external actions.

## D023 — Phase 7 commercial outcomes and shipping boundary
- **Status:** Accepted
- **Decision:** Persist customers, orders, order items, shipments, profit records and attribution records as a separate commercial-outcome domain. Keep shipping provider behavior behind `ShippingAdapter`; Phase 7 ships only a non-networked MANUAL adapter until a real provider contract is verified.
- **Reason:** The roadmap requires COD/order economics while explicitly requiring provider-specific shipping logic to remain isolated. Prematurely integrating a local carrier would create avoidable coupling and unverified external behavior.
- **Consequence:** Expected and actual revenue/profit can now be reconciled from order lifecycle events. Real carrier integration is deferred to a verified adapter change rather than embedded in order logic.
