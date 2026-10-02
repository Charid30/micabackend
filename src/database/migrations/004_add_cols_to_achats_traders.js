module.exports = {
  name: '004_add_cols_to_achats_traders',
  description: 'Ajout quantite_m3_15, quantite_m3_ambiant, frais_lc_cfa à achats_traders',

  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'achats_traders'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);

    const toAdd = [
      { name: 'quantite_m3_15',     sql: 'DECIMAL(15,3) NULL AFTER quantite_tm' },
      { name: 'quantite_m3_ambiant', sql: 'DECIMAL(15,3) NULL AFTER quantite_m3_15' },
      { name: 'frais_lc_cfa',       sql: 'DECIMAL(20,2) NULL AFTER montant_trans_cfa' },
    ];

    for (const col of toAdd) {
      if (!existing.includes(col.name)) {
        await sequelize.query(`ALTER TABLE achats_traders ADD COLUMN ${col.name} ${col.sql}`);
        console.log(`  + Colonne ajoutée : ${col.name}`);
      } else {
        console.log(`  = Colonne déjà présente : ${col.name}`);
      }
    }
  },
};
