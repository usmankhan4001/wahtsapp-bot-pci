// Generate PDF proposal using the pure PDFKit renderer.
import type { NormalizedUnit } from "../bitrix/types.js";
import type { PlanResult } from "./calc.js";
import { buildProposalPdf as buildWithPdfKit, type TemplateMeta } from "./pdf-renderer.js";

/**
 * Build the proposal PDF using the PDFKit renderer.
 */
export async function buildProposalPdf(
  unit: NormalizedUnit,
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  return buildWithPdfKit(unit, plan, meta);
}
