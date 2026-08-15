# AdsGenius — Master Product & Architecture Specification V1

**Status:** Baseline / Planning Document  
**Version:** V1  
**Purpose:** Permanent project reference to prevent duplication, architectural drift, contradictory decisions, and repeated work.

> This document records the decisions and methodology agreed for AdsGenius so future development can continue from the current state instead of restarting from zero.

---

## 1. Product Identity

**Product:** AdsGenius

AdsGenius is intended to become a **global multi-platform advertising application**, not merely a browser SaaS dashboard.

### Target platforms
- Windows
- macOS
- Android
- iOS / iPadOS

The product should share business logic and core functionality across platforms while adapting UX to desktop and mobile form factors.

---

## 2. Product Vision

AdsGenius should evolve into an **AI Advertising Operating System**, not simply another Meta Ads Manager or AI copywriting tool.

The intended lifecycle is:

`Research → Strategy → Creation → Launch → Monitoring → Diagnosis → Optimization → Profit → Learning`

The product should help users understand **why** advertising performance changes and what action should be taken, not merely display metrics.

---

## 3. Strategic Principle: Find Market Gaps First

Before locking the final feature set or architecture, AdsGenius must be compared with leading global advertising, creative, analytics, automation, and AI products.

For every major capability we should determine:

1. What existing products provide it?
2. How well do they provide it?
3. What complaints or workflow gaps remain?
4. What can AdsGenius do better?
5. Can several fragmented workflows be unified into one product?

The **Competitor Gap Analysis** must precede major architectural commitments.

---

## 4. Core Product Philosophy

AdsGenius should be a **decision system**, not only a dashboard.

Preferred workflow:

`Data → AI Analysis → Diagnosis → Recommendation → Simulation/Preview → User Approval → Execution → Measurement → Learning`

Automation must be controlled and auditable.

---

## 5. Core Functional Areas

### 5.1 Research Intelligence
- Product analysis
- Market analysis
- Competitor analysis
- Audience research
- Marketing angles
- Hooks
- Offers

### 5.2 Creative Intelligence
- Creative concepts
- Image generation/integration
- Video generation/integration
- Copy
- Hooks
- Variations
- Creative diagnosis
- Creative fatigue detection
- Identification of likely reasons for creative success/failure

### 5.3 Creative Testing Engine

Testing should be structured rather than random.

Example:

```text
Angle A
 ├── Hook 1
 ├── Hook 2
 └── Hook 3

Angle B
 ├── Hook 1
 ├── Hook 2
 └── Hook 3
```

The system should record which elements changed and connect those changes to performance outcomes.

### 5.4 Campaign Intelligence
- Campaign creation
- Audience configuration
- Budget planning
- Campaign structure
- Pre-launch QA
- Monitoring
- Root-cause analysis
- Recommendations
- Controlled optimization

### 5.5 Product & Profit Intelligence
Input should include, where applicable:
- Product
- Price
- Cost
- Shipping cost
- Target market

Outputs should include:
- Break-even CPA
- Break-even ROAS
- Maximum CAC
- Expected margin
- Shipping impact
- COD risk

Principle: **Purchase is not the same as profit.**

### 5.6 Budget Guardian
Support:
- Total budget
- Daily limit
- Campaign limit
- Alert thresholds
- Spending rules
- Overspend warnings

### 5.7 Campaign Detective
When performance changes, the system should investigate possible causes such as:
- CTR
- CPC
- CPM
- Conversion rate
- Creative fatigue
- Audience
- Placement
- Landing page
- Checkout

The desired output is a diagnosis and recommended action, not only charts.

### 5.8 Pre-Launch QA
Before launch, validate where applicable:
- Tracking
- Pixel / platform tracking
- URL
- UTM
- CTA
- Creative dimensions
- Copy
- Policy risks
- Landing page
- Campaign naming
- Duplicate campaigns
- Budget configuration

Result should clearly indicate whether the campaign is ready or has detected problems.

### 5.9 Order → Delivery → Profit Loop
Especially for COD markets:

`Ad → Click → Order → Delivery → Delivered/Returned → Net Revenue → Actual Profit → Ad Performance`

This allows optimization around real profit rather than reported purchases alone.

### 5.10 AI Memory
The system should progressively retain useful product/workspace context such as:
- Products
- Brand voice
- Campaign history
- Creative history
- Winning creatives
- Failed creatives
- Audiences
- Offers
- Performance results

AI should not restart from zero for every task.

---

## 6. Controlled AI Agent Model

Automation should use explicit permission levels:

- **Level 0:** Analyze only
- **Level 1:** Recommend
- **Level 2:** Create draft
- **Level 3:** Execute after user approval
- **Level 4:** Rule-based automation explicitly configured by the user

No unrestricted autonomous advertising actions should be assumed.

---

## 7. Global + Country Packs

The product should not be architected as an Algeria-only application.

Principle:

**Global Core + Country Packs**

Initial regional relevance includes Algeria, with future support for markets such as Saudi Arabia, UAE, Morocco, Tunisia, Egypt and other markets as justified by research.

Country-specific capabilities may include:
- COD
- Regions / Wilayas / Communes
- Shipping rules
- Delivery performance
- Returns
- Local delivery providers
- Local commercial conventions

The global core must remain independent from country-specific integrations.

---

## 8. Integrations Strategy

The architecture must permit multiple advertising platforms over time:
- Meta
- Google
- TikTok
- Snapchat
- Other platforms later

**Meta is the first major real integration target.**

Shipping providers should use an adapter/provider architecture rather than scattered provider-specific conditionals.

Initial/known Algerian providers to evaluate include:
- Yalidine
- ZR Express
- Maystro

Availability and API capabilities must be verified before implementation.

---

## 9. Technical Direction

Current preferred direction:

**React + TypeScript + Tauri 2** for the multi-platform application, with a separate backend and PostgreSQL.

This direction is preferred because the current GitHub project already contains a substantial React/Vite UI that may be reusable.

This is a planning decision, not permission to immediately rewrite the current project. Final architecture is to be confirmed after competitor-gap research and full code audit.

---

## 10. Target Repository Architecture

Target direction:

```text
adsgenius/
├── apps/
│   ├── client/
│   └── desktop-mobile/
├── backend/
├── packages/
│   ├── shared-types/
│   ├── api-client/
│   ├── validation/
│   ├── domain/
│   └── config/
├── docs/
├── scripts/
├── .github/
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

The exact structure may be refined by the architecture phase, but separation of concerns is mandatory.

---

## 11. Frontend Architecture Principles

Frontend responsibilities must remain separate from backend/domain responsibilities.

Desired conceptual areas include:
- app
- features
- components
- pages/views
- hooks
- services
- stores/state
- i18n
- types

Feature-oriented organization should be preferred over one large global folder containing unrelated business logic.

---

## 12. Backend Architecture Principles

Backend should be modular by business domain, for example:

```text
backend/src/modules/
├── auth/
├── users/
├── products/
├── creatives/
├── copywriter/
├── audiences/
├── campaigns/
├── orders/
├── analytics/
├── integrations/
└── ai/
```

Each module should have clear responsibility, validation, service boundaries, and tests where appropriate.

---

## 13. AI Architecture Principles

AI calls must not be placed directly in the client application with exposed provider secrets.

Conceptual flow:

`Client → API → AI Module → Provider`

AI functionality should be separated by capability, for example:
- product analysis
- copywriter
- creative intelligence
- audience intelligence
- campaign intelligence
- optimizer
- analytics/diagnosis

Prompt/version management, schemas, validation, errors, and usage tracking should be considered first-class concerns.

---

## 14. Meta Integration Principles

Meta must be implemented as an isolated integration rather than scattered throughout the application.

Target conceptual areas:

```text
integrations/meta/
├── oauth/
├── accounts/
├── campaigns/
├── adsets/
├── ads/
├── insights/
├── webhooks/
└── client/
```

Actual Meta API capabilities, permissions, review requirements, and current API versions must be verified before production implementation.

---

## 15. Shipping Integration Principles

Use a common shipping abstraction and provider adapters:

```text
shipping/
├── core/
└── providers/
    ├── yalidine/
    ├── zr-express/
    ├── maystro/
    └── future-providers/
```

Provider-specific logic must not be duplicated across orders, analytics, campaigns, or UI components.

---

## 16. Database Direction

Preferred production database: **PostgreSQL**.

The domain should be designed around clear entities, likely including:

- User
- Workspace
- WorkspaceMember
- Product
- ProductVariant
- Creative
- Copy
- Audience
- Campaign
- AdSet
- Ad
- Customer
- Order
- Shipment
- Integration
- Analytics
- AIUsage
- Notification
- Subscription
- AuditLog

The final schema must be derived from the finalized product requirements and architecture, not invented ad hoc during feature development.

A Workspace abstraction should be considered from the beginning even if the initial user model is simple, so future team/business use does not require a major rewrite.

---

## 17. Offline / Sync Direction

The application may support partial offline-first behavior for suitable data such as:
- Drafts
- UI preferences
- Cached products
- Campaign drafts
- Creative drafts

Server-authoritative data and operations should remain synchronized with a clear conflict strategy.

Sensitive operations and external platform actions require network connectivity and server-side authorization.

---

## 18. Security Principles

Security is a design requirement, not a later patch.

Required principles include:
- No provider secrets in frontend code
- Secure authentication
- Authorization and workspace isolation
- Input validation
- Rate limiting where appropriate
- Audit logs
- Secure secret management
- Least-privilege permissions
- Secure local token storage
- Restricted Tauri capabilities
- Safe external integrations

Production security requirements must be documented before release.

---

## 19. Current GitHub Baseline

The current GitHub `main` branch is treated as the **existing prototype baseline**, not the final architecture.

Current project characteristics identified during review:
- React/Vite frontend exists
- Numerous UI pages/features already exist
- Demo data/context exists
- Several service files exist
- Backend is not currently present in the GitHub `main` baseline reviewed during this planning phase

Existing work must not be discarded blindly.

Every current file should eventually receive one of these dispositions:

- **KEEP**
- **MOVE**
- **MERGE**
- **REWRITE**
- **DELETE**

This disposition must be decided during the code audit before major refactoring.

---

## 20. Known Prototype / Mock Areas

The current prototype includes concepts/services that have previously been identified as simulation-oriented, including:
- DemoContext
- demoData
- AIService
- MetaService
- DeliveryService
- OrderService

These must be audited individually before being reused in production.

No mock implementation should silently become a production integration.

---

## 21. Development Methodology

AdsGenius must be developed systematically.

Required lifecycle:

```text
Market Research
→ Competitor Gap Analysis
→ Product Requirements
→ Architecture
→ Domain/Database Design
→ API Design
→ UI Architecture
→ AI Architecture
→ Integrations
→ Implementation
→ Testing
→ Security Review
→ Deployment
```

Do not jump directly from an idea to large-scale coding.

Do not ask an AI coding agent to rebuild the whole product in one uncontrolled operation.

---

## 22. Coding Rules

### Prohibited
- Duplicate services
- Duplicate business logic
- Production dependencies on mock/demo data
- Provider API keys in the client
- Backend logic embedded in UI components
- Repeated type definitions for the same domain object
- Uncontrolled architecture changes during feature work
- Rewriting working features without a documented reason
- Direct destructive changes to `main` without review

### Required
- Clear module boundaries
- Shared types where appropriate
- Central validation
- Consistent naming
- Tests for important business logic
- Documentation for architectural decisions
- Small, reviewable changes
- Branch/PR workflow where practical
- Definition of Done for each milestone

---

## 23. Git / Change Management

The current `main` branch is the protected baseline.

Major work should use feature branches and reviewable changes.

Avoid `force push` unless explicitly justified and reviewed.

Every significant change should answer:
1. What changed?
2. Why?
3. Which requirements does it satisfy?
4. What was tested?
5. What remains?

---

## 24. Documentation System

The project documentation should progressively contain:

```text
docs/
├── ADSGENIUS_MASTER_SPEC_V1.md
├── ARCHITECTURE.md
├── PRODUCT_REQUIREMENTS.md
├── COMPETITOR_GAP_MATRIX.md
├── DEVELOPMENT_RULES.md
├── CURRENT_CODE_AUDIT.md
├── DATABASE.md
├── API.md
├── SECURITY.md
├── AI.md
├── META.md
├── DEPLOYMENT.md
└── DECISION_LOG.md
```

The exact set may evolve, but documentation is part of the product engineering process.

---

## 25. Required Audit Before Major Refactor

Before changing the architecture, perform a complete current-code audit.

For every relevant existing file/function/module determine:

`KEEP / MOVE / MERGE / REWRITE / DELETE`

The audit must identify:
- duplication
- dead code
- mock logic
- coupled modules
- incorrect boundaries
- missing tests
- security issues
- missing integrations
- architecture risks
- reusable UI

The audit should be saved in `docs/CURRENT_CODE_AUDIT.md`.

---

## 26. Competitor Gap Research Requirement

Before finalizing the V2 feature/architecture baseline, create `docs/COMPETITOR_GAP_MATRIX.md` covering relevant global competitors and categories.

The research should examine at minimum:
- campaign management
- creative generation
- creative intelligence
- analytics
- root-cause diagnosis
- automation
- AI agents
- budget management
- pre-launch QA
- cross-platform advertising
- product profitability
- COD intelligence
- delivery/profit feedback
- AI memory
- creative fatigue
- testing workflows

Sources, dates, and confidence should be recorded for externally researched claims.

---

## 27. Priority Product Differentiators

The following are high-priority differentiation hypotheses, to be validated by competitor research rather than assumed as proven market gaps:

1. Root-cause advertising diagnosis
2. Creative Intelligence and structured creative testing
3. Product-to-profit intelligence
4. Order-to-delivery-to-profit feedback loop
5. Pre-launch advertising QA
6. Budget Guardian
7. Controlled AI Agent permissions
8. Long-term AI memory
9. Global Core + Country Packs
10. Unified workflow from research through optimization

---

## 28. Definition of Done

A feature is not considered complete merely because its UI exists.

Depending on the feature, completion should include:
- UI
- domain logic
- API
- persistence
- validation
- error states
- loading states
- authentication/authorization
- tests
- logging/observability where appropriate
- documentation
- platform compatibility
- security review
- production integration where applicable

A mock/demo is explicitly labeled as such and is not considered production complete.

---

## 29. Decision Log Principle

Important architectural/product decisions must be recorded in `docs/DECISION_LOG.md` with:
- Date
- Decision
- Context
- Alternatives considered
- Reason
- Consequences
- Status

This prevents later discussions from repeatedly reopening already-settled decisions without new evidence.

---

## 30. Current Project Status

**Status: Planning / Architecture Baseline**

Completed so far:
- GitHub repository connected
- Existing prototype reviewed at a high level
- Product direction changed from browser-only platform thinking to multi-platform application thinking
- Need for competitor-gap research identified
- Need for permanent project documentation established
- Need for systematic code audit established

Not yet completed:
- Full competitor-gap matrix
- Final architecture freeze
- Full file-by-file code audit
- Final database schema
- Final API contract
- Production backend
- Real AI provider integration
- Real Meta integration
- Real shipping integrations
- Production packaging/signing

---

## 31. Next Mandatory Steps

Do not skip the following order:

### Step 1 — Documentation baseline
Create and review this Master Spec and supporting project documents.

### Step 2 — Competitor Gap Research
Research the global market and update `COMPETITOR_GAP_MATRIX.md`.

### Step 3 — Full Current Code Audit
Audit every current project area and create `CURRENT_CODE_AUDIT.md`.

### Step 4 — Product Requirements V2
Convert validated market gaps into prioritized requirements.

### Step 5 — Architecture V2
Freeze the technical architecture only after Steps 2–4.

### Step 6 — Domain + Database Design
Design the domain model and PostgreSQL schema.

### Step 7 — Implementation Roadmap
Break the work into small, testable Codex tasks.

### Step 8 — Controlled Refactor
Refactor the current prototype without unnecessary destruction of reusable work.

### Step 9 — Real Backend / Integrations / AI
Implement production services progressively.

### Step 10 — Cross-platform QA and Release
Test Windows, macOS, Android, iOS/iPadOS, backend, integrations, security, and release packaging.

---

## 32. Golden Rule

> **Do not restart AdsGenius from zero, and do not continue blindly from the prototype.**

Use the current GitHub project as the baseline, preserve valuable work, identify gaps and duplication, validate the product direction against the global market, then evolve the codebase through controlled, documented stages.

This document is the reference point for future AdsGenius planning and reviews. When a later decision changes an item here, update the document and the decision log rather than relying only on conversation history.
