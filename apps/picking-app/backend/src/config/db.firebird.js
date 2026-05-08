const Firebird = require('node-firebird');

function getFirebirdOptions() {
	return {
		host: process.env.FB_HOST,
		port: Number(process.env.FB_PORT || 3050),
		database: process.env.FB_DATABASE,
		user: process.env.FB_USER,
		password: process.env.FB_PASSWORD,
		lowercase_keys: false,
		role: null,
		pageSize: 4096
	};
}

function attachFirebird() {
	const options = getFirebirdOptions();

	return new Promise((resolve, reject) => {
		Firebird.attach(options, (error, db) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(db);
		});
	});
}

function executeQuery(db, sql) {
	return new Promise((resolve, reject) => {
		db.query(sql, (error, result) => {
			if (error) {
				reject(error);
				return;
			}

			resolve(result);
		});
	});
}

async function testFirebirdConnection() {
	const db = await attachFirebird();

	try {
		await executeQuery(db, 'SELECT 1 AS ok FROM RDB$DATABASE');
		return true;
	} finally {
		db.detach();
	}
}

module.exports = {
	attachFirebird,
	testFirebirdConnection
};
