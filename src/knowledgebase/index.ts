// ── Knowledge Base Loader ──────────────────────────────────────────
// Formats the structured PCI knowledge into a concise text block that
// fits inside Gemini's system prompt. Kept under ~3000 tokens to leave
// room for conversation history and tool results.

import { PCI_KNOWLEDGE as K } from "./pci-knowledge.js";

function bulletList(items: readonly string[], indent = "  "): string {
  return items.map((i) => `${indent}• ${i}`).join("\n");
}

function projectBlock(p: Record<string, unknown>): string {
  const lines: string[] = [`  • ${p.name}`];
  if (p.location) lines.push(`    Location: ${p.location}`);
  if (p.type) lines.push(`    Type: ${p.type}`);
  if (p.area) lines.push(`    Area: ${p.area}`);
  if (p.structure) lines.push(`    Structure: ${p.structure}`);
  if (p.partnership) lines.push(`    Partnership: ${p.partnership}`);
  if (p.approvedBy) lines.push(`    Approved By: ${p.approvedBy}`);
  if (p.unitTypes) lines.push(`    Unit Types: ${p.unitTypes}`);
  if (p.paymentPlans) lines.push(`    Payment Plans: ${p.paymentPlans}`);
  if (p.features) lines.push(`    Features: ${p.features}`);
  if (p.timeline) lines.push(`    Timeline: ${p.timeline}`);
  if (Array.isArray(p.components)) {
    lines.push(`    Sub-Components:\n${p.components.map((c) => `      - ${c}`).join("\n")}`);
  }
  if (Array.isArray(p.keyAmenities)) {
    lines.push(`    Key Amenities: ${(p.keyAmenities as string[]).join(", ")}`);
  }
  if (Array.isArray(p.amenities)) {
    lines.push(`    Amenities: ${(p.amenities as string[]).join(", ")}`);
  }
  if (Array.isArray(p.smartFeatures)) {
    lines.push(`    Smart Features: ${(p.smartFeatures as string[]).join(", ")}`);
  }
  if (p.proximity) lines.push(`    Nearby: ${p.proximity}`);
  return lines.join("\n");
}

/**
 * Build the full knowledge base text for injection into Gemini's system prompt.
 * This is called once per turn — keep it efficient.
 */
export function buildKnowledgeBase(): string {
  const sections: string[] = [];

  // Company overview
  sections.push(`# COMPANY KNOWLEDGE BASE — Premier Choice International (PCI)
Use this information to answer customer questions about PCI. This is AUTHORITATIVE — do NOT guess or invent facts outside this data. For live unit availability and pricing, ALWAYS use the Bitrix tools.

## Company Overview
• Name: ${K.company.name} (${K.company.shortName})
• Founded: ${K.company.founded} in ${K.company.foundedIn}
• Global Footprint: ${K.company.globalFootprint}
• Global Presence: ${K.company.globalPresence.join(", ")}
• Scale: ${K.company.employees}
• Total Projects: ${K.company.totalProjects}
• Certification: ${K.company.certification}
• Website: ${K.company.website}`);

  // Leadership
  sections.push(`## Executive Leadership Team
${K.leadership.map((l) => `• ${l.name} — ${l.role}`).join("\n")}`);

  // PMO divisions & services
  sections.push(`## In-House Project Management Office (PMO) Departments
${bulletList(K.pmoDepartments)}`);

  // Contact
  sections.push(`## Contact Information
• Email: ${K.contact.email}
• Pakistan Landline: ${K.contact.phones.pakistanLandline}
• General Sales Inquiry: ${K.contact.phones.generalSales}
• Dubai Head Office: ${K.contact.phones.dubaiHeadOffice}
• Pakistan Office Address: ${K.contact.offices.pakistan}
• Dubai Office Address: ${K.contact.offices.dubai}
• Business Hours: ${K.contact.businessHours}`);

  // Completed projects
  sections.push(`## Completed Projects (History & Timeline)
${K.projects.completed.map((p) => projectBlock(p as unknown as Record<string, unknown>)).join("\n")}`);

  // Under construction projects
  sections.push(`## Active & Under Construction Projects
${K.projects.underConstruction.map((p) => projectBlock(p as unknown as Record<string, unknown>)).join("\n")}`);

  // FAQs
  sections.push(`## Frequently Asked Questions (FAQs)
${K.faqs.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}`);

  return sections.join("\n\n");
}
