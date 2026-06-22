// Render the HTML proposal template to a PDF via Puppeteer (pixel-match look).
// A single headless browser is reused across requests for speed.
import puppeteer, { type Browser } from "puppeteer";
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import { renderProposalHtml, type TemplateMeta } from "./template.js";
import { renderBoxPark3Html } from "./template-boxpark3.js";
import { isBoxPark3 } from "./assets.js";

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

export async function buildProposalPdf(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  const html = isBoxPark3(unit.projectName)
    ? renderBoxPark3Html(unit, plan, meta)
    : renderProposalHtml(unit, plan, meta);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    // Ensure remote logos/hero images finished loading before printing.
    await page.evaluate(async () => {
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
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
