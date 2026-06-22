// Box Park-3 proposal template — replicates generatePDFForBoxPark3.js:
//   Page 1: full-page sales-offer cover image
//   Page 2: title (company + project logos, prepared-for, hero, Property Details grid)
//   Page 3: Investment Summary (Financial Breakdown table + gold Installment Schedule)
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import {
  BOXPARK3_COVER,
  COMPANY_LOGO,
  COMPANY_LOGO_WHITE,
  assetsFor,
} from "./assets.js";
import type { TemplateMeta } from "./template.js";

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function renderBoxPark3Html(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): string {
  const a = assetsFor(unit.projectName);
  const client = esc(meta.clientName || "Valued Client");
  const summaryNo = meta.summaryNo ?? Math.floor(1000 + Math.random() * 9000);
  const date = (meta.date ?? new Date()).toLocaleDateString("en-GB");
  const area = unit.grossArea ? `${unit.grossArea} sq. ft.` : "N/A";

  // Financial breakdown (matches generatePDFForBoxPark3.js).
  const financial = [
    ["Total Unit Price", pkr(plan.totalPrice)],
    [`Down Payment (${plan.downPaymentPercent}%)`, pkr(plan.downPaymentAmount)],
    [`Possession (${plan.possessionPercent}%)`, pkr(plan.possessionAmount)],
    ["Total Balloon Amount", pkr(plan.totalBalloon)],
    ["Standard Monthly Installment", pkr(plan.averageInstallment)],
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td class="right bold">${v}</td></tr>`)
    .join("");

  // Installment schedule: flat monthly amount + highlighted balloon rows.
  const balloonsByMonth = new Map<number, number[]>();
  for (const r of plan.schedule) {
    if (r.kind === "balloon") {
      const arr = balloonsByMonth.get(r.month) ?? [];
      arr.push(r.amount);
      balloonsByMonth.set(r.month, arr);
    }
  }
  const scheduleRows: string[] = [];
  for (let i = 1; i <= plan.installmentMonths; i++) {
    scheduleRows.push(
      `<tr><td class="center">${i}</td><td>Monthly Installment</td><td>${pkr(plan.averageInstallment)}</td></tr>`,
    );
    for (const amt of balloonsByMonth.get(i) ?? []) {
      scheduleRows.push(
        `<tr class="balloon"><td class="center"></td><td>BALLOON PAYMENT</td><td>${pkr(amt)}</td></tr>`,
      );
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { --blue:#003366; --gold:#D4AF37; --dark:#343A40; --light:#6C757D; --bg:#F8F9FA; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Helvetica, Arial, sans-serif; color:var(--dark); }
    .page { width:210mm; min-height:297mm; padding:15mm; position:relative; page-break-after:always; }
    .page:last-child { page-break-after:auto; }
    .cover { width:210mm; height:297mm; padding:0; page-break-after:always; }
    .cover img { width:100%; height:100%; object-fit:cover; display:block; }
    .row { display:flex; justify-content:space-between; align-items:flex-start; }
    .company-logo { height:18mm; } .project-logo { height:22mm; }
    .meta { margin-top:12mm; font-size:11pt; } .meta .label { color:var(--light); font-size:9pt; }
    .hero { width:100%; height:80mm; object-fit:cover; border-radius:4px; margin:10mm 0; }
    h2 { color:var(--blue); font-size:15pt; margin:6mm 0 3mm; }
    table { width:100%; border-collapse:collapse; font-size:10pt; }
    .grid td { border:0.3px solid #dcdcdc; padding:3mm; }
    .grid td.k { font-weight:bold; background:var(--bg); width:18%; }
    .header-bar { background:var(--blue); color:#fff; margin:-15mm -15mm 10mm; padding:10mm 15mm;
                  display:flex; justify-content:space-between; align-items:center; }
    .header-bar img { height:14mm; } .header-bar h1 { font-size:22pt; margin:0; }
    .fin th { background:var(--blue); color:#fff; text-align:left; padding:3.5mm 5mm; font-size:12pt; }
    .fin th.right, .fin td.right { text-align:right; }
    .fin td { padding:3.5mm 5mm; } .fin tr:nth-child(odd) td { background:var(--bg); }
    .sched th { background:var(--gold); color:#333; text-align:left; padding:3mm 4mm; }
    .sched th.amt { text-align:right; }
    .sched td { border:0.3px solid #dcdcdc; padding:2.4mm 4mm; }
    .center { text-align:center; } .right { text-align:right; } .bold { font-weight:bold; }
    .sched tr.balloon td { background:#FFF8E1; font-weight:bold; }
    .footer { position:absolute; bottom:10mm; left:15mm; right:15mm; font-size:8pt; color:var(--light); font-style:italic; }
  </style></head><body>

  <!-- PAGE 1 — COVER -->
  <div class="cover"><img src="${BOXPARK3_COVER}" /></div>

  <!-- PAGE 2 — TITLE -->
  <div class="page">
    <div class="row">
      <img class="company-logo" src="${COMPANY_LOGO}" />
      <img class="project-logo" src="${a.logoUrl}" />
    </div>
    <div class="row meta">
      <div>
        <div class="label">Prepared for</div><div><b>${client}</b></div>
        <div style="margin-top:4mm">Project: ${esc(unit.projectName ?? "")}</div>
        <div>Property Type: ${esc(unit.typeName ?? "N/A")}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Summary #</div><div><b>${summaryNo}</b></div>
        <div style="margin-top:4mm" class="label">Date Issued</div><div>${date}</div>
      </div>
    </div>
    <img class="hero" src="${a.imageUrl}" />
    <h2>Property Details</h2>
    <table class="grid"><tbody>
      <tr><td class="k">Project:</td><td>${esc(unit.projectName ?? "")}</td><td class="k">Unit Number:</td><td>${esc(unit.name)}</td></tr>
      <tr><td class="k">Type:</td><td>${esc(unit.typeName ?? "N/A")}</td><td class="k">Category:</td><td>${esc(unit.categoryName ?? "N/A")}</td></tr>
      <tr><td class="k">Floor:</td><td>${esc(unit.floorName ?? "N/A")}</td><td class="k">Total Area:</td><td>${area}</td></tr>
    </tbody></table>
  </div>

  <!-- PAGE 3 — INVESTMENT SUMMARY -->
  <div class="page">
    <div class="header-bar">
      <img src="${COMPANY_LOGO_WHITE}" /><h1>Investment Summary</h1>
    </div>
    <table class="fin">
      <thead><tr><th>Financial Breakdown</th><th class="right">Value</th></tr></thead>
      <tbody>${financial}</tbody>
    </table>
    <h2>Installment Schedule</h2>
    <table class="sched">
      <thead><tr><th style="width:25mm">Month</th><th>Description</th><th class="amt">Amount</th></tr></thead>
      <tbody>${scheduleRows.join("")}</tbody>
    </table>
    <div class="footer">This proposal is indicative and subject to availability and final confirmation by Premier Choice International. Amounts are in PKR.</div>
  </div>

  </body></html>`;
}
