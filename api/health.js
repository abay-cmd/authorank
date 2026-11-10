// api/health.js
// Pemeriksaan status server, environment, dan koneksi Google Sheets tanpa membocorkan secret

const { testSheetsConnection } = require('../lib/sheets');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Hanya metode GET yang diizinkan.' }
    });
  }

  try {
    const hasSpreadsheetId = Boolean(process.env.SPREADSHEET_ID);
    const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const sheetsStatus = await testSheetsConnection();

    return res.status(200).json({
      ok: true,
      service: 'Authorank API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: {
        spreadsheetConfigured: hasSpreadsheetId,
        serviceAccountConfigured: hasServiceAccount,
        storageMode: sheetsStatus.mode
      },
      database: {
        status: sheetsStatus.connected ? 'connected' : 'standalone_fallback',
        detail: sheetsStatus.message
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Gagal melakukan health check sistem.'
      }
    });
  }
};
