// api/database.js
// Endpoint inspeksi data fisik database (projects & contributors)
// Menampilkan lokasi penyimpanan nyata (File data/database.json lokal vs Google Sheets URL)

const { getDatabaseInspector } = require('../lib/sheets');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Hanya metode GET yang diizinkan.' }
    });
  }

  try {
    const inspectorData = await getDatabaseInspector();
    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString(),
      data: inspectorData
    });
  } catch (err) {
    console.error('[Database API Error]:', err);
    return res.status(500).json({
      ok: false,
      error: { code: 'DATABASE_INSPECTION_FAILED', message: err.message }
    });
  }
};
