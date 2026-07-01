import * as xlsx from "xlsx";
import * as path from "path";

const filePath = path.resolve("E:/Apps/PCI Whatsapp Bot/Inventory/Inventory Updated - PCI - Oct 25.xlsx");
console.log("Reading file:", filePath);

try {
  const wb = xlsx.readFile(filePath);
  console.log("Sheets:", wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    // Print first 5 rows
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`Row ${i}:`, data[i]);
    }
  }
} catch (e) {
  console.error("Error reading file:", e.message);
}
