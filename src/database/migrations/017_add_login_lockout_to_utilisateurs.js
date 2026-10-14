module.exports = {
  name: '017_add_login_lockout_to_utilisateurs',
  async up(sequelize) {
    const [attempts] = await sequelize.query(`SHOW COLUMNS FROM utilisateurs LIKE 'failed_login_attempts'`);
    if (attempts.length === 0) {
      await sequelize.query(
        `ALTER TABLE utilisateurs ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0 AFTER password_changed_at`
      );
    }
    const [locked] = await sequelize.query(`SHOW COLUMNS FROM utilisateurs LIKE 'locked_until'`);
    if (locked.length === 0) {
      await sequelize.query(
        `ALTER TABLE utilisateurs ADD COLUMN locked_until DATETIME DEFAULT NULL AFTER failed_login_attempts`
      );
    }
  },
};
