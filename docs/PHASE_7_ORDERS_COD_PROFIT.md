# AdsGenius — Phase 7 Customers + Orders + COD + Profit

**Branch:** `phase-7/orders-cod-profit`
**Status:** IMPLEMENTED — verification pending

## Scope

Phase 7 connects advertising to commercial outcomes without adding external shipping-provider calls.

Implemented:
- Workspace-scoped customers.
- Persisted orders and order items.
- COD/prepaid payment state.
- Persisted shipment lifecycle.
- Provider-neutral shipping adapter contract with a non-networked `MANUAL` adapter.
- Expected vs actual revenue.
- Estimated vs actual profit records.
- Campaign attribution records.
- Profit dashboard API with delivery/return rates, revenue, profit and ROAS.
- Audit events for customer/order/shipment/attribution mutations.

## API

- `GET/POST /api/v1/workspaces/:workspaceId/customers`
- `GET/POST /api/v1/workspaces/:workspaceId/orders`
- `GET/PATCH /api/v1/workspaces/:workspaceId/orders/:orderId`
- `POST /api/v1/workspaces/:workspaceId/orders/:orderId/shipment`
- `PATCH /api/v1/workspaces/:workspaceId/shipments/:shipmentId`
- `POST /api/v1/workspaces/:workspaceId/orders/:orderId/attribution`
- `GET /api/v1/workspaces/:workspaceId/profit`

## Profit rules

- New orders create an `ESTIMATED` profit record.
- Delivered orders use actual order revenue and mark the profit record `ACTUAL`.
- Returned/cancelled orders do not claim actual revenue; their profit remains an estimated economic outcome based on the expected case.
- Advertising spend is explicitly represented in profit calculations.
- Recommendations or shipment actions do not call an external provider in Phase 7.

## Shipping boundary

Provider-specific behavior is isolated behind `ShippingAdapter`. The only built-in adapter is `MANUAL`, which performs no network operation. A real Algerian provider is intentionally deferred until its current API contract, authentication and webhook/status semantics are verified.

## Data ownership

The Phase 7 migration creates dedicated PostgreSQL tables. The current service uses parameterized Prisma raw SQL for these tables so the existing generated Prisma client does not require a premature full-schema rewrite. The migration is the database source of truth for this phase.

## Safety

- All endpoints require authenticated workspace access.
- Mutating operations require OWNER/ADMIN/MEMBER.
- Cross-workspace customer/campaign/product references are rejected.
- No external shipping, billing, Meta or advertising mutation is introduced.
