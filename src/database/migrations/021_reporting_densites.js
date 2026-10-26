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
// Rapport au format du document REPORTING (Word de la direction)
//  - produits.densite_t_m3        : densite a 15 °C, pour convertir en litres les quantites achetees en tonnes
//                                   (encours de livraison) ; modifiable dans le referentiel par la DSTA.
//                                   Gaz : pas de densite, les tonnes sont donnees en kg.
//  - recommandations.informations_utiles : rubrique « Informations utiles » du rapport, reprise d'une
//                                   semaine sur l'autre et modifiable.
// Densites usuelles a 15 °C, a faire confirmer par la DSTA. Idempotente.
const DENSITES = { SUPER91: 0.745, GASOIL: 0.845, DDO: 0.87, PETROLE: 0.8, JET_A1: 0.8, FUEL_OIL: 0.98 };

const columnExists = async (sequelize, table, col) => (await sequelize.query(`SHOW COLUMNS FROM ${table} LIKE '${col}'`))[0].length > 0;

module.exports = {
  name: '021_reporting_densites',
  async up(sequelize) {
    if (!await columnExists(sequelize, 'produits', 'densite_t_m3')) {
      await sequelize.query('ALTER TABLE produits ADD COLUMN densite_t_m3 DECIMAL(6,4) NULL AFTER unite');
      for (const [code, d] of Object.entries(DENSITES)) {
        await sequelize.query('UPDATE produits SET densite_t_m3 = ? WHERE code = ?', { replacements: [d, code] });
      }
    }
    if (!await columnExists(sequelize, 'recommandations', 'informations_utiles')) {
      await sequelize.query('ALTER TABLE recommandations ADD COLUMN informations_utiles TEXT NULL AFTER rapport_id');
    }
  },
};
