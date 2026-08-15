# AdsGenius — Phase 6 Analytics & Campaign Detective

**Requirement:** Phase 6 — Analytics + Campaign Detective
**Branch:** `phase-6/analytics-campaign-detective`
**Status:** **CLOSED**

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
- Analytics page migrated from DemoContext metrics to the persisted analytics API while preserving the existing dashboard/chart concept.
- Shared analytics contracts and API client methods added.
- API and decision records updated.
- Dedicated Phase 6 CI workflow added with automatic push/PR execution and manual dispatch.

## Safety Boundary

Recommendations are advisory and require approval by default. Phase 6 does not execute campaign mutations.

AI output remains explicitly MOCK/assistive. Deterministic analytics facts remain the source of truth for diagnosis evidence.

No production AI provider, Meta integration, shipping integration, billing, or external advertising mutation was introduced.

## Final Verification

GitHub Actions **Run #7** for commit `cfab8aa3a1fbc95afbc61acb2e9bfb2a2a8a66de` completed successfully:

1. Install dependencies — PASS
2. Prisma client generation — PASS
3. Database migrations — PASS
4. Typecheck — PASS
5. Lint — PASS
6. Tests — PASS
7. Production build — PASS
8. Backend health smoke test — PASS

## Definition of Done

- Analytics distinguish reported/calculated/estimated metrics — PASS
- Campaign can receive a traceable diagnosis — PASS
- Diagnosis references the relevant data window/evidence snapshots — PASS
- Recommendations do not silently execute external changes — PASS
- Existing prototype behavior outside Phase 6 remains preserved — PASS
