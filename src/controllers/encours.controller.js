const encoursService = require('../services/encours.service');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await encoursService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Encours] GET :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
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
    res.status(400).json({ message: err.message || 'Erreur serveur.' });
  }
};
