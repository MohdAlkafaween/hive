# HIVE Project Structure

Study house management system built with Next.js 16, Prisma 7, SQLite, dark theme with gold (#F5C518) accent, and EN/AR internationalization.

**Stats:** 68 API routes | 33 components | 10 pages | 21 Prisma models | 742 i18n keys per language | 4 hooks | 11 lib files

---

## 1. File Tree

```
prisma/
  schema.prisma          - 21 database models
  seed.ts                - Seeds admin account + default settings + plans

src/
  app/
    layout.tsx           - Root layout: html, body, fonts (Inter, JetBrains Mono, Noto Arabic)
    globals.css          - Tailwind v4 + dark theme + glassmorphism + custom animations
    (auth)/
      login/page.tsx     - Login page (full-screen, dark, gold accent)
    (app)/
      layout.tsx         - App shell: TopNav + IconSidebar + GlobalProviders + footer
      page.tsx           - Dashboard (main operational screen)
      admin/page.tsx     - Admin panel (8 tabs: promos, users, shifts, audit, registers, backup, plans, settings)
      barista/page.tsx   - Barista POS (menu grid, cart, checkout, register)
      directory/page.tsx - Student directory (search, filter, sort, export, profile view)
      logs/page.tsx      - Check-in/out log history with calendar view
      stats/page.tsx     - Statistics & analytics (charts, revenue, export)
    (kiosk)/
      layout.tsx         - Bare layout for kiosk screens (no nav/sidebar)
      checkin/page.tsx   - Kiosk check-in (RFID, search, QR tabs)
      display/page.tsx   - Public occupancy display (wall-mounted screen)
    (print)/
      barista/receipt/[id]/page.tsx - 80mm thermal receipt print page
    api/
      auth/
        login/route.ts          - POST: login with JWT + per-email rate limit
        logout/route.ts         - POST: logout, clear cookie, clock-out shift
        register/route.ts       - POST: create staff account (ADMIN only, ADMIN can create ADMIN)
        me/route.ts             - GET: current user info from JWT
        refresh-session/route.ts - POST: refresh JWT with live DB role
        reset-password/route.ts  - POST: admin resets another user's password
        seed/route.ts           - GET: first-time admin seed (gated by ALLOW_SEED env)
        users/route.ts          - GET: list all staff (ADMIN/MANAGER)
        users/[id]/route.ts     - GET/PUT/DELETE: staff detail, role change, disable, delete
        audit-logs/route.ts     - GET: paginated staff audit log (ADMIN)
      students/
        route.ts                - GET: paginated list + search | POST: create student
        [id]/route.ts           - GET/PATCH/DELETE: student detail + update + delete
        [id]/notes/route.ts     - GET/POST/DELETE: student notes
        [id]/orders/route.ts    - GET: student's barista order history
        [id]/photo/route.ts     - POST: upload student photo
        search/route.ts         - GET: search students for kiosk check-in
      checkin/
        route.ts                - POST: RFID/manual check-in (public, rate-limited)
        qr/route.ts             - POST: QR code check-in (public, rate-limited)
        search/route.ts         - GET: search for kiosk check-in
      checkout/
        route.ts                - POST: manual check-out
        auto/route.ts           - POST: bulk auto-checkout stale sessions
      subscriptions/
        route.ts                - POST: create subscription (with planId + createdBy)
        [id]/route.ts           - GET/PATCH: subscription detail + edit visits
        [id]/freeze/route.ts    - POST: freeze/unfreeze subscription
        expire/route.ts         - POST: expire stale subscriptions
      plans/
        route.ts                - GET/POST: list + create subscription plans
        [id]/route.ts           - PUT/DELETE: update + delete plan
      transactions/
        [id]/route.ts           - GET/PATCH: transaction detail + void/refund
        [id]/receipt/route.ts   - GET: subscription receipt data
        today/route.ts          - GET: today's transactions
      barista/
        orders/route.ts         - GET/POST: list + create barista orders
        orders/[id]/route.ts    - GET/DELETE: order detail + cancel
        orders/[id]/receipt/route.ts - GET: barista receipt data (reads businessName/receiptFooter)
        logs/route.ts           - GET: barista sales analytics
      menu/
        route.ts                - GET: full menu with categories + options
        [id]/route.ts           - PATCH/DELETE: update + soft-delete menu item
        categories/route.ts     - GET/POST: menu categories
        categories/[id]/route.ts - PUT/DELETE: category update + delete
        [id]/options/route.ts   - GET/POST: item options (Size, etc.)
        [id]/options/[optionId]/route.ts - PUT/DELETE: option update + delete
        [id]/options/[optionId]/values/route.ts - GET/POST: option values (Small, Large)
        [id]/options/[optionId]/values/[valueId]/route.ts - PUT/DELETE: value update + delete
      cash-register/
        route.ts                - GET/POST: list + open register
        [id]/route.ts           - PUT: close register
        summary/route.ts        - GET: register summary stats
      expenses/
        route.ts                - GET/POST: list + create cafe expense
        [id]/route.ts           - PUT/DELETE: update + delete expense
      promo/
        route.ts                - GET/POST: list + create promo codes
        [id]/route.ts           - PATCH/DELETE: update + delete promo
        validate/route.ts       - POST: validate promo code (public for kiosk)
      logs/
        [id]/route.ts           - GET/DELETE: single log detail + delete
        today/route.ts          - GET: today's logs with processedByUser
        history/route.ts        - GET: historical logs by date with processedByUser
        bulk-delete/route.ts    - DELETE: bulk delete old logs (ADMIN)
        cleanup/route.ts        - POST: cleanup old checked-out logs (ADMIN)
      stats/
        daily/route.ts          - GET: daily stats for charts
        summary/route.ts        - GET: summary statistics
      reports/route.ts          - GET: monthly report data
      dashboard/stats/route.ts  - GET: dashboard card stats
      display/route.ts          - GET: public display data (occupancy, activity)
      settings/route.ts         - GET/PUT: app settings with key whitelist
      shifts/route.ts           - GET: staff shift history
      rfid/[uuid]/route.ts      - GET: RFID lookup (public, limited data)
      upload/route.ts           - POST: file upload with magic byte validation
      waitlist/route.ts         - GET/POST/PATCH: waitlist management
      backup/
        route.ts                - GET/POST: download + restore backup
        status/route.ts         - GET: backup status + history
        trigger/route.ts        - POST: trigger manual backup

  components/
    GlobalProviders.tsx         - RFID scanner + keyboard shortcuts + CheckInOverlay
    CheckInOverlay.tsx          - Full-screen check-in result overlay (success/error/warning)
    layout/
      TopNav.tsx                - Top navigation bar (logo, clock, scanner status, user info, logout)
      IconSidebar.tsx           - Left icon rail (nav links, role-based visibility, shortcuts)
      AppLayoutInner.tsx        - I18n provider wrapper for app layout
    dashboard/
      SearchBar.tsx             - Student search for manual check-in
      AddStudentModal.tsx       - New student registration form (all fields + RFID scan)
      DashboardStats.tsx        - Stat cards (active students, check-ins, occupancy, revenue)
      ExpiryBanner.tsx          - Warning banner for expiring subscriptions
      TodayFeedTable.tsx        - Today's check-in feed with processedBy indicator
      ReceiptModal.tsx          - Subscription receipt display + print
      WaitlistPanel.tsx         - Waitlist management panel
    directory/
      ProfileView.tsx           - Full student profile (info, sub history with "Sold by", logs, notes, QR, etc.)
      RenewModal.tsx            - Subscription renewal (fetches plans from API, promo codes)
    admin/
      PlansSection.tsx          - Subscription plan CRUD
      RegistersSection.tsx      - Cash register history
    barista/
      CashRegisterBar.tsx       - Active register status bar
    stats/
      ExcelExport.tsx           - Excel export component
      RevenueChart.tsx          - Revenue chart (Recharts)
    shared/
      ExportButton.tsx          - Reusable export button
    animations/
      AnimatedNumber.tsx        - Counting number animation
      AnimatedTabs.tsx          - Tab switcher with motion
      FadeInView.tsx            - Fade-in wrapper
      PageTransition.tsx        - Page transition animation
      SkeletonCard.tsx          - Loading skeleton card
      SkeletonRow.tsx           - Loading skeleton table row
      StaggerContainer.tsx      - Staggered children animation
    ui/
      Badge.tsx                 - Status badge component
      Button.tsx                - Button component (variants: primary, secondary, danger, ghost)
      ConfirmModal.tsx          - Confirmation dialog (warning/danger variants)
      ErrorBoundary.tsx         - React error boundary
      Modal.tsx                 - Base modal component (glassmorphism)
      Toast.tsx                 - Toast notification system (success/error/info)

  hooks/
    useAuth.tsx                 - Auth state hook (fetches /api/auth/me, role, permissions)
    useRFIDScanner.ts           - RFID card reader hook (keyboard buffer pattern)
    useKeyboardShortcuts.ts     - Global keyboard shortcuts (F1=new student, F2=search, Esc=close)
    useAudio.ts                 - Audio playback hook for check-in sounds

  lib/
    prisma.ts                   - Prisma client singleton with WAL mode
    auth.ts                     - JWT sign/verify/decrypt (Edge-safe, jose)
    authGuard.ts                - Server-side auth guard (DB role check, isActive, permissions)
    rateLimit.ts                - In-memory rate limiter with eviction
    sanitize.ts                 - Input sanitization (strings, phones, RFID, emails, dates, IDs)
    subscriptionLogic.ts        - Plan defaults, expiry computation, todayString(), isActive check
    i18n.tsx                    - I18n provider + 742 EN/AR translation keys
    store.ts                    - Zustand store (overlay, addStudentOpen, searchRef)
    auditLog.ts                 - In-memory audit log helper
    capacity.ts                 - Venue capacity check
    autoExpire.ts               - Auto-expire stale subscriptions
    autoCheckout.ts             - Auto-checkout logic
    backupScheduler.ts          - Automated backup scheduler

  middleware.ts                 - JWT validation, public paths, CSP headers, role-based routing
  instrumentation.ts            - Server startup hooks (auto-checkout + backup scheduler)
```

---

## 2. Schema Models (21)

| Model | Purpose | Key Relations |
|-------|---------|---------------|
| User | Staff accounts (email, password, role, permissions, isActive) | createdBy (self), auditLogs, cashRegisters, expenses, processedLogs, createdSubscriptions |
| StaffAuditLog | Login/logout/action audit trail | user |
| Student | Members (fullName, phone, email, university, status, rfidUuid, qrToken, etc.) | subscriptions, logs, transactions, notes, orders, promoUsages, waitlist |
| Subscription | Time/visit-based passes | student, createdByUser, plan (SubscriptionPlan) |
| Log | Check-in/out records | student, processedByUser |
| Transaction | Financial records (SALE, REFUND, VOID) | student |
| MenuCategory | Cafe menu categories | items |
| MenuItem | Cafe products | category, orders, options |
| MenuItemOption | Item variants (Size, etc.) | menuItem, values |
| MenuItemOptionValue | Variant choices (Small, Large) | option |
| BaristaOrder | Cafe orders | menuItem, student, register |
| CafeExpense | Business expenses | user |
| CashRegister | Cash drawer sessions | shift, user, orders |
| PromoCode | Discount/bonus codes | usages |
| PromoUsage | Promo redemption records | promoCode, student |
| StudentNote | Notes on student profiles | student |
| StaffShift | Staff clock-in/out | cashRegisters |
| AppSetting | Key-value config store | -- |
| WaitlistEntry | Queue when at capacity | student |
| BackupLog | Backup history | -- |
| SubscriptionPlan | Configurable plan types | subscriptions |

---

## 3. API Routes (68)

### Auth (10 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/login` | POST | Login with JWT + per-email rate limit |
| `/api/auth/logout` | POST | Logout, clear cookie, clock-out shift |
| `/api/auth/register` | POST | Create staff account (ADMIN only, ADMIN can create ADMIN) |
| `/api/auth/me` | GET | Current user info from JWT |
| `/api/auth/refresh-session` | POST | Refresh JWT with live DB role |
| `/api/auth/reset-password` | POST | Admin resets another user's password |
| `/api/auth/seed` | GET | First-time admin seed (gated by ALLOW_SEED env) |
| `/api/auth/users` | GET | List all staff (ADMIN/MANAGER) |
| `/api/auth/users/[id]` | GET/PUT/DELETE | Staff detail, role change, disable, delete |
| `/api/auth/audit-logs` | GET | Paginated staff audit log (ADMIN) |

### Students (6 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/students` | GET/POST | Paginated list + search, create student |
| `/api/students/[id]` | GET/PATCH/DELETE | Student detail + update + delete |
| `/api/students/[id]/notes` | GET/POST/DELETE | Student notes |
| `/api/students/[id]/orders` | GET | Student's barista order history |
| `/api/students/[id]/photo` | POST | Upload student photo |
| `/api/students/search` | GET | Search students for kiosk check-in |

### Check-in / Check-out (5 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/checkin` | POST | RFID/manual check-in (public, rate-limited) |
| `/api/checkin/qr` | POST | QR code check-in (public, rate-limited) |
| `/api/checkin/search` | GET | Search for kiosk check-in |
| `/api/checkout` | POST | Manual check-out |
| `/api/checkout/auto` | POST | Bulk auto-checkout stale sessions |

### Subscriptions (4 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/subscriptions` | POST | Create subscription (with planId + createdBy) |
| `/api/subscriptions/[id]` | GET/PATCH | Subscription detail + edit visits |
| `/api/subscriptions/[id]/freeze` | POST | Freeze/unfreeze subscription |
| `/api/subscriptions/expire` | POST | Expire stale subscriptions |

### Plans (2 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/plans` | GET/POST | List + create subscription plans |
| `/api/plans/[id]` | PUT/DELETE | Update + delete plan |

### Transactions (3 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/transactions/[id]` | GET/PATCH | Transaction detail + void/refund |
| `/api/transactions/[id]/receipt` | GET | Subscription receipt data |
| `/api/transactions/today` | GET | Today's transactions |

### Barista (4 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/barista/orders` | GET/POST | List + create barista orders |
| `/api/barista/orders/[id]` | GET/DELETE | Order detail + cancel |
| `/api/barista/orders/[id]/receipt` | GET | Barista receipt data (reads businessName/receiptFooter) |
| `/api/barista/logs` | GET | Barista sales analytics |

### Menu (8 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/menu` | GET | Full menu with categories + options |
| `/api/menu/[id]` | PATCH/DELETE | Update + soft-delete menu item |
| `/api/menu/categories` | GET/POST | Menu categories |
| `/api/menu/categories/[id]` | PUT/DELETE | Category update + delete |
| `/api/menu/[id]/options` | GET/POST | Item options (Size, etc.) |
| `/api/menu/[id]/options/[optionId]` | PUT/DELETE | Option update + delete |
| `/api/menu/[id]/options/[optionId]/values` | GET/POST | Option values (Small, Large) |
| `/api/menu/[id]/options/[optionId]/values/[valueId]` | PUT/DELETE | Value update + delete |

### Cash Register (3 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/cash-register` | GET/POST | List + open register |
| `/api/cash-register/[id]` | PUT | Close register |
| `/api/cash-register/summary` | GET | Register summary stats |

### Expenses (2 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/expenses` | GET/POST | List + create cafe expense |
| `/api/expenses/[id]` | PUT/DELETE | Update + delete expense |

### Promo (3 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/promo` | GET/POST | List + create promo codes |
| `/api/promo/[id]` | PATCH/DELETE | Update + delete promo |
| `/api/promo/validate` | POST | Validate promo code (public for kiosk) |

### Logs (5 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/logs/[id]` | GET/DELETE | Single log detail + delete |
| `/api/logs/today` | GET | Today's logs with processedByUser |
| `/api/logs/history` | GET | Historical logs by date with processedByUser |
| `/api/logs/bulk-delete` | DELETE | Bulk delete old logs (ADMIN) |
| `/api/logs/cleanup` | POST | Cleanup old checked-out logs (ADMIN) |

### Stats, Reports, Dashboard, Display (4 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/stats/daily` | GET | Daily stats for charts |
| `/api/stats/summary` | GET | Summary statistics |
| `/api/reports` | GET | Monthly report data |
| `/api/dashboard/stats` | GET | Dashboard card stats |

### Other (9 routes)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/display` | GET | Public display data (occupancy, activity) |
| `/api/settings` | GET/PUT | App settings with key whitelist |
| `/api/shifts` | GET | Staff shift history |
| `/api/rfid/[uuid]` | GET | RFID lookup (public, limited data) |
| `/api/upload` | POST | File upload with magic byte validation |
| `/api/waitlist` | GET/POST/PATCH | Waitlist management |
| `/api/backup` | GET/POST | Download + restore backup |
| `/api/backup/status` | GET | Backup status + history |
| `/api/backup/trigger` | POST | Trigger manual backup |

---

## 4. Components (33)

### Core (2)

| Component | Description |
|-----------|-------------|
| `GlobalProviders.tsx` | RFID scanner + keyboard shortcuts + CheckInOverlay |
| `CheckInOverlay.tsx` | Full-screen check-in result overlay (success/error/warning) |

### Layout (3)

| Component | Description |
|-----------|-------------|
| `TopNav.tsx` | Top navigation bar (logo, clock, scanner status, user info, logout) |
| `IconSidebar.tsx` | Left icon rail (nav links, role-based visibility, shortcuts) |
| `AppLayoutInner.tsx` | I18n provider wrapper for app layout |

### Dashboard (7)

| Component | Description |
|-----------|-------------|
| `SearchBar.tsx` | Student search for manual check-in |
| `AddStudentModal.tsx` | New student registration form (all fields + RFID scan) |
| `DashboardStats.tsx` | Stat cards (active students, check-ins, occupancy, revenue) |
| `ExpiryBanner.tsx` | Warning banner for expiring subscriptions |
| `TodayFeedTable.tsx` | Today's check-in feed with processedBy indicator |
| `ReceiptModal.tsx` | Subscription receipt display + print |
| `WaitlistPanel.tsx` | Waitlist management panel |

### Directory (2)

| Component | Description |
|-----------|-------------|
| `ProfileView.tsx` | Full student profile (info, sub history with "Sold by", logs, notes, QR, etc.) |
| `RenewModal.tsx` | Subscription renewal (fetches plans from API, promo codes) |

### Admin (2)

| Component | Description |
|-----------|-------------|
| `PlansSection.tsx` | Subscription plan CRUD |
| `RegistersSection.tsx` | Cash register history |

### Barista (1)

| Component | Description |
|-----------|-------------|
| `CashRegisterBar.tsx` | Active register status bar |

### Stats (2)

| Component | Description |
|-----------|-------------|
| `ExcelExport.tsx` | Excel export component |
| `RevenueChart.tsx` | Revenue chart (Recharts) |

### Shared (1)

| Component | Description |
|-----------|-------------|
| `ExportButton.tsx` | Reusable export button |

### Animations (7)

| Component | Description |
|-----------|-------------|
| `AnimatedNumber.tsx` | Counting number animation |
| `AnimatedTabs.tsx` | Tab switcher with motion |
| `FadeInView.tsx` | Fade-in wrapper |
| `PageTransition.tsx` | Page transition animation |
| `SkeletonCard.tsx` | Loading skeleton card |
| `SkeletonRow.tsx` | Loading skeleton table row |
| `StaggerContainer.tsx` | Staggered children animation |

### UI (6)

| Component | Description |
|-----------|-------------|
| `Badge.tsx` | Status badge component |
| `Button.tsx` | Button component (variants: primary, secondary, danger, ghost) |
| `ConfirmModal.tsx` | Confirmation dialog (warning/danger variants) |
| `ErrorBoundary.tsx` | React error boundary |
| `Modal.tsx` | Base modal component (glassmorphism) |
| `Toast.tsx` | Toast notification system (success/error/info) |

---

## 5. Hooks (4)

| Hook | Description |
|------|-------------|
| `useAuth.tsx` | Auth state hook (fetches /api/auth/me, role, permissions) |
| `useRFIDScanner.ts` | RFID card reader hook (keyboard buffer pattern) |
| `useKeyboardShortcuts.ts` | Global keyboard shortcuts (F1=new student, F2=search, Esc=close) |
| `useAudio.ts` | Audio playback hook for check-in sounds |

---

## 6. Lib Files (11)

| File | Description |
|------|-------------|
| `prisma.ts` | Prisma client singleton with WAL mode |
| `auth.ts` | JWT sign/verify/decrypt (Edge-safe, jose) |
| `authGuard.ts` | Server-side auth guard (DB role check, isActive, permissions) |
| `rateLimit.ts` | In-memory rate limiter with eviction |
| `sanitize.ts` | Input sanitization (strings, phones, RFID, emails, dates, IDs) |
| `subscriptionLogic.ts` | Plan defaults, expiry computation, todayString(), isActive check |
| `i18n.tsx` | I18n provider + 742 EN/AR translation keys |
| `store.ts` | Zustand store (overlay, addStudentOpen, searchRef) |
| `auditLog.ts` | In-memory audit log helper |
| `capacity.ts` | Venue capacity check |
| `autoExpire.ts` | Auto-expire stale subscriptions |
| `autoCheckout.ts` | Auto-checkout logic |
| `backupScheduler.ts` | Automated backup scheduler |

---

## 7. Key Data Flows

### RFID Check-In

Card tap -> `useRFIDScanner` captures keystrokes -> POST `/api/checkin` `{rfidUuid}` -> find student -> check status (block SUSPENDED/BANNED) -> check subscription (active, not frozen, not expired) -> check capacity -> `$transaction`: create Log (processedBy from JWT), increment visitsUsed, increment lifetimeCheckIns -> `CheckInOverlay` shows result -> `TodayFeedTable` refreshes

### Student Registration

Click "Add Student" -> `AddStudentModal` -> fill form -> POST `/api/students` -> create with atomic student number + QR token -> optionally open `RenewModal` -> POST `/api/subscriptions` `{planId, gateway}` -> create Subscription (createdBy) + Transaction + receipt number -> `ReceiptModal`

### Subscription Renewal

`ProfileView` -> click "Renew" -> `RenewModal` fetches GET `/api/plans` -> select plan + payment -> optionally apply promo (POST `/api/promo/validate`) -> POST `/api/subscriptions` -> deactivate old sub + create new (with planId, createdBy) + Transaction -> `ReceiptModal`

### Login

POST `/api/auth/login` -> per-email rate limit (5/15min) + IP limit (30/15min) -> bcrypt verify -> create JWT -> set httpOnly cookie -> auto clock-in shift -> audit log -> redirect to dashboard

### Barista Order

Menu grid -> add to cart -> checkout modal -> POST `/api/barista/orders` -> create orders + receipt number -> update CashRegister totals -> receipt

---

## 8. Auth Architecture

| Layer | File | Purpose |
|-------|------|---------|
| Middleware | `middleware.ts` | Validates JWT on every non-public request, enforces role-based page access, sets CSP headers |
| Auth Guard | `authGuard.ts` (requireAuth) | Server-side DB lookup for live role + isActive check, used by all protected API routes |
| JWT Utils | `auth.ts` | Edge-safe JWT sign/verify using jose HS256, cookie helpers |

### Public Paths (no auth required)

- `/login`, `/checkin`, `/display`
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/seed`, `/api/auth/me`
- `/api/checkin`, `/api/checkin/qr`, `/api/checkin/search`
- `/api/rfid/*`, `/api/display`

---

## 9. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes (production) | JWT signing key |
| `DATABASE_URL` | No | SQLite path (default: `file:./dev.db`) |
| `SEED_ADMIN_EMAIL` | No | Initial admin email (default: `admin@hive.study`) |
| `SEED_ADMIN_PASSWORD` | No | Initial admin password |
| `ALLOW_SEED` | No | Enable `/api/auth/seed` endpoint (default: `false`) |
| `TRUST_PROXY` | No | Trust X-Forwarded-For header (default: `false`) |
| `BACKUP_DIR` | No | Backup storage directory |
| `NODE_ENV` | No | Set by Next.js automatically |

---

## 10. Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.2.6 | React framework |
| react | 19.2.4 | UI library |
| prisma | 7.8.0 | ORM |
| @prisma/adapter-better-sqlite3 | -- | SQLite adapter for Prisma |
| better-sqlite3 | -- | SQLite driver |
| bcryptjs | -- | Password hashing |
| jose | -- | JWT sign/verify (Edge-compatible) |
| zustand | -- | Client state management |
| framer-motion | -- | Animations |
| lucide-react | -- | Icons |
| recharts | -- | Charts |
| xlsx | -- | Excel export |
| html5-qrcode | -- | QR scanner |
| qrcode | -- | QR code generation |
| react-use | -- | React utility hooks |
| tailwindcss | v4 | Styling |
