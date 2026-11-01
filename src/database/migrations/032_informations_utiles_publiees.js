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
// Le rapport ne lit plus que les « Informations utiles » enregistrees pour sa semaine. Les rapports
// deja publies qui affichaient un texte repris d'une semaine precedente le recoivent ici dans leur
// propre saisie : leur contenu ne change pas.
module.exports = {
  name: '032_informations_utiles_publiees',
  description: 'Rapports publies : informations utiles reprises inscrites dans leur propre saisie',
  async up(sequelize) {
    const select = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
    const rapports = await select(`SELECT id, statut, date_fin FROM rapports_hebdo WHERE del = 0 ORDER BY date_fin ASC, id ASC`);
    let dernierTexte = '';
    for (const r of rapports) {
      const [ligne] = await select(
        `SELECT id, informations_utiles FROM recommandations WHERE rapport_id = ? AND del = 0
         ORDER BY date_saisie DESC, id DESC LIMIT 1`, [r.id]);
      if (ligne?.informations_utiles) {
        dernierTexte = ligne.informations_utiles;
      } else if (r.statut === 'PUBLIE' && dernierTexte) {
        if (ligne) {
          await sequelize.query(`UPDATE recommandations SET informations_utiles = ? WHERE id = ?`, { replacements: [dernierTexte, ligne.id] });
        } else {
          await sequelize.query(
            `INSERT INTO recommandations (rapport_id, date_saisie, informations_utiles, del) VALUES (?, ?, ?, 0)`,
            { replacements: [r.id, r.date_fin, dernierTexte] });
        }
      }
    }
  },
};
