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
const sequelize = require('../config/database');
const { QueryTypes } = require('sequelize');
const { RapportHebdo } = require('../models');
const { getAutonomie } = require('./autonomie.service');
const { getTresorerie } = require('./tresorerie.service');

// Situation SONABHY / Etat, issue de la saisie Tresorerie (sous-totaux et leurs lignes de detail) :
//  - dettes de l'Etat envers SONABHY  = sous-total CREANCES_ETAT (moins-values, subventions gaz et SONABEL...)
//  - creances de l'Etat sur SONABHY   = sous-total DETTES_ETAT  (plus-values, droits et taxes de douane...)
// Les lignes de detail suivent le parametrage du chef Treso (ajout / desactivation sans code).
const CODE_DETTES_ETAT = 'CREANCES_ETAT';
const CODE_CREANCES_ETAT = 'DETTES_ETAT';
const situationEtat = (rapport, treso) => {
  const bloc = (code) => {
    const st = treso.lignes.find(l => l.code === code);
    if (!st) return null;
    const ligne = (l) => ({
      libelle: l.libelle, montant: l.montant_n, montant_n1: l.montant_n1,
      ecart: l.ecart, variation_pct: l.variation_pct, changement_signe: l.changement_signe,
      tendance: l.tendance, favorable: l.favorable,
    });
    return { ...ligne(st), details: treso.lignes.filter(l => l.parent_id === st.id).map(ligne) };
  };
  const dettes = bloc(CODE_DETTES_ETAT);
  const creances = bloc(CODE_CREANCES_ETAT);
  const solde = dettes?.montant !== null && dettes?.montant !== undefined && creances?.montant !== null && creances?.montant !== undefined
    ? dettes.montant - creances.montant : null;
  return {
    rapport: { semaine_iso: rapport.semaine_iso, annee: rapport.annee, date_fin: rapport.date_fin },
    dettesEtat: dettes, creancesEtat: creances, solde,
  };
};

// rapportIdDemande : semaine choisie dans le selecteur du tableau de bord (publiee ou en cours) ;
// par defaut, le dernier rapport publie
const getSynthese = async (rapportIdDemande = null) => {
  let dernierRapport;
  if (rapportIdDemande) {
    dernierRapport = await RapportHebdo.findOne({ where: { id: rapportIdDemande, del: 0 }, attributes: ['id'] });
    if (!dernierRapport) throw { status: 404, message: 'Rapport introuvable.' };
  } else {
    [dernierRapport] = await sequelize.query(
      `SELECT id FROM rapports_hebdo WHERE statut = 'PUBLIE' AND del = 0 ORDER BY date_fin DESC LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
  }

  // Pas de rapport publié : retourner des zéros
  if (!dernierRapport) {
    return {
      autonomieMoyenneInt: 0,
      autonomieMoyenneExt: 0,
      camionsCharges: 0,
      tauxRealisation: 0,
      detteEtat: 0,
      creanceEtat: 0,
      situationEtat: null,
      alertes: [],
      stocksInterieurs: [],
      encours: null,
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
  const camionsDe = async (id) => {
    const [c] = await sequelize.query(`
      SELECT
        COALESCE(SUM(camions_charges), 0)    AS camionsCharges,
        COALESCE(SUM(objectif_journalier), 0) AS objectif
      FROM chargements_corridors
      WHERE rapport_id = :id AND del = 0
    `, { type: QueryTypes.SELECT, replacements: { id } });
    const charges = parseInt(c?.camionsCharges || 0);
    const objectif = parseInt(c?.objectif || 0);
    return { charges, taux: objectif > 0 ? Math.round((charges / objectif) * 1000) / 1000 : 0 };
  };
  const camions = await camionsDe(rapportId);

  // Situation avec l'Etat (tresorerie du rapport publie)
  const etat = situationEtat(rapport, await getTresorerie(rapport));


  // Encours fournisseurs par produit (menu Encours) : cumul, besoin, taux de couverture
  const enc = await require('./encoursLivraison.service').getEncours(rapport);

  // Stock national (depots interieurs, m³) et evolution par rapport au rapport precedent
  // (en-tete du tableau de bord sur telephone)
  const totalInterieur = (a) => a.synthese_interieure.reduce((t, x) => t + (Number(x.volume_total) || 0), 0);
  const stockNational = totalInterieur(auto);
  let stockPrecedent = null;
  // Semaine precedente : comparaison N / N-1 (cartes et tableau des stocks)
  let autoPrec = null;
  let comparaison = null;
  const [precedent] = await sequelize.query(
    'SELECT id FROM rapports_hebdo WHERE del = 0 AND date_fin < :debut ORDER BY date_fin DESC LIMIT 1',
    { type: QueryTypes.SELECT, replacements: { debut: rapport.date_debut } }
  );
  if (precedent) {
    const rapportPrec = await RapportHebdo.findByPk(precedent.id);
    autoPrec = await getAutonomie(rapportPrec).catch(() => null);
    if (autoPrec) stockPrecedent = totalInterieur(autoPrec);
    const camionsPrec = await camionsDe(precedent.id);
    comparaison = {
      rapport: { id: rapportPrec.id, semaine_iso: rapportPrec.semaine_iso, annee: rapportPrec.annee, date_debut: rapportPrec.date_debut, date_fin: rapportPrec.date_fin },
      autonomieMoyenneInt: autoPrec ? Math.round(moyenne(autoPrec.synthese_interieure) * 10) / 10 : null,
      autonomieMoyenneExt: autoPrec ? Math.round(moyenne(autoPrec.synthese_exterieure) * 10) / 10 : null,
      camionsCharges: camionsPrec.charges,
      tauxRealisation: camionsPrec.taux,
    };
  }
  const precedentDe = (produitId) => autoPrec?.synthese_interieure.find(x => x.produit_id === produitId) || null;

  // Ventes de la semaine par jour (saisie quotidienne) ; date nulle : saisie hebdomadaire
  const ventesJour = await sequelize.query(`
    SELECT date_saisie AS date, COALESCE(SUM(quantite), 0) AS quantite
    FROM ventes_marketeurs
    WHERE rapport_id = :rapportId AND del = 0
    GROUP BY date_saisie
    ORDER BY date_saisie
  `, { type: QueryTypes.SELECT, replacements: { rapportId } });

  // Alertes : chaque depot x produit sous l'objectif (rouge ou jaune)
  const alertes = [...auto.depots_interieurs, ...auto.depots_exterieurs].flatMap(d => d.lignes
    .filter(l => l.couleur === 'rouge' || l.couleur === 'jaune')
    .map(l => ({ produit: l.produit_libelle, depot: d.depot_libelle, autonomie: l.autonomie, seuil: l.objectif_jours, couleur: l.couleur })))
    .sort((a, b) => a.autonomie - b.autonomie);

  return {
    autonomieMoyenneInt:  Math.round(moyenne(auto.synthese_interieure) * 10) / 10,
    autonomieMoyenneExt:  Math.round(moyenne(auto.synthese_exterieure) * 10) / 10,
    // Rapport dont les chiffres sont affiches (dernier rapport publie)
    rapport:              { id: rapport.id, semaine_iso: rapport.semaine_iso, annee: rapport.annee, date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut },
    // Semaine non publiee : chiffres provisoires (saisie en cours)
    provisoire:           rapport.statut !== 'PUBLIE',
    camionsCharges:       camions.charges,
    tauxRealisation:      camions.taux,
    // Semaine precedente (null : pas de semaine avant celle-ci)
    comparaison,
    detteEtat:            etat.dettesEtat?.montant ?? 0,
    creanceEtat:          etat.creancesEtat?.montant ?? 0,
    situationEtat:        etat,
    alertes,
    stockNational: {
      total: Math.round(stockNational),
      precedent: stockPrecedent === null ? null : Math.round(stockPrecedent),
      evolution_pct: stockPrecedent > 0 ? Math.round(((stockNational - stockPrecedent) / stockPrecedent) * 1000) / 10 : null,
    },
    ventesJour: ventesJour.map(v => ({ date: v.date, quantite: Math.round(Number(v.quantite) || 0) })),
    encours: { produits: enc.produits.map(({ produit, cumul, besoin, taux }) => ({ produit, cumul, besoin, taux })), total: enc.total },
    stocksInterieurs: auto.synthese_interieure.map(s => ({
      produit:         s.produit_libelle,
      stockPrecedent:  precedentDe(s.produit_id)?.volume_total ?? null,
      autonomiePrecedente: precedentDe(s.produit_id)?.autonomie ?? null,
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
