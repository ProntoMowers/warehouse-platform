const { checkAllDatabases } = require('../services/database.service');

async function getDatabasesStatus(req, res) {
  const result = await checkAllDatabases();

  const hasErrors = Object.values(result.databases).some((entry) => entry.status === 'error');

  res.status(hasErrors ? 207 : 200).json({
    ok: !hasErrors,
    ...result
  });
}

module.exports = {
  getDatabasesStatus
};
