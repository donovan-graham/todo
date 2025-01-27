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
  pgm.createIndex("lists", ["user_id"]);

  pgm.createIndex("todos", ["list_id"]);
  pgm.createIndex("todos", ["created_by"]);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropIndex("lists", ["user_id"]);

  pgm.dropIndex("todos", ["list_id"]);
  pgm.dropIndex("todos", ["created_by"]);
};
