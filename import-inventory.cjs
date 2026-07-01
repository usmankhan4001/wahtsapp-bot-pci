// Reads the user's finalized PCI_Inventory.json, fixes NaN values, and writes a clean copy to src/inventory/data.json
const fs = require('fs');
const path = require('path');

const inputPath = path.resolve('E:/Apps/PCI Whatsapp Bot/Inventory/PCI_Inventory.json');
const outputPath = path.resolve('src/inventory/data.json');

let raw = fs.readFileSync(inputPath, 'utf-8');

// Fix invalid JSON: NaN -> null
raw = raw.replace(/:\s*NaN\b/g, ': null');

const data = JSON.parse(raw);
console.log('Total units parsed:', data.length);

const projects = [...new Set(data.map(u => u.project))];
console.log('Projects:', projects.length);
projects.forEach(p => {
  const all = data.filter(u => u.project === p);
  const avail = all.filter(u => u.status === 'Available');
  console.log('  ' + p + ': ' + all.length + ' total, ' + avail.length + ' available');
});

const statuses = [...new Set(data.map(u => u.status))];
console.log('All statuses:', statuses);

// Write clean JSON
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
console.log('Saved clean inventory to', outputPath);
