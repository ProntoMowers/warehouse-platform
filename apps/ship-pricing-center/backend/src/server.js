require('dotenv').config();

const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health.routes');
const shipPricingRoutes = require('./routes/ship-pricing.routes');
const { apiKeyAuth } = require('./middleware/apiKeyAuth');
const { closeDatabasePools } = require('./services/database.service');

const app = express();
const port = Number(process.env.PORT || 3012);
const corsOptions = buildCorsOptions(process.env.CORS_ORIGIN);

app.disable('x-powered-by');
app.use(cors(corsOptions));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '4mb' }));

app.use('/api/health', healthRoutes);
app.use('/api', apiKeyAuth, shipPricingRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Route not found.'
  });
});

app.use((err, req, res, next) => {
  const status = Number(err.status || 500);
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }
  res.status(status).json({
    ok: false,
    message: err.message || 'Internal server error.'
  });
});

const server = app.listen(port, () => {
  console.log(`Ship Pricing Center backend running on port ${port}`);
});

function buildCorsOptions(originValue) {
  const origins = String(originValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes('*')) {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin not allowed: ${origin}`));
      }
    }
  };
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing Ship Pricing Center backend...`);
  server.close(async () => {
    await closeDatabasePools();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
