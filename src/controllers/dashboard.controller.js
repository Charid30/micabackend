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
