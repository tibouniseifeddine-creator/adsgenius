# AdsGenius Platform Shell Boundary

This directory defines the native-shell boundary for Phase 12.

## Rules
- Native code must not contain API provider secrets.
- Authentication and authorization remain server-controlled.
- Domain logic stays in the shared application/backend.
- Platform-specific capabilities must be accessed through small adapters.
- Offline state must never report a server mutation as successful until confirmed by the API.
- Signing certificates, provisioning profiles, keystores and tokens are supplied only by CI secrets.

## Target shells
- Desktop: Tauri 2 feasibility target for Windows/macOS.
- Mobile: platform shell strategy for Android and iOS/iPadOS.

Actual native project generation is intentionally separated from the architecture boundary so it can be validated without changing the existing web runtime.
