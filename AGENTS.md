<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OptiManage — Project Context

This is a **real, live production system** for Noor Optics, an optical retail shop in Karachi, Pakistan — inventory, POS, prescriptions, lab orders, suppliers, customer CRM, analytics, and (since July 2026) a public customer-facing storefront with online checkout. `README.md` is stale and still describes an old mock-data prototype version of this app — ignore it for current state; this file is the source of truth. Check `git log` for detailed feature history rather than expecting it enumerated here.

## Stack
- Next.js 16 App Router + Turbopack, TypeScript, Tailwind CSS v4
- Prisma 7 with `@prisma/adapter-neon` (NOT plain `new PrismaClient()`) → Neon Postgres, database `optimanage`
- NextAuth v5, credentials + bcrypt, for staff login
- Vercel deployment, no VPS, no separate staging environment

## Deployment topology — two Vercel projects, one repo, one database
- **optimanage** project → https://optimanage-nu.vercel.app — the staff dashboard/POS, used daily at the outlet. `/` redirects to `/login`.
- **noor-optics-shop** project → https://noor-optics-shop.vercel.app — the public customer storefront. Same codebase and same GitHub repo (`sixleadflows-maker/optimanage`, `master` branch) — one push deploys both.
- `src/middleware.ts` makes the *same* deployed code behave differently per domain: it rewrites `/` → `/shop` only when the request's Host header matches something in the `STOREFRONT_HOSTNAMES` env var (comma-separated, substring-matched). That var is set only on the `noor-optics-shop` project.
- Both projects need their own `DATABASE_URL` and `AUTH_SECRET` set in Vercel project settings. Vercel marks these "Sensitive" — **write-only forever**, there is no reveal/copy button once saved, not even for whoever set it. If you need the DB connection string again, get it fresh from the Neon console, not from the other Vercel project's settings.
- A brand-new Vercel project created via `vercel project add` defaults to Framework Preset **"Other"**, not Next.js, even after a successful `next build` deploy — this causes a platform-level 404 (`X-Vercel-Error: NOT_FOUND`, request never reaches the app) despite a green build. Fix once with `vercel project update <name> --framework nextjs`, then redeploy.

## Codebase conventions
- Pages follow: Server Component `page.tsx` fetches data via functions in `src/lib/data.ts`, passes it to a sibling `*Client.tsx` (`"use client"`) that handles interactivity/state.
- Mutations live in `src/lib/actions/*.ts` (`"use server"` files). Every export in one of these files must be an async function:
  - A plain constant export (e.g. `export const FOO = [...]`) crashes the page the moment it's touched.
  - `export type { Foo }` (re-exporting a type) silently breaks the Server Actions bundle with a `ReferenceError` — not caught by `tsc`, only surfaces as a real 500 the first time that specific action is invoked. Keep shared types in a plain non-`"use server"` module instead and import them from there.
- `revalidatePath()` only works from a genuine Server Action or Route Handler — never from code a Server Component's render reaches directly, even one `await` removed. If a mutation needs to happen as part of a page rendering (e.g. a payment-confirmation page finishing up an order), wrap it in its own dedicated Server Action and trigger that from a small client component, not from the page itself.
- Design system: glass-morphism (`.glass-card`, `.glass-modal`, `.glass-input` in `globals.css`), primary `#6d5ef0`, secondary `#14b8a6`, Manrope for display/headings. The old blue `#1f5d8c` was deliberately purged — don't reintroduce it.
- Prisma client generates to `src/generated/prisma` (gitignored). After any `schema.prisma` change: `npm run db:push` then `npx prisma generate`.

## Key areas
- Sale creation core: `src/lib/sales/core.ts` (`persistSale`) — shared by POS (`src/lib/actions/sales.ts`) and online orders (`src/lib/orders/fulfillOnlineOrder.ts`) so there's exactly one implementation of totals math and stock deduction. Stock is decremented via an atomic conditional `updateMany({ where: { stock: { gte: qty } } })` per item, not a naive read-then-write, specifically to prevent overselling under concurrent sales.
- Storefront: `src/app/shop/**` (public routes, no auth). Checkout flow: `src/lib/actions/storefront.ts` (`initiateCheckout`) → `CheckoutSession` row → payment gateway → `src/lib/orders/fulfillOnlineOrder.ts` converts a paid session into a real `Sale` with `source: ONLINE`.
- Payments: `src/lib/payments/swich.ts`. Swich is the chosen gateway (Pakistan-first aggregator: cards, JazzCash, EasyPaisa, bank via 1LINK). Their docs site is JS-rendered and wasn't scrapable when this was built, so the module runs in **mock mode** whenever `SWICH_API_KEY` is unset — it simulates instant payment success so the whole storefront flow is testable without real credentials. Do not invent real Swich endpoint paths or field names; get them from the owner's actual merchant dashboard once they have one, and wire the real HTTP calls in behind the existing function signatures.
- Print output: `.receipt-paper` (80mm thermal) and `.a4-invoice` classes in `globals.css`, rendered in `POSClient.tsx`. A print-scoped rule forces `font-weight: 700 !important` on both, because thin strokes (Courier New, default-weight body text) print faint on thermal printers — the on-screen previews intentionally stay at normal weight, only the physical printout is bold.

## Staff login credentials
Do not hardcode these in any file that gets committed. Dev/seed logins are defined in `prisma/seed.ts` (one OWNER, one MANAGER, two CASHIER accounts) — read that file directly if you need to log in locally. The live production DB uses the same accounts (there's no separate staging DB), so treat them as real credentials, not throwaway demo values.

## Local development
`npm run dev` (Turbopack). Needs `DATABASE_URL` + `AUTH_SECRET` in `.env`/`.env.local` pointing at the **same live Neon database used in production** — there is no separate dev/staging DB. Always clean up any test sales/customers/stock changes with a throwaway `tsx` script immediately after verifying a feature; don't leave test data in the shared production DB.

## Known open items
- Swich is not live yet — needs the owner to sign up for a real merchant account and share API docs/keys.
- Storefront is on the free `noor-optics-shop.vercel.app` subdomain. Moving to a real domain is just a DNS step + adding it to `STOREFRONT_HOSTNAMES` — no code changes needed.
- HBL physical POS card-terminal integration was requested but not investigated — unclear if their merchant tier even exposes an API for this.
- Seeded passwords have never been rotated; role enforcement exists per-server-action but hasn't had a dedicated audit pass.
