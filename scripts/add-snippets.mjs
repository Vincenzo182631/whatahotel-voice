#!/usr/bin/env node
/**
 * Adds the "Audio Highlight" snippet to each hotel's Hotel Content in the WhataHotel admin.
 * Runs on YOUR computer, so the admin login never leaves it.
 *
 *   npm i playwright && npx playwright install chromium     (once)
 *   node scripts/add-snippets.mjs exports/four-seasons-batch-7-9-admin.csv
 *
 * Default: does ONE hotel, fills the form, saves a screenshot and waits for you to press ENTER
 * before clicking "Create content". Then add --all to run the rest (it still skips hotels that
 * already have an Audio Highlight). Flags:
 *   --headless        run without a visible browser (not recommended for the first hotel)
 *   --all             process every row (otherwise only the first one not yet done)
 *   --yes             do not wait for ENTER before each save (use only after the first one looked right)
 *   --start=ID        begin at this Hotel ID
 *   --admin=URL       admin address (default https://www.whatahotel.com/admin/)
 *   --hotels=URL      hotel list page (default https://www.whatahotel.com/admin/cms/hotels.cfm)
 *
 * Login: set WAH_ADMIN_EMAIL and WAH_ADMIN_PASS in your terminal, or type them when asked
 * (the password is not echoed). Results go to add-snippets-log.csv, screenshots to add-snippets-shots/.
 */
import { chromium } from "playwright";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import readline from "node:readline";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const csvPath = args.find((a) => !a.startsWith("--"));
if (!csvPath) { console.error("Usage: node scripts/add-snippets.mjs <csv> [--all] [--yes] [--headless] [--start=ID] [--admin=URL]"); process.exit(1); }
const ADMIN = (opt("admin") ?? "https://www.whatahotel.com/admin").replace(/\/+$/, "") + "/";
const HOTELS_PAGE = opt("hotels") ?? new URL("cms/hotels.cfm", ADMIN).href;
const SHOTS = "add-snippets-shots", LOG = "add-snippets-log.csv";
mkdirSync(SHOTS, { recursive: true });
if (!existsSync(LOG)) writeFileSync(LOG, "Hotel ID,Hotel name,Result,Note\n");

function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(Boolean)) rows.push(row); row = []; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const [header, ...data] = parseCsv(readFileSync(csvPath, "utf8"));
const col = (n) => header.indexOf(n);
let hotels = data.map((r) => ({ id: r[col("Hotel ID")], name: col("Hotel name") >= 0 ? r[col("Hotel name")] : "", snippet: r[col("Snippet")] }));
const done = new Set(readFileSync(LOG, "utf8").split("\n").slice(1).filter((l) => /,(added|exists)/.test(l)).map((l) => l.split(",")[0]));
const start = opt("start");
if (start) hotels = hotels.slice(hotels.findIndex((h) => h.id === start));
hotels = hotels.filter((h) => !done.has(h.id));
if (!flag("all")) hotels = hotels.slice(0, 1);
if (!hotels.length) { console.log("Nothing left to do."); process.exit(0); }

function ask(q, hidden = false) {
  return new Promise((res) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = () => {};
    process.stdout.write(q);
    rl.question("", (a) => { rl.close(); if (hidden) process.stdout.write("\n"); res(a); });
  });
}
const log = (h, result, note = "") => appendFileSync(LOG, `${h.id},"${h.name}",${result},"${note.replace(/"/g, "'")}"\n`);

const email = process.env.WAH_ADMIN_EMAIL || (await ask("Admin email: "));
const pass = process.env.WAH_ADMIN_PASS || (await ask("Admin password: ", true));

const browser = await chromium.launch({ headless: flag("headless") });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
page.setDefaultTimeout(20000);

await page.goto(ADMIN);
await page.fill('input[name="userEmail"]', email);
await page.fill('input[name="userPass"]', pass);
await Promise.all([page.waitForLoadState("load"), page.click('input[type="submit"][value^="LOG IN"]')]);
if ((await page.locator('input[name="userPass"]').count()) || /invalid|incorrect|not found/i.test(await page.locator("body").innerText())) { console.error("Login failed. Check the email and password."); await browser.close(); process.exit(1); }
console.log("Logged in.");

async function openHotel(h) {
  // 1. search the hotel on the hotels page (by ID first, then by name)
  // 2. click the eye icon: it is the middle one of the three action icons (pencil, eye, x)
  for (const term of [h.id, h.name].filter(Boolean)) {
    await page.goto(HOTELS_PAGE);
    const box = page
      .locator('input[type="search"], input[name*="search" i], input[placeholder*="search" i], input[id*="search" i], input[name*="keyword" i], input[name*="name" i]')
      .or(page.locator('input[type="text"]'))
      .first();
    if (!(await box.count())) throw new Error("Could not find the hotel search box on the hotels page");
    await box.fill(term);
    await box.press("Enter");
    await page.waitForLoadState("load");
    await page.waitForTimeout(1500);
    const rows = page.locator("tr", { hasText: new RegExp(`\\b${h.id}\\b`) });
    const row = (await rows.count()) ? rows.first() : page.locator("tbody tr").first();
    if (!(await row.count())) continue;
    const actions = row.locator("a, button");
    const named = row.locator("a:has(.fa-eye), button:has(.fa-eye), a:has(.fa-eye-open), a[title*='details' i], a[title*='view' i]");
    const n = await actions.count();
    const target = (await named.count()) ? named.first() : n >= 3 ? actions.nth(n - 2) : n === 2 ? actions.nth(1) : undefined;
    if (!target) continue;
    await Promise.all([page.waitForLoadState("load"), target.click()]);
    return;
  }
  throw new Error("Hotel not found on the hotels page, or its eye icon was not found");
}

async function addSnippet(h) {
  await openHotel(h);
  const section = page.getByText("Hotel Content", { exact: false }).first();
  await section.scrollIntoViewIfNeeded();
  const body = await page.locator("body").innerText();
  const contentPart = body.split("Hotel Content")[1] ?? "";
  if (/Audio Highlight/i.test(contentPart.split("ADD HOTEL CONTENT")[0] ?? contentPart)) return { result: "exists", note: "already has an Audio Highlight entry; skipped" };

  await Promise.all([page.waitForLoadState("load"), page.getByRole("link", { name: /add hotel content/i }).or(page.getByRole("button", { name: /add hotel content/i })).first().click()]);
  await page.getByLabel("Title", { exact: false }).first().fill("Audio Highlight");
  await page.getByLabel("Category", { exact: false }).first().selectOption({ label: "Content" });
  await page.getByLabel("Type", { exact: false }).first().selectOption({ label: "Audio Highlight" });
  await page.getByLabel("Format", { exact: false }).first().selectOption({ label: "HTML" });
  await page.getByLabel("Language", { exact: false }).first().selectOption({ label: "English" });
  await page.locator("textarea").first().fill(h.snippet);
  const shot = `${SHOTS}/${h.id}-form.png`;
  await page.screenshot({ path: shot, fullPage: true });
  if (!flag("yes")) {
    console.log(`\n${h.id} ${h.name}: form filled. Screenshot: ${shot}`);
    const a = await ask("Press ENTER to click \"Create content\" (or type n to skip): ");
    if (a.trim().toLowerCase() === "n") return { result: "skipped", note: "you skipped it" };
  }
  await Promise.all([page.waitForLoadState("load"), page.getByRole("button", { name: /create content/i }).or(page.locator('input[type="submit"][value*="reate" i]')).first().click()]);
  await page.screenshot({ path: `${SHOTS}/${h.id}-after.png`, fullPage: true });
  // verify: the hotel's Hotel Content table now lists an Audio Highlight
  const after = await page.locator("body").innerText();
  if (!/Audio Highlight/i.test(after)) return { result: "unverified", note: "saved, but the table does not show Audio Highlight yet; check the screenshot" };
  return { result: "added", note: "" };
}

for (const h of hotels) {
  try {
    const { result, note } = await addSnippet(h);
    log(h, result, note);
    console.log(`${h.id} ${h.name}: ${result}${note ? " (" + note + ")" : ""}`);
  } catch (e) {
    log(h, "error", e.message);
    console.error(`${h.id} ${h.name}: error: ${e.message}`);
    await page.screenshot({ path: `${SHOTS}/${h.id}-error.png`, fullPage: true }).catch(() => {});
  }
}
await browser.close();
console.log(`Done. Log: ${LOG}`);
