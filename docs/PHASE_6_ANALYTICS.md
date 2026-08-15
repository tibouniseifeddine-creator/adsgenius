# AdsGenius — Phase 6 Analytics & Campaign Detective

**Requirement:** Phase 6 — Analytics + Campaign Detective
**Branch:** `phase-6/analytics-campaign-detective`
**Status:** Implementation complete; closure gated by CI.

## Implemented

- Persisted `PerformanceSnapshot` model for normalized performance windows.
- Explicit metric provenance (`REPORTED`, `CALCULATED`, `ESTIMATED`).
- Deterministic KPI calculations: CPM, CTR, CPC, conversion rate, CPA and ROAS.
- Idempotent snapshot ingestion for the same workspace/entity/provider/time window.
- Campaign anomaly detection based on period-over-period KPI changes.
- Persisted `PerformanceDiagnosis` records with data window, observed facts, candidate causes and evidence snapshot IDs.
- Persisted advisory `AnalyticsRecommendation` records.
- Creative fatigue signal storage and detection from comparative creative-version snapshots.
- Campaign Detective endpoint with optional assistive explanation through the existing Phase 4 MOCK AI provider.
- No production AI provider, Meta integration, or external mutation was introduced.
- Analytics page migrated from DemoContext metrics to the persisted analytics API while preserving the existing dashboard/chart concept.

## Safety Boundary

Recommendations are advisory and require approval by default. Phase 6 does not execute campaign mutations.

AI output remains explicitly MOCK/assistive. Deterministic analytics facts remain the source of truth for diagnosis evidence.

## Verification Gate

CI must pass:

1. Prisma client generation
2. Database migrations
3. Typecheck
4. Lint
5. Tests
6. Production build
7. Backend health smoke test
