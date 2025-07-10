const { Pool } = require("pg");
const isProduction = process.env.NODE_ENV === "production";

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: isProduction ? connectionString : null,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  user: isProduction ? undefined : process.env.DB_USER,
  password: isProduction ? undefined : process.env.DB_PASSWORD,
  host: isProduction ? undefined : process.env.DB_HOST,
  port: isProduction ? undefined : process.env.DB_PORT,
  database: isProduction ? undefined : process.env.DB_DATABASE,
});

module.exports = pool;
