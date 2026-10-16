/* ==================================================================
 *  Auteur : BATIONO Ulrich Rachid Kévin
 *           Expert en Sécurité Informatique
 *           Développeur FullStack
 *           Tel: +226 51 57 82 89 // 66 72 02 32
 *           Whatsapp: +226 51 57 82 89
 *           Mail: bkevin@sonabhy.bf // bationor10@gmail.com
 *  Projet : MICA – SONABHY
 * ================================================================== */
const auditCreate = (userId) => ({
  created_at: new Date(),
  created_by: userId || null,
  updated_at: new Date(),
  updated_by: userId || null,
  del: 0,
});

const auditUpdate = (userId) => ({
  updated_at: new Date(),
  updated_by: userId || null,
});

const auditDelete = (userId) => ({
  deleted_at: new Date(),
  deleted_by: userId || null,
  del: 1,
});

const scopeActive = { del: 0 };

module.exports = { auditCreate, auditUpdate, auditDelete, scopeActive };
