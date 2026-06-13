# HIVE — Security Notes

## Accepted Risks (reviewed 2026-06-12 pre-launch audit)

### xlsx (SheetJS) 0.18.5 — CVE-2023-30533, CVE-2024-22363
The npm `xlsx` package has known advisories (prototype pollution, ReDoS).
**Both CVEs only affect PARSING untrusted spreadsheet input.** HIVE only
WRITES spreadsheets from trusted application data (Excel exports) and never
opens or parses user-uploaded spreadsheet files, so these CVEs do not apply.
Re-evaluate if spreadsheet *import* is ever added — at that point switch to
the patched SheetJS CDN build (https://cdn.sheetjs.com) or another library.

### In-memory rate limiter (src/lib/rateLimit.ts)
The rate limiter is in-process: it resets on server restart and does not
share state across instances. This is by design for HIVE's single-instance
SQLite LAN deployment. If the app ever moves to multi-instance/cloud
hosting, replace it with a Redis-backed limiter (e.g. @upstash/ratelimit)
and set TRUST_PROXY=true behind the reverse proxy.

## Hard Rules

- The public check-in endpoints (`/api/checkin`, `/api/checkin/qr`) must
  only return students through `safeStudentResponse()` in
  `src/lib/safeStudent.ts`. Never return a raw Student row — the model
  contains `password` (bcrypt hash), `qrToken`, `rfidUuid`, and PII.
- The Prisma client globally omits `Student.password` (see
  `src/lib/prisma.ts`). Only customer login/register/password-change may
  re-include it (via `omit: { password: false }` or an explicit `select`),
  and the hash must never be placed in a Response. Staff endpoints send a
  computed `hasPassword` boolean instead.
- `.env` must never be committed. `JWT_SECRET` is required in production.
- `ALLOW_HTTP=true` disables the cookie `secure` flag — only use it for
  HTTP LAN deployments, never on an internet-facing HTTPS deployment.
