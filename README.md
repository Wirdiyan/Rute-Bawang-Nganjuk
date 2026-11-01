# RouteBawang Nganjuk

Simulasi akademik pencarian rute distribusi satu kendaraan: berangkat dari Sukomoro, mengunjungi tujuan yang dipilih, dan kembali ke gudang. Pencarian utama memakai **A* multi-tujuan**, bukan enumerasi urutan. Frontend React dan Leaflet terhubung ke FastAPI yang menghitung solusi baru pada setiap permintaan.

**Lokasi belum merupakan gudang atau penerima barang terverifikasi.** Sesuai skenario proyek, aplikasi menggunakan titik referensi permukiman OpenStreetMap. Penanda peta berada pada node jalan yang dipakai perhitungan. Pergeseran titik referensi ke node jalan ditampilkan di konfigurasi dan tidak ditambahkan ke jarak rute. Hasil bukan rekomendasi operasi pengiriman nyata.

## Menjalankan di Windows

Memerlukan Python 3.10+ dan Node.js 20.19+ atau 22.12+. Klik ganda **Jalankan Rute.bat**, atau dari PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\mulai.ps1
```

Peluncur membuat `.venv` dan memasang dependensi bila belum tersedia. Pemasangan pertama memerlukan internet. Setelah server siap, peluncur otomatis membuka **http://127.0.0.1:5173** di browser. Alamat ini hanya aktif selama server berjalan. Biarkan terminal peluncur terbuka; Ctrl+C menghentikan server yang dimulai peluncur. Log berada di `.local/`. Server hanya mendengarkan pada komputer lokal. Port 8000 dan 5173 harus tersedia.

Data graf sudah disertakan. Tidak perlu mengunduh OSM atau menjalankan ulang skrip pengambilan data untuk memakai aplikasi. Perhitungan memakai data lokal; gambar peta dasar dan font daring memerlukan internet. Jika gambar peta gagal dimuat, aplikasi memberi keterangan dan perhitungan tetap dapat berjalan.

Alternatif dua terminal:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
npm ci
.\.venv\Scripts\python -m uvicorn backend.api.main:app --host 127.0.0.1 --port 8000
```

```powershell
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Alamat API default adalah `http://127.0.0.1:8000`; `.env.example` mendokumentasikan `VITE_API_BASE_URL`. Swagger tersedia di `http://127.0.0.1:8000/docs`.

## Menggunakan workbench

1. Pilih satu sampai tiga tujuan wajib. Gudang awal/akhir tetap Sukomoro.
2. Gunakan MST untuk batas bawah geometris atau `h = 0` sebagai pembanding. Pilihan pemeriksaan semua urutan aktif secara default.
3. Tekan **Hitung rute**. Aplikasi mengirim POST dan menjalankan pencarian baru, bukan membaca ulang JSON hasil lama. ID dan waktu perhitungan tampil bersama versi dataset.
4. Lihat urutan kunjungan, jarak per ruas antar-tujuan, geometri jalan, dan biaya semua urutan pembanding. State diekspansi mencakup seluruh perjalanan, bukan hanya ruas pertama.
5. Putar trace, gunakan slider, atau pilih baris log. OPEN dan CLOSED ditampilkan setelah ekspansi terpilih; masing-masing daftar hanya menampilkan delapan anggota tetapi jumlah keseluruhannya tetap ditampilkan. Log dipaginasi 25 baris agar tidak membangun puluhan ribu elemen sekaligus.
6. Untuk eksperimen, buka **Skenario penutupan jalan** setelah memiliki hasil. Pilih ruas dari perjalanan tersebut, aktifkan penutupannya, lalu hitung ulang. Seluruh ruas paralel pada arah itu dilarang; arah balik tidak otomatis ditutup. Hapus centang untuk kembali ke graf asli. Jika penutupan membuat perjalanan tidak terjangkau, aplikasi melaporkan kegagalan dan tidak menerbitkan solusi baru.
7. Unduh JSON untuk menyimpan konfigurasi, versi data, rute, metrik, pembanding, dan trace lengkap. Mengubah konfigurasi memberi penanda bahwa hasil sebelumnya belum sesuai pengaturan baru. Hasil perhitungan tidak ditulis ke berkas sumber.

## Model matematis dan optimalitas

State `q = (v, mask)` menyimpan node jalan dan bit tujuan yang telah dikunjungi. Setiap tujuan mempunyai satu bit, mengikuti urutan input dari kanan ke kiri. Dua state pada node yang sama dengan mask berbeda tetap berbeda. Goal adalah `(gudang, semua bit aktif)`. Melewati gudang sebelum semua tujuan tercapai tidak menghentikan pencarian. Kunjungan ulang node jalan diperbolehkan.

Biaya `g` menjumlahkan panjang ruas berarah dalam meter. Untuk ruas paralel, dipilih panjang terkecil. Bobot harus finite dan nonnegatif. Heuristik MST adalah bobot minimum spanning tree pada posisi saat ini, gudang, dan tujuan tersisa, dengan jarak Haversine simetris. Ini hanya batas bawah, bukan algoritma pemilihan rute kedua. Dataset diperiksa agar setiap panjang ruas tidak lebih pendek dari jarak geometris ujungnya; jika syarat tidak terpenuhi, MST ditolak dan pengguna dapat memilih `h = 0`.

Heuristik MST ini dapat tidak konsisten. Karena itu A* memperbarui gScore, mengabaikan antrean usang, dan membuka kembali state CLOSED ketika ditemukan biaya yang lebih rendah. Pencarian berhenti hanya ketika goal dikeluarkan dengan prioritas terbaik. Batas 200.000 ekspansi dan 30 detik pada loop pencarian mengembalikan kesalahan jika terlampaui, bukan hasil parsial berlabel optimal.

Baseline menjalankan A* antarpasangan lokasi lalu menghitung semua `k!` urutan (maksimal enam untuk tiga tujuan UI). Biaya minimum baseline harus cocok dengan A* multi-tujuan sebelum hasil diterbitkan jika pembanding diaktifkan. Baseline dapat memiliki lebih dari satu urutan minimum; pemilihan urutan dengan biaya sama dapat berbeda. Validasi pengujian juga memakai Dijkstra independen pada graf produk node × mask.

Contoh dokumen dengan matriks `[[0,4,7,9],[4,0,5,8],[7,5,0,3],[9,8,3,0]]` menghasilkan minimum **21 satuan hipotetis**, bukan kilometer. Pada snapshot OSM yang disertakan, tiga tujuan default menghasilkan sekitar **44,730 km**; angka ini berlaku terhadap titik referensi dan versi graf tersebut.

Waktu A* mencakup praproses heuristik dan loop pencarian setelah pemeriksaan input. Waktu seluruh solver juga mencakup pemuatan/validasi dataset dan baseline, tetapi tidak mencakup serialisasi respons, kompresi, dan perjalanan jaringan. Pengukuran bergantung pada perangkat.

## Pengujian

```powershell
.\.venv\Scripts\python -m unittest discover -s backend/tests -v
npm test
npm run build
.\.venv\Scripts\python backend/scripts/test_api.py
.\.venv\Scripts\python backend/scripts/test_astar.py
.\.venv\Scripts\python backend/scripts/test_multigoal_osm.py
```

Pengujian mencakup optimum 21, graf acak berarah dengan oracle Dijkstra, admissibility MST, pengembalian ke gudang, node berulang, ruas paralel, biaya tidak valid, tujuan tidak terjangkau, batas pencarian, konsistensi replay OPEN/CLOSED, perubahan tujuan, penutupan jalan tanpa mutasi dataset, validasi API, dan CORS POST. Skrip OSM memeriksa kecocokan A* MST, A* dengan h nol, dan baseline pada data yang disertakan.

## Struktur dan sumber data

- `backend/algorithms/multi_goal.py`: A* seluruh perjalanan dan trace perubahan state.
- `backend/algorithms/astar.py`: A* pasangan lokasi untuk pembanding.
- `backend/algorithms/route_optimizer.py`: enumerasi pembanding 1–6 tujuan.
- `backend/api/solver.py`: validasi dataset, penutupan ruas, perhitungan langsung, dan geometri graf.
- `backend/api/routes.py`: API baru dan endpoint GET historis untuk kompatibilitas.
- `src/pages/Dashboard.jsx`: alur konfigurasi → POST → hasil → replay.
- `src/api/adapters/searchTrace.js`: rekonstruksi OPEN/CLOSED.
- `backend/outputs/`: snapshot graf, lokasi referensi, dan hasil pairwise historis.

`GET /api/dataset` mengembalikan sumber, versi SHA-256 singkat, waktu ekstraksi, ukuran graf, validasi batas geometris, dan status lokasi simulasi. `POST /api/route/optimize` menerima `warehouse`, `destinations`, `heuristic`, `compare_baseline`, dan `blocked_edges` berisi `source`/`target`. Parameter tambahan ditolak. Respons memiliki `run_id`, `computed_at_utc`, rute, geometri, trace, statistik, dan hasil pembanding. GET `/api/route/optimize`, `/api/route/optimal`, `/api/routes/alternatives`, dan `/api/astar` tetap menyajikan snapshot historis; workbench tidak memakainya untuk hasil utama.

Untuk menyiapkan ulang data, pasang `backend/requirements-data.txt` dan baca [panduan dataset backend](backend/README.md). Mengganti titik menjadi lokasi nyata memerlukan alamat/koordinat penerima yang disahkan, pemetaan node jalan, dan pengujian ulang. Nama kecamatan saja tidak cukup. Proyek tidak memodelkan kemacetan, kapasitas/akses kendaraan rinci, waktu bongkar, BBM, atau banyak kendaraan.

Data jalan: © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright). Dataset disimpan agar eksperimen dapat diulang; keterhubungan dan pembatasan jalan nyata tetap perlu diperiksa sebelum penerapan operasional.
