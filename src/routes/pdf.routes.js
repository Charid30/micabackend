/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 *  Merci
 * ================================================================== */
const express = require('express');
const router = express.Router();
const { imprimer } = require('../services/pdf.service');
const { sendError } = require('../utils/http-error');

// Le document arrive en text/html brut (et non en JSON) : c'est un modèle de l'application, plein de
// balises, que l'analyse anti-intrusion des corps JSON prendrait à tort pour une attaque.
// Il n'est lu que par cette route et rendu dans un Chrome sans JavaScript ni réseau (pdf.service).
const corpsHtml = express.text({ type: 'text/html', limit: '10mb' });

// Nom de fichier : lettres, chiffres, tiret, point, souligné
const nomFichier = (n) => (String(n || 'document').replace(/[^\w.-]+/g, '_').replace(/\.pdf$/i, '').slice(0, 80) || 'document') + '.pdf';

// Auteur de l'impression : prénoms et NOM de l'agent, à défaut l'identifiant du compte
const auteur = (u) => {
  const nom = [u?.agent?.prenoms, u?.agent?.nom ? String(u.agent.nom).toUpperCase() : null].filter(Boolean).join(' ').trim();
  return (nom || u?.username || 'utilisateur inconnu').slice(0, 120);
};

router.post('/', corpsHtml, async (req, res) => {
  try {
    const html = typeof req.body === 'string' ? req.body : '';
    if (!/^\s*<!doctype html>/i.test(html)) return res.status(400).json({ message: 'Document invalide.' });
    const pdf = await imprimer(html, {
      paysage: req.query.orientation === 'paysage',
      pied: `MICA – SONABHY · imprimé par ${auteur(req.user)} le ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Ouagadougou' })}`,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier(req.query.fichier)}"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'no-store',
    });
    res.end(pdf);
  } catch (err) {
    console.error('[PDF] génération :', err.message);
    sendError(res, { status: 500, message: 'Impossible de générer le PDF.' });
  }
});

module.exports = router;
