# CivicSpec

Real needs. Real code. Real experience.

Step 1 provides a Next.js App Router shell, a Light / Dark / System theme selector,
server environment validation, a Prisma singleton, and module boundaries.

Use Node.js 22 or 24 LTS and npm. From the repository root:

```sh
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000. `GET /api/health` returns configuration liveness with
only `status` and `governanceMode`; it does not check database connectivity.

The example environment uses non-secret local placeholders. Server configuration
has matching local defaults, with AI disabled and integration secrets unset.
Never reuse placeholder database values for deployment. Auth and external
integrations require explicit credentials and validation when implemented.
`src/lib/env.ts` and `src/lib/prisma.ts` are guarded with `server-only`.

Prisma 6 is pinned to retain the supplied `prisma-client-js` generator and
schema-level datasource URL. The schema is preserved exactly. `DATABASE_URL` is
the pooled runtime connection; `DIRECT_URL` documents the unpooled connection for
future migration setup and is not wired into the existing schema. No database
or provider credentials are needed for this scaffold's checks. No database
migration, push, auth flow, GitHub API integration, or AI call is implemented.

```sh
npx prisma validate
npx prisma generate
npm run lint
npx tsc --noEmit
npm run build
```

`npm install` and `npm run build` also generate the Prisma client. Generation
does not connect to PostgreSQL. `npm run typecheck` is an alias for `tsc --noEmit`.
The install hook runs `next typegen` to generate the ignored `next-env.d.ts` and
route types, so typechecking also works before the first development run or build.

ESLint 9 is pinned because the lint plugins bundled with the current Next.js
configuration do not yet declare support for ESLint 10. npm reports ESLint 9's
upstream deprecation; the installed dependency tree satisfies its peer ranges.

Theme preference is stored under `civicspec-theme` in local storage. A static
head script applies it before first paint; CSS tracks OS changes in System mode.
The selector uses native radio semantics and keyboard navigation, preserves
focus, and still works for the current page if local storage is blocked. With
JavaScript disabled, the page follows the system theme. Typography uses the
existing Inter/system sans token without fetching remote fonts.

The engineering contract is currently supplied as lowercase `agents.md`.
Authoritative planning documents are in `docs/planning/`.
