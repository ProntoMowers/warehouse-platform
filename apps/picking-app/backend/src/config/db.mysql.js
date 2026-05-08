const mysql = require('mysql2/promise');

let pool;

function getMysqlPool() {
	if (pool) {
		return pool;
	}

	pool = mysql.createPool({
		host: process.env.MYSQL_HOST,
		port: Number(process.env.MYSQL_PORT || 3306),
		user: process.env.MYSQL_USER,
		password: process.env.MYSQL_PASSWORD,
		database: process.env.MYSQL_DATABASE,
		waitForConnections: true,
		connectionLimit: 10,
		queueLimit: 0
	});

	return pool;
}

async function testMysqlConnection() {
	const mysqlPool = getMysqlPool();
	const connection = await mysqlPool.getConnection();

	try {
		await connection.query('SELECT 1');
		return true;
	} finally {
		connection.release();
	}
}

module.exports = {
	getMysqlPool,
	testMysqlConnection
};
