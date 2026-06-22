// Render the HTML proposal template to a PDF via Puppeteer (pixel-match look).
// A single headless browser is reused across requests for speed.
import puppeteer, { type Browser } from "puppeteer";
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import { logger } from "../logger.js";
import { renderProposalHtml, type TemplateMeta } from "./template.js";
import { renderBoxPark3Html } from "./template-boxpark3.js";
import { isBoxPark3 } from "./assets.js";
import { buildProposalPdfFallback } from "./pdf-fallback.js";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

/** Primary renderer: Puppeteer (pixel-match). Throws if Chromium/launch fails. */
async function buildWithPuppeteer(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta,
): Promise<Buffer> {
  const html = isBoxPark3(unit.projectName)
    ? renderBoxPark3Html(unit, plan, meta)
    : renderProposalHtml(unit, plan, meta);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 20000 });
    // Wait for remote images, but never hang — cap at 8s.
    await Promise.race([
      page.evaluate(async () => {
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise((res) => {
                  img.onload = img.onerror = () => res(null);
                }),
          ),
        );
      }),
      new Promise((res) => setTimeout(res, 8000)),
    ]);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Build the proposal PDF. Tries Puppeteer first; if Chromium is unavailable or
 * anything fails, falls back to a pure-Node pdfkit PDF so a proposal ALWAYS sends.
 */
export async function buildProposalPdf(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  try {
    return await buildWithPuppeteer(unit, plan, meta);
  } catch (err) {
    logger.error("Puppeteer PDF failed — using pdfkit fallback:", err instanceof Error ? err.message : err);
    // Reset the browser so a broken instance doesn't poison future attempts.
    browserPromise = null;
    return buildProposalPdfFallback(unit, plan, meta);
  }
}
