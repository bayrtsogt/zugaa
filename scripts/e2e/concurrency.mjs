// Proves idempotency under concurrency through the real API:
// 10 parallel unlock_chapter calls charge once; 10 parallel approve_payment calls grant once.
// Usage: node scripts/e2e/concurrency.mjs  (local Supabase running; keys from env or local defaults)
import { createClient } from "@supabase/supabase-js";
import { assert, sql } from "./lib.mjs";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("set NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const email = `conc-${Date.now()}@test.mn`;
const password = "test-password-123";
const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;
const uid = created.user.id;

const user = createClient(URL, ANON, { auth: { persistSession: false } });
await user.auth.signInWithPassword({ email, password });

sql(`update wallets set balance_coins = 200 where user_id = '${uid}'`);
const chapter = sql(`select c.id from chapters c join stories s on s.id = c.story_id
                     where s.slug = 'arvan-guravdugaar-davhar' and c.number = 5`);

const results = await Promise.all(Array.from({ length: 10 }, () => user.rpc("unlock_chapter", { p_chapter_id: chapter })));
const statuses = results.map((r) => r.data?.status ?? r.error?.message);
assert(statuses.filter((s) => s === "unlocked").length === 1, `exactly one 'unlocked' of 10 parallel calls (${statuses.join(",")})`);
assert(sql(`select balance_coins from wallets where user_id = '${uid}'`) === "160", "charged once: 200 - 40 = 160");
assert(sql(`select count(*) from wallet_transactions where user_id = '${uid}' and reason = 'unlock_chapter'`) === "1", "one transaction");

const { data: req } = await user.rpc("create_payment_request", { p_product_code: "coins_300" });
await user.rpc("submit_payment_request", { p_request_id: req.id });
const approvals = await Promise.all(Array.from({ length: 10 }, () => admin.rpc("approve_payment", { p_request_id: req.id, p_admin_telegram_id: 1 })));
const fresh = approvals.filter((a) => a.data && a.data.already === false && a.data.ok).length;
assert(fresh === 1, `exactly one fresh approval of 10 parallel calls (${fresh})`);
assert(sql(`select balance_coins from wallets where user_id = '${uid}'`) === "460", "coins granted once: 160 + 300 = 460");

const { error: forbidden } = await user.rpc("approve_payment", { p_request_id: req.id });
assert(forbidden?.message === "forbidden", "a user cannot approve their own payment");

await admin.auth.admin.deleteUser(uid);
