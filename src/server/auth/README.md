# Server authentication foundation

Import application helpers from `@/server/auth` in server code. No HTTP auth
endpoint, Server Action, registration/recovery workflow, OAuth flow, or UI is
exposed in Step 3A.

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
  requests to `/auth?returnTo=...`. The sign-in page will be implemented later.
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
```

`npm test` needs no database credentials or network access. The explicitly invoked
database suite uses the configured development/test database, verifies all six
seed passwords, creates isolated random test accounts, and removes them in cleanup.
It covers real database session lookup, suspension, role revocation, expiry,
revocation, privacy projections, and cascading account deletion. No seeded account
is suspended or deleted by the tests.
