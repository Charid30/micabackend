/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 *  Merci
 * ================================================================== */
// Frequence de saisie parametrable par menu (Parametres > Frequences de saisie).
//  - date_saisie sur les tables des saisies hebdomadaires (temps d'attente, veilles, ventes,
//    tresorerie, recommandations) : une saisie par jour devient possible ;
//  - recommandations : la cle unique passe de (rapport) a (rapport, date_saisie) ;
//  - parametres FREQUENCE_* avec le fonctionnement actuel par defaut.
const TABLES = ['temps_attente_camions', 'veille_marche', 'veille_geopolitique', 'ventes_marketeurs', 'tresorerie_semaine', 'recommandations'];

const DEFAUTS = {
  FREQUENCE_STOCKS_INT: 'QUOTIDIEN', FREQUENCE_STOCKS_EXT: 'QUOTIDIEN', FREQUENCE_CORRIDORS: 'QUOTIDIEN',
  FREQUENCE_DEPOTS_INT: 'QUOTIDIEN', FREQUENCE_TEMPS_ATTENTE: 'HEBDOMADAIRE', FREQUENCE_VEILLE_MARCHE: 'HEBDOMADAIRE',
  FREQUENCE_VEILLE_GEO: 'HEBDOMADAIRE', FREQUENCE_VENTES: 'HEBDOMADAIRE', FREQUENCE_TRESORERIE: 'HEBDOMADAIRE',
  FREQUENCE_RECOMMANDATIONS: 'HEBDOMADAIRE',
};

const colonneExiste = async (sequelize, table, col) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
  { replacements: [table, col], type: sequelize.QueryTypes.SELECT })).length > 0;

const indexExiste = async (sequelize, table, nom) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
  { replacements: [table, nom], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '025_frequences_saisie',
  description: 'Frequence de saisie parametrable : date_saisie sur les saisies hebdomadaires, parametres FREQUENCE_*',
  async up(sequelize) {
    for (const t of TABLES) {
      if (!await colonneExiste(sequelize, t, 'date_saisie')) {
        await sequelize.query(`ALTER TABLE ${t} ADD COLUMN date_saisie DATE NULL DEFAULT NULL`);
      }
      if (t !== 'recommandations' && !await indexExiste(sequelize, t, `idx_${t}_date`)) {
        await sequelize.query(`CREATE INDEX idx_${t}_date ON ${t}(rapport_id, date_saisie)`);
      }
    }
    // Recommandations : une ligne par rapport et par jour de saisie
    if (!await indexExiste(sequelize, 'recommandations', 'uq_reco_jour')) {
      await sequelize.query(`ALTER TABLE recommandations ADD UNIQUE KEY uq_reco_jour (rapport_id, date_saisie)`);
    }
    if (await indexExiste(sequelize, 'recommandations', 'rapport_id')) {
      await sequelize.query(`ALTER TABLE recommandations DROP INDEX rapport_id`);
    }
    for (const [cle, valeur] of Object.entries(DEFAUTS)) {
      await sequelize.query(
        `INSERT IGNORE INTO parametres (cle, valeur, description) VALUES (?, ?, 'Fréquence de saisie (QUOTIDIEN, HEBDOMADAIRE, PERMANENT)')`,
        { replacements: [cle, valeur] }
      );
    }
  },
};
