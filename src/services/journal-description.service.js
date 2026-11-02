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
// Journal d'audit : phrase claire decrivant chaque action (« Saisie des stocks : Depot de Bingo, semaine 45 »).
// Calculee a l'enregistrement avec le corps complet de la requete, et a l'affichage pour les anciennes
// lignes a partir de leur resume (moins de precision : nombre de lignes au lieu du nom des depots).
// Seuls des noms sont repris, jamais une valeur secrete.
const {
  Produit, Depot, Corridor, Fournisseur, Marketeur, Direction, Entreprise, Agent, Utilisateur,
  RapportHebdo, Parametre, IpBannie,
} = require('../models');

// Referentiels : libelle au masculin ou feminin, modele et nom affiche
const parLibelle = (r) => r.libelle;
const ENTITES = {
  produits: { le: 'du produit', Model: Produit, nom: parLibelle },
  depots: { le: 'du dépôt', Model: Depot, nom: parLibelle },
  corridors: { le: 'du corridor', Model: Corridor, nom: parLibelle },
  fournisseurs: { le: 'du fournisseur', Model: Fournisseur, nom: parLibelle },
  marketeurs: { le: 'du marketeur', Model: Marketeur, nom: parLibelle },
  directions: { le: 'de la direction', Model: Direction, nom: r => r.acronyme },
  entreprises: { le: 'de l\'entreprise', Model: Entreprise, nom: r => r.acronyme },
  agents: { le: 'de l\'agent', Model: Agent, nom: r => [r.prenoms, r.nom].filter(Boolean).join(' ') },
  utilisateurs: { le: 'du compte', Model: Utilisateur, nom: r => r.username },
};

// Saisies : titre et champ contenant les lignes envoyees
const SAISIES = {
  stocks: { titre: 'Saisie des stocks', lignes: 'lignes' },
  chargements: { titre: 'Saisie des chargements corridors', lignes: 'corridors', unite: 'corridor' },
  encours: { titre: 'Saisie des dépôts intérieurs', lignes: 'depots', unite: 'dépôt' },
  camions: { titre: 'Saisie des temps d\'attente', lignes: 'sections', unite: 'section' },
  'veille-marche': { titre: 'Saisie de la veille marché', lignes: 'indicateurs', unite: 'indicateur' },
  'veille-geo': { titre: 'Saisie de la veille géopolitique', lignes: 'zones', unite: 'zone' },
  ventes: { titre: 'Saisie des ventes', lignes: 'ventes' },
  finances: { titre: 'Saisie de la trésorerie', lignes: 'lignes' },
  recommandations: { titre: 'Saisie des recommandations' },
  'caf-moyen': { titre: 'Saisie du CAF moyen', lignes: 'entries' },
  'achats-traders': { titre: 'Saisie des achats traders', lignes: 'achats', unite: 'achat' },
  'encours-livraison': { titre: 'Saisie des encours fournisseurs', lignes: 'lignes' },
  centrales: { titre: 'Saisie des centrales SONABEL' },
};

const FIXES = {
  'PUT auth/change-password': 'Changement de son mot de passe',
  'PUT auth/force-change-password': 'Changement obligatoire de son mot de passe',
  'PUT profil': 'Modification de ses informations personnelles',
  'POST profil/2fa/initier': 'Début d\'activation de la double authentification',
  'POST profil/2fa/activer': 'Activation de la double authentification',
  'POST profil/2fa/desactiver': 'Désactivation de la double authentification',
  'POST profil/2fa/codes-secours': 'Nouveaux codes de secours',
  'PUT frequences': 'Modification des fréquences de saisie',
  'POST notifications/test': 'Envoi d\'une notification d\'essai',
  'POST notifications/abonnement': 'Activation des notifications sur un navigateur',
  'DELETE notifications/abonnement': 'Désactivation des notifications sur un navigateur',
  'POST administration/sauvegardes': 'Sauvegarde manuelle de la base',
  'PUT administration/securite': 'Modification des réglages de sécurité',
  'PUT referentiel-stocks/depots': 'Modification du référentiel des dépôts (impompable, consommation)',
  'PUT referentiel-stocks/besoins': 'Modification des besoins des dépôts extérieurs',
  'PUT referentiel-stocks/parametres': 'Modification des paramètres du référentiel',
  'PUT referentiel-stocks/densites': 'Modification des densités',
  'POST finances/lignes': 'Ajout d\'une ligne de trésorerie',
};

// Nombre d'elements : tableau du corps, ou « 14 élément(s) » pour une ancienne ligne resumee
const nombre = (v) => (Array.isArray(v) ? v.length : parseInt(/^(\d+) élément/.exec(String(v))?.[1], 10) || 0);
const pluriel = (n, unite = 'ligne') => `${n} ${unite}${n > 1 ? 's' : ''}`;

const nomDe = async (entite, id) => {
  const r = await entite.Model.findByPk(id).catch(() => null);
  return r ? entite.nom(r) : `n° ${id}`;
};

const semaine = async (id) => {
  const r = id ? await RapportHebdo.findByPk(id, { attributes: ['semaine_iso', 'annee'] }).catch(() => null) : null;
  return r ? `semaine ${r.semaine_iso}/${r.annee}` : null;
};

// Depots concernes par une saisie de stocks (lignes reellement renseignees)
const depotsSaisis = async (lignes) => {
  if (!Array.isArray(lignes)) return null;
  const ids = [...new Set(lignes.map(l => l?.depot_id).filter(Boolean))];
  if (!ids.length) return null;
  const depots = await Depot.findAll({ where: { id: ids }, attributes: ['libelle'] });
  return depots.map(d => d.libelle).join(', ');
};

const decrireSaisie = async (cle, corps) => {
  const s = SAISIES[cle];
  const n = s.lignes ? nombre(corps[s.lignes]) : 0;
  const quoi = cle === 'stocks' ? await depotsSaisis(corps.lignes) : null;
  // Saisie datee (centrales) : le jour concerne plutot que la semaine
  if (/^\d{4}-\d{2}-\d{2}$/.test(corps.date)) return `${s.titre} du ${corps.date.split('-').reverse().join('/')}`;
  const sem = await semaine(corps.rapport_id);
  const compte = n ? pluriel(n, s.unite) : null;
  return `${s.titre}${quoi ? ` : ${quoi}` : ''}${[compte, sem].filter(Boolean).length ? ` (${[compte, sem].filter(Boolean).join(', ')})` : ''}`;
};

const decrireReferentiel = async (methode, cle, id, corps) => {
  const e = ENTITES[cle];
  if (methode === 'POST') return `Ajout ${e.le} ${corps.libelle || corps.username || corps.acronyme || corps.nom || ''}`.trim();
  const nom = await nomDe(e, id);
  return `${methode === 'DELETE' ? 'Suppression' : 'Modification'} ${e.le} ${nom}`;
};

/** Phrase decrivant une requete d'ecriture ; null si elle n'est pas connue (libelle generique a l'affichage) */
const decrire = async (methode, chemin, corps) => {
  const c = corps && typeof corps === 'object' ? corps : {};
  const segments = chemin.replace(/^\/api\//, '').replace(/\/$/, '').split('/');
  const [racine, deux, trois, quatre] = segments;
  const id = segments.find(s => /^\d+$/.test(s));

  const fixe = FIXES[`${methode} ${segments.join('/')}`];
  if (fixe) return fixe;
  if (deux === 'saisie' && SAISIES[racine]) return decrireSaisie(racine, c);

  if (racine === 'rapports' && id) {
    const sem = await semaine(id);
    const nom = sem ? `du rapport ${sem}` : `du rapport n° ${id}`;
    return methode === 'DELETE' ? `Suppression ${nom}` : `Publication ${nom}`;
  }
  if (racine === 'utilisateurs' && id && trois) {
    const nom = await nomDe(ENTITES.utilisateurs, id);
    if (trois === 'reset-password') return `Réinitialisation du mot de passe du compte ${nom}`;
    if (trois === 'permissions') return `Modification des droits du compte ${nom}`;
  }
  if (racine === 'parametres') {
    if (deux === 'alertes') return 'Modification d\'un seuil d\'alerte';
    const p = await Parametre.findByPk(id).catch(() => null);
    return `Modification du paramètre ${p?.cle || `n° ${id}`}${c.valeur !== undefined ? ` : ${String(c.valeur).slice(0, 80)}` : ''}`;
  }
  if (racine === 'finances' && deux === 'lignes') return `Modification d'une ligne de trésorerie (n° ${id})`;
  if (racine === 'encours-livraison' && deux === 'fournisseurs') return `Ajout du fournisseur ${c.libelle || ''}`.trim();
  if (racine === 'administration') {
    if (deux === 'utilisateurs' && quatre === 'reinitialiser-2fa') return `Réinitialisation de la double authentification du compte ${await nomDe(ENTITES.utilisateurs, id)}`;
    if (deux === 'intrusions' && trois === 'ip') {
      const b = await IpBannie.findByPk(id).catch(() => null);
      return `Déblocage de l'adresse ${b?.ip || `n° ${id}`}`;
    }
    if (deux === 'intrusions' && trois === 'compte') return `Réactivation du compte ${await nomDe(ENTITES.utilisateurs, id)}`;
  }
  if (ENTITES[racine] && !trois) return decrireReferentiel(methode, racine, id, c);
  return null;
};

module.exports = { decrire };
