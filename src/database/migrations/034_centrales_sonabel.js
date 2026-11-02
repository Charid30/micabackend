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
// Menu Centrale SONABEL : suivi quotidien des stocks de combustible des centrales.
//  - centrales_cuves : une ligne par centrale et combustible (valeurs par defaut) ;
//  - centrales_saisies : situation d'un jour, capacite et besoin compris (l'autonomie d'un jour passe
//    ne change pas si le besoin est modifie ensuite) ;
//  - centrales_parcs : camions-citernes en attente sur les parcs de Tanghin et de Komsilga.
// Reprise de depart : situation du 30/10/2026 (fichier de synthese, seul onglet avec des calculs fiables).
const tableExiste = async (sequelize, t) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
  { replacements: [t], type: sequelize.QueryTypes.SELECT })).length > 0;

const AUDIT = `
  created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, created_by INT NULL,
  updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP, updated_by INT NULL,
  deleted_at DATETIME NULL, deleted_by INT NULL, del TINYINT(1) NULL DEFAULT 0`;

const DIFFICILE = 'Produit difficile à aspirer';
const DATE_REPRISE = '2026-10-30';

// [centrale, combustible, capacite, besoin, stock, camions, observation]
const CUVES = [
  ['Ouaga 1', 'DDO', 454342, 30000, 391781, 0, null],
  ['Ouaga 2', 'DDO', 1098149, 60000, 817356, 0, null],
  ['Ouaga 2', 'HFO', 520000, 105000, 27379, 0, null],
  ['Kossodo 1', 'DDO', 890000, 170000, 566789, 0, null],
  ['Kossodo 1', 'HFO', 5699000, 215000, 1325907, 0, DIFFICILE],
  ['Kossodo 2', 'DDO', 1000000, 105000, 882000, 0, null],
  ['Kossodo 2', 'HFO', 4000000, 165000, 570000, 0, null],
  ['Komsilga', 'DDO', 2000000, 350000, 1225000, 17, null],
  ['Komsilga', 'HFO', 20000000, 800000, 888929, 3, null],
  ['Bobo 2', 'DDO', 3800000, 140000, 1635754, 9, null],
  ['Bobo 2', 'HFO', 8500000, 630000, 950000, 0, `${DIFFICILE} : devenu très dense au fil du temps`],
  ['Fada', 'DDO', 360000, 18000, 310530, 0, null],
  ['Fada', 'HFO', 1000000, 18000, 574973, 0, null],
];

// Absentes de l'onglet du 30/10 : capacite et observation du 29/10, sans situation reprise
const AUTRES = [
  ['Fiess', 'HFO', 4540000, 'Cuves de sécurité à Ouaga 2 (540 000) et Kossodo 2 (4 000 000)'],
  ['Pabré', 'DDO', null, 'Manque de cuve de stockage'],
  ['Koudougou', 'DDO', 2000000, null],
  ['Kaya', 'DDO', null, 'Cuve de stockage en confection'],
];

const CAMIONS_PARCS = 'Camions destinés à toutes les centrales, sauf Bobo et ses centrales rattachées';

module.exports = {
  name: '034_centrales_sonabel',
  description: 'Menu Centrale SONABEL : cuves, saisies quotidiennes, parcs, reprise du 30/10/2026',
  async up(sequelize) {
    if (!await tableExiste(sequelize, 'centrales_cuves')) {
      await sequelize.query(`
        CREATE TABLE centrales_cuves (
          id INT AUTO_INCREMENT PRIMARY KEY,
          centrale VARCHAR(80) NOT NULL,
          combustible VARCHAR(10) NOT NULL,
          ordre INT NOT NULL DEFAULT 0,
          capacite INT UNSIGNED NULL,
          besoin_journalier INT UNSIGNED NULL,
          observation VARCHAR(255) NULL,
          ${AUDIT},
          UNIQUE KEY uq_centrale_cuve (centrale, combustible)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await tableExiste(sequelize, 'centrales_saisies')) {
      await sequelize.query(`
        CREATE TABLE centrales_saisies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date_saisie DATE NOT NULL,
          cuve_id INT NOT NULL,
          capacite INT UNSIGNED NULL,
          stock INT UNSIGNED NULL,
          besoin_journalier INT UNSIGNED NULL,
          camions_attente INT UNSIGNED NULL,
          observation VARCHAR(255) NULL,
          ${AUDIT},
          UNIQUE KEY uq_centrale_saisie (date_saisie, cuve_id),
          CONSTRAINT fk_centrale_saisie_cuve FOREIGN KEY (cuve_id) REFERENCES centrales_cuves(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!await tableExiste(sequelize, 'centrales_parcs')) {
      await sequelize.query(`
        CREATE TABLE centrales_parcs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          date_saisie DATE NOT NULL,
          parc VARCHAR(20) NOT NULL,
          camions_hfo INT UNSIGNED NULL,
          camions_ddo INT UNSIGNED NULL,
          observation VARCHAR(255) NULL,
          ${AUDIT},
          UNIQUE KEY uq_centrale_parc (date_saisie, parc)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    let ordre = 0;
    for (const [centrale, combustible, capacite, besoin, stock, camions, observation] of CUVES) {
      ordre += 10;
      await sequelize.query(
        `INSERT IGNORE INTO centrales_cuves (centrale, combustible, ordre, capacite, besoin_journalier, observation) VALUES (?, ?, ?, ?, ?, ?)`,
        { replacements: [centrale, combustible, ordre, capacite, besoin, observation] });
      await sequelize.query(
        `INSERT IGNORE INTO centrales_saisies (date_saisie, cuve_id, capacite, stock, besoin_journalier, camions_attente, observation)
         SELECT ?, id, ?, ?, ?, ?, ? FROM centrales_cuves WHERE centrale = ? AND combustible = ?`,
        { replacements: [DATE_REPRISE, capacite, stock, besoin, camions, observation, centrale, combustible] });
    }
    for (const [centrale, combustible, capacite, observation] of AUTRES) {
      ordre += 10;
      await sequelize.query(
        `INSERT IGNORE INTO centrales_cuves (centrale, combustible, ordre, capacite, observation) VALUES (?, ?, ?, ?, ?)`,
        { replacements: [centrale, combustible, ordre, capacite, observation] });
    }
    await sequelize.query(
      `INSERT IGNORE INTO centrales_parcs (date_saisie, parc, camions_hfo, camions_ddo, observation) VALUES
       (?, 'TANGHIN', 0, 70, ?), (?, 'KOMSILGA', NULL, 10, ?)`,
      { replacements: [DATE_REPRISE, CAMIONS_PARCS, DATE_REPRISE, CAMIONS_PARCS] });

    // Tous les comptes existants en lecture ; l'ecriture est attribuee nominativement
    await sequelize.query(
      `INSERT IGNORE INTO permissions (utilisateur_id, module, action)
       SELECT id, 'centrales', 'READ' FROM utilisateurs WHERE del = 0 AND is_admin = 0`);
  },
};
