const { test, expect } = require("@playwright/test");

function norm(v) {
  return String(v ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function getInput(page) {
  const input = page.locator("textarea, [contenteditable='true'], [role='textbox']").first();
  await expect(input).toBeVisible({ timeout: 30000 });
  return input;
}

async function getOutputText(page) {
  const txt = await page.evaluate(() => {
    const norm2 = (s) => String(s ?? "").replace(/\r/g, "").trim();
    const isSinhala = (s) => /[අ-ෆ]/.test(s);
    const inputEl =
      document.querySelector("textarea") ||
      document.querySelector("[contenteditable='true']") ||
      document.querySelector("[role='textbox']");
    const inputVal = inputEl
      ? norm2(inputEl.value ?? inputEl.innerText ?? inputEl.textContent ?? "")
      : "";

    const els = Array.from(
      document.querySelectorAll(
        "[data-testid*='output' i],[id*='output' i],[class*='output' i],[id*='result' i],[class*='result' i],[id*='translate' i],[class*='translate' i],pre,div,p,span,textarea"
      )
    );

    for (const el of els) {
      const v = norm2(el.value ?? el.innerText ?? el.textContent ?? "");
      if (!v) continue;
      if (v === inputVal) continue;
      if (isSinhala(v)) return v;
    }

    for (const el of els) {
      const v = norm2(el.value ?? el.innerText ?? el.textContent ?? "");
      if (!v) continue;
      if (v === inputVal) continue;
      return v;
    }

    return "";
  });
  return norm(txt);
}

test.describe("SwiftTranslator - UI cases", () => {
  test("UI_0001 - Output updates while typing", async ({ page }) => {
    await page.goto("https://swifttranslator.com", { waitUntil: "domcontentloaded" });

    const input = await getInput(page);
    await input.fill("");

    const t = "oba suvendha?";
    await input.type(t.slice(0, 5), { delay: 80 });
    await page.waitForTimeout(800);
    const o1 = await getOutputText(page);

    await input.type(t.slice(5, 10), { delay: 80 });
    await page.waitForTimeout(800);
    const o2 = await getOutputText(page);

    await input.type(t.slice(10), { delay: 80 });
    await page.waitForTimeout(1200);
    const o3 = await getOutputText(page);

    expect(o3.length).toBeGreaterThan(0);
    expect(o1 !== o2 || o2 !== o3).toBeTruthy();
  });

  test("UI_0002 - Clear input clears/changes output", async ({ page }) => {
    await page.goto("https://swifttranslator.com", { waitUntil: "domcontentloaded" });

    const input = await getInput(page);

    await input.fill("mata hari mahansiyi");
    await page.waitForTimeout(1500);
    const before = await getOutputText(page);
    expect(before.length).toBeGreaterThan(0);

    await input.fill("");
    await page.waitForTimeout(1500);
    const after = await getOutputText(page);

    expect(after === "" || after !== before).toBeTruthy();
  });
});