// Reader settings sheet: theme / size / spacing applied, stored, restored before paint.
import { launch, assert, BASE } from "./lib.mjs";
const b = await launch(); const p = await (await b.newContext()).newPage();
const errors = []; p.on("console", m => m.type()==="error" && errors.push(m.text()));
await p.goto(`${BASE}/s/arvan-guravdugaar-davhar/1`); await p.waitForSelector(".prose-read");
await p.click("button[aria-label='Унших тохиргоо']");
await p.click("button:has-text('Харанхуй')"); await p.click("button[aria-label='Хамгийн том']"); await p.click("button:has-text('Сул')");
const d = await p.evaluate(() => ({ ...document.documentElement.dataset, ls: localStorage.getItem("zugaa:reader"), px: getComputedStyle(document.querySelector(".prose-read")).fontSize }));
assert(d.theme === "dark" && d.fs === "4" && d.lh === "3", "settings applied to <html>: " + JSON.stringify(d));
assert(d.px === "23px" && JSON.parse(d.ls).theme === "dark", "settings stored in localStorage");
assert((await p.getAttribute("button:has-text('Харанхуй')", "aria-pressed")) === "true", "active option marked aria-pressed");
await p.keyboard.press("Escape");
await p.reload(); await p.waitForSelector(".prose-read");
const after = await p.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.querySelector(".prose-read")).fontSize]);
assert(after[0] === "dark" && after[1] === "23px", "persisted across reload, applied before paint: " + after);
assert(errors.filter(e => !e.includes("_rsc")).length === 0, "no console errors (hydration)" + errors.join(" | "));
await b.close();
