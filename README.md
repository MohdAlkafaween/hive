# HIVE — Study House Management System

A local-first reception management system for HIVE study house. Handles student check-in/check-out via RFID cards or manual search, subscription tracking, payment recording, and daily statistics.

## Quick Start

```bash
npm install
npx prisma migrate dev   # first time only
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

| Page | Path | Purpose |
|------|------|---------|
| Dashboard | `/` | Check-in via RFID or search, today's feed |
| Directory | `/directory` | Browse all students, view/edit profiles, renew subscriptions |
| Statistics | `/stats` | Daily revenue, check-in counts, Excel export |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F1` | Focus search bar |
| `F2` | Open "Add New Student" modal |
| `Esc` | Close any modal or overlay |
| RFID swipe | Auto-detected globally (rapid keystrokes ending in Enter) |

## Subscription Plans

| Plan | Price | Valid Until | Max Visits |
|------|-------|-------------|------------|
| Daily | 3 JD | Midnight of same day | Unlimited |
| Weekly | 15 JD | 10 calendar days | 7 attendance days |
| Monthly | 50 JD | 40 calendar days | 30 attendance days |

Anti-double-deduct: If a student checks in multiple times the same day, only the first entry deducts a visit.

## Database

SQLite at `prisma/dev.db`. Browse with:

```bash
npx prisma studio
```

## Daily Backup Setup (Windows Task Scheduler)

1. Edit `backup.bat` — set `BACKUP_DIR` to your OneDrive/Google Drive path.
2. Open Task Scheduler (`Win+R` → `taskschd.msc`)
3. **Create Basic Task** → Daily → 11:50 PM
4. Action: Start a Program → browse to `backup.bat`
5. Start in: `C:\Users\moham\Desktop\hive`

Backups saved as `db_backup_HIVE_YYYY-MM-DD.db`.

## Tech Stack

Next.js 16 · Prisma 7 (SQLite) · Tailwind CSS v4 · Zustand · lucide-react · xlsx

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
