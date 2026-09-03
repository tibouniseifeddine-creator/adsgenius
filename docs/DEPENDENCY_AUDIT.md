# Dependency Vulnerability Audit -- 2026-09-02

This sandbox has no npm registry access (confirmed: `npm view` returns 403), so this audit was done by researching each pinned dependency's known CVEs against its exact version range in `package.json`, rather than running `npm audit` directly. **Treat this as a first pass, not a replacement for running `npm audit` (or `npm audit fix`) yourself once you have the project checked out locally** -- that pulls live from npm's own advisory database and will catch anything found after this was written.

## Finding: `vite` was pinned below two known CVEs -- fixed

`vite` was `"^5.0.0"` in `devDependencies`. Two CVEs affect the 5.x line at versions below 5.4.21:

- **CVE-2025-31125** (arbitrary file read) -- affects 5.0.0 to 5.4.15, fixed in 5.4.16+.
- **CVE-2025-62522** (path traversal on Windows via a trailing backslash bypassing `server.fs.deny`) -- affects 5.2.6 to 5.4.20, fixed in 5.4.21+.

Both only matter when `vite`'s **dev server** is run with `--host` (exposed to the network) -- they do not affect the production build Vercel serves, since that's static files with no Vite server involved. Still worth closing: a caret range doesn't force an upgrade of an already-resolved `package-lock.json` entry, so a project scaffolded a while ago could still be sitting on an old, vulnerable patch version even though `^5.0.0` would technically permit a newer one.

**Fixed** by raising the floor to `"vite": "^5.4.21"` in `package.json` (delivered alongside this report). Run `npm install` once to pick it up -- same step you already need for the other pending dependency changes.

## Checked, no action needed

| Package | Pinned | Result |
|---|---|---|
| `jsonwebtoken` | `^9.0.2` | The only known CVE (CVE-2022-23540) affects <=8.5.1, fixed in 9.0.0. Already well past it. |
| `postcss` | `^8.4.32` | CVE-2023-44270 affects <8.4.31. Already past it. |
| `express` | `^5.1.0` | The XSS/open-redirect CVEs found (CVE-2024-43796, CVE-2024-29041) were fixed in the 4.x line (4.19-4.20) before 5.0 was released; not applicable to 5.x. |
| `@prisma/client` / `prisma` | `^6.14.0` | No applicable CVE found for the runtime client at this version at the time of this audit. |

## Needs your own verification -- ambiguous finding

**`cors` `^2.8.5`:** one third-party vulnerability database (vulert.com) lists a "malicious code" entry under this exact version string, described as a full-compromise supply-chain incident. I could not confirm from that page alone whether this refers to the real, official `expressjs/cors` package (used by hundreds of thousands of projects, actively maintained, no corresponding mainstream security advisory found on GitHub Advisories or Snyk for this) or to a same-named/confused entry in that particular database, which is not always accurate. **I'm flagging this rather than asserting it** -- please run `npm audit` yourself (it queries npm's own advisory database, which is authoritative) and treat that result, not this note, as the final word on `cors`.

## Not a CVE, but worth fixing before a real launch

**`@vercel/blob`: `"latest"`.** This isn't pinned to any version at all -- every fresh `npm install` can silently resolve to a different (newer, or in a worst case compromised) release with nothing in `package.json` changing to show it happened. This was set to `"latest"` earlier because this sandbox couldn't reach the npm registry to confirm an exact current version number. **Action for you:** after your next `npm install`, open `package-lock.json`, find the resolved `@vercel/blob` version, and replace `"latest"` in `package.json` with that exact version (e.g. `"1.2.3"` with no `^`), then commit both files together.

## Recommended ongoing practice

Add a dependency scan to CI (GitHub Actions has a built-in `npm audit --audit-level=high` step, or Dependabot alerts, which are free on GitHub and require no code) so this kind of drift is caught automatically on every PR rather than manually, on request, like this pass was.
