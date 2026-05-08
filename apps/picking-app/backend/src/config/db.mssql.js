const sql = require('mssql');

let poolPromise;

function splitServerAndInstance(rawHost = '') {
	if (!rawHost.includes('\\')) {
		return { server: rawHost, instanceName: undefined };
	}

	const [server, instanceName] = rawHost.split('\\');
	return { server, instanceName };
}

function getMssqlPool() {
	if (poolPromise) {
		return poolPromise;
	}

	const { server, instanceName } = splitServerAndInstance(process.env.MSSQL_HOST || '');

	const config = {
		server,
		port: Number(process.env.MSSQL_PORT || 1433),
		user: process.env.MSSQL_USER,
		password: process.env.MSSQL_PASSWORD,
		database: process.env.MSSQL_DATABASE,
		pool: {
			max: 10,
			min: 0,
			idleTimeoutMillis: 30000
		},
		options: {
			encrypt: false,
			trustServerCertificate: true
		}
	};

	if (instanceName) {
		config.options.instanceName = instanceName;
	}

	poolPromise = new sql.ConnectionPool(config).connect();

	return poolPromise;
}

async function testMssqlConnection() {
	const pool = await getMssqlPool();
	await pool.request().query('SELECT 1 AS ok');
	return true;
}

module.exports = {
	getMssqlPool,
	testMssqlConnection
};
