// Gemini function-calling tools. Each has a declaration (sent to Gemini) and an
// executor (run when Gemini calls it). Tools wrap the Bitrix client + session.
import { bitrix } from "../bitrix/client.js";
import type { Session } from "../session/store.js";
import { sessions, type Language } from "../session/store.js";

// Gemini Schema types are uppercase enums (STRING, OBJECT, ...).
export const toolDeclarations = [
  {
    name: "set_language",
    description:
      "Record the customer's preferred language for the rest of the conversation.",
    parameters: {
      type: "OBJECT",
      properties: {
        language: {
          type: "STRING",
          enum: ["english", "urdu", "roman_urdu"],
          description: "The chosen language.",
        },
      },
      required: ["language"],
    },
  },
  {
    name: "list_projects",
    description:
      "List all Premier Choice International projects that have inventory. Use to know which projects exist before searching units.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "search_units",
    description:
      "Search LIVE available units. Filter by project name (or id), property type (e.g. RESIDENTIAL, COMMERCIAL), and/or floor. Returns matching available units. Prices are not included here — use get_unit_details for an exact price.",
    parameters: {
      type: "OBJECT",
      properties: {
        project: { type: "STRING", description: "Project name or id (optional)." },
        type: {
          type: "STRING",
          description: "Property type name or id, e.g. RESIDENTIAL or COMMERCIAL (optional).",
        },
        floor: { type: "STRING", description: "Floor name or id (optional)." },
      },
    },
  },
  {
    name: "get_unit_details",
    description:
      "Get full details for one unit by its id (from search_units): project, type, category, floor, area, base rate, and total price in PKR.",
    parameters: {
      type: "OBJECT",
      properties: {
        unitId: { type: "STRING", description: "The unit's product id." },
      },
      required: ["unitId"],
    },
  },
  {
    name: "generate_proposal",
    description:
      "Generate and send the payment-proposal PDF to the customer for a specific unit. Call ONLY after you have the unit id and the customer's payment preference. For installment plans, include down payment %, on-possession %, and duration in months.",
    parameters: {
      type: "OBJECT",
      properties: {
        unitId: { type: "STRING", description: "Unit product id (from search_units)." },
        plan: { type: "STRING", enum: ["full", "installment"] },
        downPaymentPercent: { type: "NUMBER", description: "e.g. 50 (installment only; min 30)." },
        possessionPercent: { type: "NUMBER", description: "On-possession %, usually 10 or 20." },
        installmentMonths: { type: "NUMBER", description: "6, 12, 24, or 36." },
        balloons: {
          type: "ARRAY",
          description: "Optional lump-sum balloon payments.",
          items: {
            type: "OBJECT",
            properties: {
              month: { type: "NUMBER" },
              amount: { type: "NUMBER" },
            },
          },
        },
      },
      required: ["unitId", "plan"],
    },
  },
  {
    name: "handoff_to_team",
    description:
      "Escalate this chat to a human team. Use for bulk/corporate (B2B), an individual ready to proceed or wanting a human agent (B2C), or complaints/after-sales (CARE).",
    parameters: {
      type: "OBJECT",
      properties: {
        team: { type: "STRING", enum: ["B2B", "B2C", "CARE"] },
        reason: { type: "STRING", description: "Short reason for the handoff." },
      },
      required: ["team", "reason"],
    },
  },
];

/** Result of a handoff so the orchestrator can notify + pause the chat. */
export interface HandoffSignal {
  team: "B2B" | "B2C" | "CARE";
  reason: string;
}

/** Set by generate_proposal; the orchestrator builds + sends the PDF after the turn. */
export interface ProposalSignal {
  unitId: string;
  plan: "full" | "installment";
  downPaymentPercent?: number;
  possessionPercent?: number;
  installmentMonths?: number;
  balloons?: { month: number; amount: number }[];
}

export interface ToolContext {
  session: Session;
  /** Set by handoff_to_team for the orchestrator to act on after the turn. */
  handoff?: HandoffSignal;
  /** Set by generate_proposal for the orchestrator to act on after the turn. */
  proposal?: ProposalSignal;
}

const enumNamesToId = async (
  list: { id: number; value: string }[],
  nameOrId?: string,
): Promise<string | undefined> => {
  if (!nameOrId) return undefined;
  if (/^\d+$/.test(nameOrId)) return nameOrId;
  const q = nameOrId.trim().toLowerCase();
  const hit =
    list.find((e) => e.value.toLowerCase() === q) ??
    list.find((e) => e.value.toLowerCase().includes(q));
  return hit ? String(hit.id) : undefined;
};

const pkr = (n?: number) =>
  n == null ? undefined : `PKR ${Math.round(n).toLocaleString("en-US")}`;

/** Execute a tool call; returns a plain object Gemini will read as the result. */
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
      const projects = await bitrix.listProjects();
      return { projects: projects.map((p) => ({ id: p.id, name: p.value })) };
    }

    case "search_units": {
      const [types, floors] = await Promise.all([
        bitrix.listTypes(),
        bitrix.listFloors(),
      ]);
      const filter = {
        project: await bitrix.resolveProjectId(String(args.project ?? "")) ?? undefined,
        propertyType: await enumNamesToId(types, args.type as string | undefined),
        propertyFloor: await enumNamesToId(floors, args.floor as string | undefined),
      };
      const units = await bitrix.searchUnits(filter);
      // Enrich the first few with floor/area/price so the bot can present them
      // directly (search results alone lack these fields).
      const top = units.slice(0, 8);
      const enriched = await Promise.all(
        top.map(async (u) => {
          try {
            const d = await bitrix.getNormalizedUnit(u.ID);
            return {
              id: u.ID,
              name: u.NAME,
              project: d?.projectName,
              type: d?.typeName,
              floor: d?.floorName,
              area: d?.grossArea ? `${d.grossArea} sq.ft` : undefined,
              price: pkr(d?.totalPrice),
            };
          } catch {
            return { id: u.ID, name: u.NAME };
          }
        }),
      );
      return { count: units.length, showing: enriched.length, units: enriched };
    }

    case "get_unit_details": {
      const u = await bitrix.getNormalizedUnit(String(args.unitId));
      if (!u) return { error: "Unit not found." };
      return {
        id: u.id,
        name: u.name,
        project: u.projectName,
        type: u.typeName,
        category: u.categoryName,
        floor: u.floorName,
        grossArea: u.grossArea,
        baseRate: pkr(u.baseRate),
        totalPrice: pkr(u.totalPrice),
        available: u.available,
      };
    }

    case "generate_proposal": {
      ctx.proposal = {
        unitId: String(args.unitId),
        plan: (args.plan as "full" | "installment") ?? "installment",
        downPaymentPercent: args.downPaymentPercent as number | undefined,
        possessionPercent: args.possessionPercent as number | undefined,
        installmentMonths: args.installmentMonths as number | undefined,
        balloons: args.balloons as { month: number; amount: number }[] | undefined,
      };
      return { ok: true, message: "Proposal PDF is being prepared and will be sent now." };
    }

    case "handoff_to_team": {
      ctx.handoff = {
        team: String(args.team) as HandoffSignal["team"],
        reason: String(args.reason ?? ""),
      };
      return { ok: true, message: "A specialist will be notified." };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
