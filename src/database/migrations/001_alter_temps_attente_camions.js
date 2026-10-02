module.exports = {
  name: '001_alter_temps_attente_camions',
  description: 'Ajout des colonnes site_type, site_nom, nb_camions, temps_moyen, temps_mini, temps_maxi, objectif_jours à temps_attente_camions',

  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temps_attente_camions'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);

    const toAdd = [
      { name: 'site_type',      sql: 'VARCHAR(30)      NULL AFTER rapport_id' },
      { name: 'site_nom',       sql: 'VARCHAR(100)     NULL AFTER site_type' },
      { name: 'nb_camions',     sql: 'INT DEFAULT 0    NULL AFTER site_nom' },
      { name: 'temps_moyen',    sql: 'DECIMAL(8,2)     NULL AFTER nb_camions' },
      { name: 'temps_mini',     sql: 'DECIMAL(8,2)     NULL AFTER temps_moyen' },
      { name: 'temps_maxi',     sql: 'DECIMAL(8,2)     NULL AFTER temps_mini' },
      { name: 'objectif_jours', sql: 'DECIMAL(4,1)     NULL AFTER temps_maxi' },
    ];

    for (const col of toAdd) {
      if (!existing.includes(col.name)) {
        await sequelize.query(`ALTER TABLE temps_attente_camions ADD COLUMN ${col.name} ${col.sql}`);
        console.log(`  + Colonne ajoutée : ${col.name}`);
      } else {
        console.log(`  = Colonne déjà présente : ${col.name}`);
      }
    }
  },
};
