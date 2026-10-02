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
