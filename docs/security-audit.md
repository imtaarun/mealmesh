# Security audit — 2026-10-10

A read-only review of the whole repository plus non-destructive probes against a local
instance with throwaway accounts. No secrets were found in the code or its history.
Not reviewed: deployment, TLS, cloud and database hosting (none of it is in the repo),
real Google/Apple sign-in, real devices. This lists what was found and what was done; it
doesn't mean the app is free of security problems.

Regression tests: `pnpm test:security` (`apps/backend/test/security.test.ts`).

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-01 | High | No rate limits or lockout on sign-in and heavy routes | Fixed: `@nestjs/throttler` (per IP), 10-failure lock per email |
| SEC-02 | Medium | Logout only cleared the phone; sessions couldn't be ended | Fixed: `POST /api/auth/logout`, `/logout-all`; the app calls logout |
| SEC-03 | Medium | Seed creates a demo account with a published password, even on production | Fixed: skipped when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` |
| SEC-04 | Medium | Request-parsing libraries (`qs`, `body-parser`, `multer`, `proxy-addr`) with known advisories | Fixed: pnpm overrides to patched versions |
| SEC-05 | Low | Login told apart unknown emails from wrong passwords (message and timing) | Fixed: same answer and a bcrypt compare either way. Sign-up's "email already exists" is kept on purpose |
| SEC-06 | Low | Unbounded inputs (huge numbers, long lists, 500s on bad query strings) | Fixed: size and range limits on every DTO, caps on invites and custom list items |
| SEC-07 | Low | Any website could call the API; no security headers | Fixed: helmet; CORS only for `CORS_ORIGINS` |
| SEC-08 | Low | Every housemate saw every other housemate's email | Fixed: only the owner (and you, for your own) |
| SEC-09 | Low | Two sign-ups could use one invite code at the same time | Fixed: the invite is claimed in one conditional update |
| SEC-10 | Low | Google/Apple tokens: no nonce check or pinned algorithm | Open |
| SEC-11 | Info | Test key URLs (`GOOGLE_JWKS_URL`, `APPLE_JWKS_URL`) could be set in production | Fixed: ignored when `NODE_ENV=production` |
| SEC-12 | Info | `POST /api/recipes/generate` returns 500 and isn't Pro-gated yet | Open — gate it when the AI provider ships |
| SEC-13 | Info | Dev-only tool advisories (never shipped in the app or API) | Open — upgrade with normal dependency work |
| SEC-14 | Info | No deployment config: HTTPS, least-privilege DB user, logging, CI, expired-session clean-up | Open; passwords over 72 bytes are now refused (bcrypt's limit) |
