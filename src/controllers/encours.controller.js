const encoursService = require('../services/encours.service');
const { sendError } = require('../utils/http-error');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await encoursService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Encours] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, depots } = req.body;
    if (!rapport_id || !Array.isArray(depots)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await encoursService.saveSaisie(rapport_id, depots, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Encours] POST :', err.message);
    sendError(res, err, 400);
  }
};
