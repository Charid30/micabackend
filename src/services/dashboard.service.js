const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const { RapportHebdo } = require('../models');
const { getAutonomie } = require('./autonomie.service');

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

  // Autonomie : meme calcul que la saisie et le rapport (stocks au jeudi de fin de semaine)
  const rapport = await RapportHebdo.findByPk(rapportId);
  const auto = await getAutonomie(rapport);
  const moyenne = (lignes) => {
    const v = lignes.map(l => l.autonomie).filter(a => a !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };

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

  const charges  = parseInt(camions?.camionsCharges || 0);
  const objectif = parseInt(camions?.objectif || 0);

  // Alertes : chaque depot x produit sous l'objectif (rouge ou jaune)
  const alertes = [...auto.depots_interieurs, ...auto.depots_exterieurs].flatMap(d => d.lignes
    .filter(l => l.couleur === 'rouge' || l.couleur === 'jaune')
    .map(l => ({ produit: l.produit_libelle, depot: d.depot_libelle, autonomie: l.autonomie, seuil: l.objectif_jours, couleur: l.couleur })))
    .sort((a, b) => a.autonomie - b.autonomie);

  return {
    autonomieMoyenneInt:  Math.round(moyenne(auto.synthese_interieure) * 10) / 10,
    autonomieMoyenneExt:  Math.round(moyenne(auto.synthese_exterieure) * 10) / 10,
    camionsCharges:       charges,
    tauxRealisation:      objectif > 0 ? Math.round((charges / objectif) * 1000) / 1000 : 0,
    detteEtat:            parseFloat(dette?.detteEtat || 0),
    alertes,
    stocksInterieurs: auto.synthese_interieure.map(s => ({
      produit:         s.produit_libelle,
      stockDisponible: s.volume_total,
      stockTonnes:     s.volume_total_tonnes,
      autonomie:       s.autonomie ?? 0,
      seuil:           s.objectif_jours,
      couleur:         s.couleur,
      tauxCouverture:  s.objectif_jours > 0 && s.autonomie !== null ? s.autonomie / s.objectif_jours : 0,
    })),
  };
};

module.exports = { getSynthese };
