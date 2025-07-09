const { Pool } = require("pg");
const keys = require("./config.js");
const pool = new Pool(keys.db);
module.exports = pool;
