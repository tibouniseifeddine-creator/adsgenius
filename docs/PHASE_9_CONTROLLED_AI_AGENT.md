# AdsGenius — Phase 9 Controlled AI Agent

**Branch:** `phase-9/creative-studio`
**Status:** IMPLEMENTED — pending CI verification

## Scope

Phase 9 converts recommendations into controlled, auditable workflows. The agent does not receive unrestricted access to the application.

### Permission levels

- `ANALYZE` — read/analysis only.
- `RECOMMEND` — create recommendations and plans.
- `DRAFT` — create provider drafts.
- `EXECUTE` — execute an approved consequential action.
- `AUTOMATE` — explicit workspace automation rules; enabling automation is restricted to owners/admins.

## Implemented

- Persistent agent runs, actions, approvals and automation rules.
- Workspace isolation on all agent records.
- Tool allowlist (`ANALYTICS`, `CREATIVE`, `META`).
- Permission checks before actions are planned and executed.
- Action previews before consequential execution.
- Approval requests expire after 30 minutes.
- Owner/admin approval for consequential actions.
- Existing Meta draft and mutation handlers are reused; no duplicate provider implementation was introduced.
- Audit log entries for run creation, approval decisions, automation changes, execution and failures.
- Cooldown field on automation rules as a safety boundary.
- Dedicated Phase 9 CI workflow with push/PR/manual execution.

## Safety boundary

The agent cannot bypass workspace authorization. A run configured below `EXECUTE` cannot execute consequential actions. Automation rules cannot be enabled unless explicitly configured at `AUTOMATE` level. Unknown tools/actions are rejected rather than executed.

Rollback payloads are persisted as part of the action contract. A generic automatic rollback executor is intentionally not fabricated where the underlying provider does not expose a technically safe inverse operation.

## Not included

- No new production AI provider.
- No autonomous background scheduler.
- No unrestricted tool execution.
- No billing or memory/learning-loop work.
- No Phase 10 implementation.
