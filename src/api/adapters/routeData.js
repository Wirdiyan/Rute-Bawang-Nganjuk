export const formatKm = (meters, digits = 3) => `${(meters / 1000).toFixed(digits)} km`;

export function createSummaryStats(result) {
  return [
    { id: 'distance', label: 'Jarak perjalanan pulang-pergi', value: result ? (result.total_distance_m / 1000).toFixed(3) : '—', unit: 'km', note: 'Jarak pada graf jalan OSM', icon: 'route', tone: 'green' },
    { id: 'destinations', label: 'Tujuan dikunjungi', value: result ? String(result.request.destinations.length) : '—', unit: 'titik', note: result ? result.route.join(' → ') : 'Hitung rute untuk melihat hasil', icon: 'pin', tone: 'red' },
    { id: 'nodes', label: 'State diekspansi', value: result ? result.statistics.expanded_states.toLocaleString('id-ID') : '—', unit: 'state', note: 'State = node jalan + tujuan dikunjungi', icon: 'nodes', tone: 'violet' },
    { id: 'time', label: 'Waktu A* multi-tujuan', value: result ? (result.statistics.execution_time_ms / 1000).toFixed(2) : '—', unit: 'detik', note: result ? `OPEN maksimum: ${result.statistics.peak_open} state` : 'Tidak termasuk baseline dan pengiriman data', icon: 'time', tone: 'amber' },
  ];
}

export function createRouteStops(result) {
  return (result?.route ?? []).map((name, index) => {
    const isStart = index === 0;
    const isFinish = index === result.route.length - 1;
    const leg = index ? result.legs[index - 1] : null;
    return { id: `${index}-${name}`, number: String(index + 1).padStart(2, '0'), title: name,
      badge: isStart ? 'MULAI' : isFinish ? 'KEMBALI' : `TUJUAN ${index}`,
      load: isStart ? 'Node gudang simulasi' : isFinish ? 'Semua tujuan tercapai, kembali ke gudang' : 'Titik referensi OSM',
      distance: leg ? `+${formatKm(leg.distance_m)}` : '', travel: leg ? `Dari ${leg.from}` : '',
      kind: isStart ? 'start' : isFinish ? 'finish' : 'stop' };
  });
}

export function createAlternativeRows(result) {
  return (result?.candidates ?? []).map((candidate) => ({
    id: `route-${candidate.rank}`, name: `Urutan ${candidate.rank}`, sequence: candidate.route.join(' → '),
    note: candidate.is_selected ? 'Urutan yang ditemukan A* multi-tujuan' : candidate.is_optimal ? 'Biaya minimum yang sama' : `${formatKm(candidate.total_distance_m - result.comparison.distance_m)} di atas minimum`,
    distance: formatKm(candidate.total_distance_m), tag: candidate.is_optimal ? 'Minimum' : `+${formatKm(candidate.total_distance_m - result.comparison.distance_m)}`,
    selected: candidate.is_selected, rank: candidate.rank,
  }));
}

export function createSearchRows(result) {
  return (result?.trace ?? []).map((step, index) => ({
    index, iteration: step.step, node: String(step.node), mask: step.mask, key: step.key,
    g: formatKm(step.g), h: formatKm(step.h), f: formatKm(step.f),
    status: step.status === 'goal' ? 'Goal' : 'Ekspansi', tone: step.status === 'goal' ? 'strong' : 'green',
  }));
}

export function createOptimalExplanation(result) {
  if (!result) return 'A* mencari seluruh perjalanan pada state (node, tujuan yang sudah dikunjungi). Goal baru tercapai setelah semua tujuan dikunjungi dan kendaraan kembali ke gudang.';
  return `A* multi-tujuan menghasilkan ${formatKm(result.total_distance_m)} dengan heuristik ${result.statistics.heuristic === 'mst' ? 'MST berbasis jarak geometris' : 'nol (h = 0)'}. ${result.comparison.enabled ? `Biayanya cocok dengan minimum ${result.comparison.candidate_count} urutan pada baseline independen.` : 'Baseline pembanding tidak dijalankan.'} Optimalitas berlaku terhadap graf dan skenario yang dipilih; titik gudang dan penerima masih berupa referensi simulasi.`;
}
