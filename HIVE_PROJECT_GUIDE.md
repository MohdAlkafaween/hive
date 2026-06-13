# HIVE Project — Complete Context Guide

> **Purpose**: Hand this file to any new Claude Code session working on HIVE. It contains everything needed to understand the codebase without re-reading hundreds of files.

---

## What Is HIVE?

HIVE is a **coworking/study house management system** — a full-stack web app that manages:
- **Customer check-ins/checkouts** via RFID cards, QR codes, or manual search
- **Subscriptions** (time-based or visit-based plans with freeze/unfreeze)
- **Barista POS** (cafe menu, orders, cash registers)
- **Customer self-service portal** (login, view profile, browse menu, place orders, check-in history)
- **Self-service kiosk** (public tablet for walk-in check-ins)
- **Public display** (live occupancy screen)
- **Admin panel** (staff management, settings, promo codes, reports, Excel export)
- **Bilingual UI** (English + Arabic with RTL support)

---

## Tech Stack

| Tech | Version | Notes |
|---|---|---|
| Next.js | **16.2.6** | App Router. **BREAKING CHANGES from training data** — read `node_modules/next/dist/docs/` before writing code |
| React | 19.2.4 | |
| Prisma | **7.8** | With `@prisma/adapter-better-sqlite3` |
| SQLite | via better-sqlite3 | WAL mode, busy_timeout=5000ms. DB file: `dev.db` at root |
| jose | 6.2.3 | JWT sign/verify (Edge-safe, no Node.js crypto) |
| bcryptjs | 3.0.3 | Password hashing (cost factor 12) |
| Tailwind CSS | v4 | Dark theme, gold accent (#F5C518) |
| framer-motion | 12.40.0 | Animations |
| lucide-react | 1.16.0 | Icons |
| zustand | 5.0.13 | Minimal client state |
| recharts | 3.8.1 | Charts (stats page) |
| xlsx | 0.18.5 | Excel export |
| html5-qrcode | 2.3.8 | QR scanning (kiosk) |
| qrcode | 1.5.4 | QR generation (profile) |

---

## CRITICAL: AGENTS.md Warning

```
This is NOT the Next.js you know.
This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
node_modules/next/dist/docs/ before writing any code. Heed deprecation notices.
```

The project uses **Next.js 16** which has differences from Next.js 14/15. Always check docs if unsure.

---

## Auth Architecture (Two Separate Systems)

### Staff Auth
- **Login**: `POST /api/auth/login` — email + password → bcrypt verify → JWT
- **JWT payload**: `{ userId, email, role, permissions }` — expires **8 hours**
- **Cookie**: `session` (httpOnly, secure in prod, sameSite=lax, path=/)
- **Roles**: `ADMIN`, `MANAGER`, `STAFF`
- **MANAGER permissions**: JSON array of allowed page paths (e.g., `["/stats", "/barista"]`)
- **Auth guard**: `requireAuth(...allowedRoles)` in `src/lib/authGuard.ts` — decrypts JWT then does **live DB role check** (never trusts JWT role alone)
- **Client context**: `AuthProvider` in `src/hooks/useAuth.tsx` → calls `GET /api/auth/me?type=staff`

### Customer Auth
- **Login**: `POST /api/auth/customer/login` — phone + password → bcrypt verify → JWT
- **Register**: `POST /api/auth/customer/register` — creates student or links to staff-created record
- **JWT payload**: `{ type: 'customer', studentId }` — expires **7 days**
- **Cookie**: `customer-session` (separate from staff cookie)
- **Auth guard**: `requireCustomerAuth()` in `src/lib/customerAuth.ts`
- **Client context**: `CustomerProvider` in `src/lib/customerContext.tsx` → calls `GET /api/auth/me?type=customer`

### Cookie Config (Single Source of Truth)
`src/lib/cookieConfig.ts` exports:
- `STAFF_COOKIE_NAME = 'session'`
- `CUSTOMER_COOKIE_NAME = 'customer-session'`
- `STAFF_COOKIE_OPTIONS` (maxAge: 8h)
- `CUSTOMER_COOKIE_OPTIONS` (maxAge: 7d)
- `getClearCookieOptions()` for logout

**RULE**: Every file that reads, sets, or clears cookies MUST import from `cookieConfig.ts`. Never hardcode cookie names.

### `/api/auth/me` Route
Supports `?type=` query parameter:
- `?type=staff` → only reads `session` cookie → returns `{ type: 'staff', user: {...} }`
- `?type=customer` → only reads `customer-session` cookie → returns `{ type: 'customer', student: {...} }`
- No `?type` → checks staff first, then customer (backward-compatible)

This prevents session bleed between staff and customer contexts.

### Edge-Safe Split
- `src/lib/auth.ts` — uses only `jose`, NO Node.js imports. Safe for middleware (Edge Runtime).
- `src/lib/authGuard.ts` and `src/lib/customerAuth.ts` — import Prisma. **Must NOT be used in middleware.**

---

## Middleware (`src/middleware.ts`)

1. **Security headers** on every response (CSP, X-Frame-Options: DENY, etc.)
2. **Public paths** (no auth): `/login`, `/customer-login`, `/checkin`, `/display`, `/api/auth/*`, `/api/checkin`, `/api/rfid/*`, `/api/menu/public`, `/api/settings/public`
3. **Session isolation**: Customer paths (`/customer*`) ONLY read `customer-session`. Staff paths ONLY read `session`. **No fallback to the other cookie type** — this prevents session bleed.
4. **No token**: API → 401. Customer pages → redirect `/customer-login`. Staff pages → redirect `/login`.
5. **Customer token routing**: Can access `/customer*`, `/api/customer/*`, `/api/checkin/self`, `/api/auth/*`. Customer on staff pages → redirect to `/customer`.
6. **Staff RBAC**: `/admin` and `/stats` → ADMIN only (or MANAGER with permission). `/barista` and `/logs` → ADMIN or STAFF. MANAGER checks against `permissions` array.
7. **Catch block**: Clears both cookies, redirects to `/login`.

---

## Route Group Structure

| Group | URL Paths | Layout | Purpose |
|---|---|---|---|
| `(auth)` | `/login`, `/customer-login` | Root only (bare) | Login pages, no app chrome |
| `(app)` | `/`, `/directory`, `/logs`, `/stats`, `/barista`, `/orders`, `/admin` | TopNav + IconSidebar + GlobalProviders | Main staff app |
| `(kiosk)` | `/checkin`, `/display` | I18nProvider only | Self-service kiosk & display |
| `(print)` | `/subscription/receipt/[id]`, `/barista/receipt/[id]` | Root only | Print-friendly receipts |
| `customer/` | `/customer`, `/customer/menu`, `/customer/orders`, `/customer/history`, `/customer/profile` | CustomerTopBar + CustomerBottomNav | Customer mobile portal |

**Note**: `customer/` is a real path segment (not a route group), so URLs are `/customer/...`.

---

## Layout Hierarchy

### Staff App
```
RootLayout (fonts: Inter, JetBrains Mono, Noto Sans Arabic)
  └─ (app)/layout.tsx
       └─ AppLayoutInner (src/components/layout/AppLayoutInner.tsx)
            └─ I18nProvider
                 └─ AuthProvider (fetches /api/auth/me?type=staff)
                      └─ LayoutShell (dark gradient bg + ambient glow + footer)
                           └─ ToastProvider
                                ├─ TopNav (sticky header: logo, clock, scanner badge, lang, user, logout)
                                ├─ IconSidebar (desktop: 60px left rail; mobile: bottom nav with More overflow)
                                └─ main > ErrorBoundary > GlobalProviders (RFID + shortcuts + overlay)
                                     └─ {page content}
```

### Customer Portal
```
RootLayout
  └─ customer/layout.tsx
       └─ I18nProvider
            └─ CustomerProvider (fetches /api/auth/me?type=customer)
                 └─ CustomerShell (loading spinner, gradient bg)
                      ├─ CustomerTopBar (logo, name, lang toggle, logout)
                      ├─ main (max-w-3xl)
                      │    └─ {page content}
                      └─ CustomerBottomNav (Home, Menu, Orders, Profile)
```

### Kiosk
```
RootLayout
  └─ (kiosk)/layout.tsx
       └─ I18nProvider
            └─ {fullscreen kiosk page}
```

---

## Database Schema (20 Models)

### Core Models

**User** (staff) — `id`, `email`, `password`, `role` (ADMIN/MANAGER/STAFF), `permissions` (JSON string for MANAGER), `isActive`, timestamps. Self-referential `createdBy`.

**Student** (customer/member) — `id`, `fullName`, `phone` (unique), `email`, `studentNumber` (sequential, displayed as STD-0001), `rfidUuid` (unique), `qrToken` (unique), `password` (optional, for customer portal), `isLoginEnabled`, `status` (ACTIVE/SUSPENDED/BANNED/GRADUATED), `major`, `university`, `gender`, `dateOfBirth`, `emergencyContact/Phone`, `referralSource`, `photoUrl`, `lastLoginAt`, timestamps.

**Subscription** — links Student to SubscriptionPlan. `startDate`, `endDate`, `visitsUsed`/`totalVisitsAllowed`, `isActive`, `isFrozen`, `freezeStartDate`, `freezeDays`, `windowStart` (24h check-in window). `createdBy` → User (staff who sold it).

**SubscriptionPlan** — `name`, `durationDays`, `totalVisits` (-1 = unlimited), `price`, `isActive`.

**Log** — check-in/out record. `checkIn`/`checkOut` timestamps, `duration`, `method` (RFID/QR/MANUAL/SEARCH/AUTO_CHECKOUT), `isDismissed`. Links to Student and User (`processedBy`).

### Financial Models

**Transaction** — `receiptNumber`, `amount`, `discount`, `type` (SALE/REFUND/VOID), `gateway` (CASH/CARD/TRANSFER), `isVoided`. Links to Student, Subscription.

**BaristaOrder** — `status` flow: PENDING → ACCEPTED → PREPARING → READY → COMPLETED/CANCELLED. `orderedBy` (STAFF/CUSTOMER). Links to MenuItem, Student (optional), CashRegister. `orderGroupId` groups cart items.

**CashRegister** — shift-based cash tracking. `openingBalance`, `closingBalance`, `isClosed`. Links to StaffShift, User.

**CafeExpense** — `description`, `amount`, `category`, `date`. Links to User.

### Menu Models

**MenuCategory** → **MenuItem** → **MenuItemOption** → **MenuItemOptionValue**
- All have bilingual names (`name` + `nameAr`)
- Soft-delete via `isActive` / `isAvailable`
- `MenuItem` has `price`, `imageUrl`, `sortOrder`
- Options can be required with min/max selections
- Option values have optional `priceAdjustment`

### Other Models

**PromoCode** / **PromoUsage** — discount codes with `discountType` (PERCENTAGE/FIXED), usage limits, date ranges.

**StudentNote** — staff notes on students. `content`, `createdBy` → User.

**StaffShift** — `clockIn`/`clockOut`, auto clock-in on login, auto clock-out on logout.

**StaffAuditLog** — security trail: `event` (LOGIN/LOGOUT/etc.), `email`, `role`, `ip`.

**AppSetting** — key-value store. Known keys: `nextStudentNumber`, `kioskEnabled`, `publicDisplayEnabled`, `maxCapacity`, `autoCheckoutHours`, `qrCheckInEnabled`.

**WaitlistEntry** — capacity waitlist with `position`, `status`, `admittedAt`.

**BackupLog** — backup history.

---

## File-by-File Reference

### `/src/lib/` — Core Libraries

| File | Purpose |
|---|---|
| `auth.ts` | JWT encrypt/decrypt/getSession/verifyAuth. **Edge-safe** (uses `jose`, no Node.js imports). Imported by middleware. |
| `authGuard.ts` | `requireAuth(...roles)` — server-side guard with live DB role check. Returns `Response` on failure. **NOT Edge-safe** (imports Prisma). |
| `customerAuth.ts` | `requireCustomerAuth()` — same pattern for customer routes. Checks `isLoginEnabled`, status. |
| `cookieConfig.ts` | Cookie names (`session`, `customer-session`), options, clear helpers. Single source of truth. |
| `prisma.ts` | Prisma client singleton. Uses `better-sqlite3` adapter, WAL mode, busy_timeout=5000. |
| `i18n.tsx` | `I18nProvider`, `useI18n()` hook. Flat key-value translations for EN and AR. ~2200 lines. Language stored in localStorage. Sets `document.dir` for RTL. |
| `customerContext.tsx` | `CustomerProvider`, `useCustomer()`. Fetches `/api/auth/me?type=customer`, handles 503 retries, redirects to `/customer-login` on failure. |
| `store.ts` | Zustand store: `overlay` (check-in result), `addStudentOpen` (modal), `searchRef` (F1 focus target). |
| `rateLimit.ts` | In-memory rate limiter. `checkRateLimit(key, maxAttempts, windowMs)` → `{ limited, retryAfterMs }`. `clearRateLimit(key)` on success. `getClientIp(req)`. |
| `sanitize.ts` | `sanitizeString()`, `sanitizePhone()`, `sanitizeRfid()`, `isValidEmail()`. |
| `subscriptionLogic.ts` | `todayString()`, subscription validation helpers. |
| `autoCheckout.ts` | Closes open logs after 24h window expires. |
| `autoExpire.ts` | Deactivates subscriptions past expiry date. |
| `backupScheduler.ts` | Scheduled SQLite backups. |
| `capacity.ts` | Venue occupancy limit enforcement. |
| `auditLog.ts` | In-memory audit logging utility. |

### `/src/hooks/` — Client Hooks

| File | Purpose |
|---|---|
| `useAuth.tsx` | `AuthProvider` + `useAuth()`. Fetches `/api/auth/me?type=staff`. Provides `{ user, loading }`. Auto-refreshes MANAGER session. |
| `useKeyboardShortcuts.ts` | F1 (focus search), F2 (open add student modal), Esc (dismiss overlay). |
| `useRFIDScanner.ts` | Keyboard-wedge RFID reader — detects rapid keystrokes, fires check-in. |
| `useAudio.ts` | Sound effects for check-in feedback. |

### `/src/components/layout/` — Layout Components

| File | Purpose |
|---|---|
| `AppLayoutInner.tsx` | Wraps staff app: I18nProvider → AuthProvider → LayoutShell (gradient bg + footer). |
| `TopNav.tsx` | Sticky header: logo, live clock, RFID scanner status badge, language toggle, user info, logout. |
| `IconSidebar.tsx` | Desktop: 60px icon rail with tooltips, active indicator. Mobile: bottom tab bar (5 primary + More overflow). Fetches `/api/settings/public` to conditionally show kiosk link. Role-based visibility. |

### `/src/components/` — Feature Components

| File | Purpose |
|---|---|
| `GlobalProviders.tsx` | Mounts RFID scanner listener, keyboard shortcuts, CheckInOverlay. |
| `CheckInOverlay.tsx` | Full-screen animated check-in/out result display. |
| `dashboard/AddStudentModal.tsx` | F2 modal: create new customer with optional login password, RFID scan, check-in. |
| `dashboard/SearchBar.tsx` | F1 search: customer lookup by name/phone. |
| `dashboard/TodayFeedTable.tsx` | Today's check-in activity feed. |
| `dashboard/DashboardStats.tsx` | Stats cards (active, check-ins, capacity, revenue). |
| `dashboard/ExpiryBanner.tsx` | Expiring subscriptions warning. |
| `dashboard/WaitlistPanel.tsx` | Capacity waitlist management. |
| `dashboard/ReceiptModal.tsx` | Subscription receipt viewer. |
| `directory/ProfileView.tsx` | Full student profile with tabs (info, history, notes, purchases). |
| `directory/RenewModal.tsx` | Subscription renewal dialog. |
| `admin/PlansSection.tsx` | Subscription plan CRUD in admin panel. |
| `admin/RegistersSection.tsx` | Cash register management. |
| `barista/CashRegisterBar.tsx` | Active cash register status bar. |
| `stats/RevenueChart.tsx` | Revenue chart component. |
| `stats/ExcelExport.tsx` | Excel export for stats. |
| `stats/DailyReportExport.tsx` | Daily report PDF/print. |
| `shared/ExportButton.tsx` | Reusable export button. |
| `ui/*` | Badge, Button, ConfirmModal, ErrorBoundary, Modal, Toast. |
| `animations/*` | AnimatedNumber, AnimatedTabs, FadeInView, PageTransition, Skeleton*, StaggerContainer. |

### `/src/app/` — Pages

| Path | File | Purpose |
|---|---|---|
| `/` | `(app)/page.tsx` | Dashboard: check-in feed, stats cards, search, expiry banner |
| `/directory` | `(app)/directory/page.tsx` | Customer directory with filters, sort, export |
| `/logs` | `(app)/logs/page.tsx` | Check-in/out log viewer with date range |
| `/stats` | `(app)/stats/page.tsx` | Statistics, charts, daily reports |
| `/barista` | `(app)/barista/page.tsx` | Barista POS: menu grid, cart, orders |
| `/orders` | `(app)/orders/page.tsx` | Staff order queue (PENDING → COMPLETED) |
| `/admin` | `(app)/admin/page.tsx` | Admin: staff users, plans, settings, promo codes, kiosk toggle, capacity, QR toggle |
| `/login` | `(auth)/login/page.tsx` | Staff login |
| `/customer-login` | `(auth)/customer-login/page.tsx` | Customer login/register (tabbed) |
| `/checkin` | `(kiosk)/checkin/page.tsx` | Self-service kiosk. Checks `kioskEnabled` setting. |
| `/display` | `(kiosk)/display/page.tsx` | Public occupancy display |
| `/customer` | `customer/page.tsx` | Customer home |
| `/customer/menu` | `customer/menu/page.tsx` | Browse menu, add to cart, place order |
| `/customer/orders` | `customer/orders/page.tsx` | Customer order tracking |
| `/customer/history` | `customer/history/page.tsx` | Check-in and subscription history |
| `/customer/profile` | `customer/profile/page.tsx` | Profile, QR code, change password |

### `/src/app/api/` — API Routes

**Auth:**
- `auth/login` — Staff login (POST)
- `auth/logout` — Logout, clears both cookies (POST)
- `auth/register` — Register staff user, ADMIN only (POST)
- `auth/me` — Current user info, supports `?type=staff|customer` (GET)
- `auth/seed` — Seed initial admin (POST)
- `auth/users` — List staff users (GET)
- `auth/users/[id]` — CRUD staff user (GET/PATCH/DELETE)
- `auth/audit-logs` — Security audit trail (GET)
- `auth/reset-password` — Staff password reset (POST)
- `auth/refresh-session` — Refresh JWT with latest DB permissions (POST)
- `auth/customer/login` — Customer login (POST)
- `auth/customer/register` — Customer registration (POST)
- `auth/customer/reset-password` — Customer password reset (POST)

**Students:**
- `students` — List (GET, paginated) / Create (POST, supports optional `password` for customer login)
- `students/search` — Quick search by name/phone (GET)
- `students/[id]` — Get/Update/Delete (GET/PATCH/DELETE)
- `students/[id]/photo` — Photo upload (POST)
- `students/[id]/notes` — Notes CRUD (GET/POST)
- `students/[id]/orders` — Student's orders (GET)

**Check-in/out:**
- `checkin` — Check-in by RFID/QR/search (POST, public, rate-limited)
- `checkin/qr` — QR code check-in (POST)
- `checkin/search` — Search for check-in (GET)
- `checkin/self` — Customer self-check-in (POST, requires customer auth)
- `checkout` — Manual checkout (POST)
- `checkout/auto` — Trigger auto-checkout (POST)

**Subscriptions:**
- `subscriptions` — Create subscription (POST)
- `subscriptions/[id]` — Get/Update (GET/PATCH)
- `subscriptions/[id]/freeze` — Freeze/unfreeze (POST)
- `subscriptions/expire` — Expire stale subscriptions (POST)

**Plans:** `plans` (GET/POST), `plans/[id]` (PATCH)

**Menu:** `menu` (GET/POST), `menu/public` (GET, no auth), `menu/[id]` (GET/PATCH/DELETE), options and values nested CRUD, `menu/categories` (GET/POST), `menu/categories/[id]` (PATCH/DELETE)

**Barista:** `barista/orders` (GET/POST), `barista/orders/[id]` (PATCH), `barista/orders/[id]/receipt` (GET), `barista/logs` (GET)

**Customer:** `customer/subscription` (GET), `customer/history` (GET), `customer/orders` (GET/POST), `customer/orders/[id]` (GET), `customer/profile` (GET/PATCH), `customer/password` (POST)

**Orders Queue:** `orders/queue` (GET), `orders/queue/[id]` (PATCH)

**Financial:** `transactions/today` (GET), `transactions/[id]` (PATCH — void/refund), `transactions/[id]/receipt` (GET), `cash-register` (GET/POST), `cash-register/summary` (GET), `cash-register/[id]` (PATCH), `expenses` (GET/POST), `expenses/[id]` (PATCH/DELETE)

**Other:** `promo` (GET/POST), `promo/validate` (POST), `promo/[id]` (PATCH), `stats/summary` (GET), `stats/daily` (GET), `reports` (GET), `reports/daily` (GET), `dashboard/stats` (GET), `logs/*` (CRUD), `settings` (GET/PUT), `settings/public` (GET, no auth), `display` (GET), `rfid/[uuid]` (GET), `shifts` (GET), `upload` (POST), `waitlist` (GET/POST/PATCH), `backup/*`

---

## API Route Patterns

All API routes follow this consistent pattern:

```typescript
import { requireAuth } from '@/lib/authGuard'
import prisma from '@/lib/prisma'
import { sanitizeString } from '@/lib/sanitize'

export async function POST(req: Request) {
  // 1. Auth guard (returns Response on failure)
  const session = await requireAuth('ADMIN', 'STAFF')
  if (session instanceof Response) return session

  // 2. Parse body
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

  // 3. Sanitize + validate
  const name = sanitizeString(body.name)
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 })

  // 4. Prisma operation
  try {
    const result = await prisma.student.create({ data: { ... } })
    return Response.json(result, { status: 201 })
  } catch (e) {
    console.error('[POST /api/whatever]', e)
    if ((e as any)?.code === 'P2002') {
      return Response.json({ error: 'Already exists' }, { status: 409 })
    }
    return Response.json({ error: 'Failed' }, { status: 500 })
  }
}
```

Customer routes use `requireCustomerAuth()` instead of `requireAuth()`.

---

## i18n Keys

Flat key-value structure in `src/lib/i18n.tsx`. ~2200 lines.

Key prefixes:
- `nav.*` — navigation labels
- `sidebar.*` — sidebar items
- `dash.*` — dashboard
- `dir.*` — directory
- `profile.*` — student profile
- `stats.*` — statistics
- `barista.*` — barista POS
- `admin.*` — admin panel
- `logs.*` — log viewer
- `renew.*` — renewal modal
- `addStudent.*` — add customer modal
- `customer.*` — customer portal
- `customerAuth.*` — customer login/register
- `kiosk.*` — kiosk page
- `report.*` — reports/exports
- `waitlist.*` — waitlist
- `footer.*` — footer

**Important**: User-visible text says "Customer" (not "Student"). Internal code (variable names, model names, API routes) still uses "Student" — this is intentional. Do NOT rename code identifiers.

---

## DO NOT TOUCH List

These areas are stable and should not be modified unless explicitly requested:

- Check-in/checkout logic, 24h window, subscription logic
- Order placement logic (backend)
- Auth system architecture (separate cookies are correct)
- Database schema (no migrations needed)
- Security boundaries (rate limiting values, RBAC, input sanitization)
- Staff dashboard core functionality
- Kiosk toggle (already implemented)
- Mobile responsiveness (already fixed)

---

## Environment

- **OS**: Windows
- **Database**: SQLite file at `./dev.db`
- **No `.env` required for dev** — JWT_SECRET falls back to insecure default in development (logged as warning)
- **Production**: Must set `JWT_SECRET` environment variable
- **Build**: `npm run build` — must pass with zero errors before any job is considered done
- **Dev**: `npm run dev` — starts on localhost:3000

---

## Recent Changes (Current State)

1. **Cookie config centralized** — all cookie names/options come from `src/lib/cookieConfig.ts`
2. **Session isolation fixed** — middleware no longer falls back to the wrong cookie type; `/api/auth/me` supports `?type=` parameter
3. **sameSite changed from `strict` to `lax`** — prevents edge-case cookie issues
4. **Rate limits relaxed for shared WiFi** — IP limits are generous (30/15min login, 200/min menu), per-identifier limits remain tight
5. **Kiosk toggle** — admin can enable/disable kiosk mode; sidebar conditionally shows kiosk link
6. **Customer login password from admin** — AddStudentModal has optional "Enable Customer Login" toggle
7. **"Student" renamed to "Customer"** in all user-visible UI text (EN + AR). Code identifiers unchanged.
