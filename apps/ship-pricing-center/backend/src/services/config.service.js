const fs = require('fs');
const path = require('path');

let cachedProfiles = null;

function isSet(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function appRoot() {
  return path.resolve(__dirname, '..', '..');
}

function keysCandidates() {
  const candidates = [];
  [
    process.env.SHIP_PRICING_KEYS_JSON,
    process.env.SPC_KEYS_JSON,
    process.env.PRONTO_KEYS_JSON
  ].filter(isSet).forEach((candidate) => candidates.push(candidate));

  candidates.push(
    path.join(appRoot(), 'config', 'keys.json'),
    path.join(appRoot(), 'data', 'keys.json')
  );

  return candidates;
}

function loadProfiles() {
  if (cachedProfiles) {
    return cachedProfiles;
  }

  for (const candidate of keysCandidates()) {
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(resolved)) {
      continue;
    }

    const raw = fs.readFileSync(resolved, 'utf8');
    const parsed = JSON.parse(raw);
    cachedProfiles = parsed.db_profiles || {};
    return cachedProfiles;
  }

  cachedProfiles = {};
  return cachedProfiles;
}

function profile(name) {
  const profiles = loadProfiles();
  return { ...(profiles[name] || {}) };
}

function env(name, fallback = '') {
  return isSet(process.env[name]) ? process.env[name].trim() : fallback;
}

function numberEnv(name, fallback) {
  const raw = env(name, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw ? parsed : fallback;
}

function getMysqlConfig() {
  const cfg = profile('pronto');
  return {
    host: env('PRONTO_DB_HOST', env('MYSQL_HOST', cfg.host || '')),
    port: numberEnv('PRONTO_DB_PORT', numberEnv('MYSQL_PORT', Number(cfg.port || 3306))),
    user: env('PRONTO_DB_USER', env('MYSQL_USER', cfg.user || '')),
    password: env('PRONTO_DB_PASSWORD', env('MYSQL_PASSWORD', cfg.password || '')),
    database: env('PRONTO_DB_NAME', env('MYSQL_DATABASE', cfg.database || '')),
    waitForConnections: true,
    connectionLimit: numberEnv('MYSQL_POOL_LIMIT', 10),
    queueLimit: 0
  };
}

function getMssqlConfig() {
  const cfg = profile('shipworks');
  const server = env('SHIPWORKS_DB_SERVER', env('MSSQL_HOST', cfg.server || cfg.host || ''));
  const port = numberEnv('SHIPWORKS_DB_PORT', numberEnv('MSSQL_PORT', Number(cfg.port || 0)));
  const config = {
    server,
    database: env('SHIPWORKS_DB_NAME', env('MSSQL_DATABASE', cfg.database || '')),
    user: env('SHIPWORKS_DB_USER', env('MSSQL_USER', cfg.user || '')),
    password: env('SHIPWORKS_DB_PASSWORD', env('MSSQL_PASSWORD', cfg.password || '')),
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    requestTimeout: 60000,
    connectionTimeout: 15000
  };

  if (port > 0 && !server.includes('\\')) {
    config.port = port;
  }

  return config;
}

function getBigQueryConfig() {
  const cfg = profile('bigquery');
  return {
    projectId: env('BIGQUERY_PROJECT', cfg.project || ''),
    keyFilename: env('BIGQUERY_CREDENTIALS_FILE', env('GOOGLE_APPLICATION_CREDENTIALS', cfg.credentials_file || ''))
  };
}

module.exports = {
  appRoot,
  getBigQueryConfig,
  getMssqlConfig,
  getMysqlConfig,
  isSet
};
