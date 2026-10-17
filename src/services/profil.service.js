/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
// Profil de l'utilisateur connecte : identite (lecture seule), coordonnees modifiables,
// droits, etat du mot de passe et historique des connexions.
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { Utilisateur, Agent, Direction, Entreprise, Permission, Depot, ConnexionUtilisateur } = require('../models');
const { chargerPolitique, etatMotDePasse, libelleNavigateur } = require('./securite-compte.service');

// Libelles des modules (memes intitules que l'ecran de gestion des permissions)
const MODULES = {
  stocks: 'Stocks dépôts (saisie quotidienne)', impompable: 'Référentiel dépôt : impompable et consommation',
  'referentiel-stocks': 'Référentiel stocks (DSTA)', 'actions-stocks': 'Actions pour relever les stocks',
  corridors: 'Corridors', 'depots-int': 'Dépôts intérieurs', 'temps-attente': "Temps d'attente",
  'veille-marche': 'Veille marché', 'veille-geo': 'Veille géopolitique', 'achats-traders': 'Achats traders',
  ventes: 'Ventes', tresorerie: 'Trésorerie (saisie hebdomadaire)', 'tresorerie-lignes': 'Trésorerie : gestion des lignes',
  recommandations: 'Recommandations', caf_moyen: 'CAF moyen des achats', rapports: 'Rapports',
  administration: 'Administration', parametres: 'Paramètres',
};

const getProfil = async (userId) => {
  const [user, connexions, politique] = await Promise.all([
    Utilisateur.findOne({
      where: { id: userId, del: 0 },
      include: [
        { model: Agent, as: 'agent', include: [{ model: Direction, as: 'direction', include: [{ model: Entreprise, as: 'entreprise' }] }] },
        { model: Permission, as: 'permissions', required: false, include: [{ model: Depot, as: 'depot', attributes: ['libelle'], required: false }] },
      ],
    }),
    ConnexionUtilisateur.findAll({ where: { utilisateur_id: userId }, order: [['created_at', 'DESC']], limit: 20 }),
    chargerPolitique(),
  ]);
  if (!user) throw { status: 404, message: 'Utilisateur introuvable.' };

  const ag = user.agent;
  return {
    identite: {
      nom: ag?.nom || '', prenoms: ag?.prenoms || '', matricule: ag?.matricule || '',
      direction: ag?.direction ? `${ag.direction.acronyme}${ag.direction.description ? ' – ' + ag.direction.description : ''}` : '',
      entreprise: ag?.direction?.entreprise?.nom || '',
    },
    compte: {
      username: user.username, email: user.email, tel: user.tel || '',
      profil: user.is_admin ? 'Administrateur' : 'Utilisateur', cree_le: user.created_at,
      derniere_connexion: user.derniere_connexion_at ? { le: user.derniere_connexion_at, ip: user.derniere_connexion_ip } : null,
    },
    droits: user.is_admin
      ? [{ module: 'Tous les modules', action: 'Administrateur', depot: null }]
      : user.permissions.filter(p => p.action !== 'NONE').map(p => ({
        module: MODULES[p.module] || p.module, action: p.action === 'WRITE' ? 'Lecture et écriture' : 'Lecture',
        depot: p.depot?.libelle || null,
      })).sort((a, b) => a.module.localeCompare(b.module, 'fr')),
    mot_de_passe: etatMotDePasse(user, politique),
    connexions: connexions.map(c => ({
      le: c.created_at, succes: !!c.succes, motif: c.motif, ip: c.ip, navigateur: libelleNavigateur(c.navigateur),
    })),
  };
};

// Coordonnees : e-mail et telephone. Le mot de passe actuel est exige pour changer l'e-mail
// (l'e-mail sert d'identifiant de connexion : une session laissee ouverte ne suffit pas a le detourner).
const updateProfil = async (userId, { email, tel, mot_de_passe_actuel }) => {
  const user = await Utilisateur.scope('withPassword').findOne({ where: { id: userId, del: 0 } });
  if (!user) throw { status: 404, message: 'Utilisateur introuvable.' };
  const valeurs = {};
  const nouvelEmail = String(email ?? user.email).trim().toLowerCase();
  if (nouvelEmail !== String(user.email).toLowerCase()) {
    if (!mot_de_passe_actuel || !(await bcrypt.compare(String(mot_de_passe_actuel), user.password))) {
      throw { status: 400, message: "Mot de passe actuel incorrect : il est requis pour modifier l'adresse e-mail." };
    }
    const pris = await Utilisateur.findOne({ where: { email: nouvelEmail, id: { [Op.ne]: userId } } });
    if (pris) throw { status: 409, message: 'Cette adresse e-mail est déjà utilisée par un autre compte.' };
    valeurs.email = nouvelEmail;
  }
  if (tel !== undefined) valeurs.tel = String(tel || '').trim() || null;
  if (!Object.keys(valeurs).length) return { message: 'Aucune modification.' };
  await user.update({ ...valeurs, updated_by: userId, updated_at: new Date() });
  return { message: 'Vos informations ont été enregistrées.', email: user.email, tel: user.tel || '' };
};

module.exports = { getProfil, updateProfil };
