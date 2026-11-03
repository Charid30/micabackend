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
// Menu RDC : Benin et Cote d'Ivoire (etats du 23/10/2026).
//  - depots : DPB, Puma, OSPP, Oryx, JNP au Benin ; GESTOCI en Cote d'Ivoire ;
//  - destinations : Benin et Cote d'Ivoire ont une colonne Peni, a completer dans l'onglet Destinations ;
//  - receptions : periode (date de fin), numero EME et navire d'accostage ;
//  - besoins en camions : valeurs negatives possibles (etat du Benin : Gasoil -73).
const colonneExiste = async (sequelize, table, colonne) => (await sequelize.query(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
  { replacements: [table, colonne], type: sequelize.QueryTypes.SELECT })).length > 0;

const DEPOTS = {
  BENIN: ['DPB', 'Puma', 'OSPP', 'Oryx', 'JNP'],
  CI: ['GESTOCI'],
};

const DESTINATIONS = {
  BENIN: [['Bingo', 'BINGO'], ['Péni', 'PENI'], ['SONABEL Ouaga', 'SONABEL'], ['SONABEL Bobo', 'SONABEL'], ['Aviation', 'AVIATION']],
  CI: [['Bingo', 'BINGO'], ['Bobo', 'BOBO'], ['Péni', 'PENI'], ['SONABEL', 'SONABEL'], ['Aviation', 'AVIATION']],
};

module.exports = {
  name: '036_rdc_benin_cote_ivoire',
  description: 'Menu RDC : dépôts du Bénin et de Côte d\'Ivoire, réceptions détaillées, besoins négatifs',
  async up(sequelize) {
    for (const [colonne, definition] of [['date_fin', 'DATE NULL'], ['numero_eme', 'VARCHAR(40) NULL'], ['accostage', 'VARCHAR(80) NULL']]) {
      if (!await colonneExiste(sequelize, 'rdc_receptions', colonne)) {
        await sequelize.query(`ALTER TABLE rdc_receptions ADD COLUMN ${colonne} ${definition}`);
      }
    }
    await sequelize.query(`ALTER TABLE rdc_besoins MODIFY quantite INT NULL`);

    for (const [pays, depots] of Object.entries(DEPOTS)) {
      for (const [i, libelle] of depots.entries()) {
        await sequelize.query(
          `INSERT IGNORE INTO rdc_depots (pays, libelle, ordre, mode_saisie) VALUES (?, ?, ?, 'CALCUL')`,
          { replacements: [pays, libelle, (i + 1) * 10] });
      }
    }
    for (const [pays, destinations] of Object.entries(DESTINATIONS)) {
      for (const [libelle, colonne] of destinations) {
        await sequelize.query(
          `INSERT IGNORE INTO rdc_destinations (pays, libelle, colonne) VALUES (?, ?, ?)`,
          { replacements: [pays, libelle, colonne] });
      }
    }
  },
};
