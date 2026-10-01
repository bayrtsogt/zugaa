// Link prefetches must not start wait-free timers.
import { launch, assert, BASE, sql } from "./lib.mjs";
const me = "(select id from auth.users where email = 'reader1@test.mn')";
sql(`delete from wait_free_timers where user_id = ${me}`);
const b = await launch(); const ctx = await b.newContext({ storageState: "/tmp/zugaa-reader.json" }); const p = await ctx.newPage();
for (const path of ["/", "/s/arvan-guravdugaar-davhar", "/library"]) { await p.goto(BASE + path); await p.waitForTimeout(1500); }
assert(sql(`select count(*) from wait_free_timers where user_id = ${me}`) === "0", "visiting pages with links to locked chapters starts no timer");
await b.close();
