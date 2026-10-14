const veilleMarcheService = require('../services/veilleMarche.service');
const { sendError } = require('../utils/http-error');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await veilleMarcheService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[VeilleMarche] GET :', err.message);
    sendError(res, err);
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, indicateurs } = req.body;
    if (!rapport_id || !Array.isArray(indicateurs)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await veilleMarcheService.saveSaisie(rapport_id, indicateurs, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[VeilleMarche] POST :', err.message);
    sendError(res, err, 400);
  }
};
