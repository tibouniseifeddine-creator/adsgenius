# Phase 12 — Desktop + Mobile Application Shell

## Scope
Package the shared AdsGenius application for Windows, macOS, Android and iOS/iPadOS without duplicating domain logic.

## Architecture boundary
- Web/client application remains the shared UI and API consumer.
- Native shell capabilities are isolated behind platform adapters.
- No provider secrets or business authorization logic move into native code.
- Secure local storage is limited to tokens/session material and explicitly approved local state.
- Offline mode is explicit: cached/read-only state must never imply successful server-side mutations.

## Targets
- Windows
- macOS
- Android
- iOS/iPadOS

## Phase 12 Definition of Done
- Shell strategy is documented and reproducible.
- Platform capability boundary exists.
- Authentication/session storage has a secure abstraction.
- Online/offline state has a shared abstraction.
- Deep-link handling is isolated and validated.
- Native permissions are minimal and documented.
- Build/signing pipeline is prepared without committing certificates or secrets.
- Existing web workflows remain unaffected.

## Implementation order
1. Shell feasibility and repository adapter boundary.
2. Secure storage abstraction.
3. Network/offline state abstraction.
4. Deep links.
5. Desktop shell.
6. Mobile shell strategy.
7. Platform build/signing CI.
8. Cross-platform smoke checks.
