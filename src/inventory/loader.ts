import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";
import { logger } from "../logger.js";

export interface UnitData {
  unitNumber: string;
  project: string;
  propertyType: string;
  floor: string;
  area: string;
  price: number;
}

let inventoryCache: UnitData[] = [];
let lastModified = 0;

const INVENTORY_PATH = path.resolve("E:/Apps/PCI Whatsapp Bot/Inventory/export (5).xls");

function parsePrice(p: string | undefined): number {
  if (!p) return 0;
  const cleaned = p.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
}

export async function fetchInventory(): Promise<UnitData[]> {
  try {
    const stats = fs.statSync(INVENTORY_PATH);
    if (stats.mtimeMs === lastModified && inventoryCache.length > 0) {
      return inventoryCache;
    }

    logger.info("Loading inventory from local XLS (HTML) file...");
    const html = fs.readFileSync(INVENTORY_PATH, "utf-8");
    const $ = cheerio.load(html);

    const headers: string[] = [];
    $("th").each((_, el) => {
      headers.push($(el).text().trim());
    });

    // Map headers to indexes
    const getIdx = (name: string) => headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));
    
    const idxProduct = getIdx("Product");
    const idxProject = getIdx("Project");
    const idxType = getIdx("Unit Type");
    const idxFloor = getIdx("Floor");
    const idxStatus = getIdx("Status");
    const idxGrossArea = getIdx("Gross Area");
    const idxPrice = getIdx("Price");

    const units: UnitData[] = [];

    $("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return; // Header row or empty

      const productText = $(tds[idxProduct]).text().trim();
      // Skip section headers like "Dubai Inventory" or empty products
      if (!productText || productText === "Dubai Inventory") return;

      const project = $(tds[idxProject]).text().trim();
      const status = $(tds[idxStatus]).text().trim();
      
      // We only care about available units for sales
      if (status.toLowerCase() !== "available") return;

      units.push({
        unitNumber: productText,
        project: project,
        propertyType: $(tds[idxType]).text().trim(),
        floor: $(tds[idxFloor]).text().trim(),
        area: $(tds[idxGrossArea]).text().trim(),
        price: parsePrice($(tds[idxPrice]).text()),
      });
    });

    inventoryCache = units;
    lastModified = stats.mtimeMs;
    logger.info(`Loaded ${units.length} available units from local inventory.`);
    return inventoryCache;
  } catch (err) {
    logger.error("Failed to load local inventory", err);
    return inventoryCache; // return stale cache if available
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
