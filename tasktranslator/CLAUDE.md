# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Backend (from /backend)
npm run dev       # nodemon server.js — hot reload
npm start         # node server.js — production

# Frontend (from /frontend)
npm run dev       # Vite dev server on :5173
npm run build     # Build to frontend/dist
npm run preview   # Preview production build

# Stripe webhooks (local dev only)
stripe listen --forward-to localhost:3003/webhook
```

No test suite exists. Test Stripe payments with card `4242 4242 4242 4242`.

## Architecture

**Monorepo:** `backend/` (Express, Node.js) + `frontend/` (React, Vite). No shared packages.

**Live URLs:** Frontend → `https://focusstepadhd.com` | Backend → `https://focusstep-backend.onrender.com`

### Frontend → Backend Communication

All API calls use `VITE_API_URL` (falls back to `""`). In dev, Vite proxies every API route to `localhost:3003` — see `vite.config.js` for the full list. In production, the same paths hit the deployed backend.

Authenticated calls use `authFetch` from `frontend/src/lib/api.js`, which attaches a Supabase JWT `Authorization: Bearer <token>` header. Unauthenticated routes (e.g. `/create-checkout`, `/translate`) use plain `fetch`.

```js
// frontend/src/lib/api.js
export async function authFetch(input, init = {}) {
  const token = await getAccessToken(); // supabase.auth.getSession()
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
```

### Auth Pattern

- **Frontend:** Supabase Auth (`@supabase/supabase-js`). Client is in `frontend/src/lib/supabase.js` — gracefully stubs itself out if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing.
- **Backend:** `requireAuth` middleware calls `supabase.auth.getUser(token)` with the service role key. Attaches `req.authUser` (the Supabase user object). Routes using `requireAuth` get the user's email from `req.authUser.email` — no email needs to be passed in the request body.
- **Pro status** is stored in the `customers` table keyed by email. The backend checks this on every translate/refine/help-step call.

### Backend Structure (`backend/server.js` — single file)

Key sections in order:
1. Middleware setup — `/webhook` gets `express.raw()` before JSON middleware (required for Stripe signature verification)
2. `getProStatus(email)` / `upsertCustomer(email, fields)` — Supabase helpers
3. `requireAuth` middleware — validates Supabase JWT
4. Cache helpers (`getCached`, `storeCache`, `runCached`) — Supabase `translations_cache` table
5. AI helpers (`callAI`, `parseJSON`, system prompts) — Claude Haiku via Anthropic SDK; optionally LM Studio locally
6. Route handlers — `/translate`, `/refine`, `/help-step`, `/pro-status`, `/create-checkout`, `/billing-portal`, `/webhook`

### Rate Limiting

Free tier: 5 translations/day, tracked in an **in-memory `Map`** keyed by `${ip}:${dateString}`. Resets at midnight; clears on server restart. Pro users bypass all limits. The same limit applies to `/translate`, `/refine`, and `/help-step`.

### Caching

Translations are cached in Supabase (`translations_cache` table). Lookup key is a normalized, JSON-stringified representation of the input (filler words stripped). Cache hits skip the AI call entirely. Optional semantic similarity search via LM Studio embeddings (disabled by default, `USE_EMBEDDINGS=false`).

### Stripe Payment Flow

1. Frontend POSTs to `/create-checkout` with `{ plan, email }` — no auth required
2. Backend creates a Stripe Checkout session; `customer_email` pre-fills the Stripe form
3. User pays on Stripe-hosted page; Stripe redirects to `/success?session_id=...`
4. Stripe fires `checkout.session.completed` webhook → backend upserts `customers` table (`is_pro: true`)
5. Subscription cancellations (`customer.subscription.deleted`) set `is_pro: false`

`/billing-portal` requires auth (`requireAuth`) and looks up the Stripe customer by the authenticated user's email.

### Key Environment Variables

**Backend (`backend/.env`):**
- `ANTHROPIC_API_KEY` — Claude API
- `STRIPE_SECRET_KEY` — must be `sk_live_...` or `sk_test_...` (never `pk_...`)
- `STRIPE_WEBHOOK_SECRET` — `whsec_...` (single prefix)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL` — used for Stripe redirect URLs (set to production domain on Render)
- `USE_LOCAL_LM=true` — switches AI calls to LM Studio instead of Anthropic

**Frontend (`frontend/.env`):**
- `VITE_API_URL` — backend URL (omit in dev; Vite proxy handles it)
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
