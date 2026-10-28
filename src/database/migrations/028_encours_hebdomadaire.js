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
// Menu Encours : saisie hebdomadaire (et non permanente) pour les bases ou la migration 027
// a deja enregistre la frequence permanente.
module.exports = {
  name: '028_encours_hebdomadaire',
  description: 'Frequence de saisie du menu Encours : hebdomadaire',
  async up(sequelize) {
    await sequelize.query(
      `UPDATE parametres SET valeur = 'HEBDOMADAIRE', updated_at = NOW() WHERE cle = 'FREQUENCE_ENCOURS_LIVRAISON' AND valeur = 'PERMANENT'`
    );
    await sequelize.query(
      `INSERT IGNORE INTO parametres (cle, valeur, description) VALUES ('FREQUENCE_ENCOURS_LIVRAISON', 'HEBDOMADAIRE', 'Fréquence de saisie (QUOTIDIEN, HEBDOMADAIRE, PERMANENT)')`
    );
  },
};
