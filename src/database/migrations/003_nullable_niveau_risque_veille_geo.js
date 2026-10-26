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
module.exports = {
  name: '003_nullable_niveau_risque_veille_geo',
  description: 'Rend niveau_risque nullable dans veille_geopolitique (aucun niveau obligatoire)',

  async up(sequelize) {
    await sequelize.query(`
      ALTER TABLE veille_geopolitique
        MODIFY COLUMN niveau_risque ENUM('FAIBLE','MOYEN','ELEVE') NULL DEFAULT NULL
    `);
    console.log('  ✓ niveau_risque rendu nullable');
  },
};
