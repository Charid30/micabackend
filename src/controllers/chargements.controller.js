const chargementsService = require('../services/chargements.service');
const { sendError } = require('../utils/http-error');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await chargementsService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Chargements] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, corridors } = req.body;
    if (!rapport_id || !Array.isArray(corridors)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await chargementsService.saveSaisie(rapport_id, corridors, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Chargements] POST :', err.message);
    sendError(res, err, 400);
  }
};
