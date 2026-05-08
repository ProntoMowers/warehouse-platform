require('dotenv').config();

const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const secureRoutes = require('./routes/secure.routes');
const { apiKeyAuth } = require('./middleware/apiKeyAuth');

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/health', healthRoutes);
app.use('/api', apiKeyAuth, secureRoutes);

app.use((req, res) => {
	res.status(404).json({
		ok: false,
		message: 'Route not found.'
	});
});

app.use((err, req, res, next) => {
	console.error('Unhandled error:', err);
	res.status(500).json({
		ok: false,
		message: 'Internal server error.'
	});
});

app.listen(port, () => {
	console.log(`Picking backend running on port ${port}`);
});
