import * as fs from "fs";
import * as path from "path";
import xlsx from "xlsx";
import * as cheerio from "cheerio";

// Define the interface that matches the bot's expected UnitData
export interface UnitData {
  unitNumber: string;
  project: string;
  propertyType: string;
  floor: string;
  area: string;
  price: number;
}

const NEW_EXCEL_PATH = path.resolve("E:/Apps/PCI Whatsapp Bot/Inventory/Inventory Updated - PCI - Oct 25.xlsx");
const OLD_HTML_PATH = path.resolve("E:/Apps/PCI Whatsapp Bot/Inventory/export (5).xls");
const OUTPUT_PATH = path.resolve("src/inventory/data.json");

function parsePrice(p: any): number {
  if (typeof p === "number") return p;
  if (!p) return 0;
  const cleaned = String(p).replace(/[^\d.-]/g, "");
  return parseFloat(cleaned) || 0;
}

function getVal(row: Record<string, any>, possibleKeys: string[]): any {
  for (const k of Object.keys(row)) {
    const lowerK = k.toLowerCase().trim();
    for (const p of possibleKeys) {
      if (lowerK.includes(p)) return row[k];
    }
  }
  return undefined;
}

async function compile() {
  const units: UnitData[] = [];
  const projectsFoundInNew = new Set<string>();

  console.log(`Reading new Excel file: ${NEW_EXCEL_PATH}`);
  
  if (fs.existsSync(NEW_EXCEL_PATH)) {
    const wb = xlsx.readFile(NEW_EXCEL_PATH);
    for (const sheetName of wb.SheetNames) {
      // Skip DHA plots per user request
      if (sheetName.toLowerCase().includes("dha")) {
        console.log(`Skipping sheet: ${sheetName}`);
        continue;
      }
      
      const projectName = sheetName.trim();
      projectsFoundInNew.add(projectName.toLowerCase());
      
      const ws = wb.Sheets[sheetName];
      // header: 1 to get array of arrays so we can find where headers actually are
      // But actually it's easier to use { header: 1 }, find header row, then map.
      const rawData = xlsx.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
      
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const rowString = rawData[i].join(" ").toLowerCase();
        if (rowString.includes("unit") && (rowString.includes("price") || rowString.includes("rate"))) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        console.warn(`Could not find header row in sheet: ${sheetName}`);
        continue;
      }

      const headers = rawData[headerRowIdx].map(h => String(h).trim().toLowerCase());
      
      for (let i = headerRowIdx + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0 || !row.some(Boolean)) continue;
        
        // Build an object
        const obj: Record<string, any> = {};
        for (let c = 0; c < headers.length; c++) {
          obj[headers[c]] = row[c];
        }

        const status = getVal(obj, ["status"]);
        if (!status || String(status).toLowerCase().trim() !== "available") continue;

        const unitNumber = getVal(obj, ["unit #", "unit no", "unit number"]);
        if (!unitNumber || String(unitNumber).trim() === "-") continue;

        units.push({
          unitNumber: String(unitNumber).trim(),
          project: projectName,
          propertyType: String(getVal(obj, ["type", "category"]) || ""),
          floor: String(getVal(obj, ["floor", "location"]) || ""),
          area: String(getVal(obj, ["area", "sq ft", "size"]) || ""),
          price: parsePrice(getVal(obj, ["price in rs", "price", "base price"]))
        });
      }
      console.log(`Loaded ${units.length} units so far (after ${sheetName})`);
    }
  } else {
    console.warn("New Excel file not found. Skipping.");
  }

  console.log(`Reading legacy HTML file: ${OLD_HTML_PATH}`);
  if (fs.existsSync(OLD_HTML_PATH)) {
    const html = fs.readFileSync(OLD_HTML_PATH, "utf-8");
    const $ = cheerio.load(html);

    const headers: string[] = [];
    $("th").each((_, el) => {
      headers.push($(el).text().trim());
    });

    const getIdx = (name: string) => headers.findIndex((h) => h.toLowerCase().includes(name.toLowerCase()));
    
    const idxProduct = getIdx("Product");
    const idxProject = getIdx("Project");
    const idxType = getIdx("Unit Type");
    const idxFloor = getIdx("Floor");
    const idxStatus = getIdx("Status");
    const idxGrossArea = getIdx("Gross Area");
    const idxPrice = getIdx("Price");

    let legacyAdded = 0;
    $("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;

      const status = $(tds[idxStatus]).text().trim();
      if (status.toLowerCase() !== "available") return;

      const project = $(tds[idxProject]).text().trim();
      
      // If we already have this project from the new Excel file, skip it
      if (projectsFoundInNew.has(project.toLowerCase())) return;

      const productText = $(tds[idxProduct]).text().trim();
      if (!productText || productText === "Dubai Inventory") return;

      units.push({
        unitNumber: productText,
        project: project,
        propertyType: $(tds[idxType]).text().trim(),
        floor: $(tds[idxFloor]).text().trim(),
        area: $(tds[idxGrossArea]).text().trim(),
        price: parsePrice($(tds[idxPrice]).text()),
      });
      legacyAdded++;
    });
    console.log(`Loaded ${legacyAdded} additional units from legacy HTML file.`);
  }

  console.log(`Total available units across all sources: ${units.length}`);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(units, null, 2), "utf-8");
  console.log(`Saved successfully to ${OUTPUT_PATH}`);
}

compile().catch(console.error);
