# ◎ FocusStep — ADHD Task Translator

> Turn overwhelming tasks into calm, clear micro-steps.

**Core loop:** Overwhelming task in → 3–7 friction-reducing steps out → start immediately.

---

## Project Structure

```
adhd-task-translator/
├── backend/
│   ├── server.js              ← Express API (Claude + Stripe + Supabase)
│   ├── package.json
│   ├── .env.example
│   └── supabase-schema.sql    ← Run this once in Supabase SQL editor
├── frontend/
│   ├── src/
│   │   ├── App.jsx            ← Shell, routing, Pro state
│   │   ├── App.css
│   │   └── components/
│   │       ├── Translator.jsx ← Core translate experience
│   │       ├── Pricing.jsx    ← Checkout buttons (real Stripe)
│   │       └── Success.jsx    ← Post-payment confirmation
│   ├── index.html
│   ├── vite.config.js
│   └── .env.example
└── README.md
```

---

## Quick Start

### 1. Install dependencies

```bash
cd adhd-task-translator
npm run install:all
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste contents of `backend/supabase-schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set up Stripe

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) → create account
2. Go to **Developers → API Keys** and copy:
   - **Secret key** → `STRIPE_SECRET_KEY` (starts with `sk_test_` for testing)
3. Set up webhook (see below) → `STRIPE_WEBHOOK_SECRET`

#### Stripe Webhook Setup

**Local development:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward events to local server
stripe listen --forward-to localhost:3003/webhook

# Copy the webhook signing secret shown → STRIPE_WEBHOOK_SECRET
```

**Production (Vercel/Render):**
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://your-backend-url.com/webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 4. Configure environment

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FRONTEND_URL=http://localhost:5173
PORT=3003
```

```bash
cp frontend/.env.example frontend/.env
# VITE_API_URL=http://localhost:3003  (default, no change needed locally)
```

### 5. Run

**Terminal 1:**
```bash
npm run dev:backend
```

**Terminal 2:**
```bash
npm run dev:frontend
```

**Terminal 3 (for Stripe webhooks locally):**
```bash
stripe listen --forward-to localhost:3003/webhook
```

App at `http://localhost:5173`

---

## How Payment Works

```
User clicks "Get Pro" → enters email
  → POST /create-checkout { plan, email }
  → Stripe Checkout page (hosted by Stripe)
  → Payment complete
  → Stripe fires checkout.session.completed webhook
  → Backend writes { email, is_pro: true } to Supabase
  → User redirected to /success
  → App checks /pro-status?email=... → isPro: true
  → Unlimited translations unlocked
```

**Monthly cancellation:** Stripe fires `customer.subscription.deleted` → backend sets `is_pro: false` in Supabase → rate limits restored next request.

---

## Testing Payments

Use Stripe test card numbers:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- Any future expiry, any CVC

Switch to live keys (`sk_live_...`) when ready to charge real money.

---

## Deploy to Render

### Backend
- Environment: Node
- Root directory: `backend`
- Build: `npm install`
- Start: `node server.js`
- Add all env vars from `.env.example`

### Frontend
- Root directory: `frontend`
- Build: `npm install && npm run build`
- Publish: `dist`
- Env var: `VITE_API_URL=https://your-backend.onrender.com`

---

## Features

### Shipped
- [x] Task translation via Claude (Haiku model)
- [x] 3–7 micro-steps per task
- [x] Start Here + time estimate
- [x] Copy to clipboard
- [x] 5/day free tier
- [x] Stripe Checkout — monthly ($12) + lifetime ($49)
- [x] Supabase Pro status storage
- [x] Webhook handles subscription lifecycle
- [x] Post-payment success screen
- [x] Email saved to localStorage for returning users

### Roadmap
- [ ] Save favorite translations (requires auth)
- [ ] Translation history
- [ ] Customer portal (manage/cancel subscription)
- [ ] Browser extension

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| AI | Claude Haiku via Anthropic SDK |
| Payments | Stripe Checkout + Webhooks |
| Database | Supabase (Postgres) |
| Deploy | Render / Vercel |
