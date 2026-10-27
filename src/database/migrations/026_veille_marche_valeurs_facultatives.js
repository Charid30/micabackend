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
// Veille marche : un indicateur peut rester sans valeur (ex. Brent ou WTI non suivis une semaine).
// Les prix N et N-1 deviennent facultatifs ; sinon tout l'enregistrement de l'ecran etait refuse.
module.exports = {
  name: '026_veille_marche_valeurs_facultatives',
  description: 'veille_marche : prix_semaine_n et prix_semaine_n1 facultatifs, taux_change_usd a 0 par defaut',
  async up(sequelize) {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'veille_marche'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const col = (n) => cols.find(c => c.COLUMN_NAME === n);
    for (const n of ['prix_semaine_n', 'prix_semaine_n1']) {
      if (col(n)?.IS_NULLABLE === 'NO') await sequelize.query(`ALTER TABLE veille_marche MODIFY ${n} DECIMAL(10,4) NULL DEFAULT NULL`);
    }
    if (col('taux_change_usd')?.COLUMN_DEFAULT === null) {
      await sequelize.query(`ALTER TABLE veille_marche MODIFY taux_change_usd DECIMAL(10,4) NOT NULL DEFAULT 0`);
    }
  },
};
