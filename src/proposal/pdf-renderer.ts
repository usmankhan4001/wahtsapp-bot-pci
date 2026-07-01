import PDFDocument from "pdfkit";
// Using any for unit parameter to avoid tight coupling
import type { PlanResult } from "./calc.js";
import { assetsFor, COMPANY_LOGO } from "./assets.js";

import * as fs from "fs";

export interface TemplateMeta {
  clientName?: string;
  date?: Date;
}

const NAVY = "#003366";
const GOLD = "#D4AF37";
const GREY = "#666666";
const LIGHT_GREY = "#F4F6F9";
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;

async function loadAsset(filePath: string): Promise<Buffer | null> {
  if (!filePath) return null;
  try {
    return await fs.promises.readFile(filePath);
  } catch (err) {
    return null;
  }
}

export async function buildProposalPdf(
  unit: any, // using any temporarily since NormalizedUnit was from Bitrix
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  const assets = assetsFor(unit.project); // Was unit.projectName, our loader uses project
  const [projectLogoBuf, companyLogoBuf, heroImageBuf] = await Promise.all([
    loadAsset(assets.logoPath),
    loadAsset(COMPANY_LOGO),
    loadAsset(assets.imagePath)
  ]);

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

    // Header Background
    doc.rect(0, 0, doc.page.width, 110).fill(NAVY);

    // Company Logo (Left)
    if (companyLogoBuf) {
      try {
        doc.image(companyLogoBuf, left, 25, { height: 40 });
      } catch (e) {
        // Fallback text if image fails to render
        doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
          .text("PREMIER CHOICE", left, 35);
      }
    } else {
      doc.fillColor("white").fontSize(20).font("Helvetica-Bold")
        .text("PREMIER CHOICE", left, 35);
    }

    // Project Logo (Right)
    if (projectLogoBuf) {
      try {
        doc.image(projectLogoBuf, right - 100, 25, { height: 40, align: "right" });
      } catch (e) {
        if (unit.project) {
          doc.fillColor(GOLD).fontSize(14).font("Helvetica-Bold")
            .text(unit.project, right - 150, 35, { width: 150, align: "right" });
        }
      }
    } else if (unit.project) {
      doc.fillColor(GOLD).fontSize(14).font("Helvetica-Bold")
        .text(unit.project, right - 150, 35, { width: 150, align: "right" });
    }

    // Header Text
    doc.fillColor(GOLD).fontSize(12).font("Helvetica-Bold").text("PAYMENT PROPOSAL", left, 80);
    doc.fillColor("white").fontSize(10).font("Helvetica").text(`Date: ${date}`, left, 80, { align: "right", width: contentW });

    doc.y = 130;

    // Client Info
    if (meta.clientName) {
      doc.fillColor(GREY).fontSize(11).font("Helvetica").text("Prepared for: ", { continued: true })
        .fillColor(NAVY).font("Helvetica-Bold").text(meta.clientName);
      doc.moveDown(0.8);
    }

    const section = (t: string) => {
      doc.moveDown(0.5).fillColor(NAVY).font("Helvetica-Bold").fontSize(13).text(t);
      doc.moveTo(left, doc.y + 3).lineTo(right, doc.y + 3).strokeColor(GOLD).lineWidth(1.5).stroke();
      doc.moveDown(0.8);
    };

    const kv = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(10).text(k, left, y, { width: contentW * 0.45 });
      doc.fillColor(NAVY).font("Helvetica")
        .text(v, left + contentW * 0.45, y, { width: contentW * 0.55, align: "right" });
      doc.moveDown(0.4);
    };

    // Split Layout for Property Details & Hero Image (if available)
    section("Property Details");

    const detailsStartY = doc.y;
    let imageWidth = 0;

    if (heroImageBuf) {
      imageWidth = 200;
      try {
        doc.image(heroImageBuf, right - imageWidth, detailsStartY, { width: imageWidth, height: 130, fit: [imageWidth, 130] });
      } catch (e) {
        imageWidth = 0; // Reset if image rendering fails
      }
    }

    const detailsWidth = contentW - imageWidth - (imageWidth ? 15 : 0);

    const kvDetails = (k: string, v: string) => {
      const y = doc.y;
      doc.fillColor(GREY).font("Helvetica-Bold").fontSize(10).text(k, left, y, { width: detailsWidth * 0.45 });
      doc.fillColor(NAVY).font("Helvetica")
        .text(v, left + detailsWidth * 0.45, y, { width: detailsWidth * 0.55, align: "left" });
      doc.moveDown(0.4);
    };

    if (unit.project) kvDetails("Project", unit.project);
    kvDetails("Unit", unit.unitNumber);
    if (unit.propertyType) kvDetails("Type", unit.propertyType);
    if (unit.floor) kvDetails("Floor", unit.floor);
    if (unit.area) kvDetails("Area", `${unit.area} sq.ft`);
    
    doc.moveDown(0.5);
    const totalPriceY = doc.y;
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Total Price:", left, totalPriceY, { width: detailsWidth * 0.45 });
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(12).text(pkr(unit.price ?? 0), left + detailsWidth * 0.45, totalPriceY, { width: detailsWidth * 0.55, align: "left" });

    doc.y = Math.max(doc.y, detailsStartY + 140);

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
      // Ensure we have enough space for the table header + a few rows
      if (doc.y > doc.page.height - 150) { doc.addPage(); doc.y = 60; }
      
      section("Installment Schedule");
      const rowH = 22;
      
      // Table Header
      const headerY = doc.y;
      doc.rect(left, headerY, contentW, rowH).fill(NAVY);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
        .text("Description", left + 10, headerY + 6)
        .text("Amount (PKR)", left, headerY + 6, { width: contentW - 10, align: "right" });
      doc.y = headerY + rowH;

      // Table Rows
      plan.schedule.forEach((r, i) => {
        if (doc.y > doc.page.height - 70) { 
          doc.addPage(); 
          doc.y = 60; 
          // Repeat Header
          const repeatHeaderY = doc.y;
          doc.rect(left, repeatHeaderY, contentW, rowH).fill(NAVY);
          doc.fillColor("white").font("Helvetica-Bold").fontSize(10)
            .text("Description", left + 10, repeatHeaderY + 6)
            .text("Amount (PKR)", left, repeatHeaderY + 6, { width: contentW - 10, align: "right" });
          doc.y = repeatHeaderY + rowH;
        }

        const rowY = doc.y;
        const balloon = r.kind === "balloon";
        if (i % 2 === 0) doc.rect(left, rowY, contentW, rowH).fill(LIGHT_GREY);
        
        doc.fillColor(balloon ? GOLD : NAVY)
           .font(balloon ? "Helvetica-Bold" : "Helvetica")
           .fontSize(10)
           .text(r.label, left + 10, rowY + 6, { width: contentW * 0.6 })
           .text(Math.round(r.amount).toLocaleString("en-US"), left, rowY + 6, { width: contentW - 10, align: "right" });
        doc.y = rowY + rowH;
      });
      
      // Table Bottom Border
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(NAVY).lineWidth(1).stroke();
    }

    // Footer
    doc.moveDown(2);
    if (doc.y > doc.page.height - 80) { doc.addPage(); doc.y = 60; }
    
    doc.rect(left, doc.y, contentW, 40).fill(LIGHT_GREY);
    doc.fillColor(GREY).font("Helvetica-Oblique").fontSize(8).text(
      "This proposal is indicative and subject to availability and final confirmation by Premier Choice International. Amounts are in PKR.",
      left + 10, doc.y + 10, { width: contentW - 20, align: "center" },
    );

    doc.end();
  });
}
