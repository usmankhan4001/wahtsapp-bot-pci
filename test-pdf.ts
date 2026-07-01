import { generateProposal } from "./src/proposal/index.js";
import { fetchInventory, searchUnits } from "./src/inventory/loader.js";
import fs from "fs";

async function main() {
  await fetchInventory();
  const availableUnits = searchUnits({ project: "grand orchard" });
  if (availableUnits.length === 0) { console.log("No available units found."); return; }
  const unit = availableUnits[0];
  console.log("Testing with unit:", unit.unit_number);

  const req = {
    unitId: unit.unit_number,
    plan: "installment" as const,
    clientName: "John Doe",
    downPaymentPercent: 30,
    possessionPercent: 10,
    installmentMonths: 48,
    balloons: [{ month: 6, amount: 500000 }]
  };
  try {
    const result = await generateProposal(req);
    if (result) {
      fs.writeFileSync("test_output.pdf", result.pdf);
      console.log("PDF generated successfully! Saved to test_output.pdf");
    } else {
      console.log("Failed to generate PDF. Returned null.");
    }
  } catch (err) {
    console.error("Error generating PDF:", err);
  }
}
main().catch(console.error);
