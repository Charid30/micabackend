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
// Menu RDC : Togo (etat du 23/10/2026).
//  - depots : STSL (volume ambiant et volume a 15 °C, sans densite), SODIGAZ et SANOU SA (gaz en kg) ;
//  - destinations : lieux hrsouaga1 a hrsouaga6 du fichier des sorties, a rattacher a une colonne ;
//  - receptions : pays (une reception peut etre livree hors d'un depot suivi, ex. ZENER), lieu de livraison,
//    type d'operation (cession...), fournisseur facultatif ;
//  - chargements : numero de BL.
const colonneExiste = async (sequelize, table, colonne) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
  { replacements: [table, colonne], type: sequelize.QueryTypes.SELECT })).length > 0;

const DEPOTS = [['STSL', 'VOLUMES'], ['SODIGAZ', 'CALCUL'], ['SANOU SA', 'CALCUL']];
const DESTINATIONS = [
  ['Bingo', 'BINGO'], ['Bobo', 'BOBO'], ['Péni', 'PENI'], ['SONABEL', 'SONABEL'], ['Aviation', 'AVIATION'],
  ...[1, 2, 3, 4, 5, 6].map(n => [`hrsouaga${n}`, 'A_CLASSER']),
];

module.exports = {
  name: '038_rdc_togo',
  description: 'Menu RDC : dépôts du Togo, lieux de livraison et type d\'opération des réceptions, BL des chargements',
  async up(sequelize) {
    for (const [table, colonne, definition] of [
      ['rdc_receptions', 'pays', 'VARCHAR(10) NULL'], ['rdc_receptions', 'lieu_livraison', 'VARCHAR(80) NULL'],
      ['rdc_receptions', 'type_operation', 'VARCHAR(40) NULL'], ['rdc_chargements', 'bl', 'VARCHAR(40) NULL'],
    ]) {
      if (!await colonneExiste(sequelize, table, colonne)) await sequelize.query(`ALTER TABLE ${table} ADD COLUMN ${colonne} ${definition}`);
    }
    // Reception livree hors depot suivi : depot facultatif ; le pays porte le rattachement
    await sequelize.query(`ALTER TABLE rdc_receptions MODIFY depot_id INT NULL, MODIFY fournisseur VARCHAR(120) NULL`);
    await sequelize.query(`UPDATE rdc_receptions r JOIN rdc_depots d ON d.id = r.depot_id SET r.pays = d.pays WHERE r.pays IS NULL`);

    for (const [i, [libelle, mode]] of DEPOTS.entries()) {
      await sequelize.query(`INSERT IGNORE INTO rdc_depots (pays, libelle, ordre, mode_saisie) VALUES ('TOGO', ?, ?, ?)`,
        { replacements: [libelle, (i + 1) * 10, mode] });
    }
    for (const [libelle, colonne] of DESTINATIONS) {
      await sequelize.query(`INSERT IGNORE INTO rdc_destinations (pays, libelle, colonne) VALUES ('TOGO', ?, ?)`, { replacements: [libelle, colonne] });
    }
  },
};
