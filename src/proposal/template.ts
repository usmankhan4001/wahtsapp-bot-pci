// HTML proposal template, mirroring the calculator's generatePDF.js layout
// (PKR currency, project logos/hero image, title page + Investment Summary page).
// Rendered to PDF by Puppeteer.
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import { COMPANY_LOGO, COMPANY_LOGO_WHITE, assetsFor } from "./assets.js";

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export interface TemplateMeta {
  clientName?: string;
  summaryNo?: number;
  date?: Date;
}

export function renderProposalHtml(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): string {
  const a = assetsFor(unit.projectName);
  const client = esc(meta.clientName || "Valued Client");
  const summaryNo = meta.summaryNo ?? Math.floor(1000 + Math.random() * 9000);
  const date = (meta.date ?? new Date()).toLocaleDateString("en-GB");
  const condition = plan.plan === "installment" ? "Installment Plan" : "Full Payment";
  const area = unit.grossArea ? `${unit.grossArea} sq. ft.` : "N/A";

  // Schedule rows for page 2.
  const scheduleRows: string[] = [];
  scheduleRows.push(`
    <tr>
      <td>1</td>
      <td>Investment for ${esc(unit.projectName ?? "")}<br><span class="muted">Unit: ${esc(unit.name)}</span></td>
      <td>${area}</td>
      <td class="right">${pkr(plan.totalPrice)}</td>
    </tr>`);
  if (plan.plan === "installment") {
    for (const row of plan.schedule) {
      const isBalloon = row.kind === "balloon";
      scheduleRows.push(`
        <tr class="${isBalloon ? "balloon" : ""}">
          <td></td>
          <td>${esc(row.label)}</td>
          <td></td>
          <td class="right">${pkr(row.amount)}</td>
        </tr>`);
    }
  }

  const totals =
    plan.plan === "installment"
      ? [
          ["Total Price:", pkr(plan.totalPrice)],
          [`Down Payment (${plan.downPaymentPercent}%):`, pkr(plan.downPaymentAmount)],
          [`On Possession (${plan.possessionPercent}%):`, pkr(plan.possessionAmount)],
          ...(plan.totalBalloon > 0 ? [["Balloon Payments:", pkr(plan.totalBalloon)]] : []),
          ["Remaining For Installments:", pkr(plan.remainingForInstallment)],
        ]
      : [["Grand Total:", pkr(plan.totalPrice)]];

  const totalsRows = totals
    .map(([k, v]) => `<tr><td class="right bold">${k}</td><td class="right">${v}</td></tr>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { --blue:#003366; --gold:#D4AF37; --dark:#343A40; --light:#6C757D; --bg:#F8F9FA; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Helvetica, Arial, sans-serif; color: var(--dark); }
    .page { width:210mm; min-height:297mm; padding:15mm; position:relative; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .row { display:flex; justify-content:space-between; align-items:flex-start; }
    .company-logo { height:18mm; }
    .project-logo { height:22mm; }
    .meta { margin-top:12mm; font-size:11pt; }
    .meta .label { color: var(--light); font-size:9pt; }
    .hero { width:100%; height:80mm; object-fit:cover; border-radius:4px; margin-top:10mm; }
    .details { display:flex; margin-top:12mm; }
    .details .col { flex:1; }
    .details .divider { width:1px; background:var(--blue); margin:0 8mm; }
    h2 { color:var(--blue); font-size:15pt; margin:0 0 4mm; }
    .details p { margin:2mm 0; font-size:11pt; }
    /* page 2 */
    .header-bar { background:var(--blue); color:#fff; margin:-15mm -15mm 12mm; padding:10mm 15mm;
                  display:flex; justify-content:space-between; align-items:center; }
    .header-bar img { height:14mm; }
    .header-bar h1 { font-size:22pt; margin:0; }
    table { width:100%; border-collapse:collapse; font-size:10.5pt; }
    .schedule th { background:var(--blue); color:#fff; text-align:left; padding:3mm 4mm; }
    .schedule td { padding:2.6mm 4mm; border-bottom:1px solid #eee; }
    .schedule tr:nth-child(even) td { background:var(--bg); }
    .right { text-align:right; } .bold { font-weight:bold; } .muted { color:var(--light); font-size:9.5pt; }
    .balloon td { color:var(--gold); font-style:italic; font-weight:bold; }
    .totals { margin-top:8mm; width:60%; margin-left:40%; }
    .totals td { padding:1.8mm 4mm; }
    .prepared { display:flex; justify-content:space-between; font-size:11pt; margin-bottom:6mm; }
    .prepared .label { color:var(--light); font-size:9pt; }
    .footer { position:absolute; bottom:10mm; left:15mm; right:15mm; font-size:8pt; color:var(--light); font-style:italic; }
  </style></head><body>

  <!-- PAGE 1 — TITLE -->
  <div class="page">
    <div class="row">
      <img class="company-logo" src="${COMPANY_LOGO}" />
      <img class="project-logo" src="${a.logoUrl}" />
    </div>
    <div class="row meta">
      <div>
        <div class="label">Prepared for</div>
        <div><b>${client}</b></div>
        <div style="margin-top:4mm">Project: ${esc(unit.projectName ?? "")}</div>
        <div>Property Type: ${esc(unit.typeName ?? "N/A")}</div>
      </div>
      <div style="text-align:right">
        <div class="label">Summary #</div>
        <div><b>${summaryNo}</b></div>
        <div style="margin-top:4mm" class="label">Date Issued</div>
        <div>${date}</div>
      </div>
    </div>
    <img class="hero" src="${a.imageUrl}" />
    <div class="details">
      <div class="col">
        <h2>Project Details</h2>
        <p>Project: ${esc(unit.projectName ?? "")}</p>
        <p>Unit Type: ${esc(unit.typeName ?? "N/A")}</p>
        <p>Payment Plan: ${condition}</p>
      </div>
      <div class="divider"></div>
      <div class="col">
        <h2>Unit Details</h2>
        <p>Unit Number: ${esc(unit.name)}</p>
        <p>Type: ${esc(unit.typeName ?? "N/A")}</p>
        <p>Category: ${esc(unit.categoryName ?? "N/A")}</p>
        <p>Floor: ${esc(unit.floorName ?? "N/A")}</p>
        <p>Total Area: ${area}</p>
      </div>
    </div>
  </div>

  <!-- PAGE 2 — INVESTMENT SUMMARY -->
  <div class="page">
    <div class="header-bar">
      <img src="${COMPANY_LOGO_WHITE}" />
      <h1>Investment Summary</h1>
    </div>
    <div class="prepared">
      <div><div class="label">PREPARED FOR</div><b>${client}</b></div>
      <div style="text-align:right"><div class="label">SUMMARY #</div><b>${summaryNo}</b></div>
    </div>
    <table class="schedule">
      <thead><tr><th>#</th><th>DESCRIPTION</th><th>DIMENSIONS</th><th class="right">AMOUNT</th></tr></thead>
      <tbody>${scheduleRows.join("")}</tbody>
    </table>
    <table class="totals"><tbody>${totalsRows}</tbody></table>
    <div class="footer">This proposal is indicative and subject to availability and final confirmation by Premier Choice International. Amounts are in PKR.</div>
  </div>

  </body></html>`;
}
