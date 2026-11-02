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
// Rafraichissement automatique : apres chaque enregistrement reussi, le serveur signale aux navigateurs
// connectes quel ecran a change (flux Server-Sent Events). Le signal ne contient aucune donnee metier :
// le navigateur recharge ensuite par les routes habituelles, avec les droits de son utilisateur.
const SUJETS_IGNORES = ['auth', 'profil', 'notifications', 'evenements'];
const SUJETS_ADMIN = ['utilisateurs', 'agents', 'administration', 'intrusions', 'parametres'];
const BATTEMENT_MS = 25000;                // garde la connexion ouverte a travers Apache
const DUREE_MAX_MS = 30 * 60 * 1000;       // reconnexion reguliere : la session est alors reverifiee
const MAX_PAR_COMPTE = 8;

const clients = new Set();

const ecrire = (c, texte) => {
  try { c.res.write(texte); } catch { fermerClient(c); }
};

function fermerClient(c) {
  if (!clients.delete(c)) return;
  clearTimeout(c.fin);
  try { c.res.end(); } catch { /* deja fermee */ }
}

setInterval(() => clients.forEach(c => ecrire(c, ': ok\n\n')), BATTEMENT_MS).unref();

// GET /api/evenements : flux de l'utilisateur connecte
const connecter = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  const c = {
    res, utilisateurId: req.user.id, admin: !!req.user.is_admin,
    ip: String(req.ip || '').replace(/^::ffff:/, ''),
  };
  c.fin = setTimeout(() => fermerClient(c), DUREE_MAX_MS);
  const siens = [...clients].filter(x => x.utilisateurId === c.utilisateurId);
  if (siens.length >= MAX_PAR_COMPTE) fermerClient(siens[0]);
  clients.add(c);
  req.on('close', () => fermerClient(c));
};

// Signale qu'un ecran a change ; par : auteur (rien pour une action automatique)
const diffuser = (sujet, { par = null, onglet = null } = {}) => {
  const message = `data: ${JSON.stringify({ sujet, par, onglet })}\n\n`;
  clients.forEach((c) => { if (c.admin || !SUJETS_ADMIN.includes(sujet)) ecrire(c, message); });
};

// Compte suspendu ou adresse bannie : flux coupe immediatement
const fermer = ({ utilisateurId = null, ip = null }) => {
  clients.forEach((c) => {
    if ((utilisateurId && c.utilisateurId === utilisateurId) || (ip && c.ip === ip)) fermerClient(c);
  });
};

// Middleware : signale chaque ecriture reussie, une fois la reponse envoyee
const signalerEcritures = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  res.on('finish', () => {
    if (!req.user || res.statusCode >= 400) return;
    const sujet = req.originalUrl.split('?')[0].replace(/^\/api\//, '').split('/')[0];
    if (SUJETS_IGNORES.includes(sujet)) return;
    const onglet = /^[\w-]{1,40}$/.test(req.get('X-Onglet') || '') ? req.get('X-Onglet') : null;
    diffuser(sujet, { par: req.user.username, onglet });
  });
  next();
};

module.exports = { connecter, diffuser, fermer, signalerEcritures };
