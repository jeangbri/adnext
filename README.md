# Creatye v2 - Instagram Automation SaaS

Production-grade Instagram automation platform in PT-BR.

## 🚀 Quick Start in 5 Minutes

### 1. Prerequisites
- Node.js 18+
- pnpm (`npm i -g pnpm`)
- Docker (for Redis)
- Supabase Account (or local Postgres)

### 2. Setup Environment
Copy `.env.example` to `.env` and `.env.local` (for Next.js).
```bash
cp .env.example .env
cp .env.example .apps/web/.env.local
```
Fill in your Supabase credentials and `APP_ENCRYPTION_KEY` (32 chars).

### 3. Install Dependencies
```bash
pnpm install
```

### 4. Database Setup
Ensure your connection string is set in `.env`.
```bash
# Push schema to Supabase/Postgres
pnpm db:push

# Generate Prisma Client
pnpm turbo run generate
```

### 5. Start Infrastructure (Redis)
```bash
docker-compose up -d
```

### 6. Run Application
Open two terminals:

**Terminal 1 (Web App - http://localhost:3000):**
```bash
pnpm dev
```

**Terminal 2 (Worker):**
```bash
cd apps/worker
pnpm dev
```
(Or run from root: `pnpm turbo dev` if configured)

## 🧪 Testing & Validation (Smoke Test)

### 1. Webhook Simulator (Manual)
1. Run `pnpm dev` in `apps/worker` to ensure worker is listening.
2. Edit `apps/worker/src/smoke-test.ts` to use a valid `id` that matches a Mock `InstagramAccount` in your DB (Create one manually in Supabase Dashboard if needed).
3. Run the smoke test:
```bash
cd apps/worker
npx tsx src/smoke-test.ts
```

### 2. Real Webhook Test (ngrok)
1. Install ngrok: `npm i -g ngrok`
2. Start tunnel: `ngrok http 3000`
3. Configure Instagram App Webhook URL to `https://<your-ngrok>.ngrok-free.app/api/webhooks/instagram`.
4. Verify Token: Match `IG_VERIFY_TOKEN` in `.env`.
5. Send a DM to your test account.
6. Check Logs in `Dashboard > Automações > [Seu Fluxo] > Logs`.

## 📦 Project Structure (Monorepo)

- **apps/web**: Next.js App Router (UI, API, Webhooks)
- **apps/worker**: Node.js + BullMQ Worker (Processes events asynchronously)
- **packages/db**: Prisma Schema & Client
- **packages/shared**: Shared Zod schemas & TypeScript types

## ⚠️ Common Issues

1. **Instagram Login Fails**:
   - Ensure "Instagram Login" product is added in Meta Developer Portal.
   - Check `IG_REDIRECT_URI` matches exactly what is in Meta Portal.
   - Ensure User is added as "Tester" if app is in Development mode.

2. **Webhook not Received**:
   - Check `IG_VERIFY_TOKEN` matches.
   - Ensure ngrok is running and public.
   - Check `signatureValid` in `WebhookEvent` table. If false, check `IG_APP_SECRET`.

3. **Automação não responde**:
   - Check if Worker is running (`pnpm dev` in `apps/worker`).
   - Check Redis connection.
   - Ensure Workflow is PUBLISHED and Active.
   - Ensure Channel matches (DM vs Comment).

## ✅ Definition of Done Checklist

- [x] **Monorepo Structure**: Apps/web, Apps/worker, Packages/db configured.
- [x] **Database**: Prisma Schema for Users, Workflows, Events, Accounts.
- [x] **Authentication**: Supabase Auth (Login/Register) in PT-BR.
- [x] **UI**: Dashboard, Sidebar, Workflow Editor, Integrations Page (Shadcn/Tailwind).
- [x] **Instagram Connect**: OAuth flow implemented using Instagram Basic/Graph API params.
- [x] **Webhooks**: Endpoint validates signature, stores raw payload (idempotency), enqueues job.
- [x] **Processing**: Worker consumes Queue, matches Keywords, executes Send DM/Reply.
- [x] **Logs**: Automation Runs are logged to DB with success/error status.
- [x] **Security**: Encrypted tokens, Middleware protection, Env variables.

## 🛠 Deployment
- **Web**: Deploy `apps/web` to Vercel (Set env vars).
- **Worker**: Deploy `apps/worker` to Railway/Render/AWS (Node.js service).
- **Redis**: Use Upstash (Serverless) or managed Redis.
- **Database**: Supabase (Managed Postgres).

---
Built with ❤️ by Google Antigravity.
