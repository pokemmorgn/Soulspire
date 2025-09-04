// scripts/dumpInventory.js
// node scripts/dumpInventory.js <playerId>
const mongoose = require('mongoose');
const playerId = process.argv[2];
if (!playerId) { console.error('Usage: node dumpInventory.js <playerId>'); process.exit(2); }

async function main() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/soulspire_test', { useNewUrlParser: true, useUnifiedTopology: true });
  const Inventory = mongoose.model('Inventory', new mongoose.Schema({}, { strict: false }), 'inventories');
  const inv = await Inventory.findOne({ playerId });
  if (!inv) { console.log('No inventory for', playerId); process.exit(0); }
  console.log('Inventory storage keys and itemIds:');
  const cats = Object.keys(inv.storage || {});
  for (const cat of cats) {
    const items = inv.storage[cat] || [];
    if (!Array.isArray(items)) continue;
    if (items.length === 0) continue;
    console.log(`\nCategory: ${cat} (${items.length} items)`);
    items.forEach(it => {
      console.log(` - itemId: ${it.itemId}  instanceId:${it.instanceId} qty:${it.quantity || 1}`);
    });
  }
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
