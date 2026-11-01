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
// Journal d'audit : phrase claire decrivant l'action (les anciennes lignes restent telles quelles,
// leur phrase est calculee a l'affichage)
module.exports = {
  name: '033_journal_description',
  description: 'Journal d\'audit : description lisible de chaque action',
  async up(sequelize) {
    const existe = await sequelize.query(
      `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_actions' AND COLUMN_NAME = 'description'`,
      { type: sequelize.QueryTypes.SELECT });
    if (!existe.length) await sequelize.query(`ALTER TABLE journal_actions ADD COLUMN description VARCHAR(500) NULL AFTER cible`);
  },
};
