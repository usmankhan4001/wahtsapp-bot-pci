// Typed client over the EXISTING PCI calculator backend (live Bitrix24 proxy).
// The bot never talks to Bitrix directly — it goes through these endpoints,
// so it always reflects live, project-wise availability and pricing.
//
// v2: Full in-memory inventory cache. On startup, fetches ALL projects and
// their units. Refreshes every 10 minutes. search_units is instant.
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

async function post<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

async function get<T>(path: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
  // ── Full inventory cache ──────────────────────────────────────
  private _inventoryCache = new Map<string, NormalizedUnit[]>();
  private _allUnitsFlat: NormalizedUnit[] = [];
  private _cacheReady = false;
  private _cacheAge = 0;
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;

  get cacheReady(): boolean { return this._cacheReady; }
  get cacheAge(): number { return this._cacheAge; }
  get cacheStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [pid, units] of this._inventoryCache) {
      const proj = units[0]?.projectName ?? pid;
      stats[proj] = units.length;
    }
    return stats;
  }
  get totalCachedUnits(): number { return this._allUnitsFlat.length; }

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
    }, 60_000); // 60s timeout for large result sets
    return data.products ?? [];
  }

  /** Full product detail. */
  async getProduct(productId: string): Promise<ProductDetail | null> {
    try {
      const data = await post<{ product?: ProductDetail }>("/product", { productId }, 15_000);
      return data.product ?? null;
    } catch (err) {
      logger.error(`Bitrix getProduct failed for ID ${productId}:`, err);
      return null;
    }
  }

  /**
   * Fetch a unit's detail and normalize it into a bot-friendly shape with
   * resolved project/type/floor names and computed price (baseRate * grossArea).
   */
  async getNormalizedUnit(productId: string): Promise<NormalizedUnit | null> {
    // Check cache first
    if (this._cacheReady) {
      const cached = this._allUnitsFlat.find(u => u.id === productId);
      if (cached) return cached;
    }

    const [p, projects, types, floors, categories] = await Promise.all([
      this.getProduct(productId),
      this.listProjects(),
      this.listTypes(),
      this.listFloors(),
      this.listCategories(),
    ]);
    if (!p) return null;

    return this.normalizeProduct(p, projects, types, floors, categories);
  }

  private normalizeProduct(
    p: ProductDetail,
    projects: BitrixEnum[],
    types: BitrixEnum[],
    floors: BitrixEnum[],
    categories: BitrixEnum[],
  ): NormalizedUnit {
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

  // ── Cached search (instant, no API calls) ────────────────────
  /**
   * Search the in-memory inventory cache. Returns units matching the filter
   * with full details (project, type, floor, area, price). Instant.
   * Falls back to live API if cache is not ready.
   */
  searchCached(filter: {
    projectId?: string;
    type?: string;
    floor?: string;
    category?: string;
  }): NormalizedUnit[] {
    if (!this._cacheReady) return [];

    let pool = filter.projectId
      ? this._inventoryCache.get(filter.projectId) ?? []
      : this._allUnitsFlat;

    const fuzzy = (a: string | undefined, b: string) =>
      a ? a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase()) : false;

    if (filter.type) {
      pool = pool.filter(u => fuzzy(u.typeName, filter.type!));
    }
    if (filter.floor) {
      pool = pool.filter(u => fuzzy(u.floorName, filter.floor!));
    }
    if (filter.category) {
      pool = pool.filter(u => fuzzy(u.categoryName, filter.category!));
    }

    // Only return available units
    return pool.filter(u => u.available);
  }

  // ── Cache warmup ──────────────────────────────────────────────
  /**
   * Fetch ALL projects and ALL their units from Bitrix. Runs on startup
   * and every 10 minutes. Each project's units are batch-fetched.
   */
  async warmCache(): Promise<void> {
    const start = Date.now();
    logger.info("Warming Bitrix inventory cache...");

    try {
      const [projects, types, floors, categories] = await Promise.all([
        this.listProjects(),
        this.listTypes(),
        this.listFloors(),
        this.listCategories(),
      ]);

      const newCache = new Map<string, NormalizedUnit[]>();
      let totalUnits = 0;
      let totalAvailable = 0;

      // Fetch units for each project
      for (const proj of projects) {
        try {
          const raw = await this.searchUnits({ project: String(proj.id) });
          if (raw.length === 0) continue;

          // Batch-normalize: fetch full details for each unit
          // Process in batches of 10 to avoid overwhelming the API
          const normalized: NormalizedUnit[] = [];
          const BATCH_SIZE = 10;

          for (let i = 0; i < raw.length; i += BATCH_SIZE) {
            const batch = raw.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(u => this.getProduct(u.ID)),
            );

            for (const r of results) {
              if (r.status === "fulfilled" && r.value) {
                const unit = this.normalizeProduct(r.value, projects, types, floors, categories);
                normalized.push(unit);
                totalUnits++;
                if (unit.available) totalAvailable++;
              }
            }
          }

          if (normalized.length > 0) {
            newCache.set(String(proj.id), normalized);
          }
        } catch (err) {
          logger.warn(`Cache warmup: failed to fetch units for ${proj.value}:`, err instanceof Error ? err.message : err);
        }
      }

      this._inventoryCache = newCache;
      this._allUnitsFlat = [...newCache.values()].flat();
      this._cacheReady = true;
      this._cacheAge = Date.now();

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      logger.info(
        `Inventory cache warm: ${totalAvailable} available / ${totalUnits} total units across ${newCache.size} projects (${elapsed}s)`,
      );
    } catch (err) {
      logger.error("Cache warmup failed:", err);
      // Don't wipe existing cache on failure — stale data > no data
    }
  }

  /** Start background cache refresh every N ms (default: 10 min). */
  startCacheRefresh(intervalMs = 10 * 60 * 1000): void {
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    this._refreshTimer = setInterval(() => {
      this.warmCache().catch((e) => logger.error("Background cache refresh failed", e));
    }, intervalMs);
  }

  /** Resolve a project name (fuzzy, case-insensitive) to its enum id. */
  async resolveProjectId(nameOrId: string): Promise<string | null> {
    if (/^\d+$/.test(nameOrId)) return nameOrId;
    const projects = await this.listProjects();
    const q = nameOrId.trim().toLowerCase();

    // 1. Try to find an alias match via the media registry
    const { findProjectMedia } = await import("../media/registry.js");
    const media = findProjectMedia(q);
    if (media) {
      const hit = projects.find((p) => p.value.toLowerCase() === media.name.toLowerCase());
      if (hit) return String(hit.id);
    }

    // 2. Fall back to standard fuzzy match against Bitrix names
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
