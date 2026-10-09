module.exports = {
  name: '014_add_password_changed_at',
  async up(sequelize) {
    const [cols] = await sequelize.query(`SHOW COLUMNS FROM utilisateurs LIKE 'password_changed_at'`);
    if (cols.length > 0) return;
    await sequelize.query(
      `ALTER TABLE utilisateurs ADD COLUMN password_changed_at DATETIME DEFAULT NULL AFTER must_change_password`
    );
  },
};
