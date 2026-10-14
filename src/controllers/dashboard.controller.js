const dashboardService = require('../services/dashboard.service');
const { sendError } = require('../utils/http-error');

exports.getSynthese = async (req, res) => {
  console.log('[Dashboard] GET /synthese appelé');
  try {
    console.log('[Dashboard] Appel du service...');
    const data = await dashboardService.getSynthese();
    console.log('[Dashboard] Service OK, envoi réponse');
    res.json(data);
  } catch (err) {
    console.error('[Dashboard] ERREUR :', err.message);
    sendError(res, err);
  }
};
