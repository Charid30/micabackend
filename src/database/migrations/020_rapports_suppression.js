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
// Suppression (logique) des rapports par l'administrateur.
// L'index unique uq_semaine (annee, semaine_iso) comptait aussi les rapports supprimes : apres la
// suppression du rapport de la semaine en cours, l'application ne pouvait plus en recreer un.
// Il est remplace par un index sur (annee, semaine_iso, actif_unique), ou actif_unique vaut 1 pour un
// rapport actif et NULL pour un rapport supprime (plusieurs NULL sont admis par un index unique).
// Idempotente.
const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;
const indexExists = async (sequelize, table, name) => (await sequelize.query(`SHOW INDEX FROM ${table} WHERE Key_name = '${name}'`))[0].length > 0;

module.exports = {
  name: '020_rapports_suppression',
  async up(sequelize) {
    if (!await columnExists(sequelize, 'rapports_hebdo', 'actif_unique')) {
      await sequelize.query(`
        ALTER TABLE rapports_hebdo
          ADD COLUMN actif_unique TINYINT AS (IF(del = 0, 1, NULL)) STORED
      `);
    }
    if (await indexExists(sequelize, 'rapports_hebdo', 'uq_semaine')) {
      await sequelize.query('ALTER TABLE rapports_hebdo DROP INDEX uq_semaine');
    }
    if (!await indexExists(sequelize, 'rapports_hebdo', 'uq_semaine_active')) {
      await sequelize.query('ALTER TABLE rapports_hebdo ADD UNIQUE INDEX uq_semaine_active (annee, semaine_iso, actif_unique)');
    }
  },
};
