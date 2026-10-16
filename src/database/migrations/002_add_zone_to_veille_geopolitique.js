/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
module.exports = {
  name: '002_add_zone_to_veille_geopolitique',
  description: 'Ajout de la colonne zone à veille_geopolitique',

  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'veille_geopolitique'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const existing = cols.map(c => c.COLUMN_NAME);

    if (!existing.includes('zone')) {
      await sequelize.query(`ALTER TABLE veille_geopolitique ADD COLUMN zone VARCHAR(100) NULL AFTER rapport_id`);
      console.log('  + Colonne ajoutée : zone');
    } else {
      console.log('  = Colonne déjà présente : zone');
    }
  },
};
