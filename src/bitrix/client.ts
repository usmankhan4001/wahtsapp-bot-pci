// Typed client over the EXISTING PCI calculator backend (live Bitrix24 proxy).
// The bot never talks to Bitrix directly — it goes through these endpoints,
// so it always reflects live, project-wise availability and pricing.
import { config } from "../config.js";
import { logger } from "../logger.js";
import {
  AVAILABLE_VALUE,
  PROP,
  type BitrixEnum,
  type CatalogProduct,
  type NormalizedUnit,
  type ProductDetail,
  type UnitFilter,
} from "./types.js";

const num = (s?: string) => Number(String(s ?? "").replace(/,/g, "")) || 0;

async function post<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${config.bitrixApiBase}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Bitrix ${path} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${config.bitrixApiBase}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Bitrix ${path} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Simple in-memory cache for slow-changing enum lists (projects, types, floors). */
const enumCache = new Map<string, { at: number; data: BitrixEnum[] }>();
const ENUM_TTL_MS = 10 * 60 * 1000;

export class BitrixClient {
  /** All projects. */
  async listProjects(): Promise<BitrixEnum[]> {
    return this.cachedEnum("projects", async () => {
      const data = await get<{ projectData?: { productPropertyEnums?: BitrixEnum[] } }>(
        "/all-projects",
      );
      return data.projectData?.productPropertyEnums ?? [];
    });
  }

  /** Enum values for any property id (types=177, floors=135, categories=139). */
  async listProperties(propertyId: number): Promise<BitrixEnum[]> {
    return this.cachedEnum(`prop-${propertyId}`, async () => {
      const data = await post<{ properties?: { productPropertyEnums?: BitrixEnum[] } }>(
        "/list-properties",
        { propertyId },
      );
      return data.properties?.productPropertyEnums ?? [];
    });
  }

  listTypes() {
    return this.listProperties(PROP.TYPE);
  }
  listFloors() {
    return this.listProperties(PROP.FLOOR);
  }
  listCategories() {
    return this.listProperties(PROP.CATEGORY);
  }

  /** Raw available units matching a filter (filter values are enum IDs). */
  async searchUnits(filter: UnitFilter = {}): Promise<CatalogProduct[]> {
    const data = await post<{ products?: CatalogProduct[] }>("/catalog-products", {
      filter,
    });
    return data.products ?? [];
  }

  /** Full product detail. */
  async getProduct(productId: string): Promise<ProductDetail | null> {
    const data = await post<{ product?: ProductDetail }>("/product", { productId });
    return data.product ?? null;
  }

  /**
   * Fetch a unit's detail and normalize it into a bot-friendly shape with
   * resolved project/type/floor names and computed price (baseRate * grossArea).
   */
  async getNormalizedUnit(productId: string): Promise<NormalizedUnit | null> {
    const [p, projects, types, floors, categories] = await Promise.all([
      this.getProduct(productId),
      this.listProjects(),
      this.listTypes(),
      this.listFloors(),
      this.listCategories(),
    ]);
    if (!p) return null;

    const nameOf = (list: BitrixEnum[], id?: string) =>
      list.find((e) => String(e.id) === String(id))?.value;

    const projectId = p.PROPERTY_173?.value;
    const typeId = p.PROPERTY_177?.value;
    const categoryId = p.PROPERTY_139?.value;
    const floorId = p.PROPERTY_135?.value;
    const baseRate = num(p.PROPERTY_115?.value);
    const grossArea = num(p.PROPERTY_113?.value);
    const netArea = num(p.PROPERTY_149?.value);

    // Pricing: baseRate * grossArea, except Box Park-3 (project 673) on floors
    // 299/301/249 which price on net area (matches changeTheItemFeilds.js).
    const useNetArea =
      projectId === "673" && ["299", "301", "249"].includes(floorId ?? "");
    const areaForPrice = useNetArea ? netArea : grossArea;

    return {
      id: p.ID,
      name: p.NAME,
      projectId,
      projectName: nameOf(projects, projectId),
      typeId,
      typeName: nameOf(types, typeId),
      categoryId,
      categoryName: nameOf(categories, categoryId),
      floorId,
      floorName: nameOf(floors, floorId),
      baseRate,
      grossArea,
      netArea,
      totalPrice: baseRate * areaForPrice,
      available: p.PROPERTY_99?.value === AVAILABLE_VALUE,
    };
  }

  /** Resolve a project name (fuzzy, case-insensitive) to its enum id. */
  async resolveProjectId(nameOrId: string): Promise<string | null> {
    if (/^\d+$/.test(nameOrId)) return nameOrId;
    const projects = await this.listProjects();
    const q = nameOrId.trim().toLowerCase();
    const hit =
      projects.find((p) => p.value.toLowerCase() === q) ??
      projects.find((p) => p.value.toLowerCase().includes(q));
    return hit ? String(hit.id) : null;
  }

  private async cachedEnum(
    key: string,
    loader: () => Promise<BitrixEnum[]>,
  ): Promise<BitrixEnum[]> {
    const hit = enumCache.get(key);
    if (hit && Date.now() - hit.at < ENUM_TTL_MS) return hit.data;
    try {
      const data = await loader();
      enumCache.set(key, { at: Date.now(), data });
      return data;
    } catch (err) {
      logger.error(`Bitrix enum '${key}' fetch failed`, err);
      return hit?.data ?? [];
    }
  }
}

export const bitrix = new BitrixClient();
