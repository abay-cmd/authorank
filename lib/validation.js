// lib/validation.js
// Validasi data, sanitasi, dan algoritma pembobotan urutan penulis CRediT

const CREDIT_ROLES = [
  { id: 'conceptualization', label: 'Konseptualisasi Ide', weight: 1.2, desc: 'Perumusan atau evolusi ide dan tujuan penelitian' },
  { id: 'methodology', label: 'Metodologi', weight: 1.2, desc: 'Pengembangan atau perancangan metodologi' },
  { id: 'investigation', label: 'Investigasi & Eksperimen', weight: 1.1, desc: 'Pelaksanaan riset, eksperimen, atau pengumpulan data lapangan' },
  { id: 'formal_analysis', label: 'Analisis Formal', weight: 1.0, desc: 'Analisis statistik, komputasi, atau interpretasi data' },
  { id: 'writing_draft', label: 'Penulisan Draf Awal', weight: 1.3, desc: 'Penyusunan naskah awal secara substansial' },
  { id: 'writing_review', label: 'Penelaahan & Revisi', weight: 0.9, desc: 'Kajian kritis, komentar, atau revisi substansi sebelum publikasi' },
  { id: 'software', label: 'Perangkat Lunak / Koding', weight: 0.8, desc: 'Pemrograman software, perancangan algoritma atau kode' },
  { id: 'validation', label: 'Validasi & Verifikasi', weight: 0.8, desc: 'Verifikasi replikasi/keandalan hasil penelitian' },
  { id: 'data_curation', label: 'Kurasi & Manajemen Data', weight: 0.7, desc: 'Anotasi, pembersihan, dan pemeliharaan data penelitian' },
  { id: 'resources', label: 'Penyediaan Sumber Daya', weight: 0.6, desc: 'Penyediaan sampel, reagen, pasien, instrumen, komputasi' },
  { id: 'visualization', label: 'Visualisasi & Grafik', weight: 0.7, desc: 'Pembuatan visualisasi, diagram, dan gambar ilmiah' },
  { id: 'supervision', label: 'Supervisi / Pembimbingan', weight: 1.0, desc: 'Bimbingan, kepemimpinan, dan tanggung jawab mentoring' },
  { id: 'project_admin', label: 'Administrasi Proyek', weight: 0.6, desc: 'Pengelolaan dan koordinasi aktivitas penelitian' },
  { id: 'funding_acquisition', label: 'Perolehan Dana / Hibah', weight: 0.6, desc: 'Pencarian dukungan finansial untuk riset' }
];

const BOOK_SPECIFIC_ROLES = [
  { id: 'book_primary_chapter', label: 'Penulisan Bab Utama', weight: 1.4, desc: 'Penulisan bagian/bab inti buku' },
  { id: 'book_editing', label: 'Penyuntingan Substansi Buku', weight: 1.1, desc: 'Editor umum, harmonisasi isi antar bab' },
  { id: 'book_layout_prep', label: 'Penyelarasan & Tata Letak', weight: 0.7, desc: 'Proofreading bahasa dan tata letak naskah buku' }
];

const LEVEL_MULTIPLIERS = {
  lead: 1.0,        // Kontribusi dominan / pemimpin tugas
  equal: 0.65,      // Kontribusi seimbang bersama
  supporting: 0.35, // Kontribusi pendukung / asistensi teknis
  none: 0.0         // Tidak berkontribusi pada peran ini
};

/**
 * Sanitasi string sederhana untuk menghindari script injection atau format rusak
 */
function sanitizeString(str, maxLength = 255) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLength);
}

/**
 * Validasi PIN 4-8 karakter alfanumerik
 */
function isValidPin(pin) {
  if (!pin) return false;
  const pinStr = String(pin).trim();
  return /^[0-9A-Za-z]{4,8}$/.test(pinStr);
}

/**
 * Validasi data proyek karya tulis
 */
function validateProjectInput(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Format data proyek tidak valid.'] };
  }

  const title = sanitizeString(data.title, 300);
  if (!title || title.length < 3) {
    errors.push('Judul karya tulis wajib diisi (minimal 3 karakter).');
  }

  const publicationType = data.publicationType;
  const validTypes = ['article', 'book', 'book_chapter', 'proceeding'];
  if (!validTypes.includes(publicationType)) {
    errors.push('Jenis karya tulis harus berupa artikel, buku, book chapter, atau prosiding.');
  }

  const pin = String(data.pin || '').trim();
  if (!isValidPin(pin)) {
    errors.push('PIN akses harus terdiri dari 4 sampai 8 digit angka/huruf.');
  }

  if (!Array.isArray(data.contributors) || data.contributors.length === 0) {
    errors.push('Minimal harus ada satu kontributor / penulis.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      title,
      publicationType,
      targetVenue: sanitizeString(data.targetVenue || '', 200),
      notes: sanitizeString(data.notes || '', 1000),
      pin,
      contributors: Array.isArray(data.contributors) ? data.contributors : []
    }
  };
}

/**
 * Kalkulasi pembobotan urutan penulis berdasarkan CRediT Taxonomy
 */
function calculateAuthorship(contributors, publicationType = 'article') {
  if (!Array.isArray(contributors) || contributors.length === 0) {
    return [];
  }

  // Pilih roles yang aktif sesuai jenis karya
  const activeRoles = [...CREDIT_ROLES];
  if (publicationType === 'book' || publicationType === 'book_chapter') {
    activeRoles.push(...BOOK_SPECIFIC_ROLES);
  }

  // Hitung skor per kontributor
  const scored = contributors.map((c, index) => {
    let rawScore = 0;
    const roleDetails = [];
    const contributions = c.contributions || {};

    activeRoles.forEach(role => {
      const level = contributions[role.id] || 'none';
      const multiplier = LEVEL_MULTIPLIERS[level] || 0;
      const point = role.weight * multiplier;

      if (point > 0) {
        rawScore += point;
        roleDetails.push({
          roleId: role.id,
          roleLabel: role.label,
          level,
          point: parseFloat(point.toFixed(2))
        });
      }
    });

    return {
      id: c.id || `contrib-${Date.now()}-${index}`,
      name: sanitizeString(c.name || `Penulis ${index + 1}`, 150),
      category: c.category || 'dosen', // 'dosen', 'mahasiswa', 'peneliti', 'lainnya'
      institution: sanitizeString(c.institution || '-', 200),
      email: sanitizeString(c.email || '', 150),
      isCorresponding: Boolean(c.isCorresponding),
      contributions,
      score: parseFloat(rawScore.toFixed(3)),
      activeRoleCount: roleDetails.length,
      roleDetails
    };
  });

  // Hitung total seluruh skor untuk persentase
  const grandTotal = scored.reduce((sum, item) => sum + item.score, 0);

  // Urutkan berdasarkan skor tertinggi ke terendah
  // Jika skor sama, kontributor dengan draf awal / konseptualisasi lebih tinggi diutamakan
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aDraft = (a.contributions.writing_draft === 'lead' ? 2 : a.contributions.writing_draft === 'equal' ? 1 : 0);
    const bDraft = (b.contributions.writing_draft === 'lead' ? 2 : b.contributions.writing_draft === 'equal' ? 1 : 0);
    if (bDraft !== aDraft) return bDraft - aDraft;
    return a.name.localeCompare(b.name);
  });

  // Pasang urutan ranking dan persentase
  return scored.map((item, idx) => {
    const percentage = grandTotal > 0 ? ((item.score / grandTotal) * 100) : (100 / scored.length);
    return {
      ...item,
      order: idx + 1,
      orderLabel: idx === 0 ? 'Penulis Pertama (First Author)' : `Penulis Ke-${idx + 1} (Co-Author)`,
      percentage: parseFloat(percentage.toFixed(1))
    };
  });
}

/**
 * Generate CRediT statement standar jurnal ilmiah
 */
function generateCreditStatement(rankedContributors) {
  if (!rankedContributors || rankedContributors.length === 0) return '';

  const statementParts = rankedContributors.map(c => {
    const leadOrEqualRoles = (c.roleDetails || [])
      .filter(r => r.level === 'lead' || r.level === 'equal')
      .map(r => r.roleLabel);

    const supportingRoles = (c.roleDetails || [])
      .filter(r => r.level === 'supporting')
      .map(r => `${r.roleLabel} (pendukung)`);

    const allRoles = [...leadOrEqualRoles, ...supportingRoles];
    const roleStr = allRoles.length > 0 ? allRoles.join(', ') : 'Kontribusi penelaahan umum';

    return `**${c.name}**: ${roleStr}.`;
  });

  return statementParts.join('\n\n');
}

module.exports = {
  CREDIT_ROLES,
  BOOK_SPECIFIC_ROLES,
  LEVEL_MULTIPLIERS,
  sanitizeString,
  isValidPin,
  validateProjectInput,
  calculateAuthorship,
  generateCreditStatement
};
