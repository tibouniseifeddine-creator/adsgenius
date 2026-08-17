# Auth Recovery Plan

- Login password visibility toggle.
- Password recovery by verified email.
- Password recovery by verified phone using OTP.
- QR recovery only as an optional authenticated-device recovery method; never encode or expose the password or recovery secret in the QR code.
- Recovery tokens/OTPs must be single-use, short-lived, rate-limited, and invalidated after successful reset.
