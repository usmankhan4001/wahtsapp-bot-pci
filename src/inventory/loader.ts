import { logger } from "../logger.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UnitData {
  unitNumber: string;
  project: string;
  propertyType: string;
  floor: string;
  area: string;
  price: number;
}

let inventoryCache: UnitData[] = [];

// To avoid TS compilation issues with large JSON files, we read the JSON synchronously on boot.
export async function fetchInventory(): Promise<UnitData[]> {
  try {
    if (inventoryCache.length > 0) {
      return inventoryCache;
    }

    const dataPath = path.join(process.cwd(), "src/inventory/data.json");
    if (!fs.existsSync(dataPath)) {
      logger.warn("No data.json found. Please run 'npm run compile-inventory'");
      return [];
    }

    const raw = fs.readFileSync(dataPath, "utf-8");
    inventoryCache = JSON.parse(raw);
    logger.info(`Loaded ${inventoryCache.length} available units from static JSON database.`);
    return inventoryCache;
  } catch (err) {
    logger.error("Failed to load static inventory JSON", err);
    return [];
  }
}

export function searchUnits(filter: { project?: string; type?: string; maxPrice?: number }): UnitData[] {
  return inventoryCache.filter(u => {
    if (filter.project && u.project.toLowerCase() !== filter.project.toLowerCase()) return false;
    if (filter.type && u.propertyType.toLowerCase() !== filter.type.toLowerCase()) return false;
    if (filter.maxPrice && u.price > filter.maxPrice) return false;
    return true;
  });
}

export function getUnitByNumber(unitNumber: string): UnitData | undefined {
  return inventoryCache.find(u => u.unitNumber.toLowerCase() === unitNumber.toLowerCase());
}
