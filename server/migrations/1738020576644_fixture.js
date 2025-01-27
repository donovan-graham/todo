/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.sql(`INSERT INTO users (id, username, password_hash, created_at) VALUES
        ('52177dc0-1a37-426c-b5e1-e9f54e6604a4', 'don', '$2b$10$RYSbOyAgoV.GgRKeM2sOSOboRXEQL11vt5G9J1e1tUhAq/Ciujprq', '2025-01-27T22:32:22.914Z');`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {};
