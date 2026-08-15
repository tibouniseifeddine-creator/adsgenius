# AdsGenius — API Contract Baseline V1

**Status:** Design baseline — incremental implementation in progress

## 1. API Principles

The API is the server-side contract between clients and the AdsGenius backend.

Rules:
- Version public APIs from the beginning (`/api/v1`).
- Authenticate every protected request.
- Authorize against workspace membership server-side.
- Validate request and response schemas.
- Never expose provider secrets to clients.
- Return consistent error envelopes.
- Keep provider-specific APIs behind integration modules.
- Long-running AI, sync, import, export, and optimization tasks should use jobs rather than blocking requests.

## 2. Base Structure

```text
/api/v1
├── auth
├── users
├── workspaces
├── products
├── creatives
├── audiences
├── campaigns
├── analytics
├── customers
├── orders
├── shipments
├── integrations
├── ai
├── automations
├── notifications
├── billing
└── health
```

## 3. Authentication

Conceptual endpoints:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
```

Exact authentication technology is an implementation decision, but access tokens must be handled securely and refresh/revocation behavior must be explicit.

## 4. Workspaces

```text
GET    /api/v1/workspaces
POST   /api/v1/workspaces
GET    /api/v1/workspaces/:workspaceId
PATCH  /api/v1/workspaces/:workspaceId
GET    /api/v1/workspaces/:workspaceId/members
POST   /api/v1/workspaces/:workspaceId/members
PATCH  /api/v1/workspaces/:workspaceId/members/:memberId
DELETE /api/v1/workspaces/:workspaceId/members/:memberId
```

All workspace routes must verify membership and role permissions.

## 5. Products

```text
GET    /api/v1/workspaces/:workspaceId/products
POST   /api/v1/workspaces/:workspaceId/products
GET    /api/v1/workspaces/:workspaceId/products/:productId
PATCH  /api/v1/workspaces/:workspaceId/products/:productId
DELETE /api/v1/workspaces/:workspaceId/products/:productId
```

Product variants should be nested or exposed through a clearly documented sub-resource.

## 6. Creatives

```text
GET    /api/v1/workspaces/:workspaceId/creatives
POST   /api/v1/workspaces/:workspaceId/creatives
GET    /api/v1/workspaces/:workspaceId/creatives/:creativeId
PATCH  /api/v1/workspaces/:workspaceId/creatives/:creativeId
DELETE /api/v1/workspaces/:workspaceId/creatives/:creativeId
POST   /api/v1/workspaces/:workspaceId/creatives/:creativeId/versions
```

Asset upload should use signed storage URLs or an equivalent secure upload mechanism rather than sending large assets through every API endpoint.

## 7. Audiences

```text
GET    /api/v1/workspaces/:workspaceId/audiences
POST   /api/v1/workspaces/:workspaceId/audiences
GET    /api/v1/workspaces/:workspaceId/audiences/:audienceId
PATCH  /api/v1/workspaces/:workspaceId/audiences/:audienceId
DELETE /api/v1/workspaces/:workspaceId/audiences/:audienceId
```

## 8. Campaigns

```text
GET    /api/v1/workspaces/:workspaceId/campaigns
POST   /api/v1/workspaces/:workspaceId/campaigns
GET    /api/v1/workspaces/:workspaceId/campaigns/:campaignId
PATCH  /api/v1/workspaces/:workspaceId/campaigns/:campaignId
DELETE /api/v1/workspaces/:workspaceId/campaigns/:campaignId
POST   /api/v1/workspaces/:workspaceId/campaigns/:campaignId/publish
POST   /api/v1/workspaces/:workspaceId/campaigns/:campaignId/pause
POST   /api/v1/workspaces/:workspaceId/campaigns/:campaignId/resume
```

External publishing must pass authorization checks and must create an audit record.

## 9. Analytics

Phase 6 adds the first persisted analytics/diagnosis contract without introducing a production advertising-provider integration.

```text
POST /api/v1/workspaces/:workspaceId/analytics/snapshots
GET  /api/v1/workspaces/:workspaceId/analytics/campaigns/:campaignId
POST /api/v1/workspaces/:workspaceId/analytics/campaigns/:campaignId/diagnose
GET  /api/v1/workspaces/:workspaceId/analytics/diagnostics
GET  /api/v1/workspaces/:workspaceId/analytics/creative-fatigue
POST /api/v1/workspaces/:workspaceId/analytics/creative-fatigue/:creativeVersionId
```

Analytics snapshots preserve provider/source provenance and a defined time window. Missing metrics remain unknown rather than being converted to zero. Normalized KPIs are calculated deterministically from the available metrics.

Diagnosis records preserve:
- data window
- observed facts
- candidate causes
- confidence
- evidence snapshot IDs
- recommendations
- optional mock-AI explanation/task reference

Recommendations are advisory only in Phase 6 and do not execute external advertising changes.

## 10. Campaign Monitoring

```text
GET /api/v1/workspaces/:workspaceId/analytics/overview
GET /api/v1/workspaces/:workspaceId/analytics/campaigns/:campaignId
GET /api/v1/workspaces/:workspaceId/analytics/creatives/:creativeId
GET /api/v1/workspaces/:workspaceId/analytics/profit
GET /api/v1/workspaces/:workspaceId/analytics/diagnostics
```

Analytics responses should distinguish:
- provider-reported metrics
- normalized metrics
- calculated metrics
- estimated metrics
- actual commercial outcomes

## 11. Customers / Orders / Shipments

```text
GET    /api/v1/workspaces/:workspaceId/customers
POST   /api/v1/workspaces/:workspaceId/customers
GET    /api/v1/workspaces/:workspaceId/orders
POST   /api/v1/workspaces/:workspaceId/orders
GET    /api/v1/workspaces/:workspaceId/orders/:orderId
PATCH  /api/v1/workspaces/:workspaceId/orders/:orderId
GET    /api/v1/workspaces/:workspaceId/orders/:orderId/shipments
POST   /api/v1/workspaces/:workspaceId/shipments
```

Provider-specific shipment operations remain behind the shipping integration module.

## 12. Integrations

```text
GET    /api/v1/workspaces/:workspaceId/integrations
POST   /api/v1/workspaces/:workspaceId/integrations
GET    /api/v1/workspaces/:workspaceId/integrations/:integrationId
DELETE /api/v1/workspaces/:workspaceId/integrations/:integrationId
POST   /api/v1/workspaces/:workspaceId/integrations/:integrationId/sync
```

OAuth authorization flows may use dedicated routes/callbacks as required by the provider.

## 13. AI

AI endpoints should represent capabilities, not expose raw provider APIs.

Examples:

```text
POST /api/v1/workspaces/:workspaceId/ai/product-analysis
POST /api/v1/workspaces/:workspaceId/ai/creative-analysis
POST /api/v1/workspaces/:workspaceId/ai/campaign-diagnosis
POST /api/v1/workspaces/:workspaceId/ai/creative-ideas
POST /api/v1/workspaces/:workspaceId/ai/copy
POST /api/v1/workspaces/:workspaceId/ai/profit-analysis
GET  /api/v1/workspaces/:workspaceId/ai/memory
```

Long-running operations should return a job reference when necessary.

## 14. Jobs

Conceptual endpoints:

```text
GET /api/v1/jobs/:jobId
POST /api/v1/jobs/:jobId/cancel
```

Jobs may be used for:
- AI generation
- large analytics imports
- Meta sync
- shipping sync
- creative processing
- bulk operations

## 15. Automations

```text
GET    /api/v1/workspaces/:workspaceId/automations
POST   /api/v1/workspaces/:workspaceId/automations
GET    /api/v1/workspaces/:workspaceId/automations/:automationId
PATCH  /api/v1/workspaces/:workspaceId/automations/:automationId
DELETE /api/v1/workspaces/:workspaceId/automations/:automationId
POST   /api/v1/workspaces/:workspaceId/automations/:automationId/test
```

Automation execution must respect the configured AI-agent permission level and produce an audit record for consequential actions.

## 16. Notifications

```text
GET  /api/v1/workspaces/:workspaceId/notifications
POST /api/v1/workspaces/:workspaceId/notifications/:notificationId/read
POST /api/v1/workspaces/:workspaceId/notifications/read-all
```

## 17. Health

```text
GET /api/v1/health
```

Health should expose safe service status only and must not leak credentials or sensitive infrastructure details.

## 18. Error Envelope

Preferred shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {},
    "requestId": "..."
  }
}
```

Do not expose stack traces or secret values in production responses.

## 19. Pagination

Collection endpoints should support a consistent pagination model.

Conceptual response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "hasNext": false
  }
}
```

Cursor pagination may be preferred for large analytics/event datasets.

## 20. Idempotency

Operations that can create external side effects should support idempotency where appropriate, especially:
- publish
- pause/resume
- order creation from external callbacks
- shipment creation
- payment/subscription operations

Analytics snapshot ingestion is idempotent for the same workspace/entity/provider/time-window key.

## 21. Webhooks

External provider webhooks must be handled through dedicated integration modules.

Requirements:
- Signature verification
- Replay protection where supported
- Idempotent processing
- Event logging
- Retry strategy
- Safe failure handling

## 22. API Contract Governance

Before implementation of a public endpoint, define:
- request schema
- response schema
- authentication requirements
- authorization requirements
- validation rules
- error codes
- pagination/filtering behavior
- idempotency behavior
- audit requirements
- rate limits where relevant

OpenAPI should be generated or maintained as part of implementation so the contract remains reviewable.

## 23. Out of Scope for This Baseline

Not frozen yet:
- Exact authentication provider
- Exact token format
- Exact OpenAPI document
- Exact pagination cursor format
- Exact webhook event catalog
- Final Meta API version/endpoints
- Final billing provider
- Final production AI provider/model selection
