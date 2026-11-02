# SIMANTRI — UI dan UX

## Arah desain

Dashboard praktikum untuk mengatur tujuan distribusi, mempelajari pencarian A*, dan memutar perjalanan. Identitas memakai logo SIMANTRI yang diberikan pemilik proyek. Logo dipakai utuh, tanpa mengganti warna atau proporsi.

Panduan: [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), pencarian gaya `operations dashboard minimal`, serta panduan React dan aksesibilitasnya. Rekomendasi **Minimalism & Swiss Style** dipakai untuk hierarki, grid, tipografi, dan pengurangan dekorasi. Warna dan pilihan font disesuaikan dengan identitas serta kebutuhan aplikasi; pola halaman pemasaran dari rekomendasi tidak diterapkan pada dashboard praktikum.

## Aturan visual

- Font utama: Inter 400–700. Satu WOFF2 Latin lokal, 48 KB; lisensi SIL OFL disertakan di `public/fonts/OFL-Inter.txt`. Monospace sistem hanya untuk ID dan log yang membutuhkan perataan angka. Tidak memanggil Google Fonts saat aplikasi dijalankan.
- Warna utama: `#205c3f`; teks `#21372d`; teks pendukung `#586d61`; latar `#f5f7f5`; panel putih; garis `#dce5df`. Hijau menandai tindakan utama dan hasil perjalanan; warna biru/kuning pada graf tetap membedakan status pencarian.
- Ukuran teks utama 14–16 px, label 12–13 px, judul panel 17–25 px. Angka statistik memakai tabular numerals. Diagram memiliki ukuran teks tersendiri agar label tetap terbaca.
- Jarak memakai kelipatan 4/8 px; gutter desktop 32 px dan ponsel 16 px. Lebar konten maksimum 1440 px. Panel beradius 12 px dengan batas halus, tanpa blur atau animasi dekoratif.
- Tombol utama hijau tua, tombol pendukung putih dengan batas. Target sentuh minimal 44 px pada layar kecil. Fokus keyboard tetap terlihat, status tidak bergantung pada warna saja.

## Alur halaman

1. Konfigurasi dan simulasi per ruas tetap berdampingan pada desktop; berurutan pada tablet/ponsel.
2. Ringkasan hasil tampil sebelum diagram keseluruhan agar jarak dan jumlah tujuan cepat ditemukan. Panel siklus keseluruhan beserta kontrol independennya tetap tersedia.
3. Analisis rute, pembanding, replay multi-tujuan, dan tabel log tetap ditampilkan dengan tipografi dan jarak yang konsisten.

Navigasi langsung menuju Praktikum, Simulasi lengkap, Analisis rute, dan Panduan. Batasan lokasi tetap terlihat, dengan rincian sumber dalam disclosure agar tidak memenuhi area kerja. Semua kontrol simulasi, algoritma, perhitungan jarak, serta pembatasan 2–4 node perantara dipertahankan.

## Implementasi dan pemeriksaan

`src/styles/simantri.css` adalah lapisan desain di atas stylesheet fungsi yang ada. Tidak menambahkan pustaka UI atau animasi. Logo dan font lokal berada di `public/`.

Periksa desktop, tablet, dan ponsel; menu keyboard; fokus; keterbacaan angka; overflow hanya di area diagram/tabel yang diberi label; serta prefers-reduced-motion. Verifikasi jalur: Hitung rute → langkah A* per ruas → simulasi keseluruhan → kembali ke gudang → analisis. Perubahan ini tidak mengganti solver atau geometri OSM.

Renderer node memakai snapshot jam animasi terkini saat dipasang ulang. Setelah menghitung rute baru, jejak SVG dan label persentase sama-sama kembali ke awal; renderer tidak memakai frame React lama yang belum sempat diperbarui.
