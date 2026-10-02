const { RapportHebdo, TempsAttenteCamion, sequelize } = require('../models');

const SECTIONS_DEF = [
  {
    site_type:      'EXTERIEUR',
    titre:          '1. Dépôts extérieurs',
    col_site:       'Dépôt',
    objectif_jours: 3,
    sites: ['Ghana', 'Togo', 'Bénin', "Côte d'Ivoire"],
  },
  {
    site_type:      'INTERIEUR',
    titre:          '2. Dépôts intérieurs',
    col_site:       'Dépôt',
    objectif_jours: 4,
    sites: ['Bingo', 'Péni'],
  },
  {
    site_type:      'PORT_SEC',
    titre:          '3. Ports secs',
    col_site:       'Port sec',
    objectif_jours: 1,
    sites: ['Ouagadougou'],
  },
  {
    site_type:      'FRONTIERE',
    titre:          '4. Frontières',
    col_site:       'Frontière',
    objectif_jours: 2,
    sites: ['Cinkansé', 'Dakola', 'Niangoloko'],
  },
  {
    site_type:      'CAMIONS_VIDES',
    titre:          '5. Camions vides en attente de départ',
    col_site:       'Destination',
    objectif_jours: 3,
    sites: ['Ghana', 'Togo', 'Bénin', "Côte d'Ivoire"],
  },
];

const { getOrCreateRapportSemaine } = require('../utils/rapport.utils');

const getSaisieData = async (userId) => {
  const rapport = await getOrCreateRapportSemaine(userId);

  const rows = await TempsAttenteCamion.findAll({ where: { rapport_id: rapport.id, del: 0 } });
  const idx = {};
  rows.forEach(r => { idx[`${r.site_type}|${r.site_nom}`] = r; });

  return {
    rapport: {
      id: rapport.id, annee: rapport.annee, semaine_iso: rapport.semaine_iso,
      date_debut: rapport.date_debut, date_fin: rapport.date_fin, statut: rapport.statut,
    },
    sections: SECTIONS_DEF.map(sec => ({
      site_type:      sec.site_type,
      titre:          sec.titre,
      col_site:       sec.col_site,
      objectif_jours: sec.objectif_jours,
      lignes: sec.sites.map(site => {
        const key = `${sec.site_type}|${site}`;
        const row = idx[key] || {};
        return {
          site_nom:       site,
          nb_camions:     parseInt(row.nb_camions)  || 0,
          temps_moyen:    row.temps_moyen  != null ? parseFloat(row.temps_moyen)  : null,
          temps_mini:     row.temps_mini   != null ? parseFloat(row.temps_mini)   : null,
          temps_maxi:     row.temps_maxi   != null ? parseFloat(row.temps_maxi)   : null,
        };
      }),
    })),
  };
};

const saveSaisie = async (rapportId, sectionsData, userId) => {
  const rapport = await RapportHebdo.findOne({ where: { id: rapportId, del: 0 } });
  if (!rapport) throw new Error('Rapport introuvable.');
  if (rapport.statut === 'PUBLIE') throw new Error('Ce rapport est déjà publié.');

  for (const section of sectionsData) {
    for (const ligne of section.lignes) {
      const defaults = {
        nb_camions:     parseInt(ligne.nb_camions)       || 0,
        temps_moyen:    ligne.temps_moyen  != null ? parseFloat(ligne.temps_moyen)  : null,
        temps_mini:     ligne.temps_mini   != null ? parseFloat(ligne.temps_mini)   : null,
        temps_maxi:     ligne.temps_maxi   != null ? parseFloat(ligne.temps_maxi)   : null,
        objectif_jours: section.objectif_jours,
        created_by:     userId,
      };
      const [row, created] = await TempsAttenteCamion.findOrCreate({
        where: { rapport_id: rapportId, site_type: section.site_type, site_nom: ligne.site_nom, del: 0 },
        defaults,
      });
      if (!created) {
        await row.update({ ...defaults, updated_by: userId });
      }
    }
  }
  return { message: 'Saisie temps d\'attente enregistrée avec succès.' };
};

// Colonnes de l'analyse mensuelle (dans l'ordre du fichier Excel)
const ANALYSE_SITES = [
  { type: 'EXTERIEUR',     nom: 'Ghana'         },
  { type: 'EXTERIEUR',     nom: 'Togo'          },
  { type: 'EXTERIEUR',     nom: 'Bénin'         },
  { type: 'EXTERIEUR',     nom: "Côte d'Ivoire" },
  { type: 'INTERIEUR',     nom: 'Bingo'         },
  { type: 'INTERIEUR',     nom: 'Péni'          },
  { type: 'FRONTIERE',     nom: 'Cinkansé'      },
  { type: 'FRONTIERE',     nom: 'Dakola'        },
  { type: 'FRONTIERE',     nom: 'Niangoloko'    },
];

const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const getAnalyseMensuelle = async (annee) => {
  const rows = await sequelize.query(`
    SELECT
      MONTH(r.date_debut)  AS mois_num,
      t.site_type,
      t.site_nom,
      ROUND(AVG(t.temps_moyen), 1) AS moyenne
    FROM temps_attente_camions t
    INNER JOIN rapports_hebdo r ON r.id = t.rapport_id
    WHERE YEAR(r.date_debut) = :annee
      AND t.del = 0
      AND t.temps_moyen IS NOT NULL
    GROUP BY MONTH(r.date_debut), t.site_type, t.site_nom
  `, { replacements: { annee }, type: sequelize.QueryTypes.SELECT });

  const idx = {};
  rows.forEach(r => { idx[`${r.mois_num}|${r.site_type}|${r.site_nom}`] = parseFloat(r.moyenne); });

  return {
    annee,
    colonnes: ANALYSE_SITES.map(s => s.nom),
    lignes: MOIS.map((mois, i) => ({
      mois,
      valeurs: ANALYSE_SITES.map(s => {
        const v = idx[`${i + 1}|${s.type}|${s.nom}`];
        return v != null ? v : null;
      }),
    })),
  };
};

module.exports = { getSaisieData, saveSaisie, getAnalyseMensuelle };
