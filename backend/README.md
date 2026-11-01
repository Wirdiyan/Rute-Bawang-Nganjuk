# Backend RouteBawang

Panduan menjalankan aplikasi, model A* multi-tujuan, API, dan pengujian tersedia di [README utama](../README.md). Frontend sudah terintegrasi dan menjalankan perhitungan baru melalui `POST /api/route/optimize`.

## Menyiapkan ulang snapshot OSM

Gunakan langkah ini hanya jika memang ingin mengganti snapshot dataset. Pemakaian aplikasi biasa tidak memerlukan unduhan ulang.

```powershell
.\.venv\Scripts\python -m pip install -r backend/requirements-data.txt
.\.venv\Scripts\python backend/scripts/build_osm_graph.py
```

Skrip mencari Sukomoro, Nganjuk dan Rejoso melalui Nominatim/OSMnx, memakai referensi terkurasi Kecamatan Gondang 64451 dari `backend/data/location_references.json`, mengunduh graf `drive` berarah, memeriksa panjang ruas dan keterhubungan, lalu mengekspor GraphML, tabel node/ruas dan metadata lokasi. Ini menghasilkan titik referensi permukiman, bukan gudang/penerima barang yang sudah diverifikasi. Periksa kandidat geocoding, kecocokan lokasi, dan pemetaan node sebelum menerima dataset baru.

Geocoding nama tidak mengesahkan titik pengiriman. Untuk penggunaan nyata, tetapkan koordinat serah-terima, dokumentasikan sumber persetujuannya, sesuaikan tahap pemetaan titik, dan uji akses jalan untuk kendaraan. Pengaturan `drive` tidak menjamin seluruh pembatasan truk/logistik telah dimodelkan.

Margin bawaan unduhan adalah 0,08 derajat di sekitar referensi; opsi `--margin-degrees` mengubahnya. Cache OSMnx berada di `backend/data/raw/osmnx-cache/` dan dikecualikan dari Git. Skrip membutuhkan internet dan tidak menghitung rute.

Output dataset: `road_network.graphml`, `nodes.csv`, `edges.csv`, `locations.json`. Versi dataset API berasal dari hash gabungan graf dan lokasi. Setelah mengganti berkas, mulai ulang server untuk memastikan seluruh cache endpoint historis dihapus.

```powershell
.\.venv\Scripts\python backend/scripts/test_astar.py
.\.venv\Scripts\python backend/scripts/test_multigoal_osm.py
```

Untuk memperbarui snapshot **pairwise historis** yang dipakai endpoint GET kompatibilitas:

```powershell
.\.venv\Scripts\python backend/scripts/test_route_optimizer.py
```

Perintah terakhir menulis ulang `route_optimization.json`. Workbench utama menghitung hasil langsung di memori dan tidak memerlukan pembaruan berkas ini.

Sumber: © OpenStreetMap contributors, [Open Database License](https://www.openstreetmap.org/copyright).

Gondang tidak lagi dipilih dari pencarian nama generik. Referensi historis BPS 2016 (-7.527964, 111.956318) digunakan sebagai titik simulasi kecamatan. Kode pos 64451, konteks Gondangkulon, sumber koordinat, dan pencegahan regresi diperiksa oleh `backend/location_references.py`. Jangan menggantinya dengan desa senama berkode pos 64472.
