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
// Referentiel : retablit les accents perdus (« B??nin ») quand une valeur a ete modifiee avec un
// outil SQL qui n'etait pas en UTF-8. Seules les valeurs contenant « ? » sont remplacees par la
// valeur d'origine (mica_db.sql) : un libelle personnalise sans erreur d'accent n'est pas touche.
const ORIGINES = [
  { table: 'produits',  code: 'PETROLE',     champs: { libelle: 'Pétrole' } },
  { table: 'depots',    code: 'BINGO',       champs: { libelle: 'Dépôt de Bingo' } },
  { table: 'depots',    code: 'PENI',        champs: { libelle: 'Dépôt de Péni' } },
  { table: 'depots',    code: 'GHANA',       champs: { libelle: 'Dépôt Ghana (TEMA)' } },
  { table: 'depots',    code: 'COTE_IVOIRE', champs: { libelle: "Dépôt Côte d'Ivoire", pays: "Côte d'Ivoire" } },
  { table: 'depots',    code: 'BENIN',       champs: { libelle: 'Dépôt Bénin (Cotonou)', pays: 'Bénin' } },
  { table: 'depots',    code: 'TOGO',        champs: { libelle: 'Dépôt Togo (Lomé)' } },
  { table: 'corridors', code: 'COTE_IVOIRE', champs: { libelle: "Corridor Côte d'Ivoire (Abidjan)" } },
  { table: 'corridors', code: 'COTONOU',     champs: { libelle: 'Corridor Cotonou (Bénin)' } },
  { table: 'corridors', code: 'LOME',        champs: { libelle: 'Corridor Lomé (Togo)' } },
];

module.exports = {
  name: '029_accents_referentiel',
  description: 'Referentiel : retablit les accents perdus (ex. « B??nin »)',
  async up(sequelize) {
    for (const o of ORIGINES) {
      for (const [champ, valeur] of Object.entries(o.champs)) {
        await sequelize.query(
          `UPDATE ${o.table} SET ${champ} = ?, updated_at = NOW() WHERE code = ? AND INSTR(${champ}, CHAR(63)) > 0`,
          { replacements: [valeur, o.code] }
        );
      }
    }
  },
};
