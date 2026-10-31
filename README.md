# Lemekinaye Platform

Lemekinaye is an automotive marketplace platform developed from the Lemekinaye Master Developer System Specification and Master Attribute Library.

## Planned applications

- `apps/api` - NestJS backend API
- `apps/web` - Customer and public marketplace
- `apps/admin` - Administration portal
- `apps/seller` - Seller Portal for Article submissions and Seller operations

## Shared packages

- `packages/database` - Database schema and migrations
- `packages/shared` - Shared types, validation and utilities

## Other directories

- `docs` - Technical and development documentation
- `infrastructure` - Docker and deployment configuration

## Development status

Phase 1 foundations now include database migrations, deny-by-default IAM/RBAC,
secure catalog and vehicle administration, privileged Admin provisioning with
mandatory MFA, and the first secure Admin Portal interface.

## Database development

The API requires Node.js 24 and PostgreSQL 16. Copy `.env.example` to `.env`, use
the same local-only database password in `POSTGRES_PASSWORD` and `DATABASE_URL`,
and generate the Admin MFA encryption key with `openssl rand -base64 32`. Then
start the database and apply its migrations. With native PostgreSQL (no Docker),
use port `5432` in both `POSTGRES_PORT` and `DATABASE_URL`, and ensure the
`lemekinaye` database and login role already exist. After saving your local values:

```sh
cp .env packages/database/.env
cp .env apps/api/.env
npm install
npm run db:validate
npm run db:generate
npm run db:migrate
npm run start:dev -w api
```

Docker remains optional. Its Compose database uses the example port `55432`:

```sh
docker compose --env-file .env -f infrastructure/compose.yaml up -d postgres
```

`DATABASE_URL` is required and must be a PostgreSQL URL. `PORT` defaults to `3000`
and `NODE_ENV` defaults to `development`; invalid configuration stops the API before
it starts. Never commit `.env` or production credentials.

The API exposes liveness at `GET /api/v1/health/live` and database-backed readiness
at `GET /api/v1/health/ready`. The existing `GET /api/v1/health` route remains for
backward compatibility. Readiness returns HTTP 503 when PostgreSQL cannot be queried.

The Prisma schema and version-controlled migrations live in `packages/database`.
Use `npm run db:migrate` in deployed environments and `npm run migrate:dev -w
@lemekinaye/database` only when authoring a new migration locally.

### Development Admin demo data

After migrations and after at least one Admin account has been provisioned, a
development-only seed can populate the current Admin master-data screens:

```sh
npm run admin:seed-demo
```

To choose the Admin account recorded as the audit actor:

```sh
npm run admin:seed-demo -- --actor-email admin@example.com
```

The seed is repeatable and uses `DEMO_` / `ATTR_DEMO_` canonical codes so it
does not collide with future production master data. It creates sample catalog
categories, Product Types, Attribute Definitions, STATIC allowed values,
Product-Type Attribute assignments and published schemas, plus Vehicle Makes,
Models, Generations, Trims, Engines, Transmissions, Body Types, Markets and
Vehicle Configurations. The key vehicle example is Toyota → Corolla → E140 →
GLI with both manual and automatic 2ZR-FE configurations.

The seed refuses to run when `NODE_ENV=production`. It does not create Admin
credentials or change authentication data.

## Identity and access foundation

Protected API routes deny access by default. `GET /api/v1/auth/me` resolves the
current active session, `POST /api/v1/auth/logout` revokes it, and
`GET /api/v1/admin/me` additionally requires the stable
`admin.portal.access` permission. Public routes are explicit and limited to the
root, health checks and active catalog/vehicle lookup contracts.

Sessions use opaque, cryptographically random bearer tokens. Only SHA-256 token
hashes are persisted, and revoked, expired, suspended or deactivated sessions are
rejected. Admin access tokens default to 30 minutes and the rotating Admin session
has an eight-hour absolute lifetime; other sessions default to 24 hours. Legacy
Admin sessions without an MFA verification marker are rejected.

## Privileged Admin authentication

The first platform Admin is created only through the offline operator command;
no public endpoint can create an identity or assign an Admin role:

```sh
npm run admin:provision -- --email admin@example.com --name "Platform Admin"
```

The command prints a high-entropy activation token once. Deliver that token through
a secure out-of-band channel. Activation sets a scrypt-hashed password, returns a
one-time TOTP enrollment seed, and changes the account from `PROVISIONED` to
`ACTIVE` only after the TOTP is verified. Authenticator seeds are protected with
AES-256-GCM at rest. TOTP values, passwords, activation tokens, challenges, access
tokens and refresh tokens are never persisted in plaintext.

An MFA-authenticated Admin with `admin.accounts.manage` may provision another
platform Admin at `POST /api/v1/admin/accounts/provision`. Login, MFA verification,
refresh and refresh-token logout are under `/api/v1/admin/auth`. Authentication
failures use generic responses, persistent source throttles, per-account attempt
limits and auditable security events.

## Catalog and vehicle administration baseline

Public clients can read active categories at `GET /api/v1/catalog/categories`
and active canonical vehicle data at `GET /api/v1/vehicles/makes` and
`GET /api/v1/vehicles/models?makeId={id}`.

Administrative category routes under `/api/v1/admin/catalog/categories` require
an active `ADMIN` session with `catalog.manage`. Vehicle make/model routes under
`/api/v1/admin/vehicles` require `vehicle.manage`. Create operations default to
`DRAFT`; PATCH requests require the current `version`, reject stale writes and
record before/after audit evidence. Records use lifecycle status changes instead
of physical deletion.

Interactive OpenAPI documentation is available at `GET /api/docs` while the API
is running. Requirement evidence and deferred scope are recorded in
`docs/traceability/IAM-001.md` and
`docs/traceability/IAM-002.md` and `docs/traceability/CAT-VEH-001.md`.

## Admin Portal

The Next.js Admin Portal runs on `http://localhost:3001`. It currently provides
one-time account activation, QR/manual authenticator enrollment, password plus TOTP login,
automatic access-token refresh, logout and the protected administration shell.
Start the API and Admin Portal in separate terminals:

```sh
npm run dev:api
npm run dev:admin
```

`ADMIN_API_BASE_URL` is server-only and defaults to
`http://127.0.0.1:3000/api/v1` during local development. For a different API,
copy `apps/admin/.env.example` to `apps/admin/.env.local` and edit that value.
Never prefix it with `NEXT_PUBLIC_`.

Production requires `ADMIN_API_BASE_URL` and `ADMIN_APP_ORIGIN`. The latter must
match the browser-facing HTTPS origin (for example `https://admin.example.com`),
including any non-default port. Terminate HTTPS at a trusted reverse proxy and
keep the API on a trusted private connection. Copy only the Admin example to
`apps/admin/.env.local`; it does not need database passwords or the MFA encryption key.

To activate the first administrator, run the existing `npm run admin:provision`
command above, open `/activate`, paste the one-time token, choose a password, and
scan the locally generated QR code in an authenticator app. After activation,
sign in at `/login`; if the app still shows the code used for activation, wait for
the next code before completing login. Password and authenticator recovery are
not yet available in this increment.

The portal uses a same-origin backend-for-frontend layer. Access and rotating
refresh tokens are held in `HttpOnly`, `SameSite=Strict` cookies and are never
placed in browser storage or returned to client JavaScript. Production cookies
also use `Secure` and `__Host-` names. See
`docs/traceability/ADM-UI-001.md` for requirement and test evidence.


## Seller Portal

The Seller Portal is a separate Next.js application from Admin. It runs on
`http://localhost:3002` and uses its own Seller session cookie and BFF boundary.
Admin continues to govern Seller accounts and catalog review; Sellers use this
application for their own operational workflows.

Start all three applications in separate terminals:

```sh
npm run dev:api
npm run dev:admin
npm run dev:seller
```

Local application boundaries:

- API: `http://localhost:3000`
- Admin: `http://localhost:3001`
- Seller: `http://localhost:3002`
- Seller sign in: `http://localhost:3002/login`
- Seller Article workspace: `http://localhost:3002/articles`

For a non-default API or production deployment, copy
`apps/seller/.env.example` to `apps/seller/.env.local`. Configure
`SELLER_API_BASE_URL` as a server-only API URL and `SELLER_APP_ORIGIN` as the
browser-facing HTTPS Seller origin. Do not expose Seller bearer tokens to client
JavaScript or browser storage.
