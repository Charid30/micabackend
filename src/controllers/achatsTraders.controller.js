const { getSaisieData, saveSaisie } = require('../services/achatsTraders.service');
const { sendError } = require('../utils/http-error');

exports.getSemaineCourante = async (req, res) => {
  try {
    const data = await getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[AchatsTraders] GET :', err.message);
    sendError(res, err);
  }
};

exports.postSaisie = async (req, res) => {
  try {
    const { rapport_id, achats } = req.body;
    if (!rapport_id || !Array.isArray(achats)) {
      return res.status(400).json({ message: 'rapport_id et achats[] requis.' });
    }
    const result = await saveSaisie(rapport_id, achats, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[AchatsTraders] POST :', err.message);
    sendError(res, err);
  }
};
