const camionsService = require('../services/camions.service');

exports.getAnalyseMensuelle = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee) || new Date().getFullYear();
    const data = await camionsService.getAnalyseMensuelle(annee);
    res.json(data);
  } catch (err) {
    console.error('[Camions] Analyse mensuelle :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.getSaisieData = async (req, res) => {
  try {
    const data = await camionsService.getSaisieData(req.user.id);
    res.json(data);
  } catch (err) {
    console.error('[Camions] GET :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};

exports.saveSaisie = async (req, res) => {
  try {
    const { rapport_id, sections } = req.body;
    if (!rapport_id || !Array.isArray(sections)) {
      return res.status(400).json({ message: 'Données invalides.' });
    }
    const result = await camionsService.saveSaisie(rapport_id, sections, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Camions] POST :', err.message);
    res.status(400).json({ message: err.message || 'Erreur serveur.' });
  }
};
