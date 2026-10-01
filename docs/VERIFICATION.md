# Verification

Run on 2026-10-01 against the local Supabase stack (CLI 2.119, Postgres 17) and the production build of the app
(`next build && next start`), and additionally on the Cloudflare Worker build running in `workerd`
(`opennextjs-cloudflare build` + `wrangler dev`).

## Database (pgTAP) — `pnpm db:test`

75 assertions, all passing (`packages/db/supabase/tests/access_and_payments.test.sql`):

- RLS enabled on every public table; users cannot write wallets, transactions, unlocks, subscriptions, payment
  requests, or set `is_admin`; they see only their own profile.
- `anon` and `authenticated` cannot select `chapters.content` (even `select *` fails) or `chapter_choices`, and
  cannot call `has_access`.
- **Non-paying user cannot read locked content**: `get_chapter` returns ≤ 600 chars, no ending text, no choices.
- **Double unlock charges once** (balance 100 → 60, one transaction, one unlock row).
- Wait-free: viewing starts nothing; `start_wait_free` starts one timer per story; an elapsed timer opens the
  chapter and becomes a permanent unlock.
- 18+: anonymous → login required with no text; no birth year → asked; minor → blocked (also cannot buy); birth
  year can be set only once.
- Payments: price taken from `products`; max 3 open requests; users cannot approve; **double approve grants once**
  (coins and subscription); a pass bought during an active one extends from its expiry (30 + 7 = 37 days);
  rejected requests cannot be approved; admin session can approve; story purchase unlocks the whole story; state
  changes are audited.
- **Subscription expiry removes access** (locked again, preview only).

## End to end — `pnpm e2e`

All passing (Chromium, 360 px viewport unless noted):

| Script | Covers |
| --- | --- |
| `reader-login` | Email OTP via Mailpit, redirect back, 18+ birth-year gate, OTP rate limit (6th request refused) |
| `reader-progress` | Header hides on scroll down / shows on scroll up, debounced progress save, position restored, "Үргэлжлүүлэн унших", "Үргэлжлүүлэх" |
| `reader-prefetch` | Pages linking to locked chapters start no wait-free timer |
| `reader-unlock` | Countdown "24 цаг", balance on lock screen, coin unlock opens chapter, charged exactly once, shop shortfall |
| `reader-settings` | Theme/size/spacing applied, stored in localStorage, restored before paint, no hydration errors |
| `full-flow` | **Acceptance flow**: sign up → read free → hit lock → buy month pass → bank details/copy buttons/reference → "Гүйлгээ хийсэн" → Telegram message (text + ✅/❌ buttons) → webhook rejects bad secret (401) and non-admin ("Эрхгүй") → admin approves → **pending screen flips to "Эрх нээгдлээ" without refresh (≈0.3 s via Realtime)** → message edited "✅ Батлагдсан", buttons removed → chapter readable → double approve "Аль хэдийн шийдвэрлэсэн", one subscription → reject flow + reply reason stored |
| `admin` | `/admin` blocked for anonymous and non-admin; approve from panel reaches the buyer's open screen; coin adjustment (audited); story create with Mongolian→Latin slug, duplicate slug rejected; chapters, markdown preview, choices; draft hidden until published |
| `leak-audit` | Every paid chapter, as anonymous and as a signed-in non-paying user, direct load and client-side navigation: **no hidden text in any of ~440 responses** (HTML, RSC, JSON) |
| `concurrency` | Over the REST API: 10 parallel `unlock_chapter` → one charge; 10 parallel `approve_payment` → one grant; user cannot approve |

`full-flow` also passes against the Worker in `workerd`; a separate check there confirmed the proxy refreshes an
expired access token and re-sets the session cookie.

**Not done for real:** the Telegram side used a local mock of the Bot API (`scripts/e2e/mock-telegram.mjs`), and
webhook updates were posted the way Telegram sends them (same headers and JSON). A real bot token, group and
`setWebhook` against a public URL still need one manual run after deployment. Google sign-in needs real OAuth
credentials and was not exercised.

## Lighthouse (mobile preset, simulated throttling)

Local `next start` on the same machine as Supabase, so server latency is lower than in production.

| Page | Performance | Accessibility | Best practices | SEO | LCP | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| Story `/s/arvan-guravdugaar-davhar` | 99 | 100 | 100 | 100 | 2.0 s | 0 |
| Reader `/s/arvan-guravdugaar-davhar/1` | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| Home `/` | 100 | 100 | 100 | 100 | 1.7 s | 0 |
| Locked chapter `/…/3` (anonymous) | 99 | 100 | 100 | 66 ¹ | 2.1 s | 0 |

¹ Intentional: locked chapter pages are `noindex` (only a preview is visible), which Lighthouse's "is crawlable"
audit scores down. Story pages and free chapters are indexable and score 100.

Fonts: one self-hosted subset per face (Literata 43 KB + italic 25 KB, Inter 33 KB), metric-matched fallbacks.

## Screenshots

`docs/screenshots/{light,sepia,dark}-{360,1280}.jpg` are contact sheets of all 20 screens: home, library, story,
reader, reader settings, locked (anonymous / signed in with countdown), login, 404, home signed in, branching
choices, 18+ gate, shop, payment, pending, approved, Миний, admin payments, admin story, admin chapter editor.
`pnpm screens` regenerates the full-size set. Checked against §8: typography-led, flat surfaces with hairlines,
single deep-red accent, solid-color serif covers, no gradients/blur/shadows/emoji/hero sections, ≥44 px targets,
AA contrast in all three themes (ratios in `packages/ui/src/tokens.css`).
