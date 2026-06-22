// Build a full proposal (fetch unit -> calc plan -> render PDF).
import { bitrix } from "../bitrix/client.js";
import { calculatePlan, type Balloon } from "./calc.js";
import { buildProposalPdf } from "./pdf.js";

export interface ProposalRequest {
  unitId: string;
  plan: "full" | "installment";
  downPaymentPercent?: number;
  possessionPercent?: number;
  installmentMonths?: number;
  balloons?: Balloon[];
  clientName?: string;
}

export interface ProposalOutput {
  pdf: Buffer;
  filename: string;
  /** Short human summary for WhatsApp caption + manager notification. */
  summary: string;
  unitName: string;
  totalPrice: number;
}

export async function generateProposal(req: ProposalRequest): Promise<ProposalOutput | null> {
  const unit = await bitrix.getNormalizedUnit(req.unitId);
  if (!unit) return null;

  const plan = calculatePlan({
    totalPrice: unit.totalPrice ?? 0,
    plan: req.plan,
    downPaymentPercent: req.downPaymentPercent,
    possessionPercent: req.possessionPercent,
    installmentMonths: req.installmentMonths,
    balloons: req.balloons,
  });

  const pdf = await buildProposalPdf(unit, plan, { clientName: req.clientName });

  const safe = (s: string) => s.replace(/[^\w-]+/g, "_");
  const filename = `PCI_Proposal_${safe(unit.projectName ?? "Unit")}_${safe(unit.name)}.pdf`;

  const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;
  const summary =
    plan.plan === "full"
      ? `${unit.projectName ?? ""} ${unit.name} — Full payment ${pkr(plan.totalPrice)}`
      : `${unit.projectName ?? ""} ${unit.name} — ${pkr(plan.totalPrice)}; ` +
        `DP ${plan.downPaymentPercent}% (${pkr(plan.downPaymentAmount)}), ` +
        `${plan.installmentMonths}m @ ~${pkr(plan.averageInstallment)}/mo`;

  return { pdf, filename, summary, unitName: unit.name, totalPrice: unit.totalPrice ?? 0 };
}
