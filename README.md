# Зугаа — Унших

The reading app ("Унших") of the Зугаа entertainment platform: Mongolian horror, mystery and thriller stories read
chapter by chapter. Free chapters need no account; locked chapters open with coins, a time pass, a whole-story
purchase or a free wait timer. Payments are manual bank transfers approved from Telegram.

Accounts, wallet, subscriptions and payments are **app-agnostic** so later mini apps (word games, quizzes, audio)
share them.

```
apps/read          Next.js 16 app (App Router, TypeScript strict) → Cloudflare Workers via OpenNext
packages/db        Supabase project: SQL migrations, seed, pgTAP tests, generated types
packages/auth      Supabase client factories, session helpers, 18+ gate helpers
packages/wallet    Wallet/subscription/payment wrappers, MNT/coin formatting, Telegram Bot API client
packages/ui        Design tokens (3 themes, type scale), Tailwind v4 theme, base components
scripts/           set-telegram-webhook.ts, screenshots, end-to-end checks
DECISIONS.md       Choices made where the spec was open
docs/VERIFICATION.md  What was tested and the results
```

## How it works (short)

- **Content protection.** `chapters.content` is not selectable by `anon`/`authenticated` (column privileges). Text
  leaves the database only through `get_chapter()`, which returns the full text when `has_access()` is true and a
  ~600-character preview otherwise. The reader renders on the server; locked text is never in HTML, RSC payloads or
  JSON (`scripts/e2e/leak-audit.mjs` checks every network response).
- **Money.** Prices live in `products`. `create_payment_request`, `unlock_chapter`, `unlock_story`,
  `approve_payment` are Postgres functions; they are atomic and idempotent (double tap, double approve and parallel
  calls charge/grant once).
- **Payments.** User picks a product → `ZG-1234` reference → bank transfer → "Гүйлгээ хийсэн" → Telegram message
  with ✅/❌ buttons → webhook calls `approve_payment` → the user's open payment screen flips via Supabase Realtime
  (10 s polling fallback). The admin panel uses the same functions.

## Local development

Prerequisites: Node 20+, pnpm 10, Docker (for the Supabase CLI).

```bash
pnpm install
pnpm db:start                 # local Supabase (API :54321, DB :54322, Mailpit :54324)
pnpm db:reset                 # migrations + seed (2 stories, products)
cp apps/read/.env.example apps/read/.env.local
# fill NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from `pnpm --filter @zugaa/db exec supabase status`
pnpm dev                      # http://localhost:3000
```

Sign in with any email; the 6-digit code arrives in Mailpit at http://127.0.0.1:54324. Make yourself an admin:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

Regenerate types after changing SQL: `pnpm db:types`.

## Supabase (production)

1. Create a project. Link and push the schema:
   ```bash
   cd packages/db
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push        # migrations only; do not run seed.sql in production
   ```
   Then insert your products (see the top of `supabase/seed.sql` for the five default products and prices).
2. **Extensions:** enable `pg_cron` (Database → Extensions) *before* pushing, so the 24-hour expiry job is
   scheduled. Without it requests still expire lazily.
3. **Auth → URL configuration:** Site URL = `APP_URL`; add `APP_URL/auth/callback` to Redirect URLs.
4. **Auth → Emails:** set up **custom SMTP first** — Supabase only lets you edit email templates with your own
   SMTP (e.g. Resend: host `smtp.resend.com`, port `465`, username `resend`, password = a full Resend API key,
   sender `onboarding@resend.dev` until your domain is verified). Then edit the **Magic Link** and **Confirm signup**
   templates: paste `packages/db/supabase/templates/otp.html` (it uses `{{ .Token }}`), subject
   `Зугаа — нэвтрэх код`. Set **Email OTP Length** to 6 (new projects may default to 8; the app accepts 6–10).
   Raise the emails-per-hour rate limit (default is 2).
5. **Auth → Providers → Google:** create an OAuth client in Google Cloud (type "Web application") with the
   authorized redirect URI `https://<ref>.supabase.co/auth/v1/callback`; paste client id/secret into Supabase.
6. **Auth → Rate limits:** sign-in requests come from the app server, so raise "Sign-ups and sign-ins" per IP
   (the app enforces its own per-email and per-IP OTP limits in Postgres). Optionally enable CAPTCHA.
7. **Realtime** needs no setup: the migration adds `payment_requests` to the `supabase_realtime` publication and RLS
   limits each user to their own rows.
8. Copy the project URL, anon (publishable) key and service-role key into the environment variables below.

## Telegram bot

1. In Telegram open **@BotFather** → `/newbot` → copy the token (`TELEGRAM_BOT_TOKEN`).
2. Create a private group for payment admins, add the bot. Send any message, then get the chat id (negative number)
   from `https://api.telegram.org/bot<TOKEN>/getUpdates` → `TELEGRAM_ADMIN_CHAT_ID`. (Run this before setting the
   webhook — `getUpdates` stops working once a webhook is set.)
3. Collect the numeric Telegram user ids of the people allowed to approve (e.g. from `getUpdates`, `from.id`) →
   `ADMIN_TELEGRAM_IDS=111,222`. Others tapping the buttons get "Эрхгүй".
4. Pick a random secret (letters, digits, `_`, `-`) → `TELEGRAM_WEBHOOK_SECRET`.
5. After deploying, register the webhook:
   ```bash
   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://read.example.mn pnpm telegram:set-webhook
   ```
   It calls `setWebhook` with `secret_token` and `allowed_updates: ["callback_query","message"]`.

To give a rejection reason, an admin **replies** to the bot's message in the group; the text is stored on the
request and shown to the user.

## Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build time | inlined into the client bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build time | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | server only (webhook, notifications, rate limiter) |
| `TELEGRAM_BOT_TOKEN` | secret | |
| `TELEGRAM_ADMIN_CHAT_ID` | var¹ | group/chat that receives payment messages |
| `ADMIN_TELEGRAM_IDS` | var | comma-separated user ids allowed to approve |
| `TELEGRAM_WEBHOOK_SECRET` | secret | checked against `X-Telegram-Bot-Api-Secret-Token` |
| `BANK_NAME`, `BANK_ACCOUNT_NUMBER`, `BANK_ACCOUNT_HOLDER` | var | shown on the payment screen |
| `APP_URL` | var | public origin, no trailing slash |
| `TELEGRAM_API_BASE` | — | tests only (points at the mock Bot API) |

¹ "var" = not secret, but the deploy workflow still uploads every runtime value as a Worker secret so nothing
project-specific lives in `wrangler.jsonc`.

## Deploy to Cloudflare Workers

### From GitHub (recommended)

`.github/workflows/deploy.yml` pushes the migrations to Supabase, builds and deploys the Worker, uploads the
runtime configuration as Worker secrets and registers the Telegram webhook.

1. In the GitHub repo: **Settings → Secrets and variables → Actions**, add the secrets and variables listed at the
   top of `deploy.yml` (Supabase access token, DB password, service-role key, Cloudflare API token, project ref,
   Supabase URL + anon key, Cloudflare account id, `APP_URL`, bank details; Telegram values when the bot exists).
2. **Actions → Deploy → Run workflow.** Tick **seed** on the very first run only (inserts products and the two
   demo stories).
3. The first run prints the `*.workers.dev` URL. If it differs from `APP_URL`, update the variable and run again.
4. Finish the dashboard-only Supabase steps above (email templates, redirect URLs, Google provider).

### From your computer

```bash
cd apps/read
pnpm exec wrangler login
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # likewise APP_URL, BANK_*, TELEGRAM_* (see table above)
# NEXT_PUBLIC_* must be in the build environment (shell env or apps/read/.env.production):
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... pnpm run deploy
```

`pnpm run preview` builds and runs the Worker locally in `workerd` (reads `apps/read/.dev.vars`). Attach a custom
domain in the Cloudflare dashboard, set `APP_URL` to it, then run `telegram:set-webhook`.

## Tests

```bash
pnpm db:test          # 75 pgTAP assertions: RLS, content protection, idempotency, expiry, 18+ gate
node scripts/e2e/mock-telegram.mjs &            # mock Bot API on :8099
# start the app with TELEGRAM_API_BASE=http://127.0.0.1:8099 (see .env.example), then:
pnpm e2e              # reader, payments + Telegram webhook, admin, leak audit, concurrency
pnpm screens          # every screen at 360/1280 px in all three themes
```

See `docs/VERIFICATION.md` for the latest results, Lighthouse scores and screenshot contact sheets.

## Adding another mini app

Create `apps/<name>`, depend on `@zugaa/auth`, `@zugaa/wallet`, `@zugaa/ui`. Use the same Supabase project.
Products with `app = 'all'` (coin packs, subscriptions with `scope = 'all'`) already work everywhere; give
app-specific products `app = '<name>'` and write `wallet_transactions.app = '<name>'`.
