# HIVE — Complete Project Documentation

> Master reference for understanding, maintaining, and deploying HIVE.
> Last updated: 2026-06-12 (post audit cycle 14). Companion docs:
> [SECURITY.md](SECURITY.md) · [PRINTER_SETUP.md](PRINTER_SETUP.md)

---

## 1. Project Overview

**HIVE** is a management system for a study-house / coworking space with an
attached café, built for a single physical location in Amman, Jordan. It handles:

- Member (student/customer) registration, profiles, and photos
- Subscriptions (Daily/Weekly/Monthly + custom DB-defined plans) with a 24-hour
  entry-window model
- Check-in/check-out via RFID card, QR code, kiosk search, staff dashboard, or
  customer self-check-in
- A café POS for walk-in sales plus an online ordering flow for logged-in customers
- Cash register sessions, expenses, promo codes, refunds/voids
- Receipt printing (80mm thermal) and JSON receipt archiving
- Statistics, daily reports, and six Excel exports
- Customer feedback (item star ratings)
- A public occupancy display board and a self-service check-in kiosk

**Target deployment:** one on-premises server (Windows PC) on the venue LAN.
Staff tills, the kiosk tablet, and customers' phones access it over HTTP on the
local network (`ALLOW_HTTP=true`), or over HTTPS behind a reverse proxy.

**Tech stack:**

| Layer | Technology |
|---|---|
| Framework | Next.js **16.2.6** (App Router, Turbopack) |
| UI | React **19.2.4**, Tailwind CSS, framer-motion 12, lucide-react icons, recharts |
| Database | SQLite (WAL mode) via Prisma **7.8** + `@prisma/adapter-better-sqlite3` |
| Auth | `jose` (JWT HS256) + httpOnly cookies, bcryptjs (cost 12) |
| Exports | SheetJS `xlsx` 0.18.5 (dynamically imported, write-only) |
| QR | `html5-qrcode` (camera scan), `qrcode` (generation) |
| State | zustand (small global store), React state elsewhere |
| i18n | Custom context in `src/lib/i18n.tsx` — English + Arabic (RTL) |

---

## 2. Architecture

### App Router structure

```
src/app/
├── (app)/        Staff-facing pages (sidebar layout, staff auth)
│   ├── page.tsx          Dashboard (check-in feed, search, stats)
│   ├── admin/            Admin panel (settings, staff, plans, backups, registers)
│   ├── barista/          Café POS
│   ├── directory/        Member directory + profile view
│   ├── orders/           Customer order queue (staff side)
│   ├── stats/            Statistics & reports
│   ├── logs/             Attendance log history
│   └── feedback/         Feedback management
├── (auth)/       Login pages (no app chrome)
│   ├── login/            Staff login
│   └── customer-login/   Customer login + self-registration
├── customer/     Customer portal (own layout + bottom nav, customer auth)
│   ├── page.tsx          Customer home (QR code, subscription status)
│   ├── menu/             Browse menu + cart + place order
│   ├── orders/           Live order tracking (polling)
│   ├── profile/          Profile + password change
│   └── history/          Check-in + subscription history
├── (kiosk)/      Unauthenticated kiosk screens
│   ├── checkin/          Self check-in kiosk (RFID / search / QR camera)
│   └── display/          Public occupancy display board
├── (print)/      Receipt pages (80mm print CSS, auto-print)
│   ├── barista/receipt/[id]
│   ├── customer-order/receipt/[id]
│   └── subscription/receipt/[id]
└── api/          ~70 route handlers (see §14)
```

### Dual auth system
Two fully isolated sessions (see §4): **staff** (`session` cookie → `User` table)
and **customer** (`customer-session` cookie → `Student` table). Middleware routes
each request type against only its own cookie — no fallback, no session bleed.

### Database
Single SQLite file (`dev.db` in the project root) accessed through Prisma with the
better-sqlite3 driver adapter. WAL journal mode and a 5s busy timeout are enforced
at client creation (`src/lib/prisma.ts`). The Prisma client globally **omits
`Student.password`** from all query results.

### Real-time behavior (polling, no websockets)
| What | Where | Interval |
|---|---|---|
| Pending-order count + new-order beep | `IconSidebar` (every staff page) | 15s |
| Staff order queue | `(app)/orders` | 5s |
| Customer order status + ready chime | `OrderNotificationProvider` (every customer page) | 15s |
| Customer orders page | `customer/orders` | 10s |
| Dashboard check-in feed | `TodayFeedTable` | 30s |
| Waitlist panel | `WaitlistPanel` | 30s |
| Clocks (display board, top nav) | UI only | 1s |

Background jobs run in `src/instrumentation.ts` (Node runtime): startup
auto-checkout + startup backup, then a 60s interval that auto-checks-out expired
24h sessions and runs scheduled backups (frequency/retention from AppSettings).

---

## 3. Database Schema

All models live in `prisma/schema.prisma`. Money fields are `Float` (SQLite has no
Decimal); the app rounds to 2 decimals at every write (`Math.round(x*100)/100`).

### User — staff accounts
| Field | Type | Notes |
|---|---|---|
| id | Int PK | |
| email | String @unique | login identifier |
| password | String | bcrypt hash (cost 12) |
| name, phone | String | display/contact |
| role | String | `ADMIN` \| `MANAGER` \| `STAFF` \| `BARISTA` |
| permissions | String JSON | page allowlist for MANAGER (e.g. `["/stats","/logs"]`) |
| isActive | Boolean | deactivated users are blocked at the auth guard |
| createdById / createdBy | self-relation | which admin created this account |

Relations: auditLogs, cashRegisters, expenses, processedLogs, createdSubscriptions.
**Rules:** admins can't delete/deactivate/demote themselves; ADMIN accounts can't be
deleted; MANAGER permission edits filtered against a page allowlist.

### StaffAuditLog — audit trail
userId (SetNull), email, role, event (`LOGIN`, `LOGOUT`, `LOGIN_BLOCKED`,
`CHECKIN`, `AUTO_CHECKOUT`, `BULK_CHECKOUT`, `ROLE_CHANGED`, `STAFF_DELETED`,
`PASSWORD_RESET`, …), ip, details, createdAt. Preserved when the user is deleted.

### Student — members/customers
Identity: studentNumber (sequential, unique), fullName, phone (@unique — customer
login identifier), email, major, university, gender, dateOfBirth,
emergencyContact/Phone, referralSource, photoUrl. Access: rfidUuid (@unique),
qrToken (@unique, 32-hex check-in credential). Status: `ACTIVE` / `SUSPENDED` /
`BANNED` / `GRADUATED` (suspended/banned are blocked from check-in and login).
Customer auth: password (bcrypt, null = no login set up), isLoginEnabled,
lastLoginAt. Counter: lifetimeCheckIns.
**Security rule:** `password` is globally omitted by the Prisma client; check-in
endpoints expose students only through `safeStudentResponse()` (§4).

### Subscription
planType, startDate, expiryDate (always set to 23:59:59.999 local),
totalVisitsAllowed (**-1 = unlimited**), visitsUsed, isActive, isFrozen / frozenAt /
freezeDays (cumulative, capped by `maxFreezeDays` setting), **windowStart**
(start of the current 24h check-in window — the core of the entry model, §7),
createdBy (staff), planId (optional link to a DB-defined SubscriptionPlan),
denormalized studentName. Indexes: `[studentId, isActive]`, `[expiryDate]`,
`[windowStart]`.

### Log — check-in/out records
studentId (SetNull) + denormalized studentName, checkInTime, checkOutTime (null =
currently inside), date (`YYYY-MM-DD` local string), method (`RFID` / `QR` /
`MANUAL` / `SEARCH` / `SELF` / `AUTO_CHECKOUT`), processedBy (staff id, null for
kiosk). Indexes: `[date]`, `[studentId, date]`.

### Transaction — subscription payments
amountPaid, planType, gateway (`Cash`, `CliQ`, `eFAWATEERcom`, `Credit Card`,
`Card`), discountAmount, receiptNumber (`RCP-#####`, shared sequence with café
orders), type (`SALE` / `REFUND` / `VOID`), voidedAt/By/Reason, refundOf,
subscriptionId FK (void deactivates the linked subscription FK-first). Index:
`[createdAt]`.

### Café models
- **MenuCategory** — name/nameAr, sortOrder, isActive.
- **MenuItem** — name/nameAr, price, costPrice, imageUrl, isOutOfStock,
  isDeleted (soft-delete preserves order history), isCustom (ad-hoc POS items),
  categoryId.
- **MenuItemOption** (+ **MenuItemOptionValue**) — option groups per item
  (e.g. Size); type `ADD_TO_PRICE` or `SET_PRICE`; required flag; values carry
  label/labelAr, price, costPrice, isDefault.
- **BaristaOrder** — one row per line item. menuItemId, studentId (customer
  orders), registerId, quantity, totalPrice (base), finalPrice (after options),
  selectedOptions (JSON snapshot), paymentMethod (`CASH`/`CARD`/`OTHER`),
  receiptNumber, **status** (`PENDING → ACCEPTED → PREPARING → READY → COMPLETED`,
  or `CANCELLED`; walk-in staff sales are created `COMPLETED`), customerNote,
  orderedBy (`STAFF`/`CUSTOMER`), **orderGroupId** (UUID grouping one cart).
  Indexes: createdAt, orderGroupId, status.

### Finance / ops models
- **CafeExpense** — description, amount, date, category, addedBy(+Name).
- **CashRegister** — per-shift till session: openingCash, cashSales, cardSales
  (auto-incremented when orders complete), expectedCash, closingCash,
  cashDiscrepancy, status `OPEN`/`CLOSED`, link to StaffShift.
- **PromoCode / PromoUsage** — code, discountType/Amount, bonusEntries, maxUses,
  timesUsed, expiresAt; usage rows record who used it and the discount given.
- **StudentNote** — staff notes on a member (author denormalized).
- **StaffShift** — auto clock-in on login, clock-out on logout; date string.
- **AppSetting** — key/value store for all runtime settings (kioskEnabled,
  displayEnabled, feedbackEnabled, maxCapacity, maxFreezeDays, nextReceiptNumber,
  receiptSavePath, backupFrequencyHours, backupRetentionDays, businessName,
  receiptFooter, displayConnection, …). Writes are restricted to an allowlist.
- **WaitlistEntry** — per-day queue when the venue is at capacity.
- **BackupLog** — timestamp, fileName, fileSize, success, error, trigger
  (`MANUAL`/`SCHEDULED`/`STARTUP`).
- **ItemFeedback** — rating 1–5 + comment per (baristaOrder, menuItem, student);
  indexes on menuItemId, studentId.
- **SubscriptionPlan** — admin-defined plans: name/nameAr, durationDays,
  totalVisits (**-1 = unlimited, passes through unchanged**), price, isActive.

---

## 4. Authentication & Security

### Staff auth flow
1. `POST /api/auth/login` — per-IP (30/15min) and per-email (5/15min) rate limits,
   email format + password length validation, **timing-safe** lookup (a dummy
   bcrypt compare runs even when the user doesn't exist), isActive check,
   audit-log write, auto clock-in (StaffShift).
2. On success a JWT (HS256, 8h) is signed with `{ userId, email, role, permissions }`
   and set as the **`session`** httpOnly cookie.
3. `middleware.ts` (Edge) verifies the JWT on every request, enforces
   role-based **page** access and a second layer of **API family** role checks.
4. Route handlers call `requireAuth(...roles)` (`src/lib/authGuard.ts`), which
   re-verifies the JWT **and re-reads role + isActive from the DB** — the JWT role
   claim is never trusted alone. DB errors return **503** (not 401) so transient
   SQLite locks never log users out.
5. `POST /api/auth/refresh-session` re-signs the JWT with fresh permissions so
   MANAGER permission changes apply without re-login.

### Customer auth flow
Same shape with the **`customer-session`** cookie (7 days), phone + password login
(`POST /api/auth/customer/login`), `requireCustomerAuth()` checking the Student
row (isLoginEnabled, not BANNED/SUSPENDED). Customers can self-register; if staff
already created their profile (same phone), registration links to it instead of
duplicating. Tokens carry `{ type: 'customer', studentId }` and are rejected by
staff guards (and vice versa).

### Roles
| Role | Pages | Notes |
|---|---|---|
| ADMIN | everything | only role that manages staff, plans, settings, backups, voids/deletes |
| MANAGER | configurable per-page allowlist (`permissions` JSON) | granted pages imply the matching API families |
| STAFF | Dashboard, Directory, Barista, Orders | sells subscriptions, checks in/out, runs POS |
| BARISTA | Dashboard, Barista, Orders | café only |

Middleware page sets ≡ sidebar filtering ≡ API role gates (verified in audits).

### Cookies (`src/lib/cookieConfig.ts` — single source of truth)
`httpOnly`, `sameSite: lax`, `path: /`; `secure` is true in production **unless**
`ALLOW_HTTP=true` (LAN deployments over plain HTTP — otherwise browsers silently
drop the cookie). Staff 8h, customer 7d. Same options used for set **and** clear.

### Rate limiting (`src/lib/rateLimit.ts`)
In-memory, bounded store (10k keys, two-stage eviction). Tiers:
- Public endpoints: per-IP (check-in 30/min, kiosk search 15/min, display 30/min,
  settings-public 60/min, seed 3/hour, logins 30/15min per IP + 5/15min per
  email/phone).
- Staff: `checkStaffRateLimit(userId, 'read'|'write')` → 120/min read, 60/min write.
- Customer: per-customer (orders 20/hr, self-checkin 10/hr, feedback 30/hr,
  cancellations 20/hr, profile/password limits).
`getClientIp` only trusts `X-Forwarded-For`/`x-real-ip` when `TRUST_PROXY=true`.

### Input sanitization (`src/lib/sanitize.ts`)
`sanitizeString` (strips HTML/dangerous chars, 500 cap), `sanitizePhone`,
`isValidEmail`, `isValidId`, `sanitizeRfid`, `isValidDateString`,
`isStrongPassword`. Applied on all write endpoints; order prices are **always**
recomputed server-side; uploads validate MIME + size + **magic bytes**.

### Data-exposure prevention
- **Global Prisma omit**: `Student.password` never leaves the DB layer unless a
  route explicitly re-includes it (only customer login/register/password-change).
- **`safeStudentResponse()`** (`src/lib/safeStudent.ts`): the only way student
  objects appear in the public check-in responses — id, fullName, studentNumber,
  photoUrl, status, lifetimeCheckIns + stripped subscription summary.
- Staff endpoints use explicit `select`s; the profile detail endpoint returns a
  computed `hasPassword` boolean instead of the hash; `qrToken`/`rfidUuid` appear
  only where staff genuinely manage them (profile detail, creation response).
- Public display shows initials only; kiosk search returns 5 display fields.

### CSP & headers (`src/middleware.ts`)
`default-src 'self'`, script-src without `unsafe-eval` in prod, `object-src 'none'`,
`frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`,
X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
`upgrade-insecure-requests` is added **only when the request is already HTTPS**
(adding it on HTTP LAN broke asset loading on phones).

### Audit logging
`auditLog()` (structured console) + `StaffAuditLog` DB rows for logins/logouts,
blocked attempts, check-ins, auto-checkouts, role changes, staff deletion,
password resets, and more. Logs survive user deletion (SetNull).

---

## 5. Features — Staff Side

### 5.1 Dashboard & Check-In (`(app)/page.tsx`)
Live feed of today's check-ins (`TodayFeedTable`, 30s poll) with duration and
24h-window countdown; student search (`SearchBar`) with instant check-in;
occupancy stats (`DashboardStats`); expiring-subscription banner; waitlist panel;
"Check Out All" bulk action; window-expiry and subscription-ended notifications;
Add Student modal. Check-in results show in a full-screen overlay (`CheckInOverlay`).
APIs: `/api/logs/today`, `/api/students/search`, `/api/checkin`, `/api/checkout`,
`/api/checkout/auto`, `/api/dashboard/stats`, `/api/waitlist`.

### 5.2 Directory (`(app)/directory`)
Paginated/searchable member list (name/phone/student number), sort + subscription
filters, Excel export, profile view (`ProfileView`): photo upload, contact/PII,
notes, RFID card linking, QR code display, customer-login management (enable
toggle, set/reset password — shows `hasPassword` indicator), subscription history,
transactions, renew/freeze. APIs: `/api/students*`, `/api/subscriptions*`,
`/api/auth/customer/reset-password`.

### 5.3 Subscription Management (`RenewModal`, plans in admin)
Sell/renew flow: pick plan (built-in defaults or DB plans), gateway, amount (server
clamps/rounds, discount computed vs plan price), optional promo code, custom start
date. Renewal atomically deactivates old subs and clears their window. Freeze /
unfreeze with cumulative cap. Receipt printed via `ReceiptModal`.

### 5.4 Barista POS (`(app)/barista`)
Menu grid by category, item options (size/extras, ADD/SET price), cart, custom
ad-hoc items, payment method, promo validation, cash-register bar (open/close till,
live cash/card totals), expenses entry, walk-in receipt printing. Orders created
as COMPLETED with shared `RCP-#####` numbers. APIs: `/api/barista/*`, `/api/menu*`,
`/api/cash-register*`, `/api/expenses*`, `/api/promo/validate`.

### 5.5 Customer Order Queue (`(app)/orders`)
Live queue (5s poll) of customer-placed orders grouped by cart, status transitions
(accept → preparing → ready → complete-with-payment, or cancel), auto-opens the
receipt window on completion, manual print button on completed orders.
API: `/api/orders/queue*`.

### 5.6 Statistics & Reports (`(app)/stats`)
Revenue chart, daily/monthly summaries, transactions list with void/refund,
check-in stats, expenses, daily report export (5-sheet Excel) and general export.
APIs: `/api/stats/*`, `/api/reports/*`, `/api/transactions/*`.

### 5.7 Attendance Logs (`(app)/logs`)
Historical log browser with date range, per-day view, edit/delete entries (ADMIN),
bulk delete, cleanup, Excel export with duration/method/staff/plan columns.
APIs: `/api/logs/*`.

### 5.8 Admin Panel (`(app)/admin`)
Staff management (create/edit/deactivate/delete, role changes, MANAGER page
permissions, attendance/login history), subscription plans CRUD, app settings
(business name, receipt footer, receipt save path + test, capacity, freeze cap,
kiosk/display/feedback toggles), backups (manual trigger, history, schedule
settings), cash register history (`RegistersSection`) with export, promo codes.
APIs: `/api/auth/users*`, `/api/plans*`, `/api/settings*`, `/api/backup*`,
`/api/promo*`, `/api/cash-register*`.

### 5.9 Feedback Management (`(app)/feedback`)
Per-item average ratings and review counts, drill-down to individual reviews,
visibility controlled by the `feedbackEnabled` setting, two-sheet Excel export.
APIs: `/api/feedback*`.

### 5.10 Cash Register
Opened per staff member (optionally tied to the shift), records opening cash;
completed CASH/CARD orders increment its totals inside the same transaction;
closing computes expected cash vs counted and stores the discrepancy.

## 6. Features — Customer Side

- **6.1 Registration & Login** (`(auth)/customer-login`) — phone + password;
  self-registration creates a Student (with QR token + student number) or links to
  an existing staff-created profile; per-phone and per-IP rate limits.
- **6.2 Home** (`customer/`) — personal QR code (their `qrToken`), active
  subscription status/visits, self-check-in button (if enabled).
- **6.3 Menu & Ordering** (`customer/menu`) — public menu API, options selection,
  cart, notes; order POST validates everything server-side and groups items under
  one `orderGroupId` + receipt number; 20 orders/hour cap.
- **6.4 Order Tracking** (`customer/orders`) — live status (10s poll), cancel
  while all items are still PENDING, star-rating prompt after completion.
  Global `OrderNotificationProvider` chimes + browser-notifies when an order
  turns READY from any customer page.
- **6.5 Profile & QR** (`customer/profile`) — edit contact info (sanitized),
  change password (verifies current), view QR.
- **6.6 History** (`customer/history`) — past check-ins with durations,
  subscription history.

---

## 7. Check-In System (Detailed)

The entry model is a **24-hour window**: one entry buys unlimited re-entry for
24 hours from first check-in.

```
Check-in request (RFID / QR / MANUAL / SEARCH / SELF)
        │
        ├─ Student not found ───────────────→ NOT_FOUND
        ├─ SUSPENDED / BANNED ──────────────→ blocked (403)
        ├─ No subscription row ─────────────→ EXPIRED "No active subscription"
        ├─ Frozen ──────────────────────────→ EXPIRED "Subscription is frozen"
        ├─ Inactive AND no live window ─────→ EXPIRED
        │
        ├─ PATH 1 — already inside (open log exists)
        │     → ALREADY_IN (no deduction, no new log)
        │
        ├─ PATH 2 — live 24h window (windowStart < 24h ago)
        │     → create log, NO entry deduction, windowReuse: true
        │
        └─ PATH 3 — no live window
              ├─ entries exhausted (visitsUsed ≥ allowed, ≠ -1) → EXPIRED
              ├─ venue at capacity → FULL (waitlist available)
              └─ else: create log + visitsUsed++ + windowStart = now
                       (unlimited -1 plans: set windowStart, no deduction)
```

Implementation notes:
- The subscription query also matches **deactivated subs with a live window** —
  a paid window outlives auto-expiry, so a member can re-enter until it ends.
- Log creation and deduction run inside a Prisma transaction with a duplicate
  open-log re-check (kiosk double-taps can't double-deduct).
- **Auto-checkout** (`autoCheckout.ts`): runs on every check-in, on startup, and
  every 60s — closes open logs whose window ended (checkOutTime = exact window
  end, method `AUTO_CHECKOUT`), clears `windowStart`; an orphan safety net closes
  any log older than 24h. `getExpiringCheckIns` powers the 23–24h dashboard warning.
- **Capacity** (`capacity.ts`): `maxCapacity` setting (0 = unlimited) vs count of
  open logs; full → waitlist.
- All responses pass students through `safeStudentResponse()` — the endpoints are
  public (kiosk) and never expose credentials or PII.

## 8. Subscription System (Detailed)

- Built-in defaults (`subscriptionLogic.ts`): Daily 3 JD / **-1 unlimited** / same
  day; Weekly 15 JD / 7 entries / 10 days; Monthly 50 JD / 30 entries / 40 days.
  DB plans (SubscriptionPlan) override price/duration/entries; `totalVisits: -1`
  passes through as -1.
- Expiry is always **23:59:59.999 local time** on the final day (TZ=Asia/Amman).
- Selling/renewing runs in one transaction: deactivate existing active subs +
  clear their windowStart → generate receipt number → create Subscription →
  create Transaction (FK-linked). If the member is currently inside, the response
  carries an `activeSessionWarning`.
- Freeze stores `frozenAt`; unfreeze extends expiry by the frozen days and adds to
  cumulative `freezeDays` (capped by `maxFreezeDays`).
- Auto-expire (`autoExpire.ts`) deactivates past-expiry subs on dashboard load and
  check-ins (windows still honored, see §7).

## 9. Order System (Detailed)

State machine (enforced server-side in `/api/orders/queue/[id]`):
`PENDING → ACCEPTED → PREPARING → READY → COMPLETED`, any pre-terminal state →
`CANCELLED`; COMPLETED/CANCELLED are terminal.

- **Customer placement** (`POST /api/customer/orders`): 1–20 items, qty 1–10 each,
  prices computed from the DB menu + option rules (`SET_PRICE` replaces,
  `ADD_TO_PRICE` adds), required options enforced, notes sanitized, one receipt
  number + orderGroupId per cart, status PENDING, default payment CASH (updated at
  completion). Client prices are never trusted.
- **Staff management**: transitions validated against the map; **COMPLETED requires
  a payment method** and atomically adds the total to the open cash register's
  cash/card sales.
- **Cancellation by customer**: only while every item in the group is PENDING.
- Walk-in POS sales skip the queue (created COMPLETED with payment).

## 10. Receipt Printing

Three print pages under `(print)/`, identical architecture:
fetch from a **staff-authenticated** receipt API → render 80mm layout
(`@page { size: 80mm auto; margin: 0 }`, Courier, monochrome) → `window.print()`
after 400ms (guarded against double-print) → `afterprint` → `window.close()`.
Screen-only "Print Again"/"Close" buttons are hidden by `@media print`.

| Type | Page | API | Trigger |
|---|---|---|---|
| Barista (walk-in) | `/barista/receipt/[id]` | `/api/barista/orders/[id]/receipt` | Print button in POS receipt modal |
| Customer order | `/customer-order/receipt/[orderGroupId]` | `/api/orders/[id]/receipt` — **COMPLETED only** | auto-opens on completion + manual 🖨 on completed orders |
| Subscription | `/subscription/receipt/[transactionId]` | `/api/transactions/[id]/receipt` | Print button in renewal receipt modal |

**File archiving** (`receiptWriter.ts`): if the ADMIN `receiptSavePath` setting is
set (absolute path only), every receipt is also written as JSON into monthly
subfolders with a sanitized filename and a path-traversal guard. Fire-and-forget —
never blocks or fails the sale. `/api/settings/test-receipt-path` verifies
writability from the admin UI.

Hardware setup, silent printing, and troubleshooting: see **PRINTER_SETUP.md**.
Cash-drawer kick is **not** implemented (needs raw ESC/POS over TCP 9100).

## 11. Notification System

- **Staff**: `IconSidebar` (rendered on every staff page) polls the pending-order
  count every 15s; when the count **increases**, it plays a triple 1kHz square-wave
  beep and shows a global banner. First load never beeps.
- **Customer**: `OrderNotificationProvider` (customer layout) polls orders every
  15s; when any order transitions to READY it plays a two-tone chime, shows a
  banner, and fires a browser Notification if the tab is hidden and permission
  was granted.
- **Audio**: `sounds.ts` keeps a single shared `AudioContext`, bootstrapped/resumed
  on the first user gesture (browser autoplay policy). No per-beep contexts.
- All polling intervals are cleaned up on unmount.

## 12. Excel Exports

All six use `await import('xlsx')` (never top-level) and `en-JO` locale formatting
(Amman local time). `-1` visits render as "Unlimited", nulls as "-".

| # | Export | Where | Sheets / key columns |
|---|---|---|---|
| E1 | General day export | Stats (`ExcelExport`) | Attendance Log (name, phone, in/out, duration, method, staff, plan) + Financial Summary (receipt, student, plan, gateway, paid, discount, totals, gateway breakdown) |
| E2 | Daily report | Stats (`DailyReportExport`) | Summary, Subscriptions (incl. start/expiry, visits, status, created-by), Check-Ins (incl. staff), Cafe Sales (incl. date, order type), Expenses (incl. time) |
| E3 | Logs export | Logs page (`ExportButton`) | history with duration, method, staff, subscription type |
| E4 | Directory export | Directory | members + start/expiry, visits, amount paid, payment method |
| E5 | Cash registers | Admin (`RegistersSection`) | register #, opened by, times, cash/card/total sales, expected vs closing, difference, status |
| E6 | Feedback | Feedback page | Item Summary (avg rating, review count) + All Reviews (item, rating, comment, customer, date, time) |

## 13. Kiosk Mode

- **Check-in kiosk** (`/checkin`, public): three tabs — RFID (HID keyboard-wedge
  scan via hidden input), Search (debounced name search returning only id/name/
  photo/active-plan via the gated public search API), QR (camera scan via
  html5-qrcode). 60s inactivity auto-reset. Hard-disabled everywhere when the
  `kioskEnabled` setting is off (page, search API, link in sidebar).
- **Display board** (`/display`, public): occupancy count + capacity, recent
  activity as **initials only**, clock; gated by `displayEnabled`.

## 14. API Reference

Legend — Auth: `A`=ADMIN, `M`=MANAGER (with page permission), `S`=STAFF,
`B`=BARISTA, `C`=customer, `pub`=public. RL: `r`=staff read 120/min,
`w`=staff write 60/min, `ip`=per-IP, `cust`=per-customer.

### Auth
| Method | Path | Auth | RL | Purpose |
|---|---|---|---|---|
| POST | /api/auth/login | pub | ip+email | staff login |
| POST | /api/auth/logout | session | — | clear cookies, audit, clock-out |
| GET | /api/auth/me | session | — | session introspection (?type=staff\|customer) |
| POST | /api/auth/refresh-session | session | — | re-sign JWT with fresh permissions |
| POST | /api/auth/register | A | w | create staff account |
| GET | /api/auth/seed | pub | ip | first-admin seed (ALLOW_SEED + no admin exists) |
| POST | /api/auth/reset-password | A | (audited) | reset staff password |
| GET | /api/auth/users | A,M | r | staff list (take 500) |
| GET/PUT/DELETE | /api/auth/users/[id] | A (GET: A,M) | w | staff detail/edit/delete |
| GET | /api/auth/audit-logs | A,M | r | audit trail |
| POST | /api/auth/customer/login | pub | ip+phone | customer login |
| POST | /api/auth/customer/register | pub | ip | customer self-registration |
| POST | /api/auth/customer/reset-password | A,M | w | staff resets a customer password |

### Check-in / Logs
| POST | /api/checkin | pub (kiosk) | ip 30/min | main check-in (RFID/manual) — safeStudent responses |
| POST | /api/checkin/qr | pub | ip 30/min | QR-token check-in |
| GET | /api/checkin/search | pub | ip 15/min + kioskEnabled | kiosk name search (minimal fields) |
| POST | /api/checkin/self | C | cust 10/hr | customer self-check-in |
| POST | /api/checkout | A,M,S | w | check out one log |
| POST | /api/checkout/auto | A,M | w | check out everyone |
| GET | /api/logs/today | A,M | r | live feed + notifications (take 2000) |
| GET | /api/logs/history | A,M | r | history (take 500) |
| PATCH/DELETE | /api/logs/[id] | A | w | edit/delete a log |
| POST | /api/logs/bulk-delete, /api/logs/cleanup | A | w | bulk maintenance |

### Students / Subscriptions
| GET/POST | /api/students | A,M,S | r/w | directory list (select, paginated) / create member |
| GET/PATCH/DELETE | /api/students/[id] | A,M,S (DELETE: A) | r/w | profile (qrToken/rfidUuid for staff tools, `hasPassword` bool) |
| GET/POST/DELETE | /api/students/[id]/notes | A,M,S (DELETE: A) | w | notes |
| GET | /api/students/[id]/orders | A,M,S | r | member's café orders |
| POST | /api/students/[id]/photo | A,M,S | w | photo upload (magic bytes) |
| GET | /api/students/search | A,M,S | r | dashboard search (select) |
| POST | /api/subscriptions | A,M,S | w | sell/renew (atomic) |
| PATCH/DELETE | /api/subscriptions/[id] | A,S (del: A) | w | edit |
| POST | /api/subscriptions/[id]/freeze | A,M,S | w | freeze/unfreeze |
| POST | /api/subscriptions/expire | A,M,S | w | manual expire sweep |
| GET | /api/rfid/[uuid] | pub/staff | ip 30/min | RFID lookup (minimal public, select for staff) |

### Café / Orders / Menu
| GET/POST | /api/barista/orders | A,M,S,B | r/w | POS orders |
| PATCH | /api/barista/orders/[id] | A,M,S,B | w | edit order |
| GET | /api/barista/orders/[id]/receipt | A,M,S,B | r | barista receipt data |
| GET | /api/barista/logs | A,M,S,B | r | sales history (bounded) |
| GET/PATCH | /api/orders/queue, /api/orders/queue/[id] | A,M,S,B | r/w | customer-order queue + transitions |
| GET | /api/orders/[id]/receipt | A,M,S,B | r | customer-order receipt (**COMPLETED only**) |
| CRUD | /api/menu, /api/menu/[id], options, values, categories | A,M,S (deletes: A/S) | r/w | menu management |
| GET | /api/menu/public | pub | — (read-only select) | customer menu |

### Customer portal
| GET/POST | /api/customer/orders | C | cust 20/hr (POST) | order list / place order |
| GET/PATCH | /api/customer/orders/[id] | C (IDOR-checked) | cust 20/hr (PATCH) | order detail / cancel |
| GET/PATCH | /api/customer/profile | C | cust | profile |
| PATCH | /api/customer/password | C | cust | change password |
| GET | /api/customer/subscription | C | — | subscription(s) |
| GET | /api/customer/history | C | — | check-in history (take 50) |
| POST | /api/customer/feedback | C | cust 30/hr | submit ratings |

### Finance / Stats / Admin
| GET/POST/PATCH | /api/cash-register(, /[id], /summary) | A,M,S | r/w | till sessions |
| GET/POST, PATCH/DELETE | /api/expenses(, /[id]) | A,M,S (del: A) | r/w | expenses (take 2000) |
| PATCH/DELETE | /api/transactions/[id] | A,M (del: A) | w | void/refund, delete |
| GET | /api/transactions/today, /[id]/receipt | A,M / A,S,M | r | day's transactions, receipt data |
| GET | /api/stats/daily, /summary; /api/reports, /daily | A,M | r | stats & reports |
| GET | /api/dashboard/stats | A,S,M | r | dashboard cards |
| CRUD | /api/plans(, /[id]) | A (list: A,M,S) | r/w | subscription plans |
| CRUD | /api/promo(, /[id]); POST /api/promo/validate | A (validate: A,S) | r/w | promo codes |
| GET/PUT | /api/settings | A,M,S (PUT: A) | r/w | settings (key allowlist) |
| GET | /api/settings/public | pub | ip 60/min | kiosk/display/feedback toggles |
| POST | /api/settings/test-receipt-path | A | w | verify receipt folder |
| GET/POST | /api/backup(, /status, /trigger) | A | ip 5/hr, r, w | download/create backups |
| GET/POST | /api/feedback(, /[menuItemId]) | A,M | r/w | feedback admin |
| GET/POST/PATCH | /api/waitlist | A,M,S | r/w | capacity waitlist |
| POST | /api/upload | A,M,S | ip 20/min | menu image upload |
| GET | /api/display | pub | ip 30/min + displayEnabled | display board data |

## 15. File Manifest

**src/lib/ (21):** auditLog (structured audit events) · auth (Edge-safe JWT
sign/verify) · authGuard (staff guard, live DB check, 503-on-DB-error) ·
autoCheckout (window expiry + bulk + expiring list) · autoExpire (deactivate past
expiry) · backupScheduler (DB file backups + prune) · capacity (occupancy vs
maxCapacity) · cookieConfig (cookie names/options, ALLOW_HTTP) · customerAuth
(customer guard) · customerContext (customer session React context) · i18n
(EN/AR dictionary + provider, ~2300 lines) · prisma (client, WAL, global password
omit) · rateLimit (in-memory limiter + IP helper) · receiptNumber (shared RCP
sequence in tx) · receiptWriter (JSON archiving, traversal-guarded) · safeStudent
(public-safe student projection) · sanitize (validators) · sounds (AudioContext
singleton, beep/chime) · store (zustand: overlay, modals) · subscriptionLogic
(plan defaults, expiry, todayString/toLocalDateString) · utils (generateId with
randomUUID fallback).

**src/hooks (4):** useAuth (staff session) · useAudio · useKeyboardShortcuts ·
useRFIDScanner (keyboard-wedge capture).

**src/app:** layout.tsx (fonts, viewport, metadata) · middleware.ts (auth routing +
security headers) · instrumentation.ts (startup + 60s background jobs) ·
9 staff pages under `(app)/` · 2 auth pages · 6 customer pages + layout ·
2 kiosk pages + layout · 3 print pages · ~70 API route files (see §14).

**src/components (36):** ui/ (Badge, Button, ConfirmModal, ErrorBoundary, Modal,
Toast) · layout/ (AppLayoutInner, IconSidebar with global order beep, TopNav) ·
dashboard/ (AddStudentModal, DashboardStats, ExpiryBanner, ReceiptModal, SearchBar,
TodayFeedTable, WaitlistPanel) · directory/ (ProfileView, RenewModal) · barista/
(CashRegisterBar) · admin/ (PlansSection, RegistersSection) · customer/
(OrderNotificationProvider) · stats/ (DailyReportExport, ExcelExport,
RevenueChart) · shared/ (ExportButton) · animations/ (7 motion helpers) ·
CheckInOverlay · GlobalProviders.

**prisma/:** schema.prisma (20 models) · seed.ts · migrations/ · hive.db, backups/.

## 16. Environment Variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **Yes (prod)** — app refuses to start without it | dev-only fallback | JWT signing key. Generate: `openssl rand -base64 32` |
| `DATABASE_URL` | yes | `file:./dev.db` | SQLite path (Prisma) — runtime client also opens `./dev.db` |
| `TZ` | **yes** | — | Must be the business timezone (`Asia/Amman`). All date math is local-time based |
| `ALLOW_HTTP` | no | false | `true` disables the cookie `secure` flag for HTTP-LAN deployments. Never set on HTTPS |
| `TRUST_PROXY` | no | false | `true` only behind a reverse proxy — enables X-Forwarded-For for rate limiting |
| `ALLOW_SEED` | no | false | `true` enables `/api/auth/seed` (first-run only; disable after) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | for seeding | — | initial admin credentials |
| `BACKUP_DIR` | no | `./backups` | backup destination |
| `DEV_ORIGINS` | no | — | comma-separated LAN hostnames for dev HMR |
| `NODE_ENV` | auto | — | set by Next.js |

## 17. Deployment Guide

**Prerequisites:** Node.js 20+, npm. (better-sqlite3 ships prebuilt binaries;
a build toolchain is only needed if the prebuild is missing.)

```bash
git clone <repo> hive && cd hive
npm install
cp .env.example .env        # then edit:
#   JWT_SECRET=<openssl rand -base64 32>
#   TZ=Asia/Amman
#   ALLOW_SEED=true  SEED_ADMIN_EMAIL=...  SEED_ADMIN_PASSWORD=...
#   ALLOW_HTTP=true            # only for HTTP LAN deployments
npx prisma migrate deploy    # or: npx prisma db push (first run)
npm run build
npm start                    # serves on :3000
# First run: visit http://<server>:3000/api/auth/seed  → admin created
# Then set ALLOW_SEED=false and restart
```

**Production checklist**
- [ ] Strong `JWT_SECRET` set; `.env` not committed (gitignored ✔)
- [ ] `TZ=Asia/Amman` set (dates break between midnight–3am without it)
- [ ] `ALLOW_SEED=false` after the first admin exists
- [ ] HTTPS deployments: `ALLOW_HTTP` unset/false; `TRUST_PROXY=true` behind nginx/Cloudflare
- [ ] HTTP-LAN deployments: `ALLOW_HTTP=true`; understand traffic is unencrypted on your LAN
- [ ] Backup schedule verified (Admin → Backups); `BACKUP_DIR` ideally on another disk
- [ ] Receipt printer configured (PRINTER_SETUP.md); receipt save path set + tested
- [ ] Kiosk/display toggles set as desired; `maxCapacity` configured
- [ ] Single instance only (in-memory rate limiter — see §19)

**LAN development:** `npm run dev`, add your phone/tablet IPs to `DEV_ORIGINS`
(HMR origin check), access via `http://<pc-ip>:3000`.

## 18. Security Summary

14 review cycles (3 independent full audits) — every finding fixed and re-verified:
- Secrets: env-only JWT secret (prod hard-fail), no hardcoded credentials, `.env`
  untracked.
- AuthN: HS256 pinned, timing-safe logins, bcrypt-12, per-email/phone/IP login
  limits, live isActive checks, 503-on-DB-error pattern.
- AuthZ: every route role-gated + middleware double-gating; MANAGER cannot touch
  ADMIN; staff/customer session isolation; customer IDOR checks.
- Data exposure: global `Student.password` omit; `safeStudentResponse()` on public
  check-in; per-route `select`s on staff endpoints; `hasPassword` boolean instead
  of hash; public surfaces minimal (initials-only display, 5-field kiosk search).
- Input: sanitizers on writes, server-side pricing, magic-byte upload validation,
  path-traversal-guarded receipt writer, settings key allowlist.
- Infra: full CSP/security-header set, conditional upgrade-insecure-requests,
  cookie config single-source, bounded rate-limit store, audit logging.

On every deployment, re-verify: `npm run build` + `npx tsc --noEmit` clean;
`.env` values per the checklist above; seed endpoint disabled; backups running.
Accepted risks and hard rules: see **SECURITY.md**.

## 19. Known Limitations & Future Work

- **In-memory rate limiter** — resets on restart, single-instance only. Move to
  Redis (`@upstash/ratelimit`) if HIVE ever runs multi-instance.
- **CSP `unsafe-inline`** — nonce-based CSP pending better Next.js App Router
  nonce propagation (TODO in middleware.ts).
- **xlsx 0.18.5 CVEs** — parse-side only; HIVE only writes spreadsheets
  (documented in SECURITY.md). Revisit if spreadsheet *import* is added.
- **SQLite Float money** — exact-decimal math deferred to a future PostgreSQL
  migration (schema TODO); application-layer rounding applied everywhere today.
- **Cash drawer kick** — needs a local ESC/POS print service (PRINTER_SETUP.md).
- **Polling, not push** — websockets/SSE could replace the 5–30s polls if needed.
- **Single timezone** — all logic assumes the server `TZ` is the business timezone.
