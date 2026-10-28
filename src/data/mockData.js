export const initialDestinations = [
  { id: 'nganjuk', name: 'Nganjuk', market: 'Pasar Wage', address: 'Jl. Basuki Rahmat, Nganjuk', load: 800, priority: 'Tinggi', sequence: 1, distance: 8.4, accent: 'red' },
  { id: 'rejoso', name: 'Rejoso', market: 'Sentra Tani', address: 'Jl. Raya Rejoso, Nganjuk', load: 900, priority: 'Pengepul Utama', sequence: 2, distance: 11.2, accent: 'red' },
  { id: 'gondang', name: 'Gondang', market: 'Gudang Timur', address: 'Kawasan Gudang Gondang', load: 800, priority: 'Distributor Lokal', sequence: 3, distance: 14.5, accent: 'red' },
];

export const availableDestinations = [
  { id: 'loc-04', name: 'Loc 04', market: 'Titik Distribusi Baru', address: 'Kabupaten Nganjuk', load: 500, priority: 'Normal', distance: 9.8, accent: 'blue' },
  { id: 'barat', name: 'Kawasan Barat', market: 'Gudang Mitra', address: 'Kabupaten Nganjuk', load: 650, priority: 'Normal', distance: 12.1, accent: 'blue' },
];

export const summaryStats = [
  { id: 'distance', label: 'Total jarak tempuh', value: '46.4', unit: 'km', note: 'Hemat 12.8 km (vs konvensional)', icon: 'route', tone: 'green' },
  { id: 'destinations', label: 'Jumlah destinasi', value: '3', unit: 'Lokasi Bongkar', note: 'Sukomoro → Nganjuk → Rejoso → Gondang', icon: 'pin', tone: 'red' },
  { id: 'nodes', label: 'Simpul dieksplorasi', value: '38', unit: 'Nodes', note: 'Efisiensi eksplorasi 82.4%', icon: 'nodes', tone: 'violet' },
  { id: 'time', label: 'Waktu komputasi', value: '14.2', unit: 'ms', note: 'A* konvergen optimal (O(b^d))', icon: 'time', tone: 'amber' },
];

export const routeStops = [
  { id: 'depot-start', number: '01', title: 'Gudang Sukomoro (Pusat)', badge: 'START', load: 'Muat Awal: 2.500 kg Bawang Merah', distance: '+8.4 km', travel: 'Est. 18 mnt via Jl. Raya Sukomoro - Nganjuk', kind: 'start' },
  { id: 'nganjuk-stop', number: '02', title: 'Pasar Wage Nganjuk (Pusat Kota)', badge: 'DROP #1', load: 'Bongkar: 800 kg • Akumulasi Jarak: 8.4 km', distance: '+11.2 km', travel: 'Est. 24 mnt via Jl. Basuki Rahmat & Rejoso', kind: 'stop' },
  { id: 'rejoso-stop', number: '03', title: 'Sentra Tani Rejoso', badge: 'DROP #2', load: 'Bongkar: 900 kg • Akumulasi Jarak: 19.6 km', distance: '+14.5 km', travel: 'Est. 29 mnt via Jalur Timur Rejoso - Gondang', kind: 'stop' },
  { id: 'gondang-stop', number: '04', title: 'Kawasan Gudang Gondang', badge: 'DROP #3', load: 'Bongkar: 800 kg (Muatan Habis) • Akumulasi Jarak: 34.1 km', distance: '+12.3 km', travel: 'Est. 22 mnt kembali ke gudang via Sukomoro Selatan', kind: 'stop' },
  { id: 'depot-finish', number: '05', title: 'Gudang Sukomoro (Depot)', badge: 'FINISH', load: 'Total Jarak: 46.4 km • Status: Rit Logistik Bawang Selesai Sempurna', kind: 'finish' },
];

export const alternativeRoutes = [
  { id: 'route-a', name: 'Rute A (Terpilih)', sequence: 'Sukomoro → Nganjuk → Rejoso → Gondang → Sukor', note: 'Solusi Global Minimum • Search A*', distance: '46.4 km', tag: 'Optimal', selected: true },
  { id: 'route-b', name: 'Rute B', sequence: 'Sukomoro → Rejoso → Nganjuk → Gondang → Sukomoro', note: 'Jalur silang bolak-balik', distance: '52.1 km', tag: '+5.7 km' },
  { id: 'route-c', name: 'Rute C', sequence: 'Sukomoro → Gondang → Rejoso → Nganjuk → Sukomoro', note: 'Menghadapi bottleneck simpang timur', distance: '58.6 km', tag: '+12.2 km' },
];

export const openSet = ['Node_Gondang_Alt [f=52.1]', 'Node_Blora_Junction [f=54.8]', 'Node_Bagor_Ring [f=58.2]'];
export const closedSet = ['Gudang Sukomoro', 'Pasar Wage Nganjuk', 'Sentra Rejoso', 'Kawasan Gondang'];

export const searchLedger = [
  { iteration: '01', node: 'Gudang Sukomoro', g: '0.0 km', h: '45.0 km', f: '45.0 km', status: 'Expanded', tone: 'neutral' },
  { iteration: '02', node: 'Nganjuk Node', g: '8.4 km', h: '37.2 km', f: '45.6 km', status: 'Selected', tone: 'green' },
  { iteration: '03', node: 'Rejoso Node', g: '19.6 km', h: '26.5 km', f: '46.1 km', status: 'Selected', tone: 'green' },
  { iteration: '04', node: 'Gondang Node', g: '34.1 km', h: '12.3 km', f: '46.4 km', status: 'Goal Closed', tone: 'strong' },
  { iteration: '—', node: 'Gudang Return', g: '46.4 km', h: '0.0 km', f: '46.4 km', status: 'Cycle Done', tone: 'muted' },
];

export const optimalExplanation = 'Sistem memilih urutan ini karena menghasilkan total jarak tempuh minimum (46.4 km) dan mengeliminasi perputaran arah truk logistik yang tidak perlu pada koridor padat Nganjuk–Sukomoro. Menggunakan fungsi heuristik Road Distance berbasis graf riil, pencarian membuktikan bahwa rute searah jarum jam (Sukomoro → Barat → Utara → Timur → Sukomoro) meminimalkan konsumsi BBM hingga 21.6% dibanding pola distribusi konvensional.';
