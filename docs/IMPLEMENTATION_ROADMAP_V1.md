# AdsGenius — Implementation Roadmap V1

**Status:** Execution baseline
**Purpose:** Convert the approved product, architecture, domain, and API decisions into small, testable implementation phases.

## 1. Execution Rules

- Do not rebuild the entire application in one operation.
- Do not modify `main` directly for major implementation work.
- Every phase has a clear scope and Definition of Done.
- Do not start a later phase while required blockers from an earlier phase remain unresolved.
- Preserve reusable prototype UI unless the audit explicitly marks it for rewrite/delete.
- Replace mocks incrementally behind stable interfaces.
- Every production integration must be isolated behind an adapter/module.
- Secrets never enter client source code.
- Every consequential external action must be auditable.
- Tests must accompany important domain logic and integrations.

## 2. Phase 0 — Repository & Engineering Preparation

### Goal
Prepare the repository for controlled development without changing product behavior unnecessarily.

### Tasks
- Confirm branch strategy.
- Confirm package manager/workspaces.
- Establish linting/formatting/type checking.
- Establish test framework.
- Establish environment variable conventions.
- Add CI baseline.
- Establish docs index.
- Identify existing build/runtime assumptions.
- Record exact KEEP/MOVE/MERGE/REWRITE/DELETE decisions from the code audit.

### Definition of Done
- Repository has reproducible install/build/test commands.
- CI can run typecheck/lint/tests/build.
- No secrets are committed.
- Documentation points to the current source of truth.
- Existing prototype remains runnable.

## 3. Phase 1 — Core Infrastructure

### Goal
Create the shared foundation used by every feature.

### Tasks
- Shared types/contracts package where appropriate.
- API client foundation.
- Configuration module.
- Error model.
- Logging foundation.
- Request IDs/correlation IDs.
- Database connection layer.
- Migration tooling.
- Storage abstraction.
- Background-job abstraction.

### Definition of Done
- Backend starts against a development PostgreSQL instance.
- Migrations run reproducibly.
- Client can call a versioned health endpoint.
- Errors use the documented envelope.
- No feature-specific business logic is duplicated in infrastructure code.

## 4. Phase 2 — Authentication + Workspace

### Goal
Create the secure tenant boundary.

### Tasks
- Register/login/logout/refresh/me.
- User model.
- Workspace model.
- Workspace membership.
- Roles/permissions.
- Server-side workspace authorization.
- Audit events for security-sensitive operations.

### Definition of Done
- A user can authenticate securely.
- A user can create/access an authorized workspace.
- Unauthorized workspace access is rejected server-side.
- Tests cover authentication and tenant isolation.

## 5. Phase 3 — Products + Economics

### Goal
Replace product demo data with persisted domain data.

### Tasks
- Product CRUD.
- Product variants.
- Currency-aware pricing.
- Cost and sale price.
- Product economics.
- Product UI migration from demo context.

### Definition of Done
- Product data persists in PostgreSQL.
- UI uses API/domain data rather than demo data.
- Monetary calculations use precise numeric handling.
- Tests cover core product economics.

## 6. Phase 4 — Creative Intelligence Foundation

### Goal
Build reusable creative/copy entities and AI capability boundaries.

### Tasks
- Creative CRUD.
- Creative versions/lineage.
- Copy assets.
- Secure asset storage.
- AI orchestration boundary.
- Prompt/version tracking.
- AI usage tracking.
- Product analysis.
- Creative idea generation.
- Copy generation.
- Creative analysis.

### Definition of Done
- Creative data persists.
- Generated outputs are traceable to a model/prompt version.
- AI provider secrets remain server-side.
- Failed AI requests produce controlled errors.
- Important AI operations have usage/audit records.

## 7. Phase 5 — Audiences + Campaign Domain

### Goal
Move from prototype campaign screens to the provider-neutral campaign model.

### Tasks
- Audience CRUD.
- Campaign CRUD.
- AdSet CRUD.
- Ad CRUD.
- Creative/copy attachment.
- Tracking configuration.
- Campaign validation.
- Pre-launch QA foundation.

### Definition of Done
- Campaign hierarchy persists correctly.
- Provider IDs are not hard-coded into core entities.
- Validation prevents invalid campaign states.
- UI no longer depends on campaign demo state for core operations.

## 8. Phase 6 — Analytics + Campaign Detective

### Goal
Turn advertising data into diagnosis, not only charts.

### Tasks
- Normalized performance snapshots.
- Analytics ingestion interface.
- KPI calculations.
- Anomaly detection foundation.
- Creative fatigue signals.
- Campaign diagnosis.
- AI-assisted root-cause explanations.
- Recommendation model.

### Definition of Done
- Analytics distinguish reported/calculated/estimated metrics.
- A campaign can receive a traceable diagnosis.
- Diagnosis references the relevant data window.
- Recommendations do not silently execute external changes.

## 9. Phase 7 — Customers + Orders + COD + Profit

### Goal
Connect advertising to actual commercial outcomes.

### Tasks
- Customer domain.
- Orders/order items.
- Shipment domain.
- Shipping adapter interface.
- Initial country/provider integration after API verification.
- Delivered/returned status handling.
- Actual revenue.
- Actual/estimated profit.
- Attribution records.
- Profit dashboard.

### Definition of Done
- Order lifecycle is persisted.
- Shipment lifecycle is persisted.
- Provider-specific shipping logic is isolated.
- Profit calculations can distinguish expected from actual outcomes.
- COD return effects can feed back into advertising economics.

## 10. Phase 8 — Meta Integration

### Goal
Replace the Meta mock service with a real, isolated integration.

### Tasks
- Verify current Meta API/version/permissions requirements.
- OAuth flow.
- Account discovery.
- External resource mappings.
- Campaign/adset/ad read.
- Insights sync.
- Draft creation.
- Publish/pause/resume only after approval rules are implemented.
- Webhooks where justified.
- Rate-limit/retry handling.

### Definition of Done
- Real Meta account can be connected through a secure OAuth flow.
- Provider IDs are mapped without contaminating core entities.
- Sync is idempotent.
- External mutations are permission-controlled and audited.
- Integration tests cover critical paths.

## 11. Phase 9 — Controlled AI Agent

### Goal
Convert AI recommendations into controlled workflows.

### Permission levels
- Level 0: Analyze only
- Level 1: Recommend
- Level 2: Create draft
- Level 3: Execute after user approval
- Level 4: Explicit user-configured automation rules

### Tasks
- Agent orchestration.
- Tool permissions.
- Approval workflow.
- Automation rules.
- Action previews.
- Audit trail.
- Safety/rate limits.
- Rollback strategy where technically possible.

### Definition of Done
- Agent cannot bypass authorization.
- Consequential actions require the configured permission level.
- Every external action is auditable.
- User can understand what the agent proposes before execution where approval is required.

## 12. Phase 10 — AI Memory + Learning Loop

### Goal
Allow AdsGenius to learn workspace-specific context over time.

### Tasks
- AI memory storage.
- Memory retrieval rules.
- Confidence/source metadata.
- Winning/failed creative memory.
- Campaign learning records.
- Product/brand context.
- Memory governance and deletion controls.

### Definition of Done
- AI can retrieve approved workspace context.
- Facts and hypotheses are distinguishable where practical.
- Memory is workspace-isolated.
- Users can inspect/manage stored memory where required.

## 13. Phase 11 — Billing / Entitlements

### Goal
Introduce subscription controls without coupling them to campaign domain logic.

### Tasks
- Plan model.
- Entitlements.
- Usage limits.
- Subscription provider research/selection.
- Server-side entitlement checks.
- Graceful limit handling.

### Definition of Done
- Entitlements are enforced server-side.
- Client UI reflects server truth but cannot grant itself access.
- Billing logic remains isolated from advertising domain logic.

## 14. Phase 12 — Desktop + Mobile Application Shell

### Goal
Package the shared application for the target platforms.

### Targets
- Windows
- macOS
- Android
- iOS/iPadOS

### Tasks
- Confirm Tauri 2 feasibility against the approved architecture.
- Desktop shell.
- Mobile shell strategy.
- Secure local storage.
- Deep links where required.
- Network/offline state handling.
- Platform permissions.
- Restricted native capabilities.
- Build/signing pipeline.

### Definition of Done
- Supported target builds are reproducible.
- Authentication works securely on target platforms.
- Core workflows work on desktop and mobile layouts.
- Native permissions are minimal and documented.

## 15. Phase 13 — Security / Reliability / QA

### Goal
Prepare for production rather than treating deployment as the end of development.

### Tasks
- Threat model.
- Dependency/security audit.
- Authorization tests.
- Tenant-isolation tests.
- Rate limiting.
- Secret-management review.
- Backup/restore testing.
- Database migration testing.
- Job retry/dead-letter behavior.
- Observability.
- Error monitoring.
- Load testing for critical APIs.
- Mobile/desktop regression testing.

### Definition of Done
- Critical security findings resolved or explicitly accepted.
- Recovery procedures tested.
- Monitoring covers critical services.
- Release candidate passes functional/regression tests.

## 16. Phase 14 — Production Release

### Goal
Release a controlled production version.

### Tasks
- Production PostgreSQL.
- Object storage.
- Backend deployment.
- Domain/TLS.
- Environment secrets.
- CI/CD.
- Database backup schedule.
- Monitoring/alerts.
- App signing/distribution.
- Privacy/legal documents as required.
- Support/error-reporting workflow.
- Rollback procedure.

### Definition of Done
- Production health checks pass.
- Authentication works in production.
- Core P0 workflows work end-to-end.
- Meta integration works where approved.
- Data persistence survives redeploy.
- Backup/restore has been tested.
- Release artifacts are signed according to platform requirements.

## 17. Phase Dependencies

```text
P0 Repository
    ↓
Infrastructure
    ↓
Auth + Workspace
    ↓
Products
    ↓
Creative / AI foundation
    ↓
Campaign domain
    ↓
Analytics / Diagnosis
    ↓
Orders / COD / Profit
    ↓
Meta integration
    ↓
Controlled AI Agent
    ↓
AI Memory
    ↓
Billing / Entitlements
    ↓
Cross-platform packaging
    ↓
Security / QA
    ↓
Production
```

Some work can run in parallel only when its dependencies are stable and documented.

## 18. Codex Task Protocol

Every Codex task must include:

### Context
Which documents and modules are authoritative.

### Scope
Exact files/modules that may be changed.

### Requirements
Observable behavior to implement.

### Constraints
What must not be changed.

### Tests
Exact checks to run.

### Definition of Done
Conditions that must be true before completion.

### Output
Summary of files changed, tests run, and known remaining issues.

Codex should not be instructed with vague prompts such as “finish the app” or “rebuild everything”.

## 19. Change Safety Rules

Before any major refactor:
1. Read the relevant architecture documents.
2. Inspect the existing implementation.
3. Identify reusable code.
4. Create a focused branch.
5. Make the smallest coherent change.
6. Run tests/typecheck/build.
7. Review the diff.
8. Update documentation if an architectural decision changed.

## 20. First Implementation Task

The first code task after this roadmap is **Phase 0 Repository & Engineering Preparation**.

It must not yet implement Meta, production AI, shipping integrations, or rewrite all screens.

The objective is to create a safe engineering foundation for the subsequent migration.
