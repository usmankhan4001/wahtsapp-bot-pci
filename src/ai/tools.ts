import { searchUnits, getUnitByNumber, getProjectNames, getProjectSummary } from "../inventory/loader.js";
import { PROJECT_DOCUMENTS, getDriveDownloadUrl } from "../documents/registry.js";
import type { Session } from "../session/store.js";
import { sessions, type Language } from "../session/store.js";
import { logger } from "../logger.js";
import type { ProposalRequest } from "../proposal/index.js";

export const toolDeclarations = [
  {
    name: "set_language",
    description: "Record the user's preferred language for the rest of the conversation.",
    parameters: {
      type: "OBJECT",
      properties: { language: { type: "STRING", enum: ["english", "urdu", "roman_urdu"] } },
      required: ["language"],
    },
  },
  {
    name: "query_inventory_sheet",
    description: "Search available units from the PCI inventory database. Filter by project name, unit type, category (like '1 BED', '2 BED', 'SHOP'), floor, maximum price, or minimum area. Returns up to 15 results at a time.",
    parameters: {
      type: "OBJECT",
      properties: {
        project: { type: "STRING", description: "Project name or partial match (e.g. 'Box Park', 'Grand Orchard', 'Buraq Heights')." },
        type: { type: "STRING", description: "Unit type (e.g. 'Shop', 'Residential', 'Commercial')." },
        category: { type: "STRING", description: "Specific category (e.g. '1 BED', '2 BED', 'SHOP', 'KIOSK', 'Premium')." },
        floor: { type: "STRING", description: "Floor filter (e.g. 'Ground', '1st Floor', 'Lower Ground')." },
        maxPrice: { type: "NUMBER", description: "Maximum price in PKR." },
        minArea: { type: "NUMBER", description: "Minimum gross area in SqFt." },
      },
    },
  },
  {
    name: "list_projects",
    description: "List all PCI projects with their total and available unit counts. Use this when a sales rep asks 'What projects do you have?' or 'Show me all projects'.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "generate_proposal",
    description: "Generate a flexible PDF payment proposal for a specific unit and send it to the chat. ALWAYS ask for the client's name first.",
    parameters: {
      type: "OBJECT",
      properties: {
        unitId: { type: "STRING", description: "The EXACT Unit Number from query_inventory_sheet (e.g. 'G-1', 'BPLGK-001')." },
        clientName: { type: "STRING", description: "The name of the client to put on the PDF." },
        plan: { type: "STRING", enum: ["full", "installment"], description: "Full payment or installment plan." },
        downPaymentPercent: { type: "NUMBER", description: "Down payment percentage (e.g., 20, 30, 50)." },
        possessionPercent: { type: "NUMBER", description: "Percentage to pay on possession (e.g., 10, 20)." },
        installmentMonths: { type: "NUMBER", description: "Number of monthly installments (e.g., 12, 24, 36, 48)." },
        balloons: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              month: { type: "NUMBER", description: "The month number (e.g., 6) to pay the balloon payment." },
              amount: { type: "NUMBER", description: "The amount in PKR to pay." }
            },
            required: ["month", "amount"]
          },
          description: "Optional extra bulk payments (balloons) at specific months."
        }
      },
      required: ["unitId", "clientName", "plan"],
    },
  },
  {
    name: "send_project_document",
    description: "Send the official PDF brochure or layout plan for a project directly into the WhatsApp chat.",
    parameters: {
      type: "OBJECT",
      properties: { 
        project: { type: "STRING" },
        documentType: { type: "STRING", enum: ["brochure", "layout"] }
      },
      required: ["project", "documentType"],
    },
  }
];

export interface MediaItem {
  kind: "document" | "image" | "text";
  url?: string;
  filename?: string;
  caption?: string;
}

export interface ToolContext {
  session: Session;
  media?: MediaItem[];
  proposal?: ProposalRequest;
}

const pkr = (n?: number) => n == null ? "—" : `Rs. ${Math.round(n).toLocaleString("en-PK")}`;
const sqft = (n?: number | null) => n == null ? "—" : `${n.toLocaleString("en-PK")} sqft`;

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "set_language": {
      const language = String(args.language) as Language;
      ctx.session.language = language;
      sessions.save(ctx.session);
      return { ok: true, language };
    }

    case "list_projects": {
      const summary = getProjectSummary();
      return {
        projects: summary.map(s => ({
          name: s.project,
          totalUnits: s.total,
          availableUnits: s.available
        }))
      };
    }

    case "query_inventory_sheet": {
      const filter = {
        project: args.project as string | undefined,
        type: args.type as string | undefined,
        category: args.category as string | undefined,
        floor: args.floor as string | undefined,
        maxPrice: args.maxPrice as number | undefined,
        minArea: args.minArea as number | undefined,
      };
      
      const units = searchUnits(filter);
      const top = units.slice(0, 15);
      const enriched = top.map((d) => ({
        unitNumber: d.unit_number,
        project: d.project,
        type: d.unit_type,
        category: d.category,
        floor: d.floor,
        grossArea: sqft(d.area_sqft.gross),
        netArea: sqft(d.area_sqft.net),
        ratePerSqft: pkr(d.base_rate_per_sqft),
        price: pkr(d.price),
      }));
      
      return { totalMatches: units.length, showing: enriched.length, units: enriched };
    }

    case "generate_proposal": {
      const u = getUnitByNumber(String(args.unitId));
      if (!u) return { error: "Unit not found in inventory. Please check the exact unit number." };

      const plan = args.plan as "full" | "installment";
      let dp = args.downPaymentPercent as number | undefined;
      let pos = args.possessionPercent as number | undefined;
      let months = args.installmentMonths as number | undefined;
      const balloons = args.balloons as any;

      // Enforcement for standard reps
      if (!ctx.session.isAdmin) {
        if (dp !== undefined && dp > 30) {
          return { error: "Authorization Error: Standard sales reps can only offer up to 30% down payment." };
        }
        if (pos !== undefined && pos !== 10 && pos !== 20) {
          return { error: "Authorization Error: Standard sales reps can only offer 10% or 20% on possession." };
        }
        if (plan === "installment") {
          const allowedMonths = [12, 24, 36, 48];
          if (months !== undefined && !allowedMonths.includes(months)) {
            return { error: `Authorization Error: Standard sales reps can only offer installments of 1, 2, 3, or 4 years (12, 24, 36, 48 months). You requested ${months}.` };
          }
        }
      }

      ctx.proposal = {
        unitId: String(args.unitId),
        clientName: String(args.clientName),
        plan,
        downPaymentPercent: dp,
        possessionPercent: pos,
        installmentMonths: months,
        balloons
      };
      
      return { ok: true, message: "Proposal generation queued. It will be sent shortly." };
    }

    case "send_project_document": {
      const project = String(args.project ?? "");
      const docType = String(args.documentType ?? "") as "brochure" | "layout";
      
      const docs = PROJECT_DOCUMENTS[project];
      if (!docs || !docs[docType]) {
        return { ok: false, message: `No ${docType} available yet for ${project}.` };
      }
      
      const fileId = docs[docType] as string;
      const downloadUrl = getDriveDownloadUrl(fileId);
      
      (ctx.media ??= []).push({
        kind: "document",
        url: downloadUrl,
        filename: `${project} ${docType === 'brochure' ? 'Brochure' : 'Layout'}.pdf`,
        caption: `${project} — ${docType === 'brochure' ? 'Brochure' : 'Layout Plan'} 📄`,
      });
      
      return { ok: true, message: "Document is being fetched and sent." };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
