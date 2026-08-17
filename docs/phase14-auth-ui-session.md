# Phase 14 — Auth UI + Session Management

Implemented on `feat/phase-14-auth-ui-session`.

- Login password visibility toggle.
- Forgot-password UI with email, phone/OTP, and secure trusted-device QR recovery choices.
- QR recovery UI explicitly avoids encoding passwords or recovery secrets.
- Client session restoration validates `/api/auth/me`.
- Expired JWT sessions are cleared automatically.
- Logout clears the local authentication session and protected routes redirect to `/auth`.

Recovery delivery and reset-token/OTP issuance remain backend/provider contracts and must use short-lived, single-use, rate-limited server-side secrets when wired to delivery providers.