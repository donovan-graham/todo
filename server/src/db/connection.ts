import { Pool } from "pg";

export const pool = new Pool({
  host: "127.0.0.1", // localhost
  port: 5432,
  user: "postgres_user",
  password: "postgres_password",
  database: "postgres_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});
