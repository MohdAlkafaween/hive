# HIVE — Xprinter XP-Q80C Printer Setup Guide

A one-time setup guide to connect the thermal receipt printer and get HIVE printing
receipts. No technical knowledge required — follow the steps in order. Once
configured, receipts print automatically with no extra steps.

## Printer Specifications

| Spec | Value |
|------|-------|
| Model | Xprinter XP-Q80C |
| Serial | XPQ80C-BLU2402280213 |
| Paper | 80mm thermal roll |
| Print speed | 230 mm/s |
| Interfaces | USB + LAN (Ethernet) |
| Command set | ESC/POS |
| Cash drawer port | RJ11, 24V 1A |
| Power input | 24V, 2.5A (use the supplied power brick only) |
| Manufacturer | Zhuhai Xprinter Electronics Technology Co., Ltd |

## What You Need

- The XP-Q80C printer + power brick
- 80mm thermal paper roll
- USB cable (Option A) **or** LAN cable to your router/switch (Option B)
- A Windows PC with Chrome (or Edge) running HIVE

---

## Option A: USB Connection (Simplest — one computer prints)

### Step A1: Install the driver
1. Download the Windows driver from the official site
   (https://www.xprintertech.com/download) or use the mini-CD in the printer box.
2. Run the installer. When asked for the model, select **XP-Q80C**
   (if not listed, **XP-Q80** works — same print engine).
3. Choose **USB** as the port and finish.

### Step A2: Connect and load paper
1. Plug the USB cable into the printer and the PC.
2. Load the 80mm roll: open the top cover, drop the roll in so the paper feeds
   **from underneath toward you** (thermal/shiny side faces the print head — if
   receipts come out blank, flip the roll).
3. Power on (switch at the back). The blue power light should be steady.
4. Open **Settings → Devices → Printers & Scanners** and verify the
   **XP-Q80C** appears.

### Step A3: Set as default printer → go to [Step 3](#step-3-set-as-default-printer) below.

---

## Option B: LAN / Network Connection (Recommended — any till PC on the network prints)

### Step 1: Find the Printer's IP Address

1. Make sure the printer is **turned off**
2. Hold the **FEED** button on the printer
3. While still holding FEED, turn the printer **on**
4. The printer prints a self-test page automatically
5. Look for the **IP Address** on the printed page (e.g., `192.168.1.100`)
6. Write down this IP address — you will need it in Step 2

> **Tip:** If the IP address shows `0.0.0.0` or `169.x.x.x`, the printer is not
> connected to the network properly. Check the LAN cable and try again.
> If the printed IP is in a different range than your network (factory default is
> often `192.168.123.100`), set a static IP via the printer's web page — see
> "Printer IP changed" in Troubleshooting.

### Step 2: Add the Printer to Windows (repeat on every till PC)

1. Open **Settings** (Windows key + I)
2. Click **Devices** → **Printers & Scanners**
3. Click **Add a printer or scanner**
4. Wait a moment, then click **The printer that I want isn't listed**
5. Select **Add a printer using a TCP/IP address or hostname** → **Next**
6. Enter the IP from Step 1 (e.g., `192.168.1.100`). Port name auto-fills
   (standard RAW port **9100**)
7. Keep **Query the printer and automatically select the driver** checked → **Next**
8. When asked for a driver:
   - If **Xprinter / XP-Q80C** appears (install the driver from Option A Step A1
     first for best results), select it
   - Otherwise select **Generic / Text Only** (works, but the Xprinter driver
     handles paper sizing better)
9. Name the printer: **HIVE Receipt Printer** → **Finish**

### Step 3: Set as Default Printer

1. **Settings → Devices → Printers & Scanners**
2. Turn **OFF** "Let Windows manage my default printer"
3. Click the printer → **Manage** → **Set as default**

> This matters: HIVE prints with the browser's `window.print()`, which targets the
> **default** printer. If an A4 office printer is the default, receipts go there.

### Step 4: Test Print from Chrome

1. Open Chrome → HIVE → log in as staff
2. Create a test barista order (you can void it later)
3. Click the **Print** button — a receipt window opens and the print dialog appears
4. Destination: **HIVE Receipt Printer**
5. **Margins: None** · **Scale: 100% (Default)** · **Headers and footers: OFF**
6. Click **Print** — Chrome remembers these settings for future prints

### Step 5: Silent Printing — Skip the Print Dialog (recommended for the till)

By default the browser asks for confirmation on every print. To print instantly
with zero clicks:

1. Close all Chrome windows
2. Create a desktop shortcut to Chrome with this target:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing
   ```
   (Edge equivalent: `msedge.exe --kiosk-printing`)
3. Always open HIVE from that shortcut on the till computer
4. Receipts now print straight to the default printer, no dialog

> **Note:** `--kiosk-printing` silently prints **everything** from that browser
> instance to the default printer — use the shortcut only on the till machine.

---

## How HIVE Prints Receipts

HIVE uses the browser's built-in printing — no plugins inside the app:

1. When a receipt should print, HIVE opens a small popup window with the receipt
   page (e.g., `/barista/receipt/123`).
2. The page is styled for thermal paper: `@page { size: 80mm auto; margin: 0 }`,
   monochrome, `Courier New`, 80mm body width.
3. The page fetches receipt data from a **staff-authenticated API**, renders it,
   waits 400ms, then calls `window.print()` automatically.
4. After printing, the `afterprint` event fires and the window closes itself.
   ("Print Again" and "Close" buttons are shown on screen and hidden on paper.)

## Receipt Types in HIVE

| Receipt | Printed when | Print page | Data API |
|---------|--------------|-----------|----------|
| **Barista order** | Staff completes a walk-in POS sale (Print button in the receipt modal) | `/barista/receipt/[id]` | `GET /api/barista/orders/[id]/receipt` (staff auth) |
| **Customer order** | Staff completes a customer's online order — **auto-opens on completion**; manual 🖨 button stays on completed orders | `/customer-order/receipt/[orderGroupId]` | `GET /api/orders/[id]/receipt` (staff auth, **COMPLETED orders only**) |
| **Subscription** | Staff sells/renews a subscription (Print button in the receipt modal) | `/subscription/receipt/[transactionId]` | `GET /api/transactions/[id]/receipt` (staff auth) |

All three share the same 80mm layout: logo + business name header, receipt number,
date/time (Amman timezone), cashier name, itemized lines with options, total in JD,
payment method, and a configurable footer message (Admin → Settings).

## Receipt File Saving (digital copies)

In addition to paper, HIVE can archive every receipt as a JSON file:

1. **Admin Panel → Settings → Receipt Save Path** — enter an **absolute** folder
   path (e.g., `C:\HIVE-Receipts`)
2. Click **Test Path** — HIVE verifies the folder exists and is writable
3. Every receipt is then saved as `<type>_<RCP-number>_<YYYYMMDD_HHMMSS>.json`
   inside monthly subfolders (e.g., `2026-06\`)
4. Saving is fire-and-forget: if the folder is unavailable, sales and printing are
   never blocked — failures are only logged on the server

## Paper

- Width: **80mm** thermal rolls. Do not use 58mm.
- Thermal paper prints on one side only — blank output means the roll is flipped.
- Store rolls away from heat and direct sunlight (thermal paper darkens over time).

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Receipt doesn't print at all | Printer powered on (blue light)? LAN/USB cable firmly connected? XP-Q80C set as **default** printer? Print dialog hidden behind another window? |
| Receipt prints on the office A4 printer | Wrong default printer — set HIVE Receipt Printer as default and disable "Let Windows manage my default printer" |
| Print dialog appears every time | Launch Chrome/Edge with `--kiosk-printing` (Step 5) |
| Wrong printer pre-selected in dialog | Change destination once — the browser remembers it |
| Receipt too wide / cut off | Margins **None**, Scale **100%**; verify driver paper size is 80mm not 58mm |
| Receipt prints blank | Paper roll upside down — thermal (shiny) side must face the print head |
| Headers/footers (URL, date) on receipts | Uncheck "Headers and footers" in the print dialog once |
| Receipt window doesn't auto-close | Browser blocked `window.close()` — allow popups for HIVE's address |
| Paper jam | Open the top cover with the release lever, remove jammed paper, close until it clicks, press FEED |
| Printer not found on network | Print the self-test to confirm the IP; verify the PC is on the same subnet; `ping` the IP |
| Self-test prints but HIVE doesn't | The printer is fine — recheck Windows default printer and browser dialog settings |

### Printer IP changed (network printing stopped working)

This happens when the router assigns addresses dynamically (DHCP):
1. Print a new self-test page to find the current IP
2. Remove and re-add the printer in Windows with the new IP
3. **Better — set a static IP** using the printer's built-in web page:
   1. Browse to `http://<printer-ip>/`
   2. Log in (default: admin / admin)
   3. Network settings → change DHCP to **Static IP** (pick one outside the
      router's DHCP pool, e.g., `192.168.1.250`)
   4. Save and restart the printer

---

## Cash Drawer (Future Enhancement)

The XP-Q80C has a cash drawer port (RJ-11, 24V/1A). Opening the drawer requires a
raw ESC/POS command (`\x1B\x70\x00\x19\xFA`) sent directly to the printer over TCP
port 9100 — the browser's `window.print()` cannot do this. **HIVE does not
currently open the cash drawer automatically**; use its key/button.

If drawer integration is needed later, a lightweight local service can be built to:
1. Listen on `localhost:8765` for HTTP requests from the browser
2. Send the ESC/POS kick command to the printer's IP on port 9100
3. HIVE would call `fetch('http://localhost:8765/kick')` after printing

This is a separate setup — contact the developer when ready.
