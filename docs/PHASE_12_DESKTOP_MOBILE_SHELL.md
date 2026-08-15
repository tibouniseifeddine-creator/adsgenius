# Phase 12 — Desktop + Mobile Application Shell

## Scope
Package the shared AdsGenius application for Windows, macOS, Android and iOS/iPadOS without moving secrets or business authorization into client code.

## Decisions
- Keep the existing web application as the shared UI/runtime foundation.
- Use a thin native shell; native capabilities are opt-in and minimal.
- Tauri 2 is the desktop feasibility target.
- Mobile packaging remains an explicit platform strategy and must not assume desktop-only APIs.
- Authentication tokens and sensitive configuration remain protected by platform storage and server-side authorization.

## Required boundaries
- `src/platform/` contains platform-neutral capability interfaces.
- Native implementations must sit behind adapters.
- No provider secrets in bundled client assets.
- Server remains authoritative for identity, workspace authorization, entitlements and external actions.
- Offline state must never grant additional permissions.

## Phase 12 acceptance criteria
1. Shell architecture is documented.
2. Platform capability interfaces are isolated from domain logic.
3. Desktop/mobile build configuration can be added without changing core API contracts.
4. Deep links, secure storage, network state and platform permissions have explicit extension points.
5. CI can validate the shared application independently of native signing credentials.

## Deferred
Actual platform signing, store submission, native permissions and production distribution belong to Phase 14.