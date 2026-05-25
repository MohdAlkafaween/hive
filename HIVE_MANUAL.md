# HIVE — Complete User Manual & Technical Documentation

**Version:** 1.0
**Last Updated:** May 25, 2026
**System:** HIVE Coworking Space Management System
**Developed for:** Hive.space Study House — Amman, Jordan

---

## Table of Contents

1. [What is HIVE?](#1-what-is-hive)
2. [Installation Guide (New PC Setup)](#2-installation-guide-new-pc-setup)
3. [Starting & Stopping the App](#3-starting--stopping-the-app)
4. [Staff Roles & Permissions](#4-staff-roles--permissions)
5. [Login Page](#5-login-page)
6. [The Sidebar (Navigation)](#6-the-sidebar-navigation)
7. [Page 1: Dashboard (Main Check-In Screen)](#7-page-1-dashboard--main-check-in-screen)
8. [Page 2: Student Directory](#8-page-2-student-directory)
9. [Page 3: Logs](#9-page-3-logs)
10. [Page 4: Statistics](#10-page-4-statistics)
11. [Page 5: Barista POS (Point of Sale)](#11-page-5-barista-pos)
12. [Page 6: Admin Panel](#12-page-6-admin-panel)
13. [Page 7: Kiosk Mode (Student Check-In Screen)](#13-page-7-kiosk-mode)
14. [Subscription Plans & Pricing](#14-subscription-plans--pricing)
15. [RFID Card System](#15-rfid-card-system)
16. [Database & Backups](#16-database--backups)
17. [Data Structure (What Gets Stored)](#17-data-structure)
18. [Keyboard Shortcuts](#18-keyboard-shortcuts)
19. [Daily Workflow (How to Use HIVE Day-to-Day)](#19-daily-workflow)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. What is HIVE?

HIVE is a complete management system for running a coworking/study space. It handles:

- **Student registration** — adding new members with their name, phone, major, and RFID card
- **Subscriptions** — selling Daily, Weekly, or Monthly plans with automatic expiry tracking
- **Check-in/Check-out** — tracking who is in the building right now via RFID cards or manual search
- **Barista coffee bar** — a point-of-sale system for selling drinks and snacks
- **Promo codes** — creating discount codes (fixed amount or percentage) for subscriptions
- **Statistics & reporting** — daily revenue reports with Excel export
- **Staff management** — multiple staff accounts with different access levels
- **Audit trail** — logging every staff login/logout for accountability

The entire system runs **locally on your computer** — no internet required, no cloud subscription, no monthly fees. Your data stays on your machine.

---

## 2. Installation Guide (New PC Setup)

### What You Need

- A Windows 10 or 11 computer
- An internet connection (only needed during installation)
- An RFID USB card reader (optional — the system works without it)
- About 500MB of free disk space

### Step-by-Step Installation

#### Step 1: Install Node.js

1. Open your web browser and go to: **https://nodejs.org**
2. Download the **LTS** version (the green button on the left)
3. Run the installer — click **Next** on every screen, keep all defaults
4. When it finishes, restart your computer

**How to verify it worked:**
- Press `Windows key + R`, type `cmd`, press Enter
- In the black command window, type: `node --version`
- You should see a version number like `v24.15.0`
- Type: `npm --version`
- You should see a version number like `10.x.x`
- If both show version numbers, Node.js is installed correctly

#### Step 2: Copy the HIVE Folder

1. Copy the entire `hive` folder to the new computer
2. Place it somewhere easy to find, like `C:\Users\YourName\Desktop\hive`
3. Make sure the folder contains files like `package.json`, `prisma`, `src`, etc.

#### Step 3: Install Dependencies

1. Press `Windows key + R`, type `cmd`, press Enter
2. Navigate to the HIVE folder by typing:
   ```
   cd C:\Users\YourName\Desktop\hive
   ```
   (Replace `YourName` with your actual Windows username)
3. Type the following command and press Enter:
   ```
   npm install
   ```
4. Wait for it to finish (this may take 2-5 minutes)
5. You will see some warnings — that is normal, ignore them

#### Step 4: Set Up the Database

1. In the same command window, type:
   ```
   npx prisma generate
   ```
2. Then type:
   ```
   npx prisma db push
   ```
3. This creates the database file (`dev.db`) in the hive folder

#### Step 5: Set Up the Admin Account

1. In the same command window, type:
   ```
   npm run dev
   ```
2. Wait until you see "Ready" in the console
3. Open a **new** command window (Windows + R, cmd, Enter)
4. Type:
   ```
   curl -X POST http://localhost:3000/api/auth/seed
   ```
5. This creates the default admin account

#### Step 6: Set the Secret Key

1. Open the file `hive\.env` in Notepad
2. Change the line:
   ```
   JWT_SECRET="change-me-in-production-use-openssl-rand"
   ```
   To something long and random, like:
   ```
   JWT_SECRET="myHiveStudyHouse2026SecretKeyThatIsVeryLongAndRandom123!@#"
   ```
3. Save the file
4. Restart the app (see Section 3)

**Installation is complete!**

#### Step 7 (Optional): Set Up Daily Backup

1. Open the file `hive\backup.bat` in Notepad
2. Change the `BACKUP_DIR` line to point to your backup folder:
   ```
   set BACKUP_DIR=C:\Users\YourName\OneDrive\HIVE_Backups
   ```
   (Use your Google Drive, OneDrive, or a USB drive path)
3. Open **Windows Task Scheduler** (search for it in the Start menu)
4. Click "Create Basic Task"
5. Name it "HIVE Backup"
6. Set it to run **Daily** at **11:50 PM**
7. Action: "Start a Program" — browse to `hive\backup.bat`
8. Click Finish

---

## 3. Starting & Stopping the App

### Starting HIVE

1. Open a command window (Windows + R, type `cmd`, Enter)
2. Navigate to the HIVE folder:
   ```
   cd C:\Users\YourName\Desktop\hive
   ```
3. Type:
   ```
   npm run dev
   ```
4. Wait until you see something like: `Ready in X.Xs`
5. Open **Google Chrome** and go to: **http://localhost:3000**
6. The login page will appear

**Tip:** You can create a desktop shortcut:
1. Right-click on the Desktop, choose New > Shortcut
2. For the location, type: `cmd /k "cd C:\Users\YourName\Desktop\hive && npm run dev"`
3. Name it "Start HIVE"
4. Now you just double-click this shortcut to start the app

### Stopping HIVE

1. Go to the command window where HIVE is running
2. Press `Ctrl + C`
3. If it asks "Terminate batch job?", type `Y` and press Enter

**Important:** The command window must stay open while HIVE is running. If you close it, the app stops.

---

## 4. Staff Roles & Permissions

HIVE has three staff roles. Each role can only see and do certain things:

| Feature | ADMIN | BARISTA | REGISTRATION COUNTER |
|---------|-------|---------|---------------------|
| Dashboard (check-ins) | Yes | No | Yes |
| Student Directory | Yes | No | Yes |
| Logs (history) | Yes | No | Yes |
| Statistics & Export | Yes | No | No |
| Barista POS | Yes | Yes | No |
| Admin Panel | Yes | No | No |
| Kiosk Mode | Yes | No | Yes |
| Reset passwords | Yes | No | No |
| Create promo codes | Yes | No | No |
| View audit logs | Yes | No | No |
| Create staff accounts | Yes | No | No |

### Default Admin Account

- **Email:** `Hive.study@admin.jordan`
- **Password:** `admin123`

**Change this password immediately after first login** using the Admin Panel > Staff & Passwords tab.

---

## 5. Login Page

**URL:** `http://localhost:3000/login`

This is the first screen you see. It has two fields:

| Input | What to Enter |
|-------|--------------|
| **EMAIL** | Your staff email address (e.g., `Hive.study@admin.jordan`) |
| **PASSWORD** | Your password |

**Button:**
- **Sign In** — Checks your credentials and logs you in. If correct, you are taken to the Dashboard (or Barista POS if you are a Barista).

**What can go wrong:**
- "Invalid credentials" — wrong email or password
- "Too many login attempts" — you tried too many times. Wait 15 minutes and try again.

**Note:** The login page has no navigation bar, no sidebar, no footer. It is a clean full-screen card.

---

## 6. The Sidebar (Navigation)

After logging in, you will see a thin dark sidebar on the left side of the screen. It contains icon buttons for navigating between pages. **Hover over any icon** to see a tooltip with the page name.

The icons you see depend on your role:

| Icon | Page | Visible To |
|------|------|-----------|
| Checkmark person | Dashboard | Admin, Counter |
| Two people | Directory | Admin, Counter |
| Scroll | Logs | Admin, Counter |
| Bar chart | Statistics | Admin only |
| Coffee cup | Barista POS | Admin, Barista |
| Shield | Admin Panel | Admin only |
| Scan line | Kiosk Mode | Admin, Counter |

The **Kiosk Mode** button opens in a **new browser tab** so your main workspace is not disrupted.

At the bottom of the sidebar you will see keyboard shortcut hints: **F1**, **F2**, **Esc**.

### Top Navigation Bar

At the very top of the screen there is a bar showing:
- **HIVE** logo (left side)
- **SCANNER: ARMED** badge (shows if the RFID listener is active)
- Your **email** and **role** badge (right side)
- **Logout** arrow button (far right) — click to sign out

---

## 7. Page 1: Dashboard (Main Check-In Screen)

**URL:** `http://localhost:3000/`
**Who can access:** Admin, Registration Counter

This is the primary screen used by the front desk staff. It has two main sections:

### Top Section — Search & Add Student

| Element | What It Does |
|---------|-------------|
| **Search bar** | Type a student's name or phone number to find them. Results appear as you type. Press **F1** to quickly focus the search bar. |
| **ADD NEW STUDENT (F2) button** | Opens the Add Student form to register a new member. You can also press the **F2** key. |

### When You Search and Select a Student

After selecting a student from search results, a **check-in card** appears showing:
- Student name and phone
- Current subscription status (plan type, expiry date, visits used/remaining)
- A green **Check In** button — click to check the student in

**Status indicators after check-in:**
- **Green (Success):** Student checked in successfully. Shows visits remaining.
- **Yellow (Warning):** Student can check in but their subscription is near expiry or low on visits.
- **Red (Error):** Subscription expired or no active subscription. Student cannot check in.

Press **Esc** to close the check-in card.

### Bottom Section — Today's Check-Ins

A live table showing everyone who checked in today:

| Column | What It Shows |
|--------|-------------|
| **Student Name** | Full name (clickable — takes you to their profile in Directory) |
| **Phone** | Phone number |
| **Check-In Time** | When they arrived |
| **Check-Out Time** | When they left (empty if still here) |
| **Status** | "Checked In" (green) or "Checked Out" (gray) |
| **Action** | "Check Out" button — click to check the student out |

The **refresh button** (circular arrow icon) at the top-right of the table reloads the data.

### Add Student Modal (F2)

When you click "ADD NEW STUDENT" or press F2, a popup form appears with these steps:

**Step 1 — Student Information:**

| Field | Required? | What to Enter |
|-------|-----------|--------------|
| **Full Name** | Yes | Student's full name |
| **Phone Number** | Yes | Must be a valid Jordanian number (07XXXXXXXX) |
| **Major/Field** | No | Their university major (optional) |
| **RFID Card** | No | Tap the student's card on the reader to assign it. The field shows "Listening..." with a golden glow when active. |

**Step 2 — Subscription Plan:**

| Field | What to Choose |
|-------|---------------|
| **Plan Type** | Daily (3 JD), Weekly (15 JD), or Monthly (50 JD) — click the plan card |
| **Payment Method** | Cash, CliQ, eFAWATEERcom, or Credit Card |
| **Promo Code** | Optional — type a code and click "Apply" for a discount |
| **Custom Amount** | Toggle to override the default price |

**Buttons:**
- **Back** — Go back to Step 1
- **Create Student & Start Subscription** — Saves everything and creates the student

**Step 3 — Success:**
Shows a confirmation with the student's details and a receipt breakdown.

---

## 8. Page 2: Student Directory

**URL:** `http://localhost:3000/directory`
**Who can access:** Admin, Registration Counter

A searchable list of every registered student.

### Directory List View

| Element | What It Does |
|---------|-------------|
| **Search bar** | Filter students by name, phone, or major |
| **Total count** | Shows how many students are registered |
| **Student table** | Lists all students with name, phone, subscription status, and total check-ins |

Each student row shows:
- **Name** and **phone**
- **Subscription badge** — "Active" (green) with plan type, or "Expired" (red), or "No Sub" (gray)
- **Check-ins count** — lifetime total visits
- **Arrow button** — click to open their full profile

### Student Profile View

When you click on a student, their full profile opens:

**Top Section — Student Info Card:**
- Full name, phone, major, RFID card UUID
- Registration date
- Lifetime check-ins count
- **Edit button** — modify name, phone, major
- **Back button** — return to directory list

**Subscription Section:**
- Current active subscription details (plan type, start date, expiry date, visits used/allowed)
- Status badge (Active or Expired)
- **Renew Subscription button** — opens the renewal form

**Renew Subscription Form:**

| Field | What to Enter |
|-------|--------------|
| **Plan Type** | Daily, Weekly, or Monthly (click the card) |
| **Payment Method** | Cash, CliQ, eFAWATEERcom, or Credit Card |
| **Promo Code** | Optional discount code |
| **Custom Amount** | Optional price override |

- **Confirm Renewal** button saves the new subscription
- **Cancel** button closes the form

**RFID Section:**
- Shows the currently assigned RFID card UUID
- **Assign/Reassign RFID** button — tap a card on the reader to link it to this student
- **Remove RFID** button — unlinks the card from the student

**Check-In History:**
- A table of all past check-ins for this student
- Shows date, check-in time, check-out time

**Transaction History:**
- A table of all payments made by this student
- Shows date, plan type, amount paid, discount, payment method

---

## 9. Page 3: Logs

**URL:** `http://localhost:3000/logs`
**Who can access:** Admin, Registration Counter

A historical record browser with two tabs:

### Check-In Logs Tab

Shows a calendar-style list of dates. Each date shows how many check-ins happened that day.

| Element | What It Does |
|---------|-------------|
| **Date cards** | Click any date to see all check-ins for that day |
| **Search bar** | Filter check-in records by student name |
| **Log entries** | Each entry shows: student name, phone, check-in time, check-out time |
| **Student name link** | Click to go to that student's profile in the Directory |

### Barista Logs Tab

Shows a calendar-style list of dates with daily revenue totals.

| Element | What It Does |
|---------|-------------|
| **Date cards** | Click any date to see all barista orders for that day |
| **Order entries** | Each entry shows: item name, quantity, total price, time |

---

## 10. Page 4: Statistics

**URL:** `http://localhost:3000/stats`
**Who can access:** Admin only

Daily financial and activity dashboard.

### Date Selector
- **Date picker** at the top — choose any date to view its statistics
- Defaults to today's date

### Summary Cards

Four cards at the top showing:

| Card | What It Shows |
|------|-------------|
| **Revenue** | Total money collected that day (in JD) |
| **Discounts** | Total discount amount given via promo codes |
| **Check-Ins** | Number of students who checked in |
| **Revenue by Gateway** | Breakdown by payment method (Cash, CliQ, etc.) |

### Transaction Table

A detailed table of every transaction for the selected date:

| Column | What It Shows |
|--------|-------------|
| **Student** | Who made the payment |
| **Plan** | Subscription type (Daily/Weekly/Monthly) |
| **Gateway** | Payment method used |
| **Amount** | Amount paid (in JD) |
| **Discount** | Discount applied |
| **Time** | When the transaction happened |

### Export to Excel Button

- **Export to Excel** — Downloads an `.xlsx` file with all the statistics data
- The file includes: transactions, check-ins, revenue summary
- File is named with the date (e.g., `HIVE_Stats_2026-05-25.xlsx`)

---

## 11. Page 5: Barista POS

**URL:** `http://localhost:3000/barista`
**Who can access:** Admin, Barista

The coffee bar point-of-sale system. Split into two sections:

### Left Side — Menu Management

Shows all menu items as cards with an image, name, and price.

**For each menu item:**

| Element | What It Does |
|---------|-------------|
| **Item card** | Shows the item image, name, and price |
| **Out of Stock toggle** | Mark an item as unavailable (grays it out) |
| **Delete button (trash icon)** | Remove the item from the menu permanently |

**Add New Item Form (at the bottom):**

| Field | What to Enter |
|-------|--------------|
| **Item Name** | Name of the drink/snack (e.g., "Cappuccino") |
| **Price (JD)** | Price in Jordanian Dinars (e.g., "2.50") |
| **Image** | Upload a photo of the item (optional, max 5MB) |

- **Add Item** button saves the new menu item

### Right Side — Place Orders

**For each available menu item:**
- Shows item name, price, and a **quantity selector** (- / + buttons)
- Adjust quantity and click the **order button** (cart icon) to place the order

**Today's Orders (bottom):**
- A list of all orders placed today
- Shows: item name, quantity, total price, time
- **Delete button** — remove an order if it was a mistake

---

## 12. Page 6: Admin Panel

**URL:** `http://localhost:3000/admin`
**Who can access:** Admin only

The admin control center has three tabs:

### Tab 1: Promo Codes

Manage discount codes for subscriptions.

**Existing Promo Codes List:**
Each promo code shows:
- **Code name** (e.g., "WELCOME20")
- **Discount** — "10 JD off" or "20% off"
- **Usage counter** — "3/10 used" (times used / maximum uses)
- **Status** — Active (green) or Inactive
- **Expand arrow** — click to see who used the promo code
- **Toggle button (eye icon)** — activate or deactivate the code
- **Delete button (trash icon)** — permanently remove the code

**Create New Promo Code Form (+ New Promo Code button):**

| Field | What to Enter |
|-------|--------------|
| **Code** | The promo code text (e.g., "STUDENT50") — auto-converts to UPPERCASE |
| **Discount Type** | "Fixed Amount (JD)" or "Percentage (%)" — click the tab |
| **Discount Value** | The amount off (e.g., 10 for 10 JD off, or 20 for 20% off) |
| **Max Uses** | How many times the code can be used total (0 = unlimited) |
| **Expiry Date** | Optional — when the code stops working |

- **Create Promo Code** button saves the new code

### Tab 2: Staff & Passwords

Manage staff accounts and reset passwords.

**Staff List:**
Each staff member shows:
- **Email address**
- **Role badge** (ADMIN, BARISTA, or COUNTER)
- **Join date**
- **Reset button** — click to reset their password

**Reset Password Flow:**
1. Click "Reset" next to a staff member
2. A password input field appears inline
3. Type the new password (must be at least 8 characters, with a letter and a number)
4. Click "Confirm Reset"
5. A green success message appears for 2.5 seconds

**Create New Account (+ New Account button):**

| Field | What to Enter |
|-------|--------------|
| **Email** | The staff member's email address |
| **Password** | A strong password (8+ chars, letter + number) |
| **Role** | "Registration Counter" or "Barista" (dropdown) |

- **Create Account** button saves the new staff account

**Note:** You cannot create another ADMIN account through this form. Only ADMIN and the initial seed command can create admin accounts.

### Tab 3: Staff Audit Log

A security log showing every staff login and logout event.

**Filters:**
- **All Events** dropdown — filter by event type (Logins, Logouts, Password Resets)
- **All Staff** dropdown — filter by specific staff member

**Audit Log Table:**

| Column | What It Shows |
|--------|-------------|
| **Event** | LOGIN (green badge), LOGOUT (red badge), or PASSWORD_RESET (golden badge) |
| **Staff Member** | Email of the staff who performed the action |
| **Role** | Their role at the time of the event |
| **IP Address** | Where the action came from |
| **Details** | Extra context (e.g., "Admin reset their own password") |
| **Time** | When it happened |

**Pagination:** Navigate between pages of results using the arrow buttons at the bottom.

---

## 13. Page 7: Kiosk Mode

**URL:** `http://localhost:3000/checkin` (opens in new tab)
**Who can access:** Everyone (no login required — this is the student-facing screen)

This is the screen you put on a **separate monitor or tablet** facing the students. It allows them to check themselves in.

### Two Modes:

**Search Tab (default):**

| Element | What It Does |
|---------|-------------|
| **Search bar** | Student types their name or phone number |
| **Results list** | Shows matching students |
| **Check In button** | Click to check in — shows success/error message |

Each student result shows:
- Name, phone, major
- Active subscription info (plan type, visits remaining, expiry)
- A green **Check In** button (or red if subscription expired)

**RFID Tab:**
- Shows a large scan animation
- When a student taps their RFID card on the reader, it automatically processes the check-in
- Shows the result (success with student name, or error if not found/expired)

**Status Messages:**
- **Green:** "Welcome, [Name]!" — check-in successful, shows visits remaining
- **Yellow:** "Almost there" — subscription is nearly expired or low on visits
- **Red:** "Not Found" or "Subscription Expired" — cannot check in

---

## 14. Subscription Plans & Pricing

HIVE has three subscription plans:

| Plan | Price | Duration | Visit Limit |
|------|-------|----------|------------|
| **Daily** | 3 JD | 1 day (expires at midnight) | Unlimited for the day |
| **Weekly** | 15 JD | 10 calendar days | 7 visits |
| **Monthly** | 50 JD | 40 calendar days | 30 visits |

**How subscriptions work:**
- When a student buys a plan, the start date is today and the expiry date is calculated automatically
- For Weekly: the student gets 10 actual days but can visit only 7 of them (allows for rest days)
- For Monthly: the student gets 40 actual days but can visit only 30 of them
- A subscription expires when EITHER the date passes OR all visits are used up (whichever comes first)
- Daily subscriptions have no visit limit — they expire at 11:59 PM the same day
- When a subscription expires, the student must purchase a new one

**Payment Methods:**
- Cash
- CliQ (Jordan's instant payment system)
- eFAWATEERcom (Jordan's bill payment system)
- Credit Card

---

## 15. RFID Card System

### What You Need

- A **USB RFID card reader** (any USB HID keyboard-emulation reader)
- RFID cards or tags compatible with your reader (typically 125kHz EM4100 or 13.56MHz MIFARE)

### How It Works

1. The RFID reader plugs into the computer's USB port
2. It acts like a keyboard — when a card is scanned, it "types" the card's unique ID
3. HIVE listens for these keyboard inputs in the background
4. When it detects an RFID scan, it looks up the student linked to that card

### Assigning Cards to Students

**Method 1 — During Registration (Add Student form):**
1. Open the Add Student form (F2)
2. Fill in the student's info
3. In the "RFID Card" section, click the RFID field — it shows "Listening..."
4. Tap the card on the reader
5. The card UUID appears in the field
6. Continue with registration

**Method 2 — After Registration (Student Profile):**
1. Go to Directory, find the student, open their profile
2. Scroll to the RFID section
3. Click "Assign RFID" (or "Reassign RFID" if they already have one)
4. Tap the card on the reader
5. Done

### Using Cards for Check-In

**From the Dashboard:**
- The RFID listener runs in the background
- When a card is scanned, a fullscreen overlay appears showing the check-in result
- The overlay auto-dismisses after a few seconds

**From the Kiosk (student-facing screen):**
- Switch to the "RFID" tab
- The screen shows "Ready to Scan"
- Students tap their card, see their name and status

### Troubleshooting RFID

- **"Scanner: ARMED"** in the top bar means the listener is active
- If scanning doesn't work, click on the page once (the page needs to be in focus)
- Make sure no text input field is focused — the RFID reader "types" into whatever is active
- If a card shows "Not Found," the card is not linked to any student — assign it in their profile

---

## 16. Database & Backups

### Where is the Data Stored?

All data is stored in a single file: `hive\dev.db`

This is an **SQLite database** file. It contains everything: students, subscriptions, check-in logs, barista orders, transactions, promo codes, staff accounts, and audit logs.

### Automatic Backups

The `backup.bat` script copies `dev.db` to your backup folder with a date stamp.

**To set up automatic daily backups:**
1. Edit `backup.bat` and change the `BACKUP_DIR` to your preferred location
2. Schedule it in Windows Task Scheduler (see Installation Guide, Step 7)

**Backup files are named:** `db_backup_HIVE_2026-05-25.db`

### Manual Backup

To make a quick manual backup:
1. Make sure HIVE is stopped (Ctrl+C in the command window)
2. Copy the file `hive\dev.db` to a safe location (USB drive, cloud folder, etc.)
3. Restart HIVE

### Restoring from Backup

If something goes wrong and you need to restore:
1. Stop HIVE (Ctrl+C)
2. Rename the current `dev.db` to `dev.db.broken` (keep it just in case)
3. Copy your backup file and rename it to `dev.db`
4. Start HIVE again

**Important:** Never delete `dev.db` while HIVE is running. Always stop the app first.

---

## 17. Data Structure

Here is everything HIVE stores and how the pieces connect:

### Students
- Full name, phone number (unique — no two students can have the same phone)
- Major/field of study (optional)
- RFID card UUID (optional, unique)
- Registration date
- Lifetime check-in count

### Subscriptions (linked to a Student)
- Plan type (Daily, Weekly, Monthly)
- Start date and expiry date
- Total visits allowed and visits used
- Active/inactive status
- A student can have multiple subscriptions over time (only the latest active one matters)

### Check-In Logs (linked to a Student)
- Check-in time
- Check-out time (empty if still checked in)
- Date string (for easy daily grouping)

### Transactions (linked to a Student)
- Amount paid
- Plan type purchased
- Payment method (Cash, CliQ, eFAWATEERcom, Credit Card)
- Discount amount (if a promo code was used)
- Date/time

### Menu Items
- Item name, price
- Image URL (optional)
- Out-of-stock flag

### Barista Orders (linked to a Menu Item)
- Quantity ordered
- Total price
- Date/time

### Promo Codes
- Code text (unique, uppercase)
- Discount type (AMOUNT = fixed JD, PERCENTAGE = percent off)
- Discount value
- Max uses (0 = unlimited)
- Times used counter
- Expiry date (optional)
- Active/inactive

### Promo Usages (links Promo Code to Student)
- Which promo code was used
- Which student used it
- How much discount was applied
- Date/time

### Staff Users
- Email (unique)
- Password (hashed — not stored in plain text)
- Role (ADMIN, BARISTA, or REGISTERATION_COUNTER)
- Account creation date

### Staff Audit Logs (linked to a User)
- User email and role (at time of event)
- Event type (LOGIN, LOGOUT, PASSWORD_RESET_BY_ADMIN)
- IP address
- Extra details
- Timestamp

---

## 18. Keyboard Shortcuts

| Key | What It Does | Where It Works |
|-----|-------------|---------------|
| **F1** | Focus the search bar | Dashboard |
| **F2** | Open "Add New Student" form | Dashboard |
| **Esc** | Close the current popup/overlay/card | Everywhere |

---

## 19. Daily Workflow

Here is how a typical day looks when using HIVE:

### Opening (Start of Day)

1. Turn on the computer
2. Double-click the "Start HIVE" shortcut (or open cmd and run `npm run dev`)
3. Open Chrome and go to `http://localhost:3000`
4. Log in with your staff account
5. If using a kiosk screen: click the "Kiosk Mode" icon in the sidebar (opens in new tab), drag the new tab to the student-facing screen

### During the Day — Registration Counter Staff

**When a new student walks in:**
1. Press **F2** to open the Add Student form
2. Fill in their name and phone number
3. Select their subscription plan (Daily/Weekly/Monthly)
4. Choose payment method
5. Apply promo code if they have one
6. Click "Create Student"
7. If they want an RFID card, hand them a card and tap it on the reader during registration

**When a returning student arrives:**
- **With RFID card:** They tap their card — the overlay shows their status automatically
- **Without RFID card:** Search by name or phone (F1), select them, click "Check In"

**When a student leaves:**
- Find them in the "Today's Check-Ins" table
- Click the "Check Out" button next to their name

**When a student needs to renew:**
- Go to Directory, find the student, open their profile
- Click "Renew Subscription"
- Select the new plan and payment method
- Click "Confirm Renewal"

### During the Day — Barista Staff

1. Log in with barista account
2. You will see the Barista POS page
3. When a customer orders, adjust the quantity for each item
4. Click the order button to record the sale

### End of Day — Admin

1. Check the **Statistics** page for today's revenue
2. Click **Export to Excel** to download the daily report
3. Check the **Admin Panel > Staff Audit Log** to review staff activity
4. The automatic backup runs at 11:50 PM (if configured)
5. Close HIVE (Ctrl+C in the command window)

---

## 20. Troubleshooting

### "The page won't load" / "localhost:3000 not working"

- Make sure the command window is open and HIVE is running (you should see "Ready" in the console)
- Check that you typed the address correctly: `http://localhost:3000` (not https)
- Try refreshing the page (F5)

### "I forgot the admin password"

If you forgot the admin password and cannot log in:
1. Stop HIVE (Ctrl+C)
2. Open a command window in the hive folder
3. Run: `curl -X POST http://localhost:3000/api/auth/seed`
4. This resets the admin account to `admin123`
5. Log in and change the password immediately

If the seed doesn't work (admin already exists), you'll need to delete and recreate the database:
1. Stop HIVE
2. Delete `dev.db` from the hive folder
3. Run: `npx prisma db push`
4. Start HIVE: `npm run dev`
5. Run the seed: `curl -X POST http://localhost:3000/api/auth/seed`
6. **Warning:** This erases ALL data (students, subscriptions, everything)

### "RFID scanner not working"

- Make sure the USB reader is plugged in
- Click once on the HIVE page (it needs focus)
- Check that "SCANNER: ARMED" shows in the top bar
- Try scanning the card — if nothing happens, the reader might need drivers

### "Student says their subscription should still be valid"

1. Go to Directory, find the student, open their profile
2. Check the subscription details: expiry date and visits used
3. If the date has passed or all visits are used, the subscription is correctly expired
4. If there is an error, you can renew their subscription

### "The app crashed / shows an error"

1. Go to the command window and press Ctrl+C to stop HIVE
2. Run `npm run dev` again to restart
3. Refresh the browser page
4. If the error persists, check the command window for error messages

### "How do I move HIVE to a new computer?"

1. Copy the entire `hive` folder to the new computer
2. Make sure to include the `dev.db` file (this has all your data)
3. Follow the Installation Guide (Section 2) from Step 1
4. At Step 4, skip "npx prisma db push" since you already have a database
5. Just run `npx prisma generate` and then `npm run dev`

### "Can multiple people use HIVE at the same time?"

Yes! Since HIVE runs on one computer but is accessed through a web browser, you can:
- Open multiple browser tabs on the same computer
- Access it from other computers on the same network by using the computer's IP address instead of "localhost" (e.g., `http://192.168.1.100:3000`)
- The kiosk screen and the staff screen can run simultaneously

---

*This manual covers HIVE version 1.0. For technical questions or issues not covered here, consult the development team.*
