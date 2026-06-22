// Guaranteed PDF generator using pdfkit (pure Node, no browser/Chromium).
// Used as a fallback when Puppeteer is unavailable so a proposal ALWAYS sends.
import PDFDocument from "pdfkit";
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import type { TemplateMeta } from "./template.js";

const NAVY = "#003366";
const GOLD = "#D4AF37";
const GREY = "#666666";
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;

export function buildProposalPdfFallback(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const date = (meta.date ?? new Date()).toLocaleDateString("en-GB");
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const contentW = right - left;

    // Header
    doc.rect(0, 0, doc.page.width, 90).fill(NAVY);
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
      .text("PREMIER CHOICE INTERNATIONAL", left, 28);
    doc.fillColor(GOLD).fontSize(11).font("Helvetica").text("Payment Proposal", left, 56);
    doc.fillColor("white").fontSize(9).text(date, left, 56, { align: "right", width: contentW });
    doc.y = 110;

    if (meta.clientName) {
      doc.fillColor(GREY).fontSize(10).font("Helvetica").text("Prepared for: ", { continued: true })
        .fillColor(NAVY).font("Helvetica-Bold").text(meta.clientName);
      doc.moveDown(0.5);
    }

    const section = (t: string) => {
      doc.moveDown(0.8).fillColor(NAVY).font("Helvetica-Bold").fontSize(12).text(t);
      doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor(GOLD).lineWidth(1).stroke();
      doc.moveDown(0.6);
    };
    const kv = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(GREY).font("Helvetica").fontSize(10).text(k, left, y, { width: contentW * 0.55 });
      doc.fillColor(NAVY).font("Helvetica-Bold")
        .text(v, left + contentW * 0.55, y, { width: contentW * 0.45, align: "right" });
      doc.moveDown(0.4);
    };

    section("Property Details");
    if (unit.projectName) kv("Project", unit.projectName);
    kv("Unit", unit.name);
    if (unit.typeName) kv("Type", unit.typeName);
    if (unit.categoryName) kv("Category", unit.categoryName);
    if (unit.floorName) kv("Floor", unit.floorName);
    if (unit.grossArea) kv("Area", `${unit.grossArea} sq.ft`);
    kv("Total Price", pkr(unit.totalPrice ?? 0));

    section("Payment Summary");
    if (plan.plan === "full") {
      kv("Payment Condition", "Full Payment");
      kv("Amount Payable", pkr(plan.totalPrice));
    } else {
      kv("Payment Condition", "Installment Plan");
      kv(`Down Payment (${plan.downPaymentPercent}%)`, pkr(plan.downPaymentAmount));
      kv(`On Possession (${plan.possessionPercent}%)`, pkr(plan.possessionAmount));
      if (plan.totalBalloon > 0) kv("Balloon Payments", pkr(plan.totalBalloon));
      kv(`Installments (${plan.installmentMonths} months)`, pkr(plan.remainingForInstallment));
      kv("Approx. Monthly", pkr(plan.averageInstallment));
    }

    if (plan.plan === "installment" && plan.schedule.length) {
      section("Installment Schedule");
      const rowH = 18;
      doc.rect(left, doc.y, contentW, rowH).fill(NAVY);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(9)
        .text("Installment", left + 8, doc.y + 5)
        .text("Amount (PKR)", left, doc.y - 11, { width: contentW - 8, align: "right" });
      doc.y += rowH;
      plan.schedule.forEach((r, i) => {
        if (doc.y > doc.page.height - 70) { doc.addPage(); doc.y = 60; }
        const balloon = r.kind === "balloon";
        if (i % 2 === 0) doc.rect(left, doc.y, contentW, rowH).fill("#F4F6F9");
        doc.fillColor(balloon ? GOLD : NAVY).font(balloon ? "Helvetica-BoldOblique" : "Helvetica").fontSize(9)
          .text(r.label, left + 8, doc.y + 5, { width: contentW * 0.6 })
          .text(Math.round(r.amount).toLocaleString("en-US"), left, doc.y + 5, { width: contentW - 8, align: "right" });
        doc.y += rowH;
      });
    }

    doc.moveDown(1.5);
    doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(8).text(
      "This proposal is indicative and subject to availability and final confirmation by Premier Choice International. Amounts are in PKR.",
      left, doc.y, { width: contentW },
    );
    doc.end();
  });
}
