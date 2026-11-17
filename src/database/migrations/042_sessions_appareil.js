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
// Sessions actives : l'appareil (navigateur ou application mobile) de chaque session est conserve, pour que
// l'utilisateur reconnaisse ses connexions dans « Mon profil » et ferme celles qu'il ne reconnait pas.
const colonneExiste = async (sequelize, table, colonne) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
  { replacements: [table, colonne], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '042_sessions_appareil',
  description: 'Sessions : appareil utilisé (liste des sessions actives, fermeture à distance)',
  async up(sequelize) {
    if (!await colonneExiste(sequelize, 'sessions', 'navigateur')) {
      await sequelize.query('ALTER TABLE sessions ADD COLUMN navigateur VARCHAR(255) NULL AFTER ip');
    }
  },
};
