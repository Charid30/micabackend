const dashboardService = require('../services/dashboard.service');

exports.getSynthese = async (req, res) => {
  console.log('[Dashboard] GET /synthese appelé');
  try {
    console.log('[Dashboard] Appel du service...');
    const data = await dashboardService.getSynthese();
    console.log('[Dashboard] Service OK, envoi réponse');
    res.json(data);
  } catch (err) {
    console.error('[Dashboard] ERREUR :', err.message);
    res.status(500).json({ message: err.message || 'Erreur serveur.' });
  }
};
