// Generate PDF proposal using the pure PDFKit renderer, and merge with SPA cover if available.
import type { UnitData } from "../inventory/loader.js";
import type { PlanResult } from "./calc.js";
import { buildProposalPdf as buildWithPdfKit, type TemplateMeta } from "./pdf-renderer.js";
import { assetsFor } from "./assets.js";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";

/**
 * Build the proposal PDF using the PDFKit renderer and merge the project's cover page.
 */
export async function buildProposalPdf(
  unit: UnitData,
  plan: PlanResult,
  meta: TemplateMeta = {},
): Promise<Buffer> {
  // 1. Generate the core payment plan using PDFKit
  const planPdfBuffer = await buildWithPdfKit(unit, plan, meta);

  // 2. See if we have a cover PDF for this project
  const assets = assetsFor(unit.project);
  if (!assets.coverPath) {
    return planPdfBuffer; // No cover, just return the plan
  }

  try {
    // 3. Load the cover PDF and merge it
    const coverPdfBytes = await fs.promises.readFile(assets.coverPath);
    
    const mergedPdf = await PDFDocument.create();
    
    // Load both documents
    const coverDoc = await PDFDocument.load(coverPdfBytes);
    const planDoc = await PDFDocument.load(planPdfBuffer);
    
    // Copy the cover page(s) (usually just the first page)
    const coverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach(page => mergedPdf.addPage(page));
    
    // Copy the generated payment plan pages
    const planPages = await mergedPdf.copyPages(planDoc, planDoc.getPageIndices());
    planPages.forEach(page => mergedPdf.addPage(page));
    
    // Serialize to buffer
    const mergedBytes = await mergedPdf.save();
    return Buffer.from(mergedBytes);
  } catch (error) {
    console.error(`Failed to merge cover PDF for project ${unit.project}:`, error);
    // Fallback to just the payment plan if merge fails
    return planPdfBuffer;
  }
}
