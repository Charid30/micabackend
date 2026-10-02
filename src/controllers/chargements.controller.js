const chargementsService = require('../services/chargements.service');

exports.getSaisieData = async (req, res) => {
  try {
    const data = await chargementsService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Chargements] GET :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
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
    res.status(400).json({ message: err.message || 'Erreur serveur.' });
  }
};
