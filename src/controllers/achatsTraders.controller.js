const { getSaisieData, saveSaisie } = require('../services/achatsTraders.service');

exports.getSemaineCourante = async (req, res) => {
  try {
    const data = await getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[AchatsTraders] GET :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
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
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};
