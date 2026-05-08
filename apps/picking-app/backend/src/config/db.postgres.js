const { Pool } = require('pg');

let pool;

function getPostgresPool() {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: 5,
    idleTimeoutMillis: 30000
  });

  return pool;
}

async function testPostgresConnection() {
  const pgPool = getPostgresPool();
  const client = await pgPool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

module.exports = {
  getPostgresPool,
  testPostgresConnection
};
