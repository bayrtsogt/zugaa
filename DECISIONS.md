# Decisions

Where the spec was ambiguous I chose the simplest option and recorded it here.

## Data model

- **Migrations live in `packages/db/supabase/`** (the Supabase CLI project). `supabase/migrations` are the SQL
  migrations, `src/database.types.ts` the generated types.
- **`chapters.is_ending`** (added). In a branching story the next chapter by number is often a different branch,
  so a chapter without choices that ends a branch is flagged `is_ending` and shows "Төгсгөл" instead of
  "Дараагийн бүлэг".
- **`chapter_choices.position`** (added) orders choices.
- **`stories.cover_color`** (added) is the placeholder-cover color used when `cover_url` is empty.
- **`unlocks.method` gains `'purchase'`** for a whole story bought with money (product kind `story`),
  distinct from `'coins'`.
- **`wait_free_timers`** table (added). The spec says "if set, next locked chapter unlocks free after N hours" but
  not when the clock starts. Rule: a signed-in reader gets **one running timer per story**. It starts the first time
  they open a locked chapter in that story while no timer is running. When it elapses the chapter is unlocked
  permanently (`unlocks.method = 'wait_free'`) and the slot frees up for the next locked chapter. If the reader buys
  the chapter meanwhile, the timer is released. Anonymous readers have no timer (login required).
- **Wait-free timers start from the lock screen, not from `get_chapter()`.** Next.js prefetches links, so a
  side effect inside `get_chapter()` started timers for chapters the reader never opened (found in testing).
  `get_chapter()` is read-only; the lock screen calls `start_wait_free()` from a client effect once displayed.
- **Locked preview** = first ~600 characters cut back to a word boundary, but never more than 40% of the chapter,
  so a short chapter cannot be read in full through its preview.
- **Choices are never sent for a locked chapter**, and `chapter_choices` is not readable by readers at all —
  `get_chapter()` returns labels and target numbers only when the chapter is unlocked.
- **`payment_requests`** has extra nullable columns for later integrations: `provider` (`manual|qpay|byl`),
  `provider_ref` (unique per provider), `decided_by_user_id` (admin panel decisions), `telegram_chat_id` and
  `telegram_message_id` (to edit the admin message and match reject-reason replies), `ebarimt_id`.
- **`approve_payment` only moves `submitted → approved`**, as specified. A future QPay/byl.mn webhook marks the
  request `submitted` (recording `provider_ref`) and then calls the same `approve_payment`; both are idempotent.
  `reject_payment` accepts `created` or `submitted`.
- **`approve_payment(request_id, admin_telegram_id)`** is callable by the service role (Telegram webhook, future
  gateways) **or** by an admin session (admin panel). Anyone else gets `forbidden`.
- **Subscription extension**: a new subscription starts at the latest `expires_at` of the user's running
  subscriptions (or now), so a 7-day pass bought during a month pass adds 7 days after it.
- **Story purchase with coins does not discount** chapters already bought individually.
- **Unlocking a chapter while a subscription is active returns `already` and charges nothing.**
- **Monthly nudge** uses the Asia/Ulaanbaatar calendar month and counts coins spent on unlocks × 10₮. The monthly
  price comes from the active product with code `sub_month`. Hidden while a subscription is active.
- **Ref codes** are `ZG-` + 4 digits; if the 4-digit space becomes crowded the generator widens to 5+ digits.

## Access / security

- `chapters.content` is excluded by **column privileges** for `anon`/`authenticated` (not just RLS), so even
  `select *` fails. `has_access(user, chapter)` is not callable by clients (it takes an arbitrary user id); clients
  only see it through `get_chapter()` / `get_story_chapters()`, which use `auth.uid()`.
- All tables: default Supabase grants revoked, RLS on, explicit grants per table. Writes to money/access tables
  happen only inside `SECURITY DEFINER` functions with an empty `search_path`.
- **18+**: age = current year (Ulaanbaatar) − birth year ≥ 18. One function, `private.is_adult()`, decides; ДАН
  verification can replace it later (`profiles.age_verified_at` / `age_verification_method` are the hook). Anonymous
  readers of an 18+ story see no text at all (not even a preview); they are asked to log in. Admins bypass the gate.
- **Rate limits** are stored in Postgres (`private.rate_limits`) so they hold across Worker isolates.
  OTP: 5 per email per hour and 20 per IP per hour, checked in the server action before calling Supabase Auth.
  "Гүйлгээ хийсэн": 10 per user per 10 min in the app, plus 5 submissions per user per hour inside SQL.

- **Birth year is set once.** A trigger rejects changing a non-null `birth_year` unless the caller is an admin, so a
  reader marked under 18 cannot simply edit it.
- **OTP is requested from the server** (server action) so the app's rate limit is enforced before Supabase is called.
  Supabase then sees the Worker's IP, so its per-IP sign-in limit should be raised in the dashboard (README).

## UI

- **Navigation**: bottom bar on phones (Нүүр, Номын сан, Миний); the same three links sit in the header from 768px.
  Coin/эрх purchase lives under Миний and on the lock screen. The reader has no bottom bar (immersive).
- **Theme applies app-wide**, not only in the reader; with no stored choice it follows the system setting. Set before
  first paint by a tiny inline script, so there is no flash or layout shift.
- **Dark theme accent**: deep red text fails contrast on near-black, so dark mode uses a lighter red for accent
  *text* and keeps filled buttons deep red (`--zg-fill`).
- **Small covers** (list rows) show the serif initial only; Mongolian words cannot be hyphenated by browsers and
  long titles got clipped. The title is always printed next to them.
- **Admin decisions in the panel** keep the row in place with the result; the Telegram message is edited too.
- **Metadata in `<head>` for all clients** (`htmlLimitedBots: /.*/`). Next 16 streams metadata into `<body>` for
  non-bot user agents; link previews and SEO tools expect it in `<head>`.

## Fonts

- Google's `cyrillic` subset does **not** contain Ө ө Ү ү (U+04E8/9, U+04AE/F); they are in `cyrillic-ext`.
  To avoid two font requests for every page, each face is a **single custom subset** (Basic Latin + U+0400–045F +
  Ө ө Ү ү + typographic punctuation + ₮) fetched from Google Fonts with `text=`, then instanced with fontTools
  (weight axis trimmed). Coverage was verified glyph by glyph. Headings/titles (`font-display`): **Advent Pro**
  400–800 (30 KB, semibold by default). UI and reading text: **Open Sans** 400–700 (32 KB, italic 35 KB; it has no ₮,
  which falls back to the system font). Self-hosted via `next/font/local` with metric-matched fallbacks — no request
  to Google at runtime.

## Deployment

- `proxy.ts` (Next 16's renamed middleware) runs on the Node runtime; OpenNext marks Node middleware on Cloudflare
  as experimental. It was verified in `workerd` (`wrangler dev`): the full payment flow passes and an expired access
  token is refreshed and re-set by the proxy. If it ever breaks, rename to `middleware.ts` with the edge runtime
  (same code).

- No OpenNext incremental cache (R2) is configured: every page depends on the reader's session/lock state and is
  rendered per request. Static assets are served by Workers Assets.
- **Serial (batch) import.** A JSON without `title` is a batch for the existing story with that `slug`: only the keys present are updated, chapters are upserted by number. A choice pointing at a chapter that is not written yet creates a hidden draft placeholder; readers don't see that choice and get «Үргэлжлэл удахгүй гарна» (`continues_later`) instead. Admins can download any story as import-ready JSON («JSON татах») to fix and re-import.
- **Images.** Covers, chapter images (3:2, under the title) and choice images (4:3 cards) live in the public Supabase
  Storage bucket `media`; only admins can write (storage policies). The admin browser downscales to ≤1600 px WebP and
  uploads directly (no image bytes through the Worker). Fixed aspect boxes keep scroll-position restore exact. A chapter
  image is a teaser and shows on locked chapters too, but not behind the 18+ gate. JSON re-imports keep images unless the
  JSON sets `image_url`.
- **Follows and notifications.** Readers follow a story with a button; starting an ongoing story follows it
  automatically (unfollow on /me). New chapters show on the home page until the reader reads that story. Telegram is the
  push channel (no email sending service is configured): /me → «Telegram холбох» opens the bot with a one-time token;
  `/start <token>` links the chat, `/stop` unlinks. Publishing (import, chapter save, story publish) claims due followers
  in one statement (`follows.notified_at`) and messages them after the response (`after()`), so nobody gets a
  duplicate.
