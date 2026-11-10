// api/projects.js
// Endpoint manajemen proyek karya tulis dengan otentikasi PIN dan Google Sheets

const {
  validateProjectInput,
  calculateAuthorship,
  generateCreditStatement
} = require('../lib/validation');
const {
  saveProjectToStorage,
  getProjectFromStorage,
  listPublicProjects
} = require('../lib/sheets');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Mengambil daftar ringkasan atau detail satu proyek dengan PIN
  if (req.method === 'GET') {
    try {
      const { id, pin } = req.query;

      if (id) {
        if (!pin) {
          return res.status(401).json({
            ok: false,
            error: { code: 'PIN_REQUIRED', message: 'Kode akses PIN wajib diisi untuk membuka proyek.' }
          });
        }

        const result = await getProjectFromStorage(id, pin);
        if (!result.success) {
          return res.status(403).json({
            ok: false,
            error: { code: 'ACCESS_DENIED', message: result.error || 'Akses ditolak atau proyek tidak ditemukan.' }
          });
        }

        // Hitung ulang CRediT statement dan format data
        const rankedContributors = calculateAuthorship(result.contributors, result.project.publicationType);
        const creditStatement = generateCreditStatement(rankedContributors);

        return res.status(200).json({
          ok: true,
          data: {
            project: result.project,
            contributors: rankedContributors,
            creditStatement,
            source: result.source
          }
        });
      }

      // Jika tanpa parameter id, kembalikan daftar ringkasan proyek yang tersimpan
      const list = await listPublicProjects();
      return res.status(200).json({
        ok: true,
        data: {
          total: list.length,
          projects: list
        }
      });
    } catch (err) {
      console.error('[Projects GET Error]:', err);
      return res.status(500).json({
        ok: false,
        error: { code: 'FETCH_FAILED', message: 'Gagal mengambil data proyek.' }
      });
    }
  }

  // POST: Simpan proyek baru atau perbarui proyek
  if (req.method === 'POST') {
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

      // Validasi input
      const validation = validateProjectInput(body);
      if (!validation.valid) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: validation.errors.join(' ')
          }
        });
      }

      const cleanData = validation.sanitized;

      // Hitung urutan penulis secara resmi
      const rankedContributors = calculateAuthorship(cleanData.contributors, cleanData.publicationType);
      const creditStatement = generateCreditStatement(rankedContributors);

      // Simpan ke storage (Google Sheets / fallback)
      const saveResult = await saveProjectToStorage(cleanData, rankedContributors);

      return res.status(200).json({
        ok: true,
        message: 'Proyek karya tulis dan urutan penulis berhasil disimpan.',
        data: {
          projectId: saveResult.projectId,
          storage: saveResult.storage,
          title: cleanData.title,
          publicationType: cleanData.publicationType,
          totalContributors: rankedContributors.length,
          rankedContributors,
          creditStatement
        }
      });
    } catch (err) {
      console.error('[Projects POST Error]:', err);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'SAVE_FAILED',
          message: 'Terjadi kesalahan internal saat menyimpan proyek.'
        }
      });
    }
  }

  return res.status(405).json({
    ok: false,
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Metode HTTP tidak didukung.' }
  });
};
