# RouteBawang Nganjuk

Simulasi akademik pencarian rute distribusi satu kendaraan: berangkat dari Sukomoro, mengunjungi tujuan yang dipilih, dan kembali ke gudang. Pencarian utama memakai **A* multi-tujuan**, bukan enumerasi urutan. Frontend React dan Leaflet terhubung ke FastAPI yang menghitung solusi baru pada setiap permintaan.

**Lokasi belum merupakan gudang atau penerima barang terverifikasi.** Sesuai skenario proyek, aplikasi menggunakan titik referensi permukiman OpenStreetMap dan referensi Kantor Kecamatan Gondang dari BPS (kode pos 64451). Penanda peta berada pada node jalan yang dipakai perhitungan. Pergeseran titik referensi ke node jalan ditampilkan di konfigurasi dan tidak ditambahkan ke jarak rute. Hasil bukan rekomendasi operasi pengiriman nyata.

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

Contoh dokumen dengan matriks `[[0,4,7,9],[4,0,5,8],[7,5,0,3],[9,8,3,0]]` menghasilkan minimum **21 satuan hipotetis**, bukan kilometer. Pada snapshot OSM yang disertakan, tiga tujuan default menghasilkan sekitar **31,310 km**; angka ini berlaku terhadap titik referensi dan versi graf tersebut.

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

## Koreksi referensi Kecamatan Gondang

Gondang yang dimaksud adalah **Kecamatan Gondang, kode pos 64451**, dekat Rejoso. Hasil geocoding lama mengarah ke desa senama di selatan dengan kode pos 64472 dan telah dikeluarkan dari daftar tujuan aktif.

Titik simulasi kini menggunakan referensi kecamatan pada publikasi **BPS Kabupaten Nganjuk, Kecamatan Gondang Dalam Angka 2016, Tabel 1.2, halaman 4, baris Kecamatan**: lintang selatan 7.527964 dan bujur timur 111.956318, sehingga koordinat aplikasi adalah **-7.527964, 111.956318**. Ini referensi historis untuk simulasi, bukan pengukuran terbaru kantor atau penerima barang. Konteks Kecamatan Gondang/Gondangkulon dan kode pos 64451 diperiksa silang melalui [portal pemerintah Kemendukbangga/BKKBN](https://kampungkb.kemendukbangga.go.id/kampung/85147/desa-gondangkulon).

Koordinat dan tautan sumber lengkap tersimpan di `backend/data/location_references.json`. `backend/location_references.py` menolak referensi yang berbeda, termasuk jika hanya label kode pos diubah tetapi koordinat masih menunjuk lokasi lama. Skrip persiapan graf menggunakan referensi ini untuk Gondang, sehingga hasil pencarian nama ambigu tidak menggantikannya. API juga memeriksa referensi sebelum menyediakan dataset.

Graf OSM yang disertakan tetap mencakup titik baru; node jalan terdekat adalah **6585729757**, berjarak sekitar **3,76 m** dari referensi. Seluruh 12 pasangan lokasi berarah terjangkau. Snapshot hasil pairwise dihitung ulang. Untuk tiga tujuan bawaan, rute terbaru adalah **Sukomoro → Gondang → Rejoso → Nganjuk → Sukomoro**, sekitar **31,310 km**. Rejoso–Gondang sekitar **5,868 km** pada jaringan jalan ini. Angka berlaku terhadap snapshot dan titik simulasi yang disebutkan.

## Animasi perjalanan pada peta

Warehouse berarti **gudang atau depot**: tempat kendaraan memuat bawang, mulai mengirim, dan kembali setelah seluruh tujuan dilayani. Antarmuka kini memakai istilah Gudang dan Tujuan pengiriman.

Setelah menekan **Hitung rute**, pilih tampilan **Perjalanan kendaraan**, lalu **Mulai perjalanan**. Ikon truk mengikuti geometri jalan hasil perhitungan, berhenti sejenak untuk ilustrasi bongkar di setiap tujuan sesuai urutan rute, kemudian kembali ke gudang. Penjelasan tahap aktif, tujuan yang sudah dilayani, dan jarak yang telah dilalui ikut diperbarui. Garis hijau tebal menunjukkan bagian jalan yang sudah dilalui.

Gunakan **Jeda perjalanan**, **Lanjutkan perjalanan**, **Ulang dari gudang**, pilihan kecepatan 1×/2×/4×, atau slider Posisi perjalanan untuk meninjau tahap tertentu. Gerakan hanya dimulai setelah tombol dipilih dan dijeda ketika tab browser disembunyikan, konfigurasi berubah, atau hasil baru dihitung. Tidak ada library animasi tambahan; perpindahan marker memakai requestAnimationFrame dan lapisan Leaflet yang sudah tersedia.

Durasi animasi dan jeda bongkar hanya ilustrasi; tidak menyatakan kecepatan kendaraan, waktu tempuh, muatan, atau kegiatan logistik nyata. Jarak tetap berasal dari biaya ruas hasil perhitungan, sedangkan posisi visual mengikuti titik-titik geometri jalan.

Tampilan **Proses pencarian A*** menampilkan lingkaran state yang sedang diperiksa melalui kontrol replay di bagian bawah. Gerak truk menggambarkan perjalanan pada rute yang sudah dipilih, sedangkan replay A* menjelaskan bagaimana algoritma mencari rute tersebut. Panel Cara membaca simulasi menyediakan penjelasan ini di aplikasi.

## Dua tipe simulasi

Area simulasi memiliki dua tombol: **Simulasi Node** dan **Simulasi Peta**. Node dimulai dalam mode **Pelajari pencarian A***, sebelum jalur hasil ditandai. Mode **Perjalanan kendaraan** di kedua tampilan memakai satu jam animasi yang tersinkron.

- **Simulasi Node** menampilkan satu ruas perjalanan dengan **2–4 node perantara** di antara dua lokasi. Pilih ruas, lalu gunakan Awal, Langkah berikutnya, Putar pencarian, atau Lihat hasil. OPEN, CLOSED, relaksasi tetangga, serta g/h/f diperbarui setiap langkah. Jalur hijau dan rekonstruksi parent baru ditampilkan ketika tujuan tercapai. Tiga tujuan pengiriman tidak berubah; simpang perantara bukan tujuan bongkar.
- **Simulasi Peta** mempertahankan gerak kendaraan di atas geometri jalan OSM dan pilihan replay pencarian A*. Letak geografis yang sebenarnya diperiksa pada tampilan ini.

Graf pembelajaran dibuat oleh `backend/road_lesson.py`: jalur minimum graf penuh ditambah beberapa koridor alternatif yang dicari dengan penalti pada jalur minimum. Penalti hanya dipakai memilih contoh alternatif; bobot diagram selalu panjang jalan asli. Ruas jalan di antara node acuan diringkas menjadi satu panah berarah dengan `path` node OSM yang dapat diaudit. Percabangan kecil di dalam panah tidak semuanya digambar. Minimum graf pembelajaran diuji terhadap minimum graf penuh. Ini contoh koridor yang terbatas, bukan daftar seluruh alternatif jalan.

Nama “Dekat …” berasal dari 125 titik label permukiman OSM dalam `backend/data/locality_references.json`, dengan koordinat, ID, tautan OSM, waktu pengambilan, dan kueri sumber. Jarak ke titik label dihitung; tidak diperlakukan sebagai batas administratif desa atau bukti desa yang dilintasi. Titik lebih jauh dari 2,4 km tidak diberi nama permukiman. Sumber dan jarak label dapat diperiksa dari panel node. Tata letak diagram tidak berskala geografis.

**Heuristik dibedakan menurut lingkup:** pencarian seluruh perjalanan tetap A* multi-tujuan dengan MST geometris atau h = 0. Pelajaran satu ruas memakai A* jarak lurus ke satu tujuan, atau Dijkstra h = 0. Keduanya dijalankan pada graf koridor yang sama dan jumlah ekspansi serta biaya dibandingkan setelah goal. Angka pada panah adalah jarak ruas; g adalah jarak dari awal ruas, h perkiraan sisa, dan f = g + h. Bobot jarak menghasilkan rute terpendek, bukan klaim waktu tempuh tercepat.

Dalam mode Perjalanan kendaraan, Mulai, jeda, ulang, kecepatan, slider, tahap bongkar, dan total jarak menggunakan jam simulasi yang sama. Node berganti ruas mengikuti tahap kendaraan dan menggerakkan ikon melalui simpang perantara. Berpindah Node/Peta tidak mengulang perjalanan. Mode pencarian menjeda kendaraan; pemutaran pelajaran per ruas terpisah dari replay A* multi-tujuan pada graf penuh di bagian bawah.

## Simulasi node perjalanan keseluruhan

Panel tambahan **Satu perjalanan, kembali ke gudang** berada di halaman Dashboard, di bawah simulasi per ruas. Panel per ruas dan pilihan Node/Peta di atas tetap tersedia seperti sebelumnya.

Diagram tambahan menampilkan seluruh siklus sekaligus: gudang Sukomoro → semua tujuan pada hasil perhitungan → node gudang Sukomoro yang sama. Tiap ruas menyertakan 2–4 node perantara dan alternatif koridor dari data pembelajaran yang sama; node perantara tidak menjadi tujuan bongkar baru. Terminal bersama digambar sekali. Node perantara yang muncul pada ruas berbeda diberi kode per ruas agar tahap kunjungannya jelas.

Kontrol di panel keseluruhan berdiri sendiri: Mulai/Jeda, Ulang dari gudang, kecepatan 1×/2×/4×, dan slider Posisi perjalanan. Kendaraan bergerak melalui node perantara pada jalur yang dipilih, jejak jalan menjadi hijau, berhenti untuk ilustrasi bongkar di setiap tujuan, dan akhirnya tiba tepat di posisi gudang awal. Semua ruas tetap terlihat selama animasi. Biaya setiap ruas diperiksa terhadap hasil optimasi; jumlahnya harus sama dengan total perjalanan.

Panel ini memutar perjalanan pada hasil rute, bukan mengulang proses pencarian A*. Untuk mempelajari g/h/f, OPEN/CLOSED, dan alasan pemilihan cabang, gunakan panel per ruas yang tetap ada di atas. Diagram bersifat skematis; garis putus-putus adalah alternatif koridor, dan gerak kendaraan bukan informasi waktu tempuh lapangan.
