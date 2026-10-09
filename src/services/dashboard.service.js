const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');

const getSynthese = async () => {
  // Chercher le dernier rapport publié
  const [dernierRapport] = await sequelize.query(
    `SELECT id FROM rapports_hebdo WHERE statut = 'PUBLIE' AND del = 0 ORDER BY date_fin DESC LIMIT 1`,
    { type: QueryTypes.SELECT }
  );

  // Pas de rapport publié : retourner des zéros
  if (!dernierRapport) {
    return {
      autonomieMoyenneInt: 0,
      autonomieMoyenneExt: 0,
      camionsCharges: 0,
      tauxRealisation: 0,
      detteEtat: 0,
      alertes: [],
      stocksInterieurs: [],
    };
  }

  const rapportId = dernierRapport.id;

  // Stocks intérieurs — agrégés par produit (somme des stocks, moyenne des autonomies)
  const stocksInterieurs = await sequelize.query(`
    SELECT
      p.code                                AS produit,
      COALESCE(SUM(sd.stock_disponible), 0) AS stockDisponible,
      COALESCE(AVG(sd.autonomie), 0)        AS autonomie,
      COALESCE(MAX(pa.seuil_jours), 15)     AS seuil
    FROM produits p
    CROSS JOIN depots d
    LEFT JOIN stocks_depot sd
      ON sd.produit_id = p.id AND sd.depot_id = d.id
      AND sd.rapport_id = :rapportId AND sd.del = 0
    LEFT JOIN parametres_alertes pa
      ON pa.produit_id = p.id AND pa.del = 0
    WHERE d.type = 'INTERIEUR' AND p.del = 0 AND d.del = 0
    GROUP BY p.id, p.code
    ORDER BY p.code
  `, { type: QueryTypes.SELECT, replacements: { rapportId } });

  // Stocks extérieurs
  const stocksExterieurs = await sequelize.query(`
    SELECT COALESCE(sd.autonomie, 0) AS autonomie
    FROM produits p
    CROSS JOIN depots d
    LEFT JOIN stocks_depot sd
      ON sd.produit_id = p.id AND sd.depot_id = d.id
      AND sd.rapport_id = :rapportId AND sd.del = 0
    WHERE d.type = 'EXTERIEUR' AND p.del = 0 AND d.del = 0
  `, { type: QueryTypes.SELECT, replacements: { rapportId } });

  // Camions
  const [camions] = await sequelize.query(`
    SELECT
      COALESCE(SUM(camions_charges), 0)    AS camionsCharges,
      COALESCE(SUM(objectif_journalier), 0) AS objectif
    FROM chargements_corridors
    WHERE rapport_id = :rapportId AND del = 0
  `, { type: QueryTypes.SELECT, replacements: { rapportId } });

  // Dette État
  const [dette] = await sequelize.query(`
    SELECT COALESCE(SUM(montant), 0) AS detteEtat
    FROM finances_dettes
    WHERE rapport_id = :rapportId
      AND sens = 'DETTE_ETAT_VERS_SONABHY' AND del = 0
  `, { type: QueryTypes.SELECT, replacements: { rapportId } });

  // Calculs
  const avgInt = stocksInterieurs.length
    ? stocksInterieurs.reduce((a, s) => a + parseFloat(s.autonomie), 0) / stocksInterieurs.length
    : 0;

  const avgExt = stocksExterieurs.length
    ? stocksExterieurs.reduce((a, s) => a + parseFloat(s.autonomie), 0) / stocksExterieurs.length
    : 0;

  const charges  = parseInt(camions?.camionsCharges || 0);
  const objectif = parseInt(camions?.objectif || 0);

  const alertes = stocksInterieurs
    .filter(s => parseFloat(s.stockDisponible) > 0 && parseFloat(s.autonomie) < parseFloat(s.seuil))
    .map(s => ({
      produit:  s.produit,
      autonomie: parseFloat(s.autonomie),
      seuil:    parseFloat(s.seuil),
    }));

  return {
    autonomieMoyenneInt:  Math.round(avgInt * 10) / 10,
    autonomieMoyenneExt:  Math.round(avgExt * 10) / 10,
    camionsCharges:       charges,
    tauxRealisation:      objectif > 0 ? Math.round((charges / objectif) * 1000) / 1000 : 0,
    detteEtat:            parseFloat(dette?.detteEtat || 0),
    alertes,
    stocksInterieurs: stocksInterieurs.map(s => ({
      produit:         s.produit,
      stockDisponible: parseFloat(s.stockDisponible),
      autonomie:       parseFloat(s.autonomie),
      seuil:           parseFloat(s.seuil),
      tauxCouverture:  parseFloat(s.seuil) > 0 ? parseFloat(s.autonomie) / parseFloat(s.seuil) : 0,
    })),
  };
};

module.exports = { getSynthese };
