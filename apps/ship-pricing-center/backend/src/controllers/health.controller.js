function getHealth(req, res) {
  res.json({
    ok: true,
    service: 'ship-pricing-center-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
}

module.exports = {
  getHealth
};
