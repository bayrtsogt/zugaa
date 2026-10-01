// Verifies that locked chapter text never reaches a non-paying client in any
// form: HTML, RSC/flight payloads (direct loads and client-side navigation),
// JSON. Runs as an anonymous visitor and as a signed-in user without purchases.
import { launch, login, assert, sql, BASE } from "./lib.mjs";

// Fragments taken from the hidden part of every paid chapter (beyond the preview).
const rows = JSON.parse(sql(`
  select coalesce(json_agg(json_build_object('slug', s.slug, 'number', c.number, 'content', c.content) order by s.slug, c.number), '[]')
  from chapters c join stories s on s.id = c.story_id
  where not c.is_free and s.status = 'published' and c.published_at <= now()`));
const chapters = rows.map(({ slug, number, content }) => {
  const hidden = content.slice(Math.min(650, Math.floor(content.length * 0.45)));
  // Several 24-char probes spread over the hidden part.
  const probes = [0.1, 0.35, 0.6, 0.9]
    .map((f) => hidden.slice(Math.floor(hidden.length * f), Math.floor(hidden.length * f) + 24))
    // A probe must not also occur in the visible preview (repetitive test text).
    .filter((p) => p.trim().length > 15 && !content.slice(0, 700).includes(p));
  return { slug, number, probes };
});
assert(chapters.length > 0, `${chapters.length} paid chapters to audit`);

const browser = await launch();
async function audit(label, ctx) {
  const page = await ctx.newPage();
  const bodies = [];
  page.on("response", async (r) => {
    try {
      bodies.push(await r.text());
    } catch {}
  });
  for (const c of chapters) {
    // Direct load, then a client-side navigation into the same chapter (RSC fetch).
    await page.goto(`${BASE}/s/${c.slug}/${c.number}`);
    await page.waitForLoadState("load");
    await page.goto(`${BASE}/s/${c.slug}`);
    await page.click(`a[href="/s/${c.slug}/${c.number}"]`);
    await page.waitForURL(`**/s/${c.slug}/${c.number}`);
    await page.waitForTimeout(400);
  }
  // Also hit the public JSON surfaces directly.
  bodies.push(await (await ctx.request.get(`${BASE}/sitemap.xml`)).text());
  const all = bodies.join("\n");
  let leaks = 0;
  for (const c of chapters) for (const p of c.probes) if (all.includes(p)) { leaks++; console.log("LEAK", label, c.slug, c.number, JSON.stringify(p)); }
  assert(leaks === 0, `${label}: no hidden text in ${bodies.length} responses (${chapters.reduce((n, c) => n + c.probes.length, 0)} probes)`);
  await page.close();
}

await audit("anonymous", await browser.newContext());
const userCtx = await browser.newContext();
const u = await userCtx.newPage();
await login(u, `leak-${Date.now()}@test.mn`, "/");
sql(`update profiles set birth_year = 1990 where id = (select id from auth.users order by created_at desc limit 1)`);
await audit("signed-in, no purchases", userCtx);
await browser.close();
