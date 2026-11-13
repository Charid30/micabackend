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
// Suivi des saisies (tableau de bord des saisies) : qui a saisi quoi et quand, retards par dépôt.
//  - saisies quotidiennes : grille des N derniers jours, par dépôt (stocks, dépôts intérieurs) ou par menu ;
//    chaque case : saisie à l'heure, saisie après l'heure du rappel, en retard, manquante ou non attendue ;
//  - saisies hebdomadaires et permanentes : état pour la semaine en cours ;
//  - dernières saisies enregistrées (journal d'audit).
// Heure limite = heure du rappel des saisies (NOTIF_SAISIE_HEURE, 09:35 par défaut) ; jours attendus =
// jours du rappel (NOTIF_SAISIE_JOURS, NOTIF_RDC_JOURS pour la RDC).
const { Op } = require('sequelize');
const {
  Depot, StockDepot, CamionDepot, RapportHebdo, Parametre, Utilisateur, Agent, JournalAction,
} = require('../models');
const frequence = require('./frequence.service');

const JOURS_MAX = 31;
const NOMS_JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
// Menus dont la saisie quotidienne se fait dépôt par dépôt
const PAR_DEPOT = {
  'stocks-int': { model: StockDepot, type: 'INTERIEUR', titre: 'Stocks des dépôts intérieurs' },
  'stocks-ext': { model: StockDepot, type: 'EXTERIEUR', titre: 'Stocks des dépôts extérieurs' },
  'depots-int': { model: CamionDepot, type: 'INTERIEUR', titre: 'Camions des dépôts intérieurs' },
};
// Modules du journal d'audit qui correspondent à une saisie
const MODULES_SAISIE = [
  'Stocks dépôts', 'Trésorerie', 'Corridors', 'Encours', 'Dépôts intérieurs', "Temps d'attente", 'Veille marché',
  'Veille géopolitique', 'Achats traders', 'Ventes', 'Recommandations', 'CAF moyen', 'Centrale SONABEL', 'RDC',
];

const isoJour = (d) => d.toISOString().split('T')[0];
const hhmm = (d) => (d ? new Date(d).toISOString().slice(11, 16) : null);
const minutes = (d) => { const x = new Date(d); return x.getUTCHours() * 60 + x.getUTCMinutes(); };

const joursAttendus = async (cle) => {
  const p = await Parametre.findOne({ where: { cle, del: 0 } });
  return String(p?.valeur ?? '1,2,3,4,5,6,7').split(',').map(s => Number(s.trim())).filter(Boolean);
};

// Nom affiché des comptes : « Prénom NOM » de l'agent, à défaut l'identifiant
const nomsDesComptes = async (ids) => {
  const liste = [...new Set(ids.filter(Boolean))];
  if (!liste.length) return {};
  const comptes = await Utilisateur.findAll({
    where: { id: liste }, attributes: ['id', 'username'],
    include: [{ model: Agent, as: 'agent', attributes: ['nom', 'prenoms'] }],
  });
  const noms = {};
  for (const c of comptes) {
    const prenom = (c.agent?.prenoms || '').split(' ')[0];
    noms[c.id] = c.agent ? `${prenom} ${String(c.agent.nom || '').toUpperCase()}`.trim() : c.username;
  }
  return noms;
};

// Première saisie de chaque groupe (dépôt ou menu) et de chaque jour : heure et auteur
const premieres = (rows, cle) => {
  const m = new Map();
  for (const r of rows) {
    const k = `${cle(r)}|${r.date_saisie}`;
    const t = new Date(r.created_at || r.updated_at);
    if (!m.has(k) || t < m.get(k).le) m.set(k, { le: t, par: r.created_by || r.updated_by });
  }
  return m;
};

/**
 * @param jours nombre de jours affichés (7 par défaut, 31 au plus), aujourd'hui compris
 */
const getSuivi = async ({ jours = 7 } = {}) => {
  const n = Math.min(Math.max(parseInt(jours, 10) || 7, 1), JOURS_MAX);
  const maintenant = new Date();
  const aujourdhui = isoJour(maintenant);
  const { heure, minute } = await require('./scheduler.service').heureRappel();
  const limite = heure * 60 + minute;
  const [joursSaisie, joursRdc] = await Promise.all([joursAttendus('NOTIF_SAISIE_JOURS'), joursAttendus('NOTIF_RDC_JOURS')]);

  const colonnes = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() - i));
    colonnes.push({ date: isoJour(d), libelle: `${NOMS_JOURS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}`, iso: d.getUTCDay() || 7, aujourdhui: i === 0 });
  }
  const debut = colonnes[0].date;
  const auteurs = [];

  // État d'une case : premiere = { le, par } ou undefined
  const etatCase = (col, premiere, attendus) => {
    if (premiere) {
      auteurs.push(premiere.par);
      return { etat: minutes(premiere.le) > limite ? 'tard' : 'ok', heure: hhmm(premiere.le), par: premiere.par };
    }
    if (!attendus.includes(col.iso)) return { etat: 'libre' };
    if (!col.aujourdhui) return { etat: 'manquant' };
    return { etat: minutes(maintenant) > limite ? 'retard' : 'attendu' };
  };
  const taux = (cases) => {
    const comptees = cases.filter(c => ['ok', 'tard', 'manquant', 'retard'].includes(c.etat));
    return comptees.length ? Math.round((comptees.filter(c => c.etat === 'ok' || c.etat === 'tard').length / comptees.length) * 100) : null;
  };

  const grilles = [];
  const menus = [];
  const hebdo = [];
  // Semaine qui contient aujourd'hui (pas encore créée si personne n'a ouvert de saisie : rien n'est saisi)
  const rapportCourant = await RapportHebdo.findOne({
    where: { del: 0, date_debut: { [Op.lte]: aujourdhui }, date_fin: { [Op.gte]: aujourdhui } },
  });

  for (const m of frequence.MODULES) {
    if (!m.model) continue;   // registres (CAF moyen, achats traders) : pas de saisie datée
    const freq = await frequence.frequenceDe(m.code);
    const where = { ...(m.filtre || {}), del: 0 };
    if (m.filtre && !await m.model.findOne({ where, attributes: ['id'] })) continue;   // pays RDC pas encore démarré
    const attendus = m.filtre ? joursRdc : joursSaisie;

    if (freq !== 'QUOTIDIEN') {
      // Semaine en cours : dernière mise à jour
      const derniere = rapportCourant && await m.model.findOne({
        where: { ...where, rapport_id: rapportCourant.id }, attributes: ['created_at', 'updated_at', 'created_by', 'updated_by'],
        order: [['updated_at', 'DESC']],
      }).catch(() => null);
      if (derniere) auteurs.push(derniere.updated_by || derniere.created_by);
      hebdo.push({
        code: m.code, libelle: m.libelle, frequence: frequence.FREQUENCES[freq] || freq,
        saisi: !!derniere, le: derniere ? (derniere.updated_at || derniere.created_at) : null,
        par: derniere ? (derniere.updated_by || derniere.created_by) : null,
      });
      continue;
    }

    const champs = ['date_saisie', 'created_at', 'updated_at', 'created_by', 'updated_by'];
    const pd = PAR_DEPOT[m.code];
    if (pd) {
      const depots = await Depot.findAll({ where: { type: pd.type, del: 0 }, attributes: ['id', 'libelle', 'pays'], order: [['libelle', 'ASC']] });
      const rows = await pd.model.findAll({
        where: { del: 0, depot_id: depots.map(d => d.id), date_saisie: { [Op.between]: [debut, aujourdhui] } },
        attributes: ['depot_id', ...champs], raw: true,
      });
      const p = premieres(rows, r => r.depot_id);
      const lignes = depots.map(d => {
        const cases = colonnes.map(c => etatCase(c, p.get(`${d.id}|${c.date}`), attendus));
        return { depot_id: d.id, libelle: d.libelle, cases, taux: taux(cases) };
      });
      grilles.push({ code: m.code, titre: pd.titre, lignes, taux: taux(lignes.flatMap(l => l.cases)) });
    } else {
      const rows = await m.model.findAll({
        where: { ...where, date_saisie: { [Op.between]: [debut, aujourdhui] } }, attributes: champs, raw: true,
      });
      const p = premieres(rows, () => m.code);
      const cases = colonnes.map(c => etatCase(c, p.get(`${m.code}|${c.date}`), attendus));
      menus.push({ code: m.code, libelle: m.libelle, cases, taux: taux(cases) });
    }
  }

  // Dernières saisies enregistrées (journal d'audit)
  const activite = await JournalAction.findAll({
    where: { succes: 1, module: MODULES_SAISIE, created_at: { [Op.gte]: new Date(`${debut}T00:00:00Z`) } },
    attributes: ['utilisateur_id', 'username', 'module', 'action', 'description', 'created_at'],
    order: [['created_at', 'DESC']], limit: 40,
  });
  activite.forEach(a => auteurs.push(a.utilisateur_id));

  const noms = await nomsDesComptes(auteurs);
  const nommer = (c) => (c.par ? { ...c, par: noms[c.par] || 'Compte supprimé' } : c);
  grilles.forEach(g => g.lignes.forEach(l => { l.cases = l.cases.map(nommer); }));
  menus.forEach(x => { x.cases = x.cases.map(nommer); });
  hebdo.forEach(h => { if (h.par) h.par = noms[h.par] || 'Compte supprimé'; });

  // Résumé du jour
  const casesDuJour = [...grilles.flatMap(g => g.lignes.map(l => l.cases[n - 1])), ...menus.map(x => x.cases[n - 1])];
  const compte = (e) => casesDuJour.filter(c => e.includes(c.etat)).length;
  const toutes = [...grilles.flatMap(g => g.lignes.flatMap(l => l.cases)), ...menus.flatMap(x => x.cases)];

  return {
    aujourdhui,
    heure_limite: `${String(heure).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    jours: colonnes.map(({ date, libelle, aujourdhui: a }) => ({ date, libelle, aujourdhui: a })),
    resume: {
      attendus: compte(['ok', 'tard', 'retard', 'attendu']),
      saisis: compte(['ok', 'tard']),
      tard: compte(['tard']),
      retards: compte(['retard']),
      en_attente: compte(['attendu']),
      completude: taux(toutes),
      manquants_periode: toutes.filter(c => c.etat === 'manquant').length,
    },
    grilles,
    menus,
    semaine: rapportCourant ? { semaine_iso: rapportCourant.semaine_iso, annee: rapportCourant.annee, date_debut: rapportCourant.date_debut, date_fin: rapportCourant.date_fin } : null,
    hebdo,
    activite: activite.map(a => ({
      le: a.created_at, par: noms[a.utilisateur_id] || a.username, module: a.module,
      description: a.description || `${a.action} – ${a.module}`,
    })),
  };
};

module.exports = { getSuivi };
