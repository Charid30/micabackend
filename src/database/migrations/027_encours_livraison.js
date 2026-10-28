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
// Menu Encours (fichier « Suivi des indicateurs », onglet Encours) :
//  - encours_lignes  : planning de livraison (produit, fournisseur, corridor, quantite prevue en TM,
//                      date de livraison prevue, statut), rattache a la semaine du rapport ;
//  - encours_besoins : besoin par produit (TM) pour le taux de couverture ;
//  - frequence de saisie (hebdomadaire par defaut) ;
//  - droit « encours-livraison » donne a ceux qui ont deja le droit « achats-traders » (meme equipe).
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

const AUDIT = `
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, created_by INT NULL,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, updated_by INT NULL,
  deleted_at DATETIME NULL, deleted_by INT NULL, del TINYINT(1) NULL DEFAULT 0`;

module.exports = {
  name: '027_encours_livraison',
  description: 'Menu Encours : planning de livraison et besoins par produit, frequence, droits',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'encours_lignes')) {
      await sequelize.query(`
        CREATE TABLE encours_lignes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rapport_id INT NOT NULL,
          date_saisie DATE NULL DEFAULT NULL,
          produit_id INT NOT NULL,
          fournisseur_id INT NOT NULL,
          corridor_id INT NULL,
          quantite_tm DECIMAL(15,3) NOT NULL DEFAULT 0,
          date_livraison DATE NULL,
          statut VARCHAR(30) NOT NULL DEFAULT 'EN_COURS',
          observation VARCHAR(255) NULL,
          ${AUDIT},
          INDEX idx_encours_lignes_rapport (rapport_id, date_saisie),
          CONSTRAINT fk_encours_lignes_rapport FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id),
          CONSTRAINT fk_encours_lignes_produit FOREIGN KEY (produit_id) REFERENCES produits(id),
          CONSTRAINT fk_encours_lignes_fournisseur FOREIGN KEY (fournisseur_id) REFERENCES fournisseurs(id),
          CONSTRAINT fk_encours_lignes_corridor FOREIGN KEY (corridor_id) REFERENCES corridors(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await tableExiste(sequelize, 'encours_besoins')) {
      await sequelize.query(`
        CREATE TABLE encours_besoins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rapport_id INT NOT NULL,
          date_saisie DATE NULL DEFAULT NULL,
          produit_id INT NOT NULL,
          besoin_tm DECIMAL(15,3) NULL,
          ${AUDIT},
          INDEX idx_encours_besoins_rapport (rapport_id, date_saisie),
          CONSTRAINT fk_encours_besoins_rapport FOREIGN KEY (rapport_id) REFERENCES rapports_hebdo(id),
          CONSTRAINT fk_encours_besoins_produit FOREIGN KEY (produit_id) REFERENCES produits(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    await sequelize.query(
      `INSERT IGNORE INTO parametres (cle, valeur, description) VALUES ('FREQUENCE_ENCOURS_LIVRAISON', 'HEBDOMADAIRE', 'Fréquence de saisie (QUOTIDIEN, HEBDOMADAIRE, PERMANENT)')`
    );
    // Meme droit que les achats traders (equipe approvisionnement), sans ecraser un droit deja donne
    await sequelize.query(`
      INSERT INTO permissions (utilisateur_id, module, action, depot_id, created_by)
      SELECT p.utilisateur_id, 'encours-livraison', p.action, NULL, p.created_by
      FROM permissions p
      WHERE p.module = 'achats-traders' AND (p.del = 0 OR p.del IS NULL)
        AND NOT EXISTS (SELECT 1 FROM permissions q WHERE q.utilisateur_id = p.utilisateur_id AND q.module = 'encours-livraison' AND q.action = p.action)`);
  },
};
