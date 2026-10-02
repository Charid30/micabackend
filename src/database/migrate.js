require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const path = require('path');
const fs   = require('fs');
const sequelize = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('\n🔌 Connexion base de données OK.');

    // Table de suivi des migrations
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        name       VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME     NOT NULL DEFAULT NOW()
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Migrations déjà appliquées
    const [applied] = await sequelize.query('SELECT name FROM _migrations ORDER BY id ASC');
    const appliedNames = new Set(applied.map(r => r.name));

    // Fichiers de migration triés par nom (ordre 001_, 002_, …)
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js') && !f.startsWith('_'))
      .sort();

    const pending = files.filter(f => {
      const mod = require(path.join(MIGRATIONS_DIR, f));
      return !appliedNames.has(mod.name);
    });

    if (pending.length === 0) {
      console.log('✅  Aucune migration en attente — base de données à jour.\n');
      process.exit(0);
    }

    console.log(`\n📋  ${pending.length} migration(s) en attente :\n`);

    for (const file of pending) {
      const migration = require(path.join(MIGRATIONS_DIR, file));
      console.log(`▶  ${migration.name}`);
      if (migration.description) console.log(`   ${migration.description}`);

      try {
        await migration.up(sequelize);
        await sequelize.query('INSERT INTO _migrations (name) VALUES (?)', {
          replacements: [migration.name],
        });
        console.log(`✅  ${migration.name} — appliquée.\n`);
      } catch (err) {
        console.error(`❌  ${migration.name} — ÉCHEC : ${err.message}\n`);
        console.error('    Migration arrêtée. Corrigez l\'erreur avant de relancer.');
        process.exit(1);
      }
    }

    console.log('🎉  Toutes les migrations ont été appliquées.\n');
    process.exit(0);
  } catch (err) {
    console.error('Erreur connexion :', err.message);
    process.exit(1);
  }
}

run();
