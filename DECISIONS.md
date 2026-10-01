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

## Fonts

- Google's `cyrillic` subset does **not** contain Ө ө Ү ү (U+04E8/9, U+04AE/F); they are in `cyrillic-ext`.
  To avoid two font requests for every page, each face is a **single custom subset** (Basic Latin + U+0400–045F +
  Ө ө Ү ү + typographic punctuation + ₮) fetched from Google Fonts with `text=`, then instanced with fontTools
  (optical size pinned). Coverage was verified glyph by glyph. Body: **Literata** (43 KB, italic 25 KB). UI: **Inter**
  (33 KB). Both self-hosted via `next/font/local` with metric-matched fallbacks (no layout shift).

## Deployment

- No OpenNext incremental cache (R2) is configured: every page depends on the reader's session/lock state and is
  rendered per request. Static assets are served by Workers Assets.
