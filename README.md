# OptiManage — Optical Store Management System (Prototype)

A high-fidelity, clickable prototype of an optical store management system built with Next.js. This is a **demo with mock data** — no backend, no database, no real authentication. Designed to pitch the concept and show how the final product will look and feel.

## What's Included

- **15 fully designed screens** — Dashboard, POS, Sales, Inventory, Product Detail, Suppliers, Customers, Customer Profile, Prescriptions, Lab Orders, WhatsApp Center, Analytics, Settings, Expenses, and Login
- **40 realistic products** across Frames, Sunglasses, Contact Lenses, and Lens Stock with real brand names
- **15 customers** with prescriptions, purchase history, and contact details
- **30 sales** over 60 days with line items, discounts, and payment tracking
- **Interactive features** — POS cart with live math, search/filter on all lists, dark mode, branch switching, toast notifications

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS with glassmorphism design (iOS 26 / Apple-inspired)
- Recharts for analytics charts
- Lucide React for icons
- Zero external API dependencies

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — click "Enter Demo" to skip login.

## Deploy to Vercel

### Option A: GitHub + Vercel (Recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Add New → Project → Import repo
3. Framework auto-detects as Next.js. Leave all defaults. Click Deploy.
4. Get your live `https://your-project.vercel.app` URL

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel          # follow prompts
vercel --prod   # deploy to production
```

No environment variables needed. Zero config deployment.

## Customization

Key constants to change for your pitch (all in `src/lib/constants.ts`):

| Constant | Default | What it controls |
|----------|---------|-----------------|
| `APP_NAME` | OptiManage | Product name in sidebar |
| `SHOP_NAME` | Vision Plus Opticals | Demo shop name |
| `CURRENCY` | ₹ | Currency symbol everywhere |
| `PRIMARY_COLOR` | #1f5d8c | Brand accent color |

## Important

This is a **prototype with fake data**. No real login, no saved data, no working WhatsApp/printing/payments — those are visual stand-ins. Changes reset on page refresh.
