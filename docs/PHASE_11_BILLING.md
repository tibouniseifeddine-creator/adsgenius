# Phase 11 — Billing / Entitlements

## Scope

Introduce subscription controls without coupling billing to the campaign domain.

## Rules

- Entitlements are server-owned.
- Client UI must never grant access by itself.
- Provider integration is deferred until provider selection is approved.
- Usage enforcement is deterministic and testable.
- Billing state changes must be auditable once persistence is enabled.

## Current implementation

The `backend/src/modules/billing.ts` module is the domain boundary for plan and entitlement evaluation. It intentionally contains no payment-provider integration.
