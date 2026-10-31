# ADM-UI-001 — Secure Admin Portal entry and shell

## Scope

This increment establishes the first browser surface for privileged Lemekinaye
administrators. It implements account activation, MFA enrollment, password plus
TOTP login, session renewal, logout and a protected responsive Admin shell. It
does not add catalog or vehicle CRUD screens; those remain the next isolated
milestone.

## Requirement mapping

| Source requirement                                                 | Implementation evidence                                                                        | Verification evidence                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The Admin Portal is the administrative application surface         | `apps/admin/app/admin`, `apps/admin/components/admin-shell.tsx`                                | Next production build route report includes `/admin`                    |
| Privileged identities require strong authentication and MFA        | `activation-form.tsx`, `login-form.tsx`, Admin auth BFF routes                                 | Activation/login validation tests; existing API IAM-002 tests           |
| Authorization is checked for every privileged operation            | `app/api/auth/session/route.ts` resolves `GET /admin/me` before rendering the shell            | Protected-session path compiles and the API guard remains authoritative |
| Credentials and secrets must not be embedded in client code        | Server-only `ADMIN_API_BASE_URL`; `lib/server/*`; no `NEXT_PUBLIC_` secrets                    | Typecheck, build and repository secret review                           |
| Unauthorized users must be prevented from reaching Admin functions | `proxy.ts` cookie-presence gate plus `AdminSessionGuard` API revalidation                      | Return-path and request-security tests                                  |
| Errors must not expose sensitive internals                         | `lib/server/safe-response.ts` maps upstream failures to bounded messages                       | Client API and BFF security tests                                       |
| Critical authentication activity is auditable                      | Portal calls the IAM-002 API flows, which persist security audit events                        | IAM-002 service and E2E coverage                                        |
| Admin UI must use secure documented APIs                           | Same-origin route handlers proxy only the documented `/admin/auth/*` and `/admin/me` contracts | Production build and API contract inspection                            |

## Security decisions

- The browser talks only to same-origin `/api/auth/*` handlers. The NestJS API
  address remains server-only, so the API does not need broad browser CORS.
- Access and refresh tokens are stored in `HttpOnly`, `SameSite=Strict`, path-root
  cookies. Production adds `Secure` and the `__Host-` prefix.
- Login and activation challenge tokens live only in component memory. They are
  not stored in local storage, session storage, URLs or readable cookies.
- Activation setup keys are cleared after successful verification and responses
  carry `Cache-Control: no-store`.
- POST handlers require matching origin evidence and reject cross-site Fetch
  Metadata requests. JSON request bodies are bounded while streaming.
- Session renewal uses POST, not a state-changing GET. Browser Web Locks serialize
  renewal, MFA completion and logout across tabs; a same-tab queue is the fallback
  for browsers without Web Locks. Use a current browser over HTTPS for cross-tab
  protection.
- Visible sessions are rechecked every minute and on window focus. A revoked or
  expired session returns to sign-in. Transient API outages retain cookies for retry.
- Authenticator QR codes are generated inside the BFF. No enrollment secret is
  transmitted to an external QR service. Expired challenges clear the enrollment
  state and return the user to the first step.
- The session endpoint first checks the short-lived access token, rotates the
  refresh token after expiry and clears both cookies when the API rejects the
  session.
- The UI displays generic authentication errors and never forwards API exception
  bodies or stack details.
- Security headers include a per-request nonce CSP, frame denial, MIME sniffing denial,
  referrer suppression and a constrained permissions policy.

## Brand and accessibility evidence

- The palette follows the public Lemekinaye identity: `#A71920` primary red,
  `#D71920` accent red, `#15171B` ink, `#121417` dark, `#656B74` muted,
  `#F6F7F8` soft and white surfaces.
- Forms use persistent labels, described validation errors, correct autocomplete
  tokens, numeric MFA input, visible keyboard focus and live error/status regions.
- The protected shell includes a skip link and responsive navigation. Motion is
  reduced when the operating system requests it.

## Automated verification

Run from the repository root:

```sh
npm run test -w admin
npm run typecheck -w admin
npm run lint -w admin
npm run build -w admin
```

The Admin test suite covers validation boundaries, MFA normalization, same-origin
enforcement, bounded JSON streaming, safe redirects, login and enrollment
contracts, token non-disclosure, production cookie flags, automatic renewal,
revoked sessions, unavailable APIs, logout retry, CSP and browser request serialization.

Validation completed on 2026-09-24:

- 64 API unit tests, 65 Admin tests and 20 API E2E tests passed (149 total).
- Repository typecheck, lint and both production builds passed.
- `npm audit --omit=dev` reported zero vulnerabilities.
- HTTP smoke checks against the production Admin server confirmed login and
  activation render successfully, all framework scripts carry the response CSP
  nonce, anonymous `/admin` requests redirect to sign-in, missing sessions return
  401 and cross-origin session requests return 403.
- The browser environment blocked local preview access with
  `ERR_BLOCKED_BY_CLIENT`; visual/mobile acceptance and a complete browser login
  against a real PostgreSQL-backed API remain manual checks. Tests used dummy
  environment values and mocked database/upstream boundaries, not production data.

## Deployment notes

- Set `ADMIN_API_BASE_URL` and `ADMIN_APP_ORIGIN` server-side in production.
  The public origin must use HTTPS and match the browser URL.
- Keep the API behind a trusted private connection. API source-IP throttles
  currently see the BFF source address, so quotas are shared by users of that BFF.
  Trusted forwarding and per-client source audit configuration remain a deployment
  task; do not blindly enable trust for arbitrary forwarded-IP headers.
- The API remains the authorization boundary. Cookie presence in Proxy is only
  an early redirect; `/admin/me` is checked before displaying the workspace.

## Follow-up delivery

- Category and subcategory management was delivered after this foundation.
- Product Type administration was added while preserving Category → Subcategory → Product Type.
- Vehicle make and model management was delivered using the existing `vehicle.manage` API.
- Admin account provisioning UI is tracked in `ADM-UI-002.md`.

## Deferred scope

- Password recovery and authenticator recovery
- Production reverse-proxy source-IP trust configuration
- Full browser E2E automation against a seeded PostgreSQL test database
