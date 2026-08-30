import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = "scripts/playwright/out";
mkdirSync(OUT, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();
const email = `pw-test-${stamp}@example.com`;
const password = "Testpass1!";
const name = "Playwright Tester";
const zip = "94102";

const consoleLog = [];
const netLog = [];

function record(page, tag) {
  page.on("console", (m) => consoleLog.push(`[${tag}] ${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => consoleLog.push(`[${tag}] pageerror: ${e.message}`));
  page.on("requestfailed", (req) =>
    netLog.push(`[${tag}] REQFAIL ${req.method()} ${req.url()} — ${req.failure()?.errorText}`)
  );
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\/api\/(auth|users)\//.test(url)) return;
    let body = "";
    try {
      body = (await res.text()).slice(0, 500);
    } catch {}
    netLog.push(`[${tag}] ${res.status()} ${res.request().method()} ${url}\n         ${body}`);
  });
}

const browser = await chromium.launch();
const context = await browser.newContext();
const results = { email };

// ---------- SIGNUP ----------
{
  const page = await context.newPage();
  record(page, "signup");
  try {
    await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.screenshot({ path: join(OUT, "01-signup-load.png"), fullPage: true });

    await page.locator("#name").fill(name);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#zipCode").fill(zip);
    await page.screenshot({ path: join(OUT, "02-signup-filled.png"), fullPage: true });

    const [signupResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/signup"), { timeout: 30_000 }).catch(() => null),
      page.getByRole("button", { name: /create account/i }).click(),
    ]);

    results.signupStatus = signupResp?.status() ?? "no response";
    try {
      results.signupBody = signupResp ? (await signupResp.text()).slice(0, 500) : null;
    } catch {}

    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, "03-signup-after-submit.png"), fullPage: true });
    results.signupUrlAfter = page.url();
    results.signupFormErrorText = (await page.locator("form#auth-primary").innerText()).slice(-400);
  } catch (err) {
    results.signupThrew = err.message;
  } finally {
    await page.close();
  }
}

// ---------- LOGIN with the just-signed-up user ----------
{
  const page = await context.newPage();
  record(page, "login");
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.screenshot({ path: join(OUT, "04-login-load.png"), fullPage: true });

    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.screenshot({ path: join(OUT, "05-login-filled.png"), fullPage: true });

    const [callbackResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/auth/callback/credentials"), { timeout: 30_000 }).catch(() => null),
      page.getByRole("button", { name: /log in/i }).click(),
    ]);

    results.loginCallbackStatus = callbackResp?.status() ?? "no response";
    try {
      results.loginCallbackBody = callbackResp ? (await callbackResp.text()).slice(0, 500) : null;
    } catch {}

    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, "06-login-after-submit.png"), fullPage: true });
    results.loginUrlAfter = page.url();
    results.loginFormErrorText = (await page.locator("form#auth-primary").innerText().catch(() => "")).slice(-400);
  } catch (err) {
    results.loginThrew = err.message;
  } finally {
    await page.close();
  }
}

await browser.close();

writeFileSync(join(OUT, "results.json"), JSON.stringify(results, null, 2));
writeFileSync(join(OUT, "console.log"), consoleLog.join("\n"));
writeFileSync(join(OUT, "network.log"), netLog.join("\n"));

console.log(JSON.stringify(results, null, 2));
console.log("\n---- console ----\n" + consoleLog.join("\n"));
console.log("\n---- network ----\n" + netLog.join("\n"));
