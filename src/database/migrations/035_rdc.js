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
// Menu RDC (representations des depots cotiers) : etat quotidien saisi par les representants.
//  - rdc_depots, rdc_destinations : referentiels par pays (Ghana ici ; Benin a recevoir ses fichiers) ;
//  - rdc_stocks, rdc_attentes, rdc_besoins : etat d'un jour ;
//  - rdc_chargements : camion par camion ; rdc_receptions : registre.
// Aucune reprise de donnees : le demarrage est coordonne en interne.
// Droits : le tableau de bord devient un droit (les rapports en avaient deja un), accorde a tous les
// comptes existants pour que rien ne change pour eux ; un compte RDC n'a que son menu.
// Rappel des saisies : 09:35 au lieu de 20:30.
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

const AUDIT = `
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, created_by INT NULL,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, updated_by INT NULL,
  deleted_at DATETIME NULL, deleted_by INT NULL, del TINYINT(1) NULL DEFAULT 0`;

const TABLES = {
  rdc_depots: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    pays VARCHAR(10) NOT NULL,
    libelle VARCHAR(80) NOT NULL,
    ordre INT NOT NULL DEFAULT 0,
    mode_saisie VARCHAR(10) NOT NULL DEFAULT 'CALCUL',
    ${AUDIT},
    UNIQUE KEY uq_rdc_depot (pays, libelle)`,
  rdc_destinations: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    pays VARCHAR(10) NOT NULL,
    libelle VARCHAR(80) NOT NULL,
    colonne VARCHAR(10) NOT NULL,
    ${AUDIT},
    UNIQUE KEY uq_rdc_destination (pays, libelle)`,
  rdc_stocks: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    pays VARCHAR(10) NOT NULL,
    date_saisie DATE NOT NULL,
    depot_id INT NOT NULL,
    produit VARCHAR(10) NOT NULL,
    volume DECIMAL(14,3) NULL,
    ${AUDIT},
    UNIQUE KEY uq_rdc_stock (date_saisie, depot_id, produit),
    KEY ix_rdc_stock_pays (pays, date_saisie),
    CONSTRAINT fk_rdc_stock_depot FOREIGN KEY (depot_id) REFERENCES rdc_depots(id)`,
  rdc_attentes: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_saisie DATE NOT NULL,
    depot_id INT NOT NULL,
    produit VARCHAR(10) NOT NULL,
    camions INT UNSIGNED NULL,
    ${AUDIT},
    UNIQUE KEY uq_rdc_attente (date_saisie, depot_id, produit),
    CONSTRAINT fk_rdc_attente_depot FOREIGN KEY (depot_id) REFERENCES rdc_depots(id)`,
  rdc_besoins: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    pays VARCHAR(10) NOT NULL,
    date_saisie DATE NOT NULL,
    produit VARCHAR(10) NOT NULL,
    quantite INT UNSIGNED NULL,
    repartition VARCHAR(255) NULL,
    ${AUDIT},
    UNIQUE KEY uq_rdc_besoin (pays, date_saisie, produit)`,
  rdc_chargements: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_chargement DATE NOT NULL,
    depot_id INT NOT NULL,
    produit VARCHAR(10) NOT NULL,
    bon VARCHAR(40) NULL,
    bon_origine VARCHAR(40) NULL,
    commande VARCHAR(40) NULL,
    tracteur VARCHAR(20) NULL,
    remorque VARCHAR(20) NULL,
    destination VARCHAR(80) NOT NULL,
    temperature DECIMAL(5,2) NULL,
    densite DECIMAL(7,2) NULL,
    volume_ambiant INT UNSIGNED NULL,
    quantite_20 INT UNSIGNED NULL,
    quantite_kg INT UNSIGNED NULL,
    vcf_depot DECIMAL(9,7) NULL,
    vcf DECIMAL(9,7) NULL,
    volume_15 DECIMAL(12,3) NULL,
    tonnes_vide DECIMAL(12,3) NULL,
    tonnes_air DECIMAL(12,3) NULL,
    ${AUDIT},
    UNIQUE KEY uq_rdc_bon (depot_id, bon),
    KEY ix_rdc_chargement_date (date_chargement, depot_id),
    CONSTRAINT fk_rdc_chargement_depot FOREIGN KEY (depot_id) REFERENCES rdc_depots(id)`,
  rdc_receptions: `
    id INT AUTO_INCREMENT PRIMARY KEY,
    date_reception DATE NOT NULL,
    fournisseur VARCHAR(120) NOT NULL,
    depot_id INT NOT NULL,
    produit VARCHAR(10) NOT NULL,
    quantite DECIMAL(14,3) NOT NULL,
    unite VARCHAR(4) NOT NULL,
    statut VARCHAR(10) NOT NULL,
    ${AUDIT},
    KEY ix_rdc_reception_date (date_reception),
    CONSTRAINT fk_rdc_reception_depot FOREIGN KEY (depot_id) REFERENCES rdc_depots(id)`,
};

// [depot, mode de saisie] ; APD (BOST) ne fournit ni temperature ni densite : quantites relevees, pas de tonnage
const DEPOTS_GHANA = [
  ['TTF-Tema', 'CALCUL'], ['Quantum', 'CALCUL'], ['Quantum GPL', 'CALCUL'], ['TOR', 'CALCUL'], ['Petrohub', 'CALCUL'],
  ['APD (BOST)', 'QUANTITES'], ['TFC', 'CALCUL'], ['Vana', 'CALCUL'], ['Blue Ocean', 'CALCUL'], ['PWSL', 'CALCUL'],
  ['Matrix', 'CALCUL'], ['Sentuo', 'CALCUL'],
];

// Destinations relevees dans le fichier des chargements d'octobre 2026, SONABEL et Aviation en plus
const DESTINATIONS_GHANA = [
  ['Bingo', 'BINGO'], ['Péni', 'BOBO'], ['SONABEL', 'SONABEL'], ['Aviation', 'AVIATION'],
  ['Riverstone', 'MINES'], ['Somisa', 'MINES'], ['Kiakag', 'MINES'], ['Bomboré', 'MINES'], ['Houndé', 'MINES'],
  ['Bissa', 'MINES'], ['Essakane', 'MINES'], ['Wahgnion', 'MINES'], ['Roxgold', 'MINES'],
];

module.exports = {
  name: '035_rdc',
  description: 'Menu RDC (état quotidien, chargements, réceptions), droit Tableau de bord, rappel à 09:35',
  async up(sequelize) {
    for (const [table, colonnes] of Object.entries(TABLES)) {
      if (!await tableExiste(sequelize, table)) {
        await sequelize.query(`CREATE TABLE ${table} (${colonnes}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      }
    }

    for (const [i, [libelle, mode]] of DEPOTS_GHANA.entries()) {
      await sequelize.query(
        `INSERT IGNORE INTO rdc_depots (pays, libelle, ordre, mode_saisie) VALUES ('GHANA', ?, ?, ?)`,
        { replacements: [libelle, (i + 1) * 10, mode] });
    }
    for (const [libelle, colonne] of DESTINATIONS_GHANA) {
      await sequelize.query(
        `INSERT IGNORE INTO rdc_destinations (pays, libelle, colonne) VALUES ('GHANA', ?, ?)`,
        { replacements: [libelle, colonne] });
    }

    // Comptes existants : le tableau de bord reste accessible
    await sequelize.query(
      `INSERT IGNORE INTO permissions (utilisateur_id, module, action)
       SELECT id, 'dashboard', 'READ' FROM utilisateurs WHERE del = 0 AND is_admin = 0`);

    await sequelize.query(
      `INSERT IGNORE INTO parametres (cle, valeur, description) VALUES
       ('NOTIF_RDC_JOURS', '1,2,3,4,5,6,7', 'Jours du rappel des saisies RDC (1 = lundi ... 7 = dimanche)')`);
    await sequelize.query(`UPDATE parametres SET valeur = '09:35' WHERE cle = 'NOTIF_SAISIE_HEURE'`);
  },
};
