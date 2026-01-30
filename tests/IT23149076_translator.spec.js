// tests/IT23149076_translator.spec.js
const { test, expect } = require("@playwright/test");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const EXCEL_PATH = process.env.EXCEL_PATH
  ? path.resolve(process.env.EXCEL_PATH)
  : path.join(ROOT, "IT23149076_Assignment1_TestCases.xlsx");

function norm(v) {
  return String(v ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanId(v) {
  return norm(v).replace(/^[^A-Za-z0-9]+/, "").trim();
}

function equalsLoose(a, b) {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function findTestCasesSheetName(wb) {
  const names = wb.SheetNames || [];
  const exact = names.find((n) => n.trim().toLowerCase() === "test cases");
  if (exact) return exact;
  const contains = names.find((n) => n.toLowerCase().includes("test cases"));
  if (contains) return contains;
  const contains2 = names.find((n) => n.toLowerCase().includes("test"));
  if (contains2) return contains2;
  return names[0];
}

function findHeaderRowIndex(grid) {
  const scan = Math.min(200, grid.length);
  for (let r = 0; r < scan; r++) {
    const row = grid[r] || [];
    const cells = row.map((c) => norm(c));
    const hasTcId = cells.some((c) => equalsLoose(c, "TC ID") || equalsLoose(c, "Test case ID"));
    const hasInput = cells.some((c) => equalsLoose(c, "Input"));
    const hasExpected = cells.some((c) => equalsLoose(c, "Expected output") || equalsLoose(c, "Expected Output"));
    if (hasTcId && hasInput && hasExpected) return r;
  }
  return -1;
}

function pickColExact(headers, nameOptions) {
  for (let i = 0; i < headers.length; i++) {
    for (const opt of nameOptions) {
      if (equalsLoose(headers[i], opt)) return i;
    }
  }
  return -1;
}

function readCasesFromExcel() {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Excel file not found: ${EXCEL_PATH}`);

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheetName = findTestCasesSheetName(wb);
  const ws = wb.Sheets[sheetName];

  if (!ws || !ws["!ref"]) return { sheetName, cases: [] };

  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (!grid.length) return { sheetName, cases: [] };

  const headerRowIndex = findHeaderRowIndex(grid);
  if (headerRowIndex === -1) {
    throw new Error(
      `Could not find header row. Make sure the sheet has headers like "TC ID", "Input", "Expected output". Sheet: ${sheetName}`
    );
  }

  const headers = (grid[headerRowIndex] || []).map((h) => norm(h));

  // IMPORTANT: Exact match so "Input" does NOT become "Input length type"
  const tcIdx = pickColExact(headers, ["TC ID", "Test case ID"]);
  const inputIdx = pickColExact(headers, ["Input"]);
  const expIdx = pickColExact(headers, ["Expected output", "Expected Output"]);

  if (tcIdx === -1 || inputIdx === -1 || expIdx === -1) {
    throw new Error(
      `Header columns not found properly. Found tcIdx=${tcIdx}, inputIdx=${inputIdx}, expIdx=${expIdx}. Headers: ${headers.join(
        " | "
      )}`
    );
  }

  const cases = [];

  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const row = grid[r] || [];
    if (!row.length) continue;
    if (row.every((c) => norm(c) === "")) continue;

    const tcId = cleanId(row[tcIdx]);
    const input = norm(row[inputIdx]);
    const expected = norm(row[expIdx]);

    if (!tcId) continue;

    const idLower = tcId.toLowerCase();
    const isPosNeg = idLower.startsWith("pos_fun") || idLower.startsWith("neg_fun");
    if (!isPosNeg) continue;

    // must have real input sentence
    if (!input) continue;

    cases.push({ tcId, input, expected, sheet: sheetName, row: r + 1 });
  }

  return { sheetName, cases };
}

function containsSinhala(text) {
  return /[\u0D80-\u0DFF]/.test(text || "");
}

function extractSinhalaFromBigText(big) {
  const t = String(big || "");
  // try to cut between "Sinhala" and "Translate" / "Clear"
  const k = t.lastIndexOf("Sinhala");
  if (k === -1) return t.trim();

  const after = t.slice(k + "Sinhala".length);
  const cutAt = (() => {
    const markers = ["🔁", "Translate", "🗑️", "Clear", "English"];
    let best = -1;
    for (const m of markers) {
      const idx = after.indexOf(m);
      if (idx !== -1) {
        if (best === -1 || idx < best) best = idx;
      }
    }
    return best;
  })();

  const chunk = cutAt === -1 ? after : after.slice(0, cutAt);
  return chunk.replace(/\s+/g, " ").trim();
}

async function readAny(locator) {
  const tag = await locator.evaluate((el) => (el?.tagName ? el.tagName.toLowerCase() : "")).catch(() => "");
  if (tag === "textarea" || tag === "input") {
    const v = await locator.inputValue().catch(() => "");
    return String(v || "").trim();
  }
  const t = await locator.textContent().catch(() => "");
  return String(t || "").trim();
}

async function waitForOutput(page, outputLocator) {
  const t0 = Date.now();
  let last = await readAny(outputLocator);

  while (Date.now() - t0 < 20000) {
    await page.waitForTimeout(300);
    const now = await readAny(outputLocator);

    if (now && now !== last) {
      last = now;
      await page.waitForTimeout(800);
      const after = await readAny(outputLocator);
      if (after === last) return last;
      last = after;
    } else if (now) {
      await page.waitForTimeout(600);
      const after2 = await readAny(outputLocator);
      if (after2 === now) return now;
      last = after2;
    } else {
      last = now;
    }
  }
  return last;
}

// Robust field resolver for swifttranslator.com
async function resolveTranslatorFields(page) {
  await page.goto("https://www.swifttranslator.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  // input is the visible textarea (usually 1 textarea only)
  const inputBox = page.locator("textarea").first();
  await expect(inputBox).toBeVisible({ timeout: 15000 });

  // output is often NOT a second textarea -> it can be a div/span area.
  // We'll detect output by: type a probe, then find a visible node that gains Sinhala text.
  const probe = "oba suvendha?";

  // clear
  const clearBtn = page.getByRole("button", { name: /clear/i }).first();
  if ((await clearBtn.count()) > 0) await clearBtn.click().catch(() => {});
  await inputBox.fill("");

  // baseline snapshot for candidates
  const candidates = page.locator("textarea, div, span, p, pre");
  const count = await candidates.count();
  const before = [];
  const candList = [];

  for (let i = 0; i < count; i++) {
    const loc = candidates.nth(i);
    const vis = await loc.isVisible().catch(() => false);
    if (!vis) continue;

    // skip same element as input
    const same = await page
      .evaluate(
        ([a, b]) => a === b,
        [await loc.elementHandle(), await inputBox.elementHandle()]
      )
      .catch(() => false);
    if (same) continue;

    candList.push(loc);
    before.push(await readAny(loc));
  }

  // type probe
  await inputBox.type(probe, { delay: 10 });
  await page.waitForTimeout(1500);

  let outputBox = null;
  for (let i = 0; i < candList.length; i++) {
    const after = await readAny(candList[i]);
    if (after && after !== before[i] && containsSinhala(after)) {
      outputBox = candList[i];
      break;
    }
  }

  // fallback: readonly/disabled textarea if exists
  if (!outputBox) {
    const ro = page.locator("textarea[readonly], textarea[disabled]").first();
    if ((await ro.count()) > 0 && (await ro.isVisible().catch(() => false))) outputBox = ro;
  }

  // fallback: use whole page text and later extract Sinhala from it
  if (!outputBox) outputBox = page.locator("body");

  // cleanup
  if ((await clearBtn.count()) > 0) await clearBtn.click().catch(() => {});
  await inputBox.fill("");

  await expect(inputBox).toBeVisible({ timeout: 15000 });
  return { inputBox, outputBox };
}

const { sheetName, cases } = readCasesFromExcel();

test.describe("IT23149076 - Functional Automation (Pos_Fun + Neg_Fun)", () => {
  test(`Excel source: ${EXCEL_PATH}`, async () => {
    expect(fs.existsSync(EXCEL_PATH)).toBeTruthy();
  });

  test(`Sheet used: ${sheetName} | Loaded ${cases.length} functional cases`, async () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (let i = 0; i < cases.length; i++) {
    const tc = cases[i];
    const title = `${String(i + 1).padStart(3, "0")} | ${tc.tcId} | row_${tc.row}`;

    test(title, async ({ page }, testInfo) => {
      const { inputBox, outputBox } = await resolveTranslatorFields(page);

      const clearBtn = page.getByRole("button", { name: /clear/i }).first();
      if ((await clearBtn.count()) > 0) await clearBtn.click().catch(() => {});
      await inputBox.fill("");

      await inputBox.type(tc.input, { delay: 10 });

      const raw = await waitForOutput(page, outputBox);

      // If we captured too much (body text), extract Sinhala section
      const actual = outputBox === page.locator("body")
        ? extractSinhalaFromBigText(raw)
        : (raw.length > 300 ? extractSinhalaFromBigText(raw) : raw);

      const expected = String(tc.expected || "").trim();
      const idLower = String(tc.tcId || "").toLowerCase();

      await testInfo.attach("Input", { body: Buffer.from(tc.input, "utf-8"), contentType: "text/plain" });
      await testInfo.attach("Expected Output", { body: Buffer.from(expected, "utf-8"), contentType: "text/plain" });
      await testInfo.attach("Actual Output (raw)", { body: Buffer.from(raw || "", "utf-8"), contentType: "text/plain" });
      await testInfo.attach("Actual Output (final)", { body: Buffer.from(actual || "", "utf-8"), contentType: "text/plain" });

      if (!expected) {
        expect(String(actual || "").trim().length).toBeGreaterThan(0);
      } else if (idLower.startsWith("neg_fun")) {
        // Negative: should NOT match the expected fully
        expect(String(actual || "")).not.toContain(expected);
      } else {
       function normalizeCompareText(s) {
  return String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[. ]+$/g, "")   // remove trailing dots/spaces
    .trim();
}

// ...

const expectedN = normalizeCompareText(expected);
const actualN = normalizeCompareText(actual);

if (!expectedN) {
  expect(actualN.length).toBeGreaterThan(0);
} else if (idLower.startsWith("neg_fun")) {
  expect(actualN).not.toContain(expectedN);
} else {
  expect(actualN).toContain(expectedN);
}
      }
    });
  }
});