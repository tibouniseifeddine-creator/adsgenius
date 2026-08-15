# AdsGenius — Architecture V2

**Status:** Architecture baseline / not yet implementation-complete  
**Version:** V2  
**Depends on:** `ADSGENIUS_MASTER_SPEC_V1.md`, `COMPETITOR_GAP_MATRIX.md`, `CURRENT_CODE_AUDIT.md`, `PRODUCT_REQUIREMENTS_V2.md`

> This document defines the target architecture after product and code-audit work. It is a design baseline, not a claim that the current repository already implements this architecture.

---

## 1. Architectural Goal

Build AdsGenius as a cross-platform application with a shared product/domain model and controlled backend services.

Target platforms:
- Windows
- macOS
- Android
- iOS / iPadOS

Primary principle:

`One Product Domain → Multiple Clients → One Authoritative Backend → External Integrations`

The existing React prototype is treated as reusable UI material, not as the final architecture.

---

## 2. High-Level Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                        ADSGENIUS CLIENTS                     │
│                                                               │
│  Windows / macOS (Tauri)    Android / iOS / iPadOS           │
│            │                         │                        │
│            └──────────────┬──────────┘                        │
│                           │                                   │
│                    Shared Client Core                         │
└───────────────────────────┼───────────────────────────────────┘
                            │ HTTPS / Authenticated API
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                         API / BFF                              │
│                                                               │
│ Auth │ Workspaces │ Products │ Campaigns │ Creatives          │
│ Orders │ Analytics │ AI │ Integrations │ Notifications         │
└───────────────────────────┬───────────────────────────────────┘
                            │
                ┌───────────┼────────────┐
                ▼           ▼            ▼
         Domain Services  AI Layer   Integration Layer
                │           │            │
                ▼           ▼            ▼
           PostgreSQL   AI Providers   Meta / Google / TikTok
                         + Jobs         Shipping Providers
```

---

## 3. Repository Structure

Target structure:

```text
adsgenius/
├── apps/
│   ├── client/                 # Shared React application
│   └── desktop/                # Tauri shell / desktop-specific code
│
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   ├── shared/
│   │   ├── infrastructure/
│   │   └── server.ts
│   └── prisma/
│
├── packages/
│   ├── shared-types/
│   ├── api-client/
│   ├── validation/
│   ├── domain/
│   └── config/
│
├── docs/
├── scripts/
├── .github/
└── package.json
```

The exact mobile/desktop packaging may be adjusted during implementation after validating Tauri 2 and mobile requirements. The separation between shared client code, platform shells, backend, domain, and integrations is mandatory.

---

## 4. Client Architecture

### 4.1 Shared React Client

Use feature-oriented organization rather than a flat collection of pages and services.

Conceptual structure:

```text
apps/client/src/
├── app/
│   ├── router/
│   ├── providers/
│   └── bootstrap/
├── features/
│   ├── dashboard/
│   ├── products/
│   ├── research/
│   ├── creatives/
│   ├── campaigns/
│   ├── analytics/
│   ├── profit/
│   ├── orders/
│   ├── integrations/
│   ├── ai/
│   └── settings/
├── components/
│   ├── ui/
│   └── layout/
├── services/
├── stores/
├── hooks/
├── i18n/
├── types/
└── utils/
```

The existing prototype pages/components should be mapped into this structure during refactoring rather than rewritten automatically.

### 4.2 Client Responsibilities

The client is responsible for:
- Rendering UI
- Local UI state
- Drafts/cache where appropriate
- Input collection
- Client-side validation for UX
- Calling authenticated APIs
- Displaying server/AI results
- Platform-specific UX

The client is **not** the source of truth for:
- Secrets
- Authorization
- Advertising provider credentials
- Profit calculations that require authoritative server data
- Final campaign execution decisions

---

## 5. Backend Architecture

Backend is the authoritative application layer.

```text
backend/src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── workspaces/
│   ├── products/
│   ├── research/
│   ├── creatives/
│   ├── audiences/
│   ├── campaigns/
│   ├── analytics/
│   ├── profit/
│   ├── orders/
│   ├── shipping/
│   ├── ai/
│   ├── notifications/
│   ├── subscriptions/
│   └── integrations/
│
├── shared/
│   ├── auth/
│   ├── errors/
│   ├── logging/
│   ├── validation/
│   └── security/
│
└── infrastructure/
    ├── database/
    ├── queue/
    ├── storage/
    └── external-services/
```

Modules should communicate through explicit interfaces and domain services, not by importing arbitrary internal implementation details from other modules.

---

## 6. Domain Boundaries

The first domain boundaries are:

### Identity & Access
- User
- Workspace
- WorkspaceMember
- Roles
- Permissions

### Product
- Product
- Variant
- Cost
- Price
- Market
- Offer

### Research
- Market research
- Competitor observations
- Audience hypotheses
- Angles
- Hooks

### Creative
- Creative
- Creative version
- Asset
- Copy
- Hook
- Creative test
- Creative performance

### Campaign
- Campaign
- Ad set
- Ad
- Budget
- Rules
- Execution state

### Analytics
- Metrics
- Time series
- Attribution data
- Performance diagnosis

### Profit
- Revenue
- Cost
- Shipping
- Delivery outcome
- Returns
- Actual profit
- Break-even metrics

### Orders & Shipping
- Customer
- Order
- Shipment
- Delivery event
- Return
- Provider

### AI
- AI task
- Prompt/version
- Model/provider
- Usage
- Result
- Recommendation
- Agent action
- Approval

### Integrations
- Provider connection
- OAuth/token state
- Account mapping
- Sync state
- Webhook state

---

## 7. Data Architecture

PostgreSQL is the intended production system of record.

Initial conceptual entities:

```text
User
Workspace
WorkspaceMember
Product
ProductVariant
Offer
Creative
CreativeVersion
CreativeAsset
Audience
Campaign
AdSet
Ad
CampaignRule
Customer
Order
Shipment
DeliveryEvent
Return
IntegrationConnection
ExternalAccount
MetricSnapshot
PerformanceDiagnosis
ProfitSnapshot
AITask
AIRecommendation
AIAgentAction
Approval
Notification
Subscription
AuditLog
```

Foreign keys, indexes, uniqueness rules, soft-delete strategy, tenant isolation, and retention policies must be designed before production migration.

---

## 8. Multi-Tenancy

Use `Workspace` as the primary business boundary.

Every tenant-owned resource should be associated with a workspace directly or through an explicit relationship.

Authorization must verify:

`Authenticated User → Workspace Membership → Resource Ownership`

Do not rely on frontend route visibility for security.

---

## 9. API Architecture

Use a versioned API boundary.

Conceptual routes:

```text
/api/v1/auth
/api/v1/workspaces
/api/v1/products
/api/v1/research
/api/v1/creatives
/api/v1/audiences
/api/v1/campaigns
/api/v1/analytics
/api/v1/profit
/api/v1/orders
/api/v1/shipping
/api/v1/ai
/api/v1/integrations
/api/v1/notifications
```

API requirements:
- Authentication
- Authorization
- Input schema validation
- Consistent error format
- Pagination
- Filtering/sorting where appropriate
- Idempotency for sensitive create/execute operations
- Request correlation IDs
- Rate limiting where appropriate
- Auditability

The frontend must not call third-party advertising APIs directly for privileged operations.

---

## 10. AI Architecture

AI is a backend capability.

```text
Client
  ↓
AI API
  ↓
AI Orchestrator
  ├── Product Analyst
  ├── Research Analyst
  ├── Creative Analyst
  ├── Copywriter
  ├── Campaign Analyst
  ├── Campaign Detective
  ├── Profit Analyst
  └── Controlled Agent
        ↓
Provider Adapter
        ↓
AI Provider(s)
```

### AI Orchestrator responsibilities
- Select capability
- Load authorized context
- Validate input
- Select model/provider according to policy
- Execute prompt/version
- Validate structured output
- Store usage/result metadata
- Return safe result

### AI output rule
Important decisions should use structured schemas rather than unvalidated free-form text.

Example:

```json
{
  "diagnosis": "creative_fatigue",
  "confidence": 0.82,
  "evidence": [],
  "recommendations": [],
  "requiresApproval": true
}
```

---

## 11. AI Memory

AI memory must be scoped and controlled.

Potential context layers:

```text
System rules
   ↓
Workspace context
   ↓
Product context
   ↓
Campaign context
   ↓
Historical performance
   ↓
Current task
```

Do not send the entire workspace database to an AI model by default.

Use retrieval/filtering and explicit context budgets.

Sensitive information must be excluded unless required and authorized.

---

## 12. Campaign Detective Architecture

Campaign diagnosis should be a domain workflow, not a UI calculation.

```text
Metrics
  ↓
Data normalization
  ↓
Anomaly detection
  ↓
Candidate causes
  ↓
Evidence collection
  ↓
AI/domain analysis
  ↓
Diagnosis
  ↓
Recommendation
  ↓
Approval / rule
  ↓
Action
```

Diagnosis must preserve evidence and confidence so recommendations are explainable.

---

## 13. Creative Intelligence Architecture

```text
Product + Market + Brand
          ↓
     Creative Brief
          ↓
     Angle Generator
          ↓
      Hook Generator
          ↓
   Creative Variations
          ↓
      Test Matrix
          ↓
    Campaign Results
          ↓
 Creative Performance Model
          ↓
 Learn winning patterns
```

Creative assets should have version history and metadata describing the tested variables.

---

## 14. Profit Intelligence Architecture

Profit calculations must be server-side and based on authoritative data.

Conceptual flow:

```text
Ad Spend
   + Product Cost
   + Shipping Cost
   + Return Cost
   + Other configured costs
          ↓
     Net Economics
          ↓
    Actual Profit
          ↓
  Product/Campaign/Creative ROI
```

COD delivery status should feed actual economic results where integrations permit.

---

## 15. Integration Architecture

External services use adapters.

```text
integrations/
├── meta/
├── google/
├── tiktok/
├── snapchat/
├── shipping/
│   ├── yalidine/
│   ├── zr-express/
│   └── maystro/
└── ai/
    ├── provider-a/
    └── provider-b/
```

The domain should depend on internal interfaces, not vendor-specific SDK calls.

Example:

`CampaignService → AdvertisingProvider → MetaAdapter`

not:

`CampaignService → Meta SDK everywhere`

---

## 16. Sync Architecture

External platforms are not guaranteed to respond immediately or consistently.

Use explicit synchronization state:

```text
Local state
   ↓
Sync job
   ↓
Provider API
   ↓
Normalize
   ↓
Persist
   ↓
Reconcile
```

Store external IDs and synchronization timestamps.

Sensitive operations should be idempotent.

Webhooks should be validated and processed safely.

---

## 17. Background Jobs

Use a queue/background-job layer for operations that should not block API requests, including:
- Platform synchronization
- Analytics imports
- AI generation tasks
- Creative processing
- Video processing
- Notifications
- Webhook processing
- Scheduled rules
- Reports

The exact queue technology is intentionally not frozen until infrastructure constraints are evaluated.

---

## 18. Storage Architecture

Separate storage responsibilities:

### PostgreSQL
Structured application data.

### Object storage
Images, videos, exported reports, large creative assets.

### Cache/queue
Short-lived state and jobs.

Do not store large media blobs directly in PostgreSQL unless there is a justified exception.

---

## 19. Authentication & Authorization

Authentication and authorization are separate concerns.

Required concepts:
- Session/token management
- Password security where passwords are used
- OAuth integrations
- Workspace roles
- Resource authorization
- Revocation
- Audit logging

External platform tokens must be stored server-side using secure secret management.

---

## 20. Security Architecture

Minimum principles:
- Secrets never shipped to clients
- Environment-based secret management
- Encryption in transit
- Secure storage of sensitive tokens
- Strict CORS policy in production
- CSRF protection where applicable
- Input validation
- Output validation
- Rate limiting
- Abuse protection
- Audit logs
- Least privilege
- Workspace isolation
- Secure file uploads
- Dependency scanning
- Security headers

Tauri permissions must be restricted to required capabilities only.

---

## 21. Observability

Production must provide:
- Structured logs
- Error tracking
- Request IDs
- Background job status
- Integration sync status
- AI usage metrics
- API latency metrics
- Critical action audit trails

Do not log secrets, access tokens, passwords, or sensitive customer data unnecessarily.

---

## 22. Testing Architecture

Testing layers:

```text
Unit tests
   ↓
Domain/service tests
   ↓
API integration tests
   ↓
Integration adapter tests
   ↓
End-to-end tests
   ↓
Platform smoke tests
```

High-risk areas requiring strong coverage:
- Auth
- Authorization
- Money/profit calculations
- Campaign execution
- Budget rules
- External integrations
- AI structured outputs
- Orders/returns
- Data synchronization

---

## 23. Offline Strategy

Suitable local data may be cached or drafted offline:
- Product drafts
- Creative drafts
- Campaign drafts
- Preferences
- Recently viewed data

The server remains authoritative for:
- Account state
- Billing
- External integrations
- Campaign execution
- Final analytics
- Security-sensitive operations

Conflict resolution must be explicit rather than relying on last-write-wins everywhere.

---

## 24. Platform Strategy

### Desktop
Tauri shell with shared React application.

Use native capabilities only through controlled Tauri commands.

### Mobile
Reuse shared client/domain-facing API layer while adapting navigation and UI for touch and small screens.

Mobile architecture must not assume desktop-only interactions.

### Backend
Cloud-hosted service independent of the client platform.

This allows the same account/workspace to be used across Windows, macOS, Android, and iOS.

---

## 25. Billing & Subscription Boundary

Billing should be isolated from core product domains.

Conceptual:

```text
Subscription
Plan
Entitlement
Usage
Billing Provider
```

Feature access should use entitlements rather than scattered `if plan === ...` checks.

Payment provider selection is not frozen in this document and must account for target-country availability and legal/business requirements.

---

## 26. Feature-to-Architecture Mapping

| P0 capability | Client | Backend/domain | Data | AI | External integration |
|---|---|---|---|---|---|
| Product intelligence | Products/Profit | Products/Profit | Product, costs, offers | Product Analyst | Optional market sources |
| Creative intelligence | Creatives | Creative module | Creative/version/asset | Creative Analyst | AI/media providers |
| Creative testing | Creatives/Analytics | Creative + Analytics | Test matrix/performance | Creative Analyst | Meta first |
| Campaign management | Campaigns | Campaign module | Campaign/AdSet/Ad | Optional | Meta first |
| Campaign Detective | Analytics | Analytics/Diagnosis | Metrics/Diagnosis | Campaign Analyst | Meta first |
| Budget Guardian | Campaigns | Rules/Budget | Budget/Rule | Optional | Meta first |
| Profit intelligence | Profit | Profit/Orders | Costs/order/shipment | Profit Analyst | Shipping |
| COD loop | Orders/Profit | Orders/Shipping/Profit | Order/shipment/delivery | Optional | Shipping providers |
| AI memory | AI UI | AI context | Memory/context metadata | AI | None required |
| Controlled Agent | AI/Campaigns | AI Agent/Approval | Action/Approval/Audit | Agent | Meta first |
| Pre-launch QA | Campaigns | QA service | QA results | Optional | Meta/landing checks |

---

## 27. What Must Not Happen

The following are architectural anti-patterns:

1. Calling Meta SDK directly from UI components.
2. Putting API keys in Vite environment variables that ship to the client.
3. Recreating the same business rule in multiple services.
4. Allowing demo data to silently substitute for production data.
5. Making AI output the sole authority for irreversible financial/platform actions.
6. Storing external tokens in local browser storage without a deliberate security model.
7. Creating provider-specific database schemas for every integration without a common abstraction.
8. Creating a feature before defining its domain owner and persistence requirements.
9. Mixing country-specific rules into global core services.
10. Rewriting the entire existing UI before mapping reusable components.

---

## 28. Migration Strategy From Current Prototype

Migration is incremental.

### Phase A — Preserve
- Keep the current prototype branch intact.
- Keep existing UI assets until mapped.

### Phase B — Classify
For each existing file:
- KEEP
- MOVE
- MERGE
- REWRITE
- DELETE

### Phase C — Introduce foundations
- Workspace model
- Shared types
- API client
- Validation
- Error model
- Auth boundary
- Backend module boundaries

### Phase D — Replace mocks incrementally
- Mock AI → real AI provider abstraction
- Mock Meta → real Meta adapter
- Mock delivery → real shipping adapters
- Local/demo order state → PostgreSQL-backed orders

### Phase E — Validate
Each migrated feature must pass its Definition of Done before moving to the next.

---

## 29. Architecture Freeze Rules

Architecture V2 becomes the working baseline after review of this document.

Changes are allowed when:
- New evidence contradicts an assumption.
- A technical constraint is discovered.
- Security requires a change.
- Platform limitations require a change.
- Product requirements materially change.

Every material change must be recorded in `DECISION_LOG.md`.

---

## 30. Immediate Next Step

Do **not** start a full rewrite yet.

Next mandatory work:

1. Review this architecture against `PRODUCT_REQUIREMENTS_V2.md`.
2. Resolve contradictions or missing P0 requirements.
3. Create `docs/DATABASE.md` with the concrete schema/domain model.
4. Create `docs/API.md` with the P0 API contract.
5. Create an implementation roadmap divided into small Codex tasks.
6. Only then begin controlled repository refactoring.

---

## 31. Architectural Golden Rule

> **The domain owns the business rules. The backend owns authority and secrets. The client owns presentation and user interaction. Integrations are adapters. AI is a controlled capability, not the system of record.**
