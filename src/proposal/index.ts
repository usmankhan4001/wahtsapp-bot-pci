// Build a full proposal (fetch unit -> calc plan -> render PDF).
import { getUnitByNumber } from "../inventory/loader.js";
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
  projectName?: string;
  totalPrice: number;
}

export async function generateProposal(req: ProposalRequest): Promise<ProposalOutput | null> {
  const unit = getUnitByNumber(req.unitId);
  if (!unit) return null;

  const plan = calculatePlan({
    totalPrice: unit.price ?? 0,
    plan: req.plan,
    downPaymentPercent: req.downPaymentPercent,
    possessionPercent: req.possessionPercent,
    installmentMonths: req.installmentMonths,
    balloons: req.balloons,
  });

  const pdf = await buildProposalPdf(unit, plan, { clientName: req.clientName });

  const safe = (s: string) => s.replace(/[^\w-]+/g, "_");
  const filename = `PCI_Proposal_${safe(unit.project ?? "Unit")}_${safe(unit.unit_number)}.pdf`;

  const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-US")}`;
  const summary =
    plan.plan === "full"
      ? `${unit.project ?? ""} ${unit.unit_number} — Full payment ${pkr(plan.totalPrice)}`
      : `${unit.project ?? ""} ${unit.unit_number} — ${pkr(plan.totalPrice)}; ` +
        `DP ${plan.downPaymentPercent}% (${pkr(plan.downPaymentAmount)}), ` +
        `${plan.installmentMonths}m @ ~${pkr(plan.averageInstallment)}/mo`;

  return {
    pdf,
    filename,
    summary,
    unitName: unit.unit_number,
    projectName: unit.project,
    totalPrice: unit.price ?? 0,
  };
}
