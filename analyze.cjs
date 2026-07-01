const data = require('E:/Apps/PCI Whatsapp Bot/Inventory/PCI_Inventory.json');
console.log('Total units:', data.length);
const projects = [...new Set(data.map(u => u.project))];
console.log('Projects:', projects.length);
projects.forEach(p => {
  const all = data.filter(u => u.project === p);
  const avail = all.filter(u => u.status === 'Available');
  console.log('  ' + p + ': ' + all.length + ' total, ' + avail.length + ' available');
});
const statuses = [...new Set(data.map(u => u.status))];
console.log('All statuses:', statuses);
