/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const recoService = require('../services/recommandations.service');
const { sendError } = require('../utils/http-error');

router.get('/semaine-courante', authorize('recommandations', 'READ'), async (req, res) => {
  try {
    res.json(await recoService.getSaisieData(req.user.id));
  } catch (err) {
    console.error('[RECOMMANDATIONS]', err);
    sendError(res, err);
  }
});

router.post('/saisie', authorize('recommandations', 'WRITE'), async (req, res) => {
  try {
    const { rapport_id, informations_utiles, tendance_generale, risques_majeurs, impact_sonabhy, recommandations } = req.body;
    if (!rapport_id) return res.status(400).json({ message: 'rapport_id est requis.' });
    const texte = (v) => (typeof v === 'string' ? v.slice(0, 20000) : '');
    res.json(await recoService.saveSaisie(rapport_id, {
      informations_utiles: texte(informations_utiles), tendance_generale: texte(tendance_generale),
      risques_majeurs: texte(risques_majeurs), impact_sonabhy: texte(impact_sonabhy), recommandations: texte(recommandations),
    }, req.user.id));
  } catch (err) {
    sendError(res, err, 400);
  }
});

module.exports = router;
