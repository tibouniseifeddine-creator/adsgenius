# AdsGenius — Product Requirements V2

**Status:** Planning baseline  
**Version:** V2  
**Purpose:** Convert the Master Spec, market-gap hypotheses, and current-code audit into a prioritized product requirements baseline before Architecture V2.

> This document defines what AdsGenius should do. It does not authorize implementation yet. Architecture, database schema, and production code changes follow only after these requirements are reviewed and accepted.

---

## 1. Priority Model

### P0 — Core product / first production milestone
Capabilities required to validate the central AdsGenius value proposition.

### P1 — Important expansion
Capabilities that materially increase usefulness after the P0 foundation is stable.

### P2 — Future expansion
Capabilities that should be architecturally possible but should not delay the first production milestone.

### Out of Scope for initial build
Capabilities deliberately excluded until the product has validated demand and the core system is stable.

---

# 2. P0 REQUIREMENTS

## P0-01 — Multi-platform Application Shell

**Goal:** Provide one coherent product experience for Windows, macOS, Android and iOS/iPadOS.

**Requirements:**
- Shared product logic and domain model.
- Responsive desktop/mobile UX.
- Secure authentication/session handling.
- Environment separation for development/staging/production.
- No production secrets in the client.

**Acceptance:** The same core product can be packaged for the four target platform families without duplicating business logic.

---

## P0-02 — Workspace and User Foundation

**Goal:** Establish the ownership boundary for products, campaigns, creatives, integrations and analytics.

**Requirements:**
- User identity.
- Workspace.
- Workspace membership model prepared for future teams.
- Roles/permissions foundation.
- Audit-log foundation for important actions.

**Acceptance:** Every persistent business object can be associated with the correct workspace and authorization is enforced server-side.

---

## P0-03 — Product Intelligence Foundation

**Goal:** Turn a product into structured advertising knowledge before campaign creation.

**Inputs:**
- Product name.
- Description.
- Price.
- Cost.
- Shipping cost.
- Market/country.
- Optional product images/media.
- Optional existing sales information.

**Outputs:**
- Product type/category.
- Selling points.
- Customer pain points.
- Objections.
- Positioning.
- USP hypotheses.
- Advertising angles.
- Target-customer hypotheses.
- Break-even economics where enough cost data exists.

**Important:** AI outputs are hypotheses unless supported by connected performance/sales data.

---

## P0-04 — Creative Intelligence Workspace

**Goal:** Create, organize and evaluate advertising creative concepts rather than merely generate isolated images/copy.

**Requirements:**
- Creative records.
- Creative concepts.
- Angles.
- Hooks.
- Primary text.
- Headlines.
- CTA.
- Creative status/versioning.
- Association with product/campaign.
- Ability to store external/generated media references.

**Acceptance:** A creative can be traced from its product/angle/hook through campaign usage and later performance.

---

## P0-05 — Structured Creative Testing

**Goal:** Make creative testing attributable and understandable.

**Requirements:**
- Define test dimensions such as angle, hook, format and offer.
- Record what changed between variants.
- Associate variants with performance results.
- Compare variants on normalized metrics where data permits.
- Produce an explanation of likely winning factors.

**Acceptance:** The system can answer which controlled creative variables differed and how those differences correlate with observed performance.

---

## P0-06 — Campaign Intelligence Foundation

**Goal:** Provide a normalized internal campaign model independent of one advertising provider.

**Requirements:**
- Campaign.
- Ad set/ad group equivalent.
- Ad.
- Budget.
- Objective.
- Status.
- Audience reference.
- Creative reference.
- Platform/account reference.

The model must support multiple advertising platforms later.

---

## P0-07 — Meta Integration Foundation

**Goal:** Establish the first real advertising-platform integration.

**Requirements:**
- Secure OAuth/authorization flow where supported.
- Account connection.
- Account discovery.
- Campaign/ad set/ad retrieval.
- Insights retrieval.
- Explicit error handling.
- Token/credential security.
- Permission/status visibility.

Mutating actions must be permission-controlled and auditable.

**Important:** The existing `MetaService` is a mock and must not be treated as production functionality.

---

## P0-08 — Campaign Monitoring

**Goal:** Convert platform data into actionable monitoring.

**Requirements:**
- Spend.
- Impressions.
- Reach where available.
- CPM.
- CTR.
- CPC.
- Conversions/purchases where available.
- CPA/CAC where computable.
- ROAS where computable.
- Trend comparison.
- Clear data freshness timestamp.

The system must distinguish missing data from zero values.

---

## P0-09 — Campaign Detective / Root-Cause Diagnosis

**Goal:** Answer “why did performance change?” rather than only displaying metrics.

**Analysis dimensions:**
- CTR.
- CPC.
- CPM.
- Conversion rate.
- Creative fatigue.
- Audience.
- Placement.
- Landing page signals where available.
- Checkout/order signals where available.

**Output:**
- Observed facts.
- Candidate causes.
- Confidence/limitations.
- Recommended next action.

The system must not present uncertain AI inference as confirmed fact.

---

## P0-10 — Product Profitability Engine

**Goal:** Measure economic viability rather than advertising metrics alone.

**Requirements:**
- Product cost.
- Selling price.
- Shipping cost.
- Other configurable variable costs.
- Break-even CPA.
- Break-even ROAS.
- Margin estimate.
- Maximum acceptable acquisition cost.

Calculations must be deterministic and testable; AI may explain results but should not replace the calculation engine.

---

## P0-11 — Controlled Recommendations

**Goal:** Convert diagnosis into actionable decisions.

**Recommendation structure:**
- Problem detected.
- Evidence.
- Suggested action.
- Expected objective.
- Risk/limitation.
- User approval requirement.

Examples include recommending creative replacement, budget review, audience review or further testing.

No unrestricted autonomous account changes in P0.

---

## P0-12 — Pre-Launch QA

**Goal:** Catch common campaign errors before launch.

**Checks where applicable:**
- Tracking.
- Pixel/event configuration.
- URL.
- UTM.
- CTA.
- Creative dimensions.
- Copy completeness.
- Policy-risk indicators.
- Landing-page availability.
- Campaign naming.
- Duplicate detection.
- Budget configuration.

**Output:** Ready / Needs attention / Blocked, with reasons.

---

## P0-13 — Budget Guardian

**Goal:** Prevent avoidable overspending and expose budget risk.

**Requirements:**
- Campaign budget.
- Daily spending target/limit where supported.
- Account-level monitoring where available.
- Alert thresholds.
- User-configured rules.
- Spending anomaly warnings.

The system must never imply it can stop platform spending unless the relevant platform API actually supports and confirms the action.

---

## P0-14 — AI Provider Gateway

**Goal:** Keep AI providers replaceable and secure.

**Requirements:**
- Server-side provider access.
- Structured input/output schemas.
- Prompt/version management.
- Provider abstraction.
- Error handling.
- Usage/cost tracking.
- Model selection policy.
- No API keys in frontend code.

AI modules must be separated from UI components.

---

## P0-15 — AI Memory Foundation

**Goal:** Maintain useful workspace/product context over time.

**Requirements:**
- Product context.
- Brand voice/context.
- Campaign history references.
- Creative history.
- Winning/failed creative records.
- User-approved preferences.
- Clear provenance for stored AI-derived facts.

Memory must be editable/deletable where appropriate and must respect workspace authorization.

---

## P0-16 — Auditability and Safety

**Goal:** Make external actions traceable.

**Requirements:**
- Audit log for important actions.
- Actor/user.
- Workspace.
- Action.
- Timestamp.
- Target object.
- Result/error.
- Source (user, automation, system).

Important external mutations require explicit authorization and should be reviewable.

---

# 3. P1 REQUIREMENTS

## P1-01 — Order Management

Introduce a production order domain with persistence and lifecycle tracking.

Potential statuses include configurable order/fulfillment states, not hardcoded assumptions.

---

## P1-02 — Shipping Provider Adapter System

Create a common shipping interface and provider adapters.

Initial providers to investigate for Algeria:
- Yalidine.
- ZR Express.
- Maystro.

Provider capabilities and APIs must be verified before implementation.

---

## P1-03 — Order → Delivery → Profit Loop

Connect advertising attribution to order and delivery outcomes where reliable identifiers/data are available.

Track:
- Orders.
- Delivered orders.
- Returns/cancellations.
- Net revenue.
- Delivery cost.
- Actual/estimated profit.

Do not treat an unverified purchase event as confirmed delivered revenue.

---

## P1-04 — Creative Fatigue Detection

Detect probable deterioration in creative performance using time-series and comparative signals.

The system should explain the evidence and confidence instead of claiming certainty from a single metric.

---

## P1-05 — Advanced Creative Generation

Expand from structured concepts into integrations with image/video generation providers.

Requirements should remain provider-agnostic.

The system should preserve creative lineage so generated assets can be linked to:
- Product.
- Angle.
- Hook.
- Version.
- Campaign.
- Performance.

---

## P1-06 — Advanced Audience Intelligence

Support audience hypotheses, comparison and learning from connected performance data.

Avoid pretending that AI-generated audiences are guaranteed to perform.

---

## P1-07 — Controlled AI Agent Level 3

Allow user-approved execution of selected actions.

Examples:
- Create campaign draft.
- Prepare creative variants.
- Prepare budget changes.
- Pause a campaign after explicit approval.

Every external mutation must be logged.

---

## P1-08 — Country Packs

Create a country-specific extension model while keeping the global core independent.

Initial priority should be based on validated market opportunity, not assumption.

---

## P1-09 — Reporting and Decision Briefs

Generate concise reports that answer:
- What happened?
- Why?
- What matters?
- What should we do next?
- What is uncertain?

Reports should be exportable later.

---

## P1-10 — Multi-Platform Expansion

After Meta is stable, evaluate:
- Google Ads.
- TikTok Ads.
- Snapchat Ads.

Each should use the common campaign/integration abstraction rather than platform-specific UI architecture.

---

# 4. P2 REQUIREMENTS

Potential future capabilities:
- Advanced autonomous rule engine.
- Cross-platform budget optimization.
- Advanced forecasting.
- Multi-touch attribution where data quality supports it.
- Advanced creative video analysis.
- Deeper competitor intelligence.
- Automated experiment design.
- Enterprise/team workflows.
- Advanced agency client management.
- Expanded country packs.

These are intentionally not allowed to delay P0.

---

# 5. OUT OF SCOPE FOR INITIAL BUILD

The following should not become early distractions:

- Building a full social-media management suite.
- Building a general-purpose CRM.
- Building a general-purpose e-commerce platform.
- Building a general-purpose image/video editor from scratch.
- Supporting every ad platform simultaneously.
- Fully autonomous advertising decisions without controls.
- Replacing specialist external creative-generation models unnecessarily.

AdsGenius should integrate best-of-breed capabilities where appropriate instead of rebuilding every adjacent product.

---

# 6. Cross-Cutting Requirements

## Security
- Server-side secrets.
- Authorization.
- Workspace isolation.
- Secure token handling.
- Validation.
- Rate limiting where appropriate.
- Audit logs.

## Reliability
- Explicit API errors.
- Retries only where safe.
- Idempotency for important external operations.
- Data freshness indicators.
- Observability.

## Data Quality
- Distinguish null/unknown/zero.
- Preserve source and timestamp.
- Record platform/account provenance.
- Avoid unsupported AI claims.

## Internationalization
- Architecture must support multiple languages and locales.
- Currency and number/date formatting must be locale-aware.
- Country-specific business rules must not be hardcoded into the global core.

## Accessibility
- Keyboard navigation on desktop.
- Appropriate touch targets on mobile.
- Clear contrast and semantic UI.
- Screen-reader considerations for important workflows.

## Performance
- Avoid loading large analytics datasets unnecessarily.
- Cache safe read operations.
- Paginate large collections.
- Keep client bundle/platform startup under control.

---

# 7. Non-Functional Definition of Done

A P0 capability is not complete because a screen exists.

Depending on the capability, completion requires:

1. UI/UX.
2. Domain logic.
3. Persistence.
4. API contract.
5. Validation.
6. Authentication/authorization.
7. Error/loading/empty states.
8. Tests for critical logic.
9. Audit logging for important actions.
10. Security review.
11. Documentation.
12. Production integration if the requirement is an external integration.

A mock is labeled **MOCK** and does not satisfy a production integration requirement.

---

# 8. Requirements Traceability

Each implementation task should reference one or more IDs from this document, for example:

`P0-09 Campaign Detective`

This prevents unrelated changes and makes later review easier.

Recommended task format:

```text
Requirement: P0-09
Scope: Campaign diagnosis API
Inputs: normalized campaign insights
Outputs: evidence + candidate causes + recommendation
Tests: diagnosis calculation + uncertainty handling
Status: TODO / IN PROGRESS / REVIEW / DONE
```

---

# 9. Next Gate: Architecture V2

Architecture V2 must not be frozen until this requirements document is reviewed against:

1. `ADSGENIUS_MASTER_SPEC_V1.md`
2. `COMPETITOR_GAP_MATRIX.md`
3. `CURRENT_CODE_AUDIT.md`

Then architecture must map each P0 domain to:

- Client module.
- Domain module.
- Backend module.
- Database entities.
- API endpoints.
- AI capabilities.
- Integration boundaries.
- Tests.

Only after that mapping is approved should major refactoring begin.

---

# 10. Golden Rule

> Build the smallest complete system that proves AdsGenius' differentiated value, while keeping the architecture capable of the larger vision.

Do not build a large collection of disconnected AI features. Build one coherent loop:

`Product → Research → Creative → Campaign → Measurement → Diagnosis → Profit → Learning`

That loop is the core product hypothesis for AdsGenius V2.
