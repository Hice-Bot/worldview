const Database = require('better-sqlite3');
const db = new Database('.autoforge/features.db');

const rows = db.prepare('SELECT id, name, steps FROM features WHERE id IN (71, 79, 149)').all();
rows.forEach(r => {
  console.log('\n=== Feature', r.id, ':', r.name, '===');
  const steps = JSON.parse(r.steps);
  steps.forEach((s, i) => console.log(`  Step ${i+1}: ${s}`));
});

// Get stats
const total = db.prepare("SELECT COUNT(*) as cnt FROM features").get().cnt;
const passing = db.prepare("SELECT COUNT(*) as cnt FROM features WHERE passes = 1").get().cnt;
const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM features WHERE in_progress = 1").get().cnt;
console.log(`\nStats: ${passing}/${total} passing, ${inProgress} in progress`);

db.close();
