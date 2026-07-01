import { logger } from "../logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Matches the structure of PCI_Inventory.json
export interface UnitData {
  project: string;
  unit_number: string;
  unit_type: string;       // e.g. "Shop", "Residential", "Commercial"
  category: string;        // e.g. "SHOP", "1 BED", "2 BED", "Premium"
  floor: string;
  area_sqft: {
    gross: number | null;
    net: number | null;
  };
  base_rate_per_sqft: number;
  price: number;
  price_calc_method: string;
  status: string | null;   // "Available", "Sold", "Reserved", "Hold", "Booked", or null
  data_source: string;
}

let inventoryCache: UnitData[] = [];

export async function fetchInventory(): Promise<UnitData[]> {
  try {
    if (inventoryCache.length > 0) {
      return inventoryCache;
    }

    const dataPath = path.join(__dirname, "data.json");
    if (!fs.existsSync(dataPath)) {
      logger.warn("No data.json found. Please run 'npm run compile-inventory'");
      return [];
    }

    const raw = fs.readFileSync(dataPath, "utf-8");
    inventoryCache = JSON.parse(raw);
    const available = inventoryCache.filter(u => u.status === "Available").length;
    logger.info(`Loaded ${inventoryCache.length} total units (${available} available) from static JSON database.`);
    return inventoryCache;
  } catch (err) {
    logger.error("Failed to load static inventory JSON", err);
    return [];
  }
}

/** Search units with flexible filters. Only returns Available units by default. */
export function searchUnits(filter: {
  project?: string;
  type?: string;
  category?: string;
  floor?: string;
  maxPrice?: number;
  minArea?: number;
  status?: string; // default: "Available"
}): UnitData[] {
  const targetStatus = (filter.status || "Available").toLowerCase();

  return inventoryCache.filter(u => {
    // Status filter
    if (!u.status || u.status.toLowerCase() !== targetStatus) return false;

    // Project filter (fuzzy: includes match)
    if (filter.project && !u.project.toLowerCase().includes(filter.project.toLowerCase())) return false;

    // Type filter (e.g. "Shop", "Residential")
    if (filter.type && !u.unit_type.toLowerCase().includes(filter.type.toLowerCase())) return false;

    // Category filter (e.g. "1 BED", "2 BED", "SHOP", "Premium")
    if (filter.category && !u.category.toLowerCase().includes(filter.category.toLowerCase())) return false;

    // Floor filter (fuzzy)
    if (filter.floor && !u.floor.toLowerCase().includes(filter.floor.toLowerCase())) return false;

    // Max price
    if (filter.maxPrice && u.price > filter.maxPrice) return false;

    // Min area (uses gross)
    if (filter.minArea && (u.area_sqft.gross === null || u.area_sqft.gross < filter.minArea)) return false;

    return true;
  });
}

export function getUnitByNumber(unitNumber: string): UnitData | undefined {
  return inventoryCache.find(u => u.unit_number.toLowerCase() === unitNumber.toLowerCase());
}

/** Get all distinct project names */
export function getProjectNames(): string[] {
  return [...new Set(inventoryCache.map(u => u.project))].sort();
}

/** Get summary stats per project (available count, total count) */
export function getProjectSummary(): { project: string; total: number; available: number }[] {
  const projects = getProjectNames();
  return projects.map(p => {
    const all = inventoryCache.filter(u => u.project === p);
    const avail = all.filter(u => u.status === "Available");
    return { project: p, total: all.length, available: avail.length };
  });
}
