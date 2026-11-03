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
// Interims : pendant l'absence d'un agent, un autre compte recoit ses droits du premier au dernier jour
// (inclus). Les droits propres du titulaire sont lus a chaque requete : rien n'est copie dans permissions,
// rien n'est a retirer a la fin. modules_exclus : droits du titulaire decoches par l'administrateur.
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

module.exports = {
  name: '037_interims',
  description: 'Intérims : droits d\'un agent absent confiés à un autre compte pour une période',
  async up(sequelize) {
    if (await tableExiste(sequelize, 'interims')) return;
    await sequelize.query(`
      CREATE TABLE interims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulaire_id INT NOT NULL,
        interimaire_id INT NOT NULL,
        date_debut DATE NOT NULL,
        date_fin DATE NOT NULL,
        motif VARCHAR(255) NULL,
        modules_exclus VARCHAR(1000) NULL,
        termine_le DATETIME NULL,
        termine_by INT NULL,
        created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, created_by INT NULL,
        updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, updated_by INT NULL,
        deleted_at DATETIME NULL, deleted_by INT NULL, del TINYINT(1) NULL DEFAULT 0,
        KEY ix_interim_interimaire (interimaire_id, date_debut, date_fin),
        KEY ix_interim_titulaire (titulaire_id, date_debut, date_fin),
        CONSTRAINT fk_interim_titulaire FOREIGN KEY (titulaire_id) REFERENCES utilisateurs(id),
        CONSTRAINT fk_interim_interimaire FOREIGN KEY (interimaire_id) REFERENCES utilisateurs(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  },
};
