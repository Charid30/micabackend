const { getSaisieData, saveSaisie } = require('../services/ventes.service');

exports.getSemaineCourante = async (req, res) => {
  try {
    const data = await getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Ventes] GET :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.postSaisie = async (req, res) => {
  try {
    const { rapport_id, ventes } = req.body;
    if (!rapport_id || !Array.isArray(ventes)) {
      return res.status(400).json({ message: 'rapport_id et ventes[] requis.' });
    }
    const result = await saveSaisie(rapport_id, ventes, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Ventes] POST :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};
