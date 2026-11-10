# Authorank — Penentu Urutan Penulis & Matriks Kontribusi Karya Tulis Ilmiah

Authorank adalah web app full-stack modern yang dirancang untuk **dosen, peneliti, dan mahasiswa** guna menentukan urutan kepenulisan (*authorship order*) secara adil, objektif, dan transparan untuk berbagai jenis karya tulis (Artikel Jurnal Ilmiah, Buku Monograf/Referensi, Book Chapter, dan Prosiding Konferensi).

Aplikasi ini menggunakan standar internasional **CRediT (Contributor Roles Taxonomy)** dengan pembobotan kontribusi (*Lead, Equal, Supporting*), visualisasi statistik bergaya dashboard minimalis, sistem keamanan **Kode Akses PIN**, serta integrasi **Google Sheets sebagai database** dan **Vercel Serverless Functions**.

---

## 1. Skema Database Google Sheets

Buat satu spreadsheet di Google Drive Anda (misal beri nama `DB_Authorank`), lalu buat **2 tab sheet** dengan header kolom pada **baris pertama (A1)** persis seperti di bawah ini:

### Tab 1: `projects`
Salin teks header berikut dan tempel di sel `A1` pada sheet `projects`:
```text
id	title	publication_type	target_venue	pin	total_contributors	first_author	corresponding_author	notes	created_at	updated_at
```

| Nama Kolom | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | String (UUID/ID) | Ya | ID unik proyek (cth: `proj_1731234567890`) |
| `title` | String | Ya | Judul karya tulis ilmiah atau buku |
| `publication_type` | String | Ya | `article`, `book`, `book_chapter`, atau `proceeding` |
| `target_venue` | String | Tidak | Nama target jurnal/penerbit |
| `pin` | String | Ya | Kode akses PIN (4-8 karakter) untuk membuka proyek |
| `total_contributors`| Integer | Ya | Jumlah total penulis |
| `first_author` | String | Ya | Nama penulis urutan pertama (*First Author*) |
| `corresponding_author` | String | Ya | Nama penulis korespondensi (*Corresponding Author*) |
| `notes` | String | Tidak | Catatan tambahan tim penelitian |
| `created_at` | ISO 8601 | Ya | Tanggal pembuatan proyek |
| `updated_at` | ISO 8601 | Ya | Tanggal pembaruan terakhir |

### Tab 2: `contributors`
Salin teks header berikut dan tempel di sel `A1` pada sheet `contributors`:
```text
id	project_id	name	category	institution	email	is_corresponding	score	percentage	author_order	contributions_json	updated_at
```

| Nama Kolom | Tipe Data | Wajib | Keterangan |
| :--- | :--- | :--- | :--- |
| `id` | String | Ya | ID unik kontributor |
| `project_id` | String | Ya | Foreign Key merujuk ke `projects.id` |
| `name` | String | Ya | Nama lengkap dan gelar akademis |
| `category` | String | Ya | `dosen`, `mahasiswa`, `peneliti`, atau `asisten` |
| `institution` | String | Tidak | Afiliasi kampus atau lembaga riset |
| `email` | String | Tidak | Email kontak |
| `is_corresponding` | Boolean | Ya | `TRUE` jika korespondensi, `FALSE` jika bukan |
| `score` | Decimal | Ya | Skor total pembobotan CRediT |
| `percentage` | Decimal | Ya | Persentase kontribusi relatif terhadap tim (%) |
| `author_order` | Integer | Ya | Urutan kepenulisan (1, 2, 3...) |
| `contributions_json`| JSON String | Ya | Rekam peran per level CRediT |
| `updated_at` | ISO 8601 | Ya | Tanggal pembaruan data |

---

## 2. Menyiapkan Google Cloud Service Account

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat proyek baru atau pilih proyek yang sudah ada.
3. Buka **APIs & Services → Library**, cari **Google Sheets API**, lalu klik **Enable**.
4. Buka **IAM & Admin → Service Accounts**, klik **Create Service Account**:
   - Beri nama service account, misal: `authorank-sheets-bot`.
5. Setelah dibuat, klik service account tersebut, buka tab **Keys → Add Key → Create New Key**, pilih format **JSON**.
6. File kredensial JSON akan otomatis terunduh ke komputer Anda.
7. **PENTING:** Salin alamat email service account (contoh: `authorank-sheets-bot@project-id.iam.gserviceaccount.com`), lalu buka Google Spreadsheet Anda, klik **Share (Bagikan)**, dan masukkan email tersebut dengan hak akses **Editor**.

---

## 3. Menjalankan di Komputer Lokal

1. Masuk ke folder proyek:
   ```bash
   cd /Users/admin/.gemini/antigravity/scratch/authorank
   ```
2. Pasang dependensi Node.js:
   ```bash
   npm install
   ```
3. Salin file environment:
   ```bash
   cp .env.example .env.local
   ```
4. Buka `.env.local` dan isi nilainya:
   - `SPREADSHEET_ID`: ID dari URL Google Spreadsheet Anda.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: Seluruh isi file JSON kunci kredensial yang diunduh (dijadikan 1 baris teks string).
5. Jalankan server lokal:
   ```bash
   npx vercel dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

*(Catatan: Anda juga bisa langsung membuka file `index.html` langsung di browser untuk mencoba kalkulator dan antarmuka interaktif secara standalone).*

---

## 4. Cara Deploy ke GitHub & Vercel

### A. Unggah ke GitHub
Repository lokal sudah diinisialisasi dan di-*commit*. Untuk mengunggah ke akun GitHub `abay-cmd`:
1. Buat repository kosong baru di GitHub: [https://github.com/new](https://github.com/new) dengan nama `authorank`.
2. Jalankan perintah push di terminal:
```bash
git push -u origin main
```
*(Remote origin sudah disetel ke `https://github.com/abay-cmd/authorank.git`).*

### B. Deploy di Vercel
1. Masuk ke dashboard [Vercel](https://vercel.com) dan klik **Add New... → Project**.
2. Hubungkan repository GitHub `authorank`.
3. Pada bagian **Framework Preset**, pilih **Other**.
4. Buka menu **Environment Variables**, tambahkan:
   - `SPREADSHEET_ID` = ID Spreadsheet Google Anda.
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = Salinan lengkap string JSON kredensial service account.
5. Klik **Deploy**.
6. Setelah selesai, buka URL aplikasi yang diberikan oleh Vercel.

---

## 5. Panduan Penggunaan Aplikasi

1. **Dashboard & Quick Stats**:
   - Menampilkan metrik utama proyek: jumlah kontributor, format karya tulis, siapa yang menempati *First Author*, siapa yang memegang *Corresponding Author*, serta skor CRediT tertinggi.
2. **Tambah & Kelola Kontributor**:
   - Klik tombol **Tambah Penulis** atau klik ikon pensil pada tabel untuk mengatur matriks kontribusi 14 peran CRediT (*Konseptualisasi, Metodologi, Investigasi, Draf Awal, Revisi, Supervisi, Software*, dll).
   - Tentukan level keterlibatan: *Lead* (pemimpin utama), *Equal* (seimbang), *Supporting* (pendukung), atau *None* (tidak terlibat).
3. **Kalkulasi Urutan Otomatis**:
   - Sistem secara otomatis menghitung akumulasi skor ilmiah dan menetapkan urutan Penulis 1, Penulis 2, Penulis 3, dst., serta menampilkan grafik batang perbandingan kontribusi.
4. **Ekspor CRediT Author Statement**:
   - Klik menu **CRediT Statement** untuk menghasilkan narasi kontribusi yang sesuai dengan standar jurnal Elsevier, Springer, Nature, dan IEEE, siap untuk langsung di-*copy-paste*.
5. **Cetak Berita Acara Resmi**:
   - Klik tombol **Cetak Berita Acara** untuk menampilkan lembar kesepakatan hak kepenulisan resmi yang memuat tanggal, daftar kontribusi, dan kolom tanda tangan dosen serta mahasiswa, siap dicetak langsung atau disimpan sebagai PDF.
6. **Proteksi & Akses dengan PIN**:
   - Klik **Simpan ke Cloud** dan masukkan PIN 4 digit untuk mengunci data proyek ke Google Sheets.
   - Anggota tim lain dapat membuka kembali proyek dengan mengklik **Buka via PIN**.
