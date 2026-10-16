/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const dashboardService = require('../services/dashboard.service');
const { sendError } = require('../utils/http-error');

// ?rapport_id=N : semaine choisie dans le selecteur ; sans parametre, dernier rapport publie
exports.getSynthese = async (req, res) => {
  try {
    const id = req.query.rapport_id !== undefined ? parseInt(req.query.rapport_id, 10) : null;
    if (req.query.rapport_id !== undefined && !(id > 0)) return res.status(400).json({ message: 'Identifiant de rapport invalide.' });
    res.json(await dashboardService.getSynthese(id));
  } catch (err) {
    console.error('[Dashboard] ERREUR :', err.message);
    sendError(res, err);
  }
};
