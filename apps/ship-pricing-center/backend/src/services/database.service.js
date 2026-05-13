const fs = require('fs');
const mysql = require('mysql2/promise');
const sql = require('mssql');
const { BigQuery } = require('@google-cloud/bigquery');
const {
  getBigQueryConfig,
  getMssqlConfig,
  getMysqlConfig,
  isSet
} = require('./config.service');

let mysqlPool = null;
let mssqlPoolPromise = null;

function normalize(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }
  return value;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalize(value)])
  );
}

function getMysqlPool() {
  if (!mysqlPool) {
    mysqlPool = mysql.createPool(getMysqlConfig());
  }
  return mysqlPool;
}

function getMssqlPool() {
  if (!mssqlPoolPromise) {
    mssqlPoolPromise = new sql.ConnectionPool(getMssqlConfig())
      .connect()
      .catch((error) => {
        mssqlPoolPromise = null;
        throw error;
      });
  }
  return mssqlPoolPromise;
}

async function mysqlAll(query, params = []) {
  const [rows] = await getMysqlPool().execute(query, params);
  return rows.map(normalizeRow);
}

async function mysqlOne(query, params = []) {
  const rows = await mysqlAll(query, params);
  return rows[0] || {};
}

function bindSqlServerParams(query, params = []) {
  let index = 0;
  const text = query.replace(/\?/g, () => `@p${index++}`);
  return { text, count: index };
}

async function sqlserverAll(query, params = []) {
  const pool = await getMssqlPool();
  const { text } = bindSqlServerParams(query, params);
  const request = pool.request();
  params.forEach((value, index) => {
    request.input(`p${index}`, value);
  });
  const result = await request.query(text);
  return result.recordset.map(normalizeRow);
}

async function sqlserverOne(query, params = []) {
  const rows = await sqlserverAll(query, params);
  return rows[0] || {};
}

async function bigqueryAll(query) {
  const { projectId, keyFilename } = getBigQueryConfig();
  const options = {};
  if (projectId) options.projectId = projectId;
  if (keyFilename) options.keyFilename = keyFilename;

  const client = new BigQuery(options);
  const [job] = await client.createQueryJob({ query });
  const [rows] = await job.getQueryResults();
  return rows.map(normalizeRow);
}

async function runSafeCheck(testFn, requiredValues = {}) {
  const missing = Object.entries(requiredValues)
    .filter(([, value]) => !isSet(String(value || '')))
    .map(([name]) => name);

  if (missing.length) {
    return {
      status: 'skipped',
      message: `Missing configuration: ${missing.join(', ')}`
    };
  }

  try {
    await testFn();
    return { status: 'ok' };
  } catch (error) {
    return {
      status: 'error',
      message: error.message
    };
  }
}

async function checkAllDatabases() {
  const mysqlCfg = getMysqlConfig();
  const mssqlCfg = getMssqlConfig();
  const bqCfg = getBigQueryConfig();
  const bigQueryRequirements = getBigQueryRequirements(bqCfg);

  const [mysqlStatus, mssqlStatus, bigqueryStatus] = await Promise.all([
    runSafeCheck(
      () => mysqlOne('SELECT 1 AS ok'),
      { host: mysqlCfg.host, user: mysqlCfg.user, database: mysqlCfg.database }
    ),
    runSafeCheck(
      () => sqlserverOne('SELECT 1 AS ok'),
      { server: mssqlCfg.server, user: mssqlCfg.user, database: mssqlCfg.database }
    ),
    runSafeCheck(
      () => bigqueryAll('SELECT 1 AS ok'),
      bigQueryRequirements
    )
  ]);

  return {
    timestamp: new Date().toISOString(),
    databases: {
      mysql: mysqlStatus,
      mssql: mssqlStatus,
      bigquery: bigqueryStatus
    }
  };
}

function getBigQueryRequirements(bqCfg) {
  if (!bqCfg.projectId) {
    return { projectId: '' };
  }

  if (bqCfg.keyFilename && !fs.existsSync(bqCfg.keyFilename)) {
    return { credentialsFile: '' };
  }

  return { projectId: bqCfg.projectId };
}

async function closeDatabasePools() {
  const poolCloseTasks = [];

  if (mysqlPool) {
    poolCloseTasks.push(mysqlPool.end());
    mysqlPool = null;
  }

  if (mssqlPoolPromise) {
    poolCloseTasks.push(
      mssqlPoolPromise
        .then((pool) => pool.close())
        .catch(() => {})
    );
    mssqlPoolPromise = null;
  }

  await Promise.all(poolCloseTasks);
}

module.exports = {
  bigqueryAll,
  checkAllDatabases,
  closeDatabasePools,
  mysqlAll,
  mysqlOne,
  sqlserverAll,
  sqlserverOne
};
