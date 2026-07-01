import { searchUnits, getUnitByNumber } from "../inventory/loader.js";
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
    description: "Search LIVE available units and pricing from the local inventory. Filter by project, type, maxPrice.",
    parameters: {
      type: "OBJECT",
      properties: {
        project: { type: "STRING", description: "Project name (e.g. 'Box Park')." },
        type: { type: "STRING", description: "Property type (e.g. '1 Bed', 'Shop')." },
        maxPrice: { type: "NUMBER", description: "Maximum price in PKR." }
      },
    },
  },
  {
    name: "generate_proposal",
    description: "Generate a flexible PDF payment proposal for a specific unit and send it to the chat. ALWAYS ask for the client's name first.",
    parameters: {
      type: "OBJECT",
      properties: {
        unitId: { type: "STRING", description: "The EXACT Unit Number from query_inventory_sheet." },
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

const pkr = (n?: number) => n == null ? undefined : `PKR ${Math.round(n).toLocaleString("en-US")}`;

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

    case "query_inventory_sheet": {
      const filter = {
        project: args.project as string | undefined,
        type: args.type as string | undefined,
        maxPrice: args.maxPrice as number | undefined
      };
      
      const units = searchUnits(filter);
      const top = units.slice(0, 10);
      const enriched = top.map((d) => ({
        unitId: d.unitNumber,
        project: d.project,
        type: d.propertyType,
        floor: d.floor,
        area: d.area,
        price: pkr(d.price),
      }));
      
      return { count: units.length, showing: enriched.length, units: enriched };
    }

    case "generate_proposal": {
      const u = getUnitByNumber(String(args.unitId));
      if (!u) return { error: "Unit not found in inventory." };

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
