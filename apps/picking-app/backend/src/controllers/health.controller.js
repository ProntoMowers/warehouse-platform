function getHealth(req, res) {
  res.json({
    ok: true,
    service: 'picking-app-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
}

function getSecurePing(req, res) {
  res.json({
    ok: true,
    message: 'Secure endpoint reachable.',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  getHealth,
  getSecurePing
};
