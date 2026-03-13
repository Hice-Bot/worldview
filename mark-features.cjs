const Database = require('better-sqlite3');
const db = new Database('.autoforge/features.db');

// Mark features 71, 79, 149 as passing
const featureIds = [71, 79, 149];
const stmt = db.prepare('UPDATE features SET passes = 1, in_progress = 0 WHERE id = ?');

for (const id of featureIds) {
  const result = stmt.run(id);
  console.log('Feature #' + id + ': updated ' + result.changes + ' row(s)');
}

// Verify
const rows = db.prepare('SELECT id, name, passes, in_progress FROM features WHERE id IN (71, 79, 149)').all();
rows.forEach(r => {
  console.log('  #' + r.id + ' ' + r.name + ': passes=' + r.passes + ' in_progress=' + r.in_progress);
});

// Stats
const total = db.prepare("SELECT COUNT(*) as cnt FROM features").get().cnt;
const passing = db.prepare("SELECT COUNT(*) as cnt FROM features WHERE passes = 1").get().cnt;
console.log('\nOverall: ' + passing + '/' + total + ' passing');

db.close();
