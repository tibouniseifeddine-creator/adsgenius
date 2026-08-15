# AdsGenius — Domain & Database Design V1

**Status:** Design baseline — no production schema migration yet
**Parent:** `ADSGENIUS_MASTER_SPEC_V1.md`, `PRODUCT_REQUIREMENTS_V2.md`, `ARCHITECTURE_V2.md`

## 1. Design Goals

The database must support the global AdsGenius core without coupling the core model to one country, advertising provider, or shipping provider.

Primary goals:
- Multi-workspace isolation
- Clear domain ownership
- PostgreSQL as production database
- Provider-neutral advertising entities
- Provider-neutral shipping entities
- Real profit attribution
- AI memory and usage tracking
- Auditability
- Extensibility without destructive rewrites

## 2. Tenant Model

The primary tenant boundary is `Workspace`.

```text
User
  └── WorkspaceMember ── Workspace
                            ├── Products
                            ├── Creatives
                            ├── Audiences
                            ├── Campaigns
                            ├── Customers
                            ├── Orders
                            ├── Integrations
                            ├── Analytics
                            ├── AI Memory
                            └── Audit Logs
```

Every workspace-owned entity must have an explicit workspace relationship, directly or through a clearly owned parent.

Authorization must always verify workspace membership before access.

## 3. Core Entities

### User
Identity and account-level information.

Key fields:
- id
- email
- password_hash / external-auth identifier
- name
- locale
- timezone
- created_at
- updated_at

### Workspace
Business/account container.

Key fields:
- id
- name
- slug
- default_country_code
- default_currency
- timezone
- created_at
- updated_at

### WorkspaceMember
Many-to-many membership between users and workspaces.

Key fields:
- id
- workspace_id
- user_id
- role
- status
- created_at

Roles should be permission-driven rather than hard-coded into UI logic.

## 4. Product Domain

### Product
Represents a sellable product in a workspace.

Key fields:
- id
- workspace_id
- name
- description
- sku
- base_cost
- sale_price
- currency
- active
- created_at
- updated_at

### ProductVariant
Optional variants such as size, color, or SKU variation.

Relationships:
- Product 1 → many ProductVariant

Product economics must remain separate from campaign reporting so the same product can be used by multiple campaigns.

## 5. Creative Domain

### Creative
A reusable creative asset or creative concept.

Key fields:
- id
- workspace_id
- product_id (nullable)
- type
- title
- asset_url / storage_key
- thumbnail_url
- metadata_json
- status
- created_at
- updated_at

### CreativeVersion
Tracks iterations of a creative.

Key fields:
- id
- creative_id
- parent_version_id (nullable)
- generation_method
- prompt_reference
- asset_url / storage_key
- metadata_json
- created_at

### CopyAsset
Stores reusable ad copy, hooks, headlines, primary text, and CTA concepts.

The creative system must retain enough lineage to understand what was tested and why.

## 6. Audience Domain

### Audience
Provider-neutral audience definition or saved audience concept.

Key fields:
- id
- workspace_id
- name
- type
- definition_json
- status
- created_at
- updated_at

Provider-specific audience IDs belong in integration mappings, not as the primary domain identity.

## 7. Campaign Domain

The provider-neutral domain hierarchy is:

```text
Campaign
 └── AdSet
      └── Ad
           ├── CreativeVersion
           └── CopyAsset
```

### Campaign
Key fields:
- id
- workspace_id
- product_id (nullable)
- name
- objective
- status
- budget_type
- budget_amount
- currency
- start_at
- end_at
- created_at
- updated_at

### AdSet
Key fields:
- id
- campaign_id
- audience_id (nullable)
- name
- status
- budget_amount (nullable)
- targeting_json
- placement_json
- created_at
- updated_at

### Ad
Key fields:
- id
- adset_id
- creative_version_id (nullable)
- copy_asset_id (nullable)
- name
- status
- destination_url
- tracking_config_json
- created_at
- updated_at

Provider IDs must be represented by integration mapping records rather than hard-coding Meta/TikTok/etc. identifiers into the core entities.

## 8. Integration Domain

### Integration
Represents an external provider connection for a workspace.

Key fields:
- id
- workspace_id
- provider
- type
- status
- external_account_reference
- encrypted_credentials_reference
- metadata_json
- created_at
- updated_at

Secrets themselves must not be stored as plaintext application data. Prefer a secret-management system or encrypted secret store.

### ExternalResourceMapping
Maps a core entity to an external provider resource.

Key fields:
- id
- integration_id
- entity_type
- entity_id
- external_id
- external_parent_id
- metadata_json
- created_at
- updated_at

This allows the core domain to remain provider-neutral.

## 9. Analytics Domain

### PerformanceSnapshot
Stores normalized performance measurements for a defined time period.

Key fields:
- id
- workspace_id
- entity_type
- entity_id
- provider
- period_start
- period_end
- impressions
- clicks
- spend
- conversions
- revenue
- currency
- normalized_metrics_json
- created_at

Raw provider payloads may be stored separately where necessary for traceability, subject to retention and privacy requirements.

### AttributionRecord
Connects advertising activity to downstream commercial outcomes.

Key fields:
- id
- workspace_id
- campaign/ad/adset references as appropriate
- order_id (nullable)
- attribution_method
- attributed_revenue
- attributed_cost
- attributed_profit
- created_at

Attribution methodology must be explicit and versioned. The system must not silently present estimated profit as exact profit.

## 10. Customer / Order Domain

### Customer
Key fields:
- id
- workspace_id
- name
- phone/email where applicable
- country_code
- region_code
- city_code
- metadata_json
- created_at
- updated_at

PII access must be protected by authorization and privacy controls.

### Order
Key fields:
- id
- workspace_id
- customer_id
- product_id / product snapshot reference
- status
- payment_method
- currency
- subtotal
- shipping_cost
- discount
- total
- expected_margin
- actual_revenue
- created_at
- updated_at

Order records should retain immutable commercial snapshots where necessary so later product-price changes do not rewrite historical economics.

### OrderItem
Stores the product/variant quantities and prices belonging to an order.

### Shipment
Key fields:
- id
- order_id
- provider_integration_id
- external_tracking_id
- status
- shipped_at
- delivered_at
- returned_at
- shipping_cost
- metadata_json
- created_at
- updated_at

This enables the COD feedback loop:

`Ad → Order → Shipment → Delivered/Returned → Net Revenue → Profit`

## 11. AI Domain

### AIMemory
Workspace-scoped persistent knowledge.

Key fields:
- id
- workspace_id
- type
- subject_type
- subject_id
- content
- structured_data_json
- source
- confidence
- created_at
- updated_at

Memory must distinguish observed facts from model-generated hypotheses where practical.

### AIUsage
Tracks provider/model usage for cost, quota, and audit purposes.

Key fields:
- id
- workspace_id
- user_id (nullable)
- provider
- model
- operation
- input_tokens
- output_tokens
- estimated_cost
- request_reference
- created_at

### AIAnalysis
Stores significant AI-generated diagnoses/recommendations.

Key fields:
- id
- workspace_id
- type
- subject_type
- subject_id
- model
- prompt_version
- result_json
- confidence
- created_at

Recommendations should be traceable to the underlying data snapshot when feasible.

## 12. Automation Domain

### AutomationRule
Represents a user-defined controlled automation.

Key fields:
- id
- workspace_id
- name
- status
- trigger_type
- conditions_json
- action_type
- action_config_json
- approval_mode
- created_at
- updated_at

The data model must support permission levels defined by the Master Spec.

## 13. Notifications

### Notification
Key fields:
- id
- workspace_id
- user_id
- type
- severity
- title
- message
- data_json
- read_at
- created_at

Examples:
- overspend warning
- campaign anomaly
- creative fatigue
- integration error
- QA failure

## 14. Audit

### AuditLog
Required for sensitive and consequential operations.

Key fields:
- id
- workspace_id
- user_id (nullable for system events)
- action
- entity_type
- entity_id
- before_json (where appropriate)
- after_json (where appropriate)
- request_reference
- created_at

Audit logs should be append-oriented and protected from ordinary mutation.

## 15. Billing / Entitlements

Billing is not part of advertising business logic.

Conceptual entities:
- Subscription
- Plan
- Entitlement
- UsageLimit

They should remain isolated from core campaign/product logic.

## 16. Country / Localization Data

Country-specific configuration should not be hard-coded into product tables.

Conceptual reference data may include:
- Country
- Currency
- Region
- City
- ShippingProviderConfiguration
- CountryFeatureFlag

A country pack can add capabilities without changing the global domain model.

## 17. Relationships Summary

```text
User ──< WorkspaceMember >── Workspace
Workspace ──< Product ──< ProductVariant
Workspace ──< Creative ──< CreativeVersion
Workspace ──< CopyAsset
Workspace ──< Audience
Workspace ──< Campaign ──< AdSet ──< Ad
Ad ── CreativeVersion
Ad ── CopyAsset
Workspace ──< Integration ──< ExternalResourceMapping
Workspace ──< PerformanceSnapshot
Workspace ──< Customer ──< Order ──< OrderItem
Order ──< Shipment
Workspace ──< AttributionRecord
Workspace ──< AIMemory
Workspace ──< AIAnalysis
Workspace ──< AIUsage
Workspace ──< AutomationRule
Workspace ──< Notification
Workspace ──< AuditLog
Workspace ──< Subscription / Entitlements
```

## 18. Data Integrity Rules

1. Workspace ownership must be enforced server-side.
2. Foreign keys must be used for required relationships.
3. Unique constraints must exist where domain identity requires them.
4. Money values must use precise decimal/numeric types, not floating point.
5. Currency must be explicit for monetary records.
6. Timestamps should be stored consistently in UTC with timezone-aware handling at the application boundary.
7. Historical order economics should be immutable where required for accurate profit reporting.
8. Provider IDs must not become the primary identity of core entities.
9. Soft deletion should be used only where recovery/audit requirements justify it; do not add it indiscriminately.
10. PII must have controlled access and retention rules.

## 19. Indexing Strategy

Initial index candidates:
- WorkspaceMember(workspace_id, user_id)
- Product(workspace_id, active)
- Creative(workspace_id, status)
- Campaign(workspace_id, status)
- AdSet(campaign_id, status)
- Ad(adset_id, status)
- Integration(workspace_id, provider, status)
- ExternalResourceMapping(integration_id, entity_type, entity_id)
- PerformanceSnapshot(workspace_id, entity_type, entity_id, period_start)
- Customer(workspace_id, phone/email where applicable)
- Order(workspace_id, status, created_at)
- Shipment(order_id, status)
- AIMemory(workspace_id, subject_type, subject_id)
- AuditLog(workspace_id, created_at)

Final indexes must be based on query patterns and measured performance.

## 20. Migration Principle

Do not immediately replace the current prototype with this schema.

First:
1. Complete architecture review.
2. Confirm product requirements.
3. Confirm domain model.
4. Create Prisma schema from the approved model.
5. Create migrations.
6. Add seed/test data separately from production data.
7. Implement repository/service boundaries.
8. Migrate feature-by-feature.

## 21. Out of Scope for This Document

This document does not yet freeze:
- Exact Prisma syntax
- Exact database column types for every field
- Final attribution algorithm
- Final subscription pricing
- Final Meta API schema
- Final shipping provider API contracts
- Final AI vector storage technology

Those are implementation decisions that follow the approved domain model and requirements.
