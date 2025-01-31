const { PgLiteral } = require("node-pg-migrate");

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
  pgm.createExtension("uuid-ossp", { ifNotExists: true });

  pgm.createType("status_type", ["todo", "ongoing", "done"]);

  pgm.createTable(
    "users",
    {
      id: {
        type: "uuid",
        default: new PgLiteral("uuid_generate_v4()"),
        notNull: true,
        primaryKey: true,
        unique: true,
      },
      username: { type: "varchar(255)", notNull: true },
      password_hash: { type: "varchar(1000)", notNull: true },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      ifNotExists: true,
    }
  );

  pgm.createTable(
    "lists",
    {
      id: {
        type: "uuid",
        default: new PgLiteral("uuid_generate_v4()"),
        notNull: true,
        primaryKey: true,
        unique: true,
      },
      user_id: {
        type: "uuid",
        notNull: true,
        references: "users", // users.id
      },
      name: { type: "varchar(255)", notNull: true },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      ifNotExists: true,
    }
  );

  //   pgm.createIndex("lists", ["user_id"]);
  pgm.createTable(
    "todos",
    {
      id: {
        type: "uuid",
        default: new PgLiteral("uuid_generate_v4()"),
        notNull: true,
        primaryKey: true,
        unique: true,
      },
      list_id: {
        type: "uuid",
        notNull: true,
        references: "lists", // lists.id
      },
      description: { type: "varchar(255)" },
      status: { type: "status_type", notNull: true, default: "todo" },
      position: { type: "varchar(255)", notNull: true },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
      created_by: {
        type: "uuid",
        notNull: true,
        references: "users", // user.id
      },
      updated_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      ifNotExists: true,
    }
  );

  //   pgm.createIndex("todos", "list_id");
  //   pgm.createIndex("todos", "user_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("todos");
  pgm.dropTable("lists");
  pgm.dropTable("users");
};
