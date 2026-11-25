# Server authentication foundation

Import application helpers from `@/server/auth` in server code. `/auth` provides
sign-in and registration; `/app/onboarding` provides initial participant choices;
`/app` is a minimal protected landing page. Mutations use Server Actions.

- `authenticatePassword(email, password)` returns a basic user or `null`, including
  the same failure result for wrong credentials, unknown accounts, and suspension.
- `startSession(user.id)` is a **trusted server helper** called after credential
  verification. Never pass an unverified client-supplied user ID. It sets the
  cookie and replaces the current session; use it inside a Route Handler or
  Server Action where Next.js permits cookie writes.
- `getCurrentUser()` reads the cookie, validates its HMAC, and reads current
  suspension/roles from PostgreSQL. It returns `null` for expired, revoked,
  missing, invalid, or suspended sessions. Database failures propagate and never
  fall back to trusting the cookie.
- `endSession()` revokes the database session and expires its cookie.
- `requireAuthentication()` throws `AuthError(401)` for API/action callers.
  Pass `{ kind: "page", returnTo: "/app/projects" }` to redirect anonymous page
  requests to `/auth?returnTo=...`.
- `requireRole("REVIEWER")` requires that explicit role. Arrays permit any listed
  role; empty arrays deny. There is no implicit ADMIN bypass or eligibility-based
  role. Checks resolve the current user from the database rather than trusting a
  user/roles object supplied by the caller.

API handlers should catch `AuthError` and return `authErrorResponse(error)` for
generic HTTP 401/403 responses. Other errors must propagate. Authorization checks
belong before resource lookup and still require future assignment/resource guards;
a global role does not grant access to restricted project or eligibility records.

Server Actions should return `authActionFailure(error)` from their catch boundary.
This serializable result contains `status: 401 | 403`, `ok: false`, and a generic
message. Next.js controls the Server Action transport status; use Route Handlers
when clients require an actual HTTP 401/403 response. Page role denials throw the
same generic `AuthError`; rendering a page-level forbidden state is deferred with
the UI.

Passwords use Node's asynchronous scrypt (N=32768, r=8, p=3), a random 16-byte salt,
and a 64-byte key with fixed-length timing-safe verification. Missing/malformed
stored hashes perform the same scrypt operation and comparison. Passwords are
case-sensitive and are never truncated; inputs are bounded to 1024 UTF-8 bytes.
`password.ts` intentionally supports the standalone seed CLI; the application
entry point and other authentication modules are marked `server-only`.

Session cookies contain only a version, a random 256-bit nonce, and HMAC-SHA256.
No identity, roles, referral, or eligibility data is encoded in the cookie. Only
the token's SHA-256 hash is stored in `Session`. Sessions expire after seven days.
Cookies are HttpOnly, SameSite=Lax, and Path=/; production cookies additionally
use Secure and the `__Host-` prefix, with no Domain attribute. Changing AUTH_SECRET
invalidates existing signatures. There is no fallback secret; configure a unique
random secret with at least 32 bytes in the ignored `.env` before using auth.

Shared user data is explicitly limited to `id`, `email`, `displayName`, and actual
`roles`. Password hashes and suspension reasons are never returned. Confidential
eligibility/referral tables are not joined by auth queries, including for admins.

The six namespaced synthetic seed accounts use **CivicSpecPilot123!**. Seeding is
blocked in production mode. It preserves a hash that already verifies, so repeat
runs do not change password hashes or timestamps. An existing account with a
matching synthetic email but a different ID causes an atomic seed failure.

```sh
npx prisma migrate status
npx prisma db seed
npm test
npm run test:auth:db
npm run build
npx playwright install chromium
npm run test:auth:browser
```

`npm test` needs no database credentials or network access. The explicitly invoked
database suite uses the configured development/test database, verifies all six
seed passwords, creates isolated random test accounts, and removes them in cleanup.
It covers real database session lookup, suspension, role revocation, expiry,
revocation, privacy projections, and cascading account deletion. No seeded account
is suspended or deleted by the tests.

## Public flows

Use Node.js 22.12+ or 24 LTS. `APP_URL` must match the browser's exact public
origin, including scheme, host, and port (locally, `http://localhost:3000`).
Mutations check that configured origin as well as Next.js's own CSRF checks;
forwarding headers cannot substitute a different trusted origin. Action bodies
are limited to 16 KiB.

`public-flows.ts` validates every input on the server. Registration normalizes
email, hashes an 8–128-character password, and atomically creates a SYSTEM theme
preference with no roles. A duplicate email returns a generic failure, never
updates the account, and never signs the existing account in. Registration and
roleless sign-in go to onboarding. Safe return paths are checked again at the
mutation boundary; auth/onboarding self-redirect loops fall back to `/app`.

Registration requires at least one uppercase letter, one lowercase letter, one
decimal digit, and one punctuation/symbol character (for example, !, @, or #).
Unicode letter/digit categories are supported. Spaces are allowed but do not
satisfy the symbol rule. Passwords are neither trimmed nor normalized. This
registration policy is not applied at sign-in: existing valid account passwords
continue to verify, including passwords created under the previous policy.

Onboarding takes identity only from the database-validated session. A transaction
locks the User row and rereads suspension/roles before granting PROBLEM_OWNER or
DEVELOPER. An existing role ends onboarding without granting another. The grant,
private empty developer profile (for builders), and append-only, versioned
PARTICIPATION_TERMS_ACCEPTED audit receipt commit together. ADMIN/REVIEWER,
forged user IDs, repeated fields, unknown fields, absent acknowledgements, and
stale term versions fail validation. Choosing an initial role does not establish
nonprofit eligibility or bypass GitHub/readiness gates.

`AuthRateLimit` provides shared, atomic ten-minute windows across app workers:
200 sign-in attempts globally, 10 per normalized account, 100 registrations
globally, 3 per registration email, and 10 onboarding attempts per authenticated
user. Keys are HMAC digests; no raw emails or IPs are persisted. Expired windows
reset on their next use. Database failures stop the mutation.

Forms support password managers/paste, linked field errors and a focused error
summary, preserved input on validation failure, theme changes without resetting
input, and keyboard use. Sign-out is a same-origin POST action that revokes the
database session, clears its cookie, and redirects home. No GET request signs out.

The browser suite starts its own production server on port 3196 with an ephemeral
signing secret, leaving other development instances' session/throttle namespace
alone. It uses synthetic test identities and removes only its own fixture rows.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium executable.
Database tests include concurrent registration/onboarding and transactional
rollback. Full workspace UI, account settings, OAuth, and recovery workflows are
future increments.
