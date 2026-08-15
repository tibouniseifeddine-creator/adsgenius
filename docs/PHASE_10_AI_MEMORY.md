# AdsGenius — Phase 10 AI Memory + Learning Loop

**Branch:** `phase-10/ai-memory-learning-loop`
**Status:** Implementation complete; CI verification required before closure.

## Scope

Phase 10 adds workspace-isolated AI memory and learning records without introducing a production AI provider.

### Implemented

- `ai_memories` persistence with workspace ownership.
- Memory categories for brand/product context, winning/failed creatives, campaign learning, facts and hypotheses.
- Source and confidence metadata.
- Explicit approval flag; AI retrieval only returns approved, non-deleted memories.
- Soft deletion for memory governance.
- Audit events for memory creation, governance changes and deletion.
- `ai_learning_records` for win/failure/neutral/learning outcomes with evidence and confidence.
- AI orchestration now retrieves approved workspace memory and records the memory count used in the AI task audit/output.
- Dedicated Phase 10 CI workflow.

## Safety / Governance

- Memory is filtered by `workspace_id` server-side.
- Unapproved memory is excluded from AI context by default.
- Deleted memory is excluded from retrieval.
- Stored memory does not grant authorization to execute external actions.
- No production AI integration was introduced.

## Deferred

- Semantic/vector retrieval.
- Automatic learning extraction from every commercial event.
- Production model/provider integration.
- Cross-workspace memory.
- Unreviewed autonomous memory promotion.
