const { MongoClient } = require('mongodb');

let mongoClient;
let mongoDb;

async function getMongoDb() {
	if (mongoDb) {
		return mongoDb;
	}

	const uri = process.env.MONGO_URI;
	const dbName = process.env.MONGO_DB;

	mongoClient = new MongoClient(uri, {
		maxPoolSize: 10
	});

	await mongoClient.connect();
	mongoDb = mongoClient.db(dbName);

	return mongoDb;
}

async function testMongoConnection() {
	const db = await getMongoDb();
	await db.command({ ping: 1 });
	return true;
}

module.exports = {
	getMongoDb,
	testMongoConnection
};
