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
// Menu Centrale SONABEL : situation quotidienne des stocks de combustible des centrales.
// Le creux (capacite - stock) et l'autonomie (stock / besoin journalier) sont toujours calcules.
// Capacite, besoin et observation sont repris du dernier jour saisi ; ils sont conserves avec chaque
// jour, pour qu'une modification ne change pas les jours precedents.
const { Op } = require('sequelize');
const { sequelize, CentraleCuve, CentraleSaisie, CentraleParc } = require('../models');
const { aujourdhui } = require('./frequence.service');

const PARCS = [
  { code: 'TANGHIN', libelle: 'Parc de Tanghin' },
  { code: 'KOMSILGA', libelle: 'Parc de Komsilga' },
];
const ENTIER_MAX = 4000000000;    // INT UNSIGNED
const JOURS_EVOLUTION = 7;

const erreur = (message) => ({ status: 400, message });

const verifierDate = (date) => {
  const d = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(d.getTime()) || d.toISOString().split('T')[0] !== date) {
    throw erreur('Date invalide.');
  }
  return date;
};

// Nombre entier positif ou champ vide
const entier = (v, libelle) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > ENTIER_MAX) throw erreur(`${libelle} : un nombre entier positif est attendu.`);
  return n;
};

const texte = (v) => {
  const t = typeof v === 'string' ? v.trim().slice(0, 255) : '';
  return t || null;
};

const cuvesActives = () => CentraleCuve.findAll({ where: { del: 0 }, order: [['ordre', 'ASC'], ['id', 'ASC']] });

const autonomie = (stock, besoin) => (stock !== null && besoin ? stock / besoin : null);

// Situation d'un jour ; les lignes non saisies sont pre-remplies avec le dernier jour connu
const getJour = async (date = aujourdhui()) => {
  verifierDate(date);
  const [cuves, saisies, parcs, precedentes, parcsPrecedents] = await Promise.all([
    cuvesActives(),
    CentraleSaisie.findAll({ where: { date_saisie: date, del: 0 } }),
    CentraleParc.findAll({ where: { date_saisie: date, del: 0 } }),
    CentraleSaisie.findAll({ where: { date_saisie: { [Op.lt]: date }, del: 0 }, order: [['date_saisie', 'DESC']], limit: 2000 }),
    CentraleParc.findAll({ where: { date_saisie: { [Op.lt]: date }, del: 0 }, order: [['date_saisie', 'DESC']], limit: 200 }),
  ]);
  const duJour = new Map(saisies.map(s => [s.cuve_id, s]));
  const reprises = new Map();
  precedentes.forEach((s) => { if (!reprises.has(s.cuve_id)) reprises.set(s.cuve_id, s); });

  const lignes = cuves.map((c) => {
    const s = duJour.get(c.id);
    const base = s || reprises.get(c.id) || c;
    return {
      cuve_id: c.id, centrale: c.centrale, combustible: c.combustible,
      capacite: base.capacite, besoin_journalier: base.besoin_journalier, observation: base.observation,
      stock: s?.stock ?? null, camions_attente: s?.camions_attente ?? null,
    };
  });
  return {
    date, aujourdhui: aujourdhui(), saisie_faite: saisies.length > 0, lignes,
    parcs: PARCS.map((p) => {
      const r = parcs.find(x => x.parc === p.code);
      const observation = r ? r.observation : parcsPrecedents.find(x => x.parc === p.code)?.observation;
      return { parc: p.code, libelle: p.libelle, camions_hfo: r?.camions_hfo ?? null, camions_ddo: r?.camions_ddo ?? null, observation: observation ?? null };
    }),
  };
};

const lignesValides = (lignes, cuves) => {
  const parId = new Map(cuves.map(c => [c.id, c]));
  return lignes.map((l) => {
    const c = parId.get(Number(l?.cuve_id));
    if (!c) throw erreur('Ligne de centrale inconnue.');
    const nom = `${c.centrale} ${c.combustible}`;
    const valeurs = {
      capacite: entier(l.capacite, `${nom}, capacité`),
      stock: entier(l.stock, `${nom}, stock`),
      besoin_journalier: entier(l.besoin_journalier, `${nom}, besoin journalier`),
      camions_attente: entier(l.camions_attente, `${nom}, camions en attente`),
      observation: texte(l.observation),
    };
    if (valeurs.capacite !== null && valeurs.stock !== null && valeurs.stock > valeurs.capacite) {
      throw erreur(`${nom} : le stock dépasse la capacité des cuves.`);
    }
    return { cuve_id: c.id, valeurs };
  });
};

const parcsValides = (parcs) => parcs.map((p) => {
  const parc = PARCS.find(x => x.code === p?.parc);
  if (!parc) throw erreur('Parc inconnu.');
  return {
    parc: parc.code,
    valeurs: {
      camions_hfo: entier(p.camions_hfo, `${parc.libelle}, camions HFO`),
      camions_ddo: entier(p.camions_ddo, `${parc.libelle}, camions DDO`),
      observation: texte(p.observation),
    },
  };
});

const renseignee = (v) => v.stock !== null || v.camions_attente !== null;

// Met a jour la ligne du jour, ou la cree si elle apporte une information
const ecrire = async (Model, where, valeurs, aCreer, userId, transaction) => {
  const row = await Model.findOne({ where, transaction });
  if (row) return row.update({ ...valeurs, del: 0, updated_by: userId, updated_at: new Date() }, { transaction });
  if (aCreer) await Model.create({ ...where, ...valeurs, created_by: userId }, { transaction });
  return null;
};

const saveJour = async (date, lignes, parcs, userId) => {
  verifierDate(date);
  if (date > aujourdhui()) throw erreur('Impossible d\'enregistrer une date à venir.');
  if (!Array.isArray(lignes) || !lignes.length) throw erreur('Aucune ligne à enregistrer.');
  const cuves = await cuvesActives();
  if (lignes.length > cuves.length) throw erreur('Trop de lignes.');
  const aEcrire = lignesValides(lignes, cuves);
  const parcsAEcrire = parcsValides(Array.isArray(parcs) ? parcs : []);

  await sequelize.transaction(async (t) => {
    for (const l of aEcrire) {
      await ecrire(CentraleSaisie, { date_saisie: date, cuve_id: l.cuve_id }, l.valeurs, renseignee(l.valeurs), userId, t);
    }
    for (const p of parcsAEcrire) {
      const { camions_hfo: hfo, camions_ddo: ddo, observation } = p.valeurs;
      await ecrire(CentraleParc, { date_saisie: date, parc: p.parc }, p.valeurs, hfo !== null || ddo !== null || !!observation, userId, t);
    }
  });
  return { message: 'Situation des centrales enregistrée.', ...(await getJour(date)) };
};

// Evolution sur les 7 jours se terminant a la date choisie
const getEvolution = async (au = aujourdhui()) => {
  verifierDate(au);
  const fin = new Date(`${au}T00:00:00Z`);
  const dates = Array.from({ length: JOURS_EVOLUTION }, (_, i) => (
    new Date(fin.getTime() - (JOURS_EVOLUTION - 1 - i) * 86400000).toISOString().split('T')[0]));
  const [cuves, saisies] = await Promise.all([
    cuvesActives(),
    CentraleSaisie.findAll({ where: { date_saisie: { [Op.between]: [dates[0], au] }, del: 0 } }),
  ]);
  return {
    dates,
    lignes: cuves.map(c => ({
      cuve_id: c.id, centrale: c.centrale, combustible: c.combustible,
      valeurs: dates.map((d) => {
        const s = saisies.find(x => x.cuve_id === c.id && x.date_saisie === d);
        return s ? { stock: s.stock, autonomie: autonomie(s.stock, s.besoin_journalier), camions_attente: s.camions_attente } : null;
      }),
    })),
  };
};

module.exports = { getJour, saveJour, getEvolution };
