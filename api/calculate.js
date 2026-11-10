// api/calculate.js
// Endpoint kalkulasi pembobotan urutan penulis dan pembuatan CRediT Statement

const {
  CREDIT_ROLES,
  BOOK_SPECIFIC_ROLES,
  calculateAuthorship,
  generateCreditStatement
} = require('../lib/validation');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Kembalikan daftar definisi peran CRediT dan bobotnya
    return res.status(200).json({
      ok: true,
      data: {
        creditRoles: CREDIT_ROLES,
        bookRoles: BOOK_SPECIFIC_ROLES
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Hanya metode GET dan POST yang didukung.' }
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_JSON', message: 'Payload JSON tidak valid.' }
        });
      }
    }

    const { contributors, publicationType } = body || {};

    if (!Array.isArray(contributors) || contributors.length === 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_CONTRIBUTORS', message: 'Daftar kontributor tidak boleh kosong.' }
      });
    }

    const rankedContributors = calculateAuthorship(contributors, publicationType || 'article');
    const creditStatement = generateCreditStatement(rankedContributors);

    return res.status(200).json({
      ok: true,
      data: {
        publicationType: publicationType || 'article',
        totalContributors: rankedContributors.length,
        rankedContributors,
        creditStatement,
        calculatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[Calculate API Error]:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'CALCULATION_ERROR',
        message: 'Terjadi kesalahan saat memproses perhitungan kontribusi.'
      }
    });
  }
};
