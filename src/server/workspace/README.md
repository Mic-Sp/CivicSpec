# Shared authenticated workspace

`/app/layout.tsx` resolves authentication for every app route. The `(workspace)`
route group adds the role-aware shell and sends accounts without assigned roles
to `/app/onboarding`. Dashboard/account pages also resolve their own authenticated
state on each request, since shared layouts can survive client navigation. Place
future workspace pages in this protected route group and enforce authorization
again in every data query and mutation.

`preferences.ts` reads only basic authenticated identity plus the account's own
UserPreference.theme/activeRole. It never queries confidential eligibility,
referrals, organizations, discovery records, repositories, or project tables.
Dashboard cards describe upcoming capabilities without inventing live task counts.
Unavailable navigation entries are labelled Coming soon and have no links.

UserPreference.activeRole is a view preference. Reads fall back to an actually
assigned role when a preference is missing or stale. Writes lock and reread User
and current roles, rejecting suspension, unauthenticated access, and unassigned
role values. Only UserPreference is updated; existing RBAC/resource guards remain
authoritative for permissions. The role switcher updates navigation and dashboard
only after server confirmation. Changing role does not create UserRole records.

POST `/api/workspace/preferences` accepts exactly one of:

```json
{ "expectedUserId": "current-account-id", "theme": "light" }
```

```json
{ "expectedUserId": "current-account-id", "activeRole": "REVIEWER" }
```

Theme values are light/dark/system. expectedUserId must match the session actor;
it prevents delayed/cross-tab requests from writing after an account switch and
never determines authentication. Unknown fields are rejected. The endpoint
requires the configured APP_URL origin, JSON content type, a body of at most
1024 bytes, and a valid database session. Mutations are limited to 120 requests
per account per ten-minute window, using the existing shared HMAC-keyed throttle.
Responses include only theme, effective activeRole, and authorizedRoles; errors
are generic and responses use Cache-Control: no-store.

The root layout reads an authenticated account's theme before rendering HTML.
Its head script applies that theme before the body appears and synchronizes the
local theme key, overriding stale visitor settings. Visitors retain their local
Light/Dark/System preference. With blocked storage, signed-in users still get
their database theme from server-rendered HTML.

Theme changes apply locally immediately, then save through the preference
endpoint without navigation, route refresh, cookie changes, or form resets.
Writes are serialized so rapid changes persist in order. A failed final save
restores the last confirmed appearance and announces the failure. Account changes
cancel queued work; every mutation also checks its expected actor server-side.
System mode continues to follow the OS through the existing semantic CSS tokens.

The shell uses a 240px desktop sidebar at 1200px+, a native collapsible navigation
menu below that, and a single column on phones. All new controls have 44px targets,
visible token-based focus, and semantic Light/Dark colors. Account settings display
basic identity, assigned roles, theme controls, and session termination.

Verification:

```sh
npm test
npm run test:auth:db
npm run build
npm run test:auth:browser
```

The database suite checks role forgery/revocation, actor binding, suspension,
privacy DTOs, and theme/role updates preserving each other. Browser checks exercise
seeded single/multi-role users, roleless routing, saved themes before body insertion,
draft/focus/URL/session retention, failed-save recovery, desktop/mobile layouts,
Light/Dark axe scans, and authenticated public entry. Browser fixtures restore the
seed accounts' original preferences and clean up their own temporary records.
