function getTokenFromHeaders(req) {
  const apiKeyHeader = req.header('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }

  const auth = req.header('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return '';
}

function getConfiguredKeys() {
  const keys = new Set();

  if (process.env.API_KEY) {
    keys.add(process.env.API_KEY.trim());
  }

  if (process.env.API_KEYS) {
    process.env.API_KEYS.split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .forEach((k) => keys.add(k));
  }

  if (process.env.PARTS_AVAILABILITY_API_KEY) {
    keys.add(process.env.PARTS_AVAILABILITY_API_KEY.trim());
  }

  return keys;
}

function apiKeyAuth(req, res, next) {
  const configuredKeys = getConfiguredKeys();

  if (!configuredKeys.size) {
    return res.status(500).json({
      ok: false,
      message: 'API keys are not configured in environment variables.'
    });
  }

  const incomingToken = getTokenFromHeaders(req);

  if (!incomingToken || !configuredKeys.has(incomingToken)) {
    return res.status(401).json({
      ok: false,
      message: 'Unauthorized. Provide a valid API key in x-api-key or Bearer token.'
    });
  }

  next();
}

module.exports = {
  apiKeyAuth
};
