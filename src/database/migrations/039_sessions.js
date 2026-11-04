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
// Sessions cote serveur : chaque connexion a un identifiant (porte par le jeton), revoque a la deconnexion
// et ferme apres SESSION_INACTIVITE_MINUTES sans activite. Un jeton vole ne sert plus apres la
// deconnexion de son titulaire. Les jetons emis avant cette version n'ont pas de session : une seule
// reconnexion est demandee a chacun apres le deploiement.
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '039_sessions',
  description: 'Sessions côté serveur : révocation à la déconnexion, fermeture après inactivité',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'sessions')) {
      await sequelize.query(`
        CREATE TABLE sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          sid CHAR(32) NOT NULL,
          utilisateur_id INT NOT NULL,
          ip VARCHAR(45) NULL,
          cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          derniere_activite DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          revoquee_le DATETIME NULL,
          motif_fin VARCHAR(20) NULL,
          UNIQUE KEY uq_session_sid (sid),
          KEY ix_session_utilisateur (utilisateur_id),
          CONSTRAINT fk_session_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    await sequelize.query(
      `INSERT IGNORE INTO parametres (cle, valeur, description) VALUES
       ('SESSION_INACTIVITE_MINUTES', '30', 'Fermeture de la session après ce nombre de minutes sans activité (5 à 480)')`);
  },
};
