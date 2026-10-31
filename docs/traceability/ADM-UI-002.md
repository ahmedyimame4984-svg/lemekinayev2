# ADM-UI-002 — Admin account provisioning UI

## Scope

This increment adds the protected browser workflow for provisioning another
platform administrator through the existing IAM-002 backend contract. It is
limited to provisioning because the API currently exposes no Admin account
listing, suspension, role-editing or deletion contracts.

## Requirement mapping

| Requirement | Implementation evidence | Verification evidence |
| --- | --- | --- |
| Only authorized Admins may provision privileged accounts | `/admin/accounts` checks `admin.accounts.manage`; the API remains authoritative | Admin helper tests and existing IAM-002 allow/deny E2E coverage |
| Privileged mutations use protected documented APIs | Same-origin BFF route proxies only `POST /admin/accounts/provision` | BFF forwarding and cross-origin rejection tests |
| Provisioning is audited | UI reuses the IAM-002 `AdminAuthService.provisionAdmin` path | Existing IAM-002 service assertions |
| One-time activation credentials are handled carefully | Token is returned only after success, kept in component state, and never stored in URLs or browser storage | Code review plus production build/typecheck |
| Errors do not expose backend internals | Account-specific safe 403/409 mapping bounds browser-visible errors | BFF conflict-mapping test |
| MFA remains mandatory before privileged sign-in | Success state directs the new Admin through activation, password setup and MFA enrollment | Existing activation/login contract tests |

## Security decisions

- The browser sends only name and email to the same-origin BFF.
- The BFF requires the HttpOnly Admin access cookie and forwards the bearer token
  server-side to the existing protected API.
- Cross-site provisioning requests are rejected before the upstream API is called.
- The activation token is never written to local storage, session storage, cookies,
  URLs or logs by the Admin UI.
- The token disappears when the operator leaves the page or starts another
  provisioning flow.
- Backend role assignment, lifecycle rules and audit logging remain authoritative;
  the UI cannot request arbitrary roles or permissions.

## Automated verification

The repository GitHub Actions workflow runs:

```sh
npm run db:validate
npm run typecheck
npm test
npm run test:e2e
npm run lint
npm run build
git diff --check origin/main...HEAD
```

## Deferred scope

- Admin account listing and search
- Account suspension/deactivation controls
- Role and permission assignment UI
- Session-management UI
- Password recovery, MFA reset and privileged recovery procedures
