// lib/sheets.js
// Integrasi database Authorank:
// 1. Google Sheets API v4 (Mode Cloud Production)
// 2. Local JSON Database File di data/database.json (Mode Lokal & Inspeksi Langsung)

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

const DB_FILE_PATH = path.join(__dirname, '../data/database.json');

// Memori lokal
const localStore = {
  projects: new Map(),
  contributors: new Map()
};

// Inisialisasi awal: Muat data dari file database.json jika ada
function initLocalDatabase() {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data.tables && data.tables.projects && Array.isArray(data.tables.projects)) {
        data.tables.projects.forEach(p => localStore.projects.set(p.id, p));
      } else if (data.projects && Array.isArray(data.projects)) {
        data.projects.forEach(p => localStore.projects.set(p.id, p));
      }

      if (data.tables && data.tables.contributors && Array.isArray(data.tables.contributors)) {
        data.tables.contributors.forEach(c => {
          const pId = c.projectId;
          if (!localStore.contributors.has(pId)) {
            localStore.contributors.set(pId, []);
          }
          localStore.contributors.get(pId).push(c);
        });
      }
    } else {
      // Buat file database awal dengan sample data
      const sampleProjectId = 'proj_sample_01';
      const sampleProject = {
        id: sampleProjectId,
        title: 'Analisis Efektivitas Model Machine Learning untuk Diagnosis Medis',
        publicationType: 'article',
        targetVenue: 'IEEE Journal of Biomedical Informatics',
        pin: '2026',
        totalContributors: 4,
        firstAuthor: 'Naufal Abiyyu, S.Kom',
        correspondingAuthor: 'Prof. Dr. Ir. Hendra Kusuma, M.Sc.',
        notes: 'Penelitian bersama Lab Pascasarjana Informatika.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const sampleContribs = [
        {
          id: 'c1',
          projectId: sampleProjectId,
          name: 'Naufal Abiyyu, S.Kom',
          category: 'mahasiswa',
          institution: 'Institut Teknologi Bandung',
          email: 'naufal@mhs.itb.ac.id',
          isCorresponding: false,
          score: 6.7,
          percentage: 42.5,
          order: 1,
          contributions: {
            conceptualization: 'equal',
            methodology: 'lead',
            investigation: 'lead',
            formal_analysis: 'lead',
            writing_draft: 'lead',
            software: 'lead',
            validation: 'equal'
          }
        },
        {
          id: 'c2',
          projectId: sampleProjectId,
          name: 'Prof. Dr. Ir. Hendra Kusuma, M.Sc.',
          category: 'dosen',
          institution: 'Institut Teknologi Bandung',
          email: 'hendra.k@itb.ac.id',
          isCorresponding: true,
          score: 5.8,
          percentage: 36.8,
          order: 2,
          contributions: {
            conceptualization: 'lead',
            supervision: 'lead',
            writing_review: 'lead',
            funding_acquisition: 'lead',
            resources: 'lead'
          }
        },
        {
          id: 'c3',
          projectId: sampleProjectId,
          name: 'Siti Rahmawati, S.Tr.Kom',
          category: 'mahasiswa',
          institution: 'Institut Teknologi Bandung',
          email: 'siti.r@mhs.itb.ac.id',
          isCorresponding: false,
          score: 2.1,
          percentage: 13.3,
          order: 3,
          contributions: {
            data_curation: 'lead',
            visualization: 'lead',
            validation: 'supporting'
          }
        },
        {
          id: 'c4',
          projectId: sampleProjectId,
          name: 'Dr. Eng. Dian Pratama, S.T., M.T.',
          category: 'dosen',
          institution: 'BRIN Riset Elektronika',
          email: 'dian.pratama@brin.go.id',
          isCorresponding: false,
          score: 1.15,
          percentage: 7.4,
          order: 4,
          contributions: {
            resources: 'equal',
            writing_review: 'equal'
          }
        }
      ];

      localStore.projects.set(sampleProjectId, sampleProject);
      localStore.contributors.set(sampleProjectId, sampleContribs);
      persistLocalFile();
    }
  } catch (err) {
    console.error('[Database Init Error]:', err.message);
  }
}

// Simpan data memori ke file fisik data/database.json
function persistLocalFile() {
  try {
    const allProjects = Array.from(localStore.projects.values());
    const allContributors = [];
    localStore.contributors.forEach(list => {
      allContributors.push(...list);
    });

    const payload = {
      meta: {
        appName: 'Authorank Database',
        lastUpdated: new Date().toISOString(),
        totalProjects: allProjects.length,
        totalContributors: allContributors.length,
        storageType: 'local_json_persisted'
      },
      tables: {
        projects: allProjects,
        contributors: allContributors
      }
    };

    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database Persist Error]:', err.message);
  }
}

initLocalDatabase();

/**
 * Inisialisasi Google Sheets client
 */
function getSheetsClient() {
  if (!GOOGLE_SERVICE_ACCOUNT_JSON || !SPREADSHEET_ID) {
    return null;
  }

  try {
    let credentials;
    if (typeof GOOGLE_SERVICE_ACCOUNT_JSON === 'string') {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      credentials = GOOGLE_SERVICE_ACCOUNT_JSON;
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    return google.sheets({ version: 'v4', auth });
  } catch (err) {
    console.error('[Sheets] Gagal inisialisasi Google Auth:', err.message);
    return null;
  }
}

/**
 * Tes koneksi ke Google Sheets
 */
async function testSheetsConnection() {
  if (!SPREADSHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      connected: false,
      mode: 'local_database_file',
      filePath: DB_FILE_PATH,
      message: 'Kredensial SPREADSHEET_ID atau GOOGLE_SERVICE_ACCOUNT_JSON belum diisi. Database saat ini tersimpan langsung di file lokal komputer Anda: ' + DB_FILE_PATH
    };
  }

  try {
    const sheets = getSheetsClient();
    if (!sheets) throw new Error('Client Google Sheets tidak dapat dibuat.');

    const res = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const sheetTitles = (res.data.sheets || []).map(s => s.properties.title);

    return {
      connected: true,
      mode: 'google_sheets_live',
      spreadsheetId: SPREADSHEET_ID,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
      spreadsheetTitle: res.data.properties.title,
      sheets: sheetTitles,
      message: 'Koneksi ke Google Sheets cloud database berhasil.'
    };
  } catch (err) {
    return {
      connected: false,
      mode: 'local_database_file',
      filePath: DB_FILE_PATH,
      message: `Gagal mengakses spreadsheet: ${err.message}`
    };
  }
}

/**
 * Simpan atau perbarui proyek di Google Sheets DAN file database.json lokal
 */
async function saveProjectToStorage(project, rankedContributors) {
  const sheets = getSheetsClient();
  const now = new Date().toISOString();

  const projectId = project.id || `proj_${Date.now()}`;
  const firstAuthor = rankedContributors[0] ? rankedContributors[0].name : '-';
  const corresponding = rankedContributors.find(c => c.isCorresponding);
  const correspondingAuthor = corresponding ? corresponding.name : firstAuthor;

  const projectRecord = {
    id: projectId,
    title: project.title,
    publicationType: project.publicationType,
    targetVenue: project.targetVenue || '',
    pin: project.pin,
    totalContributors: rankedContributors.length,
    firstAuthor,
    correspondingAuthor,
    notes: project.notes || '',
    createdAt: project.createdAt || now,
    updatedAt: now
  };

  const formattedContributors = rankedContributors.map(c => ({
    ...c,
    projectId
  }));

  // Simpan selalu ke Local Database File
  localStore.projects.set(projectId, projectRecord);
  localStore.contributors.set(projectId, formattedContributors);
  persistLocalFile();

  if (!sheets || !SPREADSHEET_ID) {
    return {
      success: true,
      projectId,
      storage: 'local_database_file',
      filePath: DB_FILE_PATH,
      message: 'Data berhasil disimpan ke file database lokal komputer Anda.'
    };
  }

  try {
    // 1. Simpan ke tab 'projects' Google Sheets
    const projectRow = [
      projectRecord.id,
      projectRecord.title,
      projectRecord.publicationType,
      projectRecord.targetVenue,
      projectRecord.pin,
      projectRecord.totalContributors,
      projectRecord.firstAuthor,
      projectRecord.correspondingAuthor,
      projectRecord.notes,
      projectRecord.createdAt,
      projectRecord.updatedAt
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'projects!A:K',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [projectRow]
      }
    });

    // 2. Simpan setiap kontributor ke tab 'contributors'
    const contribRows = rankedContributors.map(c => [
      c.id,
      projectId,
      c.name,
      c.category,
      c.institution,
      c.email,
      c.isCorresponding ? 'TRUE' : 'FALSE',
      c.score,
      c.percentage,
      c.order,
      JSON.stringify(c.contributions || {}),
      now
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'contributors!A:L',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: contribRows
      }
    });

    return {
      success: true,
      projectId,
      storage: 'google_sheets_live',
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`,
      message: 'Data berhasil disimpan ke Google Sheets dan file database lokal.'
    };
  } catch (err) {
    console.error('[Sheets] Error saat menyimpan data ke Google Sheets:', err.message);
    return {
      success: true,
      projectId,
      storage: 'local_database_file',
      filePath: DB_FILE_PATH,
      message: `Google Sheets gagal dihubungi (${err.message}), data tersimpan aman di file lokal.`
    };
  }
}

/**
 * Ambil proyek berdasarkan ID dan verifikasi PIN
 */
async function getProjectFromStorage(projectId, pinInput) {
  // Cek di local store terlebih dahulu
  if (localStore.projects.has(projectId)) {
    const proj = localStore.projects.get(projectId);
    if (String(proj.pin).trim() !== String(pinInput).trim()) {
      return { success: false, error: 'PIN akses tidak cocok.' };
    }
    const contributors = localStore.contributors.get(projectId) || [];
    return {
      success: true,
      project: proj,
      contributors,
      source: 'local_database_file'
    };
  }

  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) {
    return { success: false, error: 'Proyek tidak ditemukan dalam database.' };
  }

  try {
    const projRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'projects!A2:K'
    });

    const rows = projRes.data.values || [];
    const foundRow = rows.find(r => r[0] === projectId);

    if (!foundRow) {
      return { success: false, error: 'Proyek dengan ID tersebut tidak ditemukan.' };
    }

    const savedPin = foundRow[4];
    if (String(savedPin).trim() !== String(pinInput).trim()) {
      return { success: false, error: 'PIN akses salah. Akses ditolak.' };
    }

    const project = {
      id: foundRow[0],
      title: foundRow[1],
      publicationType: foundRow[2],
      targetVenue: foundRow[3],
      pin: foundRow[4],
      totalContributors: parseInt(foundRow[5], 10) || 0,
      firstAuthor: foundRow[6],
      correspondingAuthor: foundRow[7],
      notes: foundRow[8],
      createdAt: foundRow[9],
      updatedAt: foundRow[10]
    };

    const contribRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'contributors!A2:L'
    });

    const contribRows = (contribRes.data.values || []).filter(r => r[1] === projectId);
    const contributors = contribRows.map(r => {
      let parsedContribs = {};
      try {
        parsedContribs = JSON.parse(r[10] || '{}');
      } catch (e) {
        parsedContribs = {};
      }

      return {
        id: r[0],
        projectId: r[1],
        name: r[2],
        category: r[3],
        institution: r[4],
        email: r[5],
        isCorresponding: r[6] === 'TRUE',
        score: parseFloat(r[7]) || 0,
        percentage: parseFloat(r[8]) || 0,
        order: parseInt(r[9], 10) || 1,
        contributions: parsedContribs
      };
    });

    return {
      success: true,
      project,
      contributors,
      source: 'google_sheets_live'
    };
  } catch (err) {
    console.error('[Sheets] Error saat mengambil proyek:', err.message);
    return { success: false, error: `Gagal membaca Google Sheets: ${err.message}` };
  }
}

/**
 * Daftar ringkas proyek yang ada
 */
async function listPublicProjects() {
  const localList = Array.from(localStore.projects.values()).map(p => ({
    id: p.id,
    title: p.title,
    publicationType: p.publicationType,
    totalContributors: p.totalContributors,
    firstAuthor: p.firstAuthor,
    updatedAt: p.updatedAt
  }));

  const sheets = getSheetsClient();
  if (!sheets || !SPREADSHEET_ID) {
    return localList;
  }

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'projects!A2:K'
    });

    const rows = res.data.values || [];
    const sheetsList = rows.map(r => ({
      id: r[0],
      title: r[1],
      publicationType: r[2],
      targetVenue: r[3],
      totalContributors: parseInt(r[5], 10) || 0,
      firstAuthor: r[6],
      updatedAt: r[10] || r[9]
    }));

    const map = new Map();
    localList.forEach(p => map.set(p.id, p));
    sheetsList.forEach(p => map.set(p.id, p));

    return Array.from(map.values()).reverse();
  } catch (err) {
    return localList;
  }
}

/**
 * Data lengkap seluruh isi database untuk fitur "Database Inspector / Data Explorer"
 */
async function getDatabaseInspector() {
  const sheetsStatus = await testSheetsConnection();
  const allProjects = Array.from(localStore.projects.values());
  const allContributors = [];
  localStore.contributors.forEach(list => {
    allContributors.push(...list);
  });

  return {
    status: sheetsStatus,
    storageLocation: {
      type: sheetsStatus.connected ? 'google_sheets_cloud' : 'local_json_file',
      localFilePath: DB_FILE_PATH,
      googleSpreadsheetUrl: sheetsStatus.spreadsheetUrl || null,
      spreadsheetId: sheetsStatus.spreadsheetId || null
    },
    tables: {
      projects: allProjects,
      contributors: allContributors
    },
    stats: {
      totalProjects: allProjects.length,
      totalContributors: allContributors.length,
      fileSizeBytes: fs.existsSync(DB_FILE_PATH) ? fs.statSync(DB_FILE_PATH).size : 0
    }
  };
}

module.exports = {
  testSheetsConnection,
  saveProjectToStorage,
  getProjectFromStorage,
  listPublicProjects,
  getDatabaseInspector,
  DB_FILE_PATH
};
