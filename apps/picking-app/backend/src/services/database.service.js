const { testMysqlConnection } = require('../config/db.mysql');
const { testMssqlConnection } = require('../config/db.mssql');
const { testMongoConnection } = require('../config/db.mongo');
const { testFirebirdConnection } = require('../config/db.firebird');
const { testPostgresConnection } = require('../config/db.postgres');

function isConfigured(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

async function runSafeCheck(testFn, requiredEnvKeys = []) {
  const missing = requiredEnvKeys.filter((key) => !isConfigured(process.env[key]));

  if (missing.length) {
    return {
      status: 'skipped',
      message: `Missing env vars: ${missing.join(', ')}`
    };
  }

  try {
    await testFn();
    return {
      status: 'ok'
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

async function checkAllDatabases() {
  const [mysql, mssql, mongodb, firebird, postgres] = await Promise.all([
    runSafeCheck(testMysqlConnection, ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE']),
    runSafeCheck(testMssqlConnection, ['MSSQL_HOST', 'MSSQL_USER', 'MSSQL_DATABASE']),
    runSafeCheck(testMongoConnection, ['MONGO_URI', 'MONGO_DB']),
    runSafeCheck(testFirebirdConnection, ['FB_HOST', 'FB_DATABASE', 'FB_USER']),
    runSafeCheck(testPostgresConnection, ['PG_HOST', 'PG_USER', 'PG_DATABASE'])
  ]);

  return {
    timestamp: new Date().toISOString(),
    databases: {
      mysql,
      mssql,
      mongodb,
      firebird,
      postgres
    }
  };
}

module.exports = {
  checkAllDatabases
};
