const formatKm = (meters, digits = 3) => `${(meters / 1000).toFixed(digits)} km`;

export function createSummaryStats(optimal, locations, astar) {
  const destinationCount = locations?.destinations?.length ?? 0;
  const finalStep = astar?.search_steps?.at(-1);
  return [
    {
      id: 'distance', label: 'Total jarak tempuh', value: optimal ? (optimal.total_distance_m / 1000).toFixed(3) : '—',
      unit: 'km', note: optimal ? 'Rute optimal dari backend' : 'Menunggu data API', icon: 'route', tone: 'green',
    },
    {
      id: 'destinations', label: 'Jumlah destinasi', value: String(destinationCount),
      unit: 'Lokasi Bongkar', note: locations ? locations.destinations.map((item) => item.name).join(' → ') : 'Menunggu data API', icon: 'pin', tone: 'red',
    },
    {
      id: 'nodes', label: 'Simpul dieksplorasi', value: astar ? String(astar.evaluated_nodes) : '—',
      unit: 'Nodes', note: astar ? `${astar.from} → ${astar.to}` : 'Menunggu data A*', icon: 'nodes', tone: 'violet',
    },
    {
      id: 'time', label: 'Waktu komputasi A*', value: astar ? astar.execution_time_ms.toFixed(2) : '—',
      unit: 'ms', note: finalStep ? `Trace berakhir pada node ${finalStep.node}` : 'Menunggu data A*', icon: 'time', tone: 'amber',
    },
  ];
}

export function createRouteStops(optimal) {
  if (!optimal?.route?.length) return [];
  return optimal.route.map((name, index) => {
    const isStart = index === 0;
    const isFinish = index === optimal.route.length - 1;
    const previousLeg = index > 0 ? optimal.legs[index - 1] : null;
    const kind = isStart ? 'start' : isFinish ? 'finish' : 'stop';
    return {
      id: `${index}-${name}`,
      number: String(index + 1).padStart(2, '0'),
      title: name,
      badge: isStart ? 'START' : isFinish ? 'FINISH' : `DROP #${index}`,
      load: isStart ? 'Depot distribusi • titik awal' : isFinish ? 'Kembali ke depot • siklus selesai' : `Tujuan distribusi #${index}`,
      distance: previousLeg ? `+${formatKm(previousLeg.distance_m)}` : '',
      travel: previousLeg ? `Jarak dari ${previousLeg.from} ke ${previousLeg.to}` : '',
      kind,
    };
  });
}

export function createAlternativeRows(alternatives) {
  if (!alternatives?.routes?.length) return [];
  const bestDistance = alternatives.routes[0].total_distance_m;
  return alternatives.routes.map((candidate) => {
    const differenceKm = (candidate.total_distance_m - bestDistance) / 1000;
    return {
      id: `route-${candidate.rank}`,
      name: candidate.is_optimal ? `Rute ${candidate.rank} (Terpilih)` : `Rute ${candidate.rank}`,
      sequence: candidate.route.join(' → '),
      note: candidate.is_optimal ? 'Jarak minimum dari enam urutan yang dievaluasi' : `${differenceKm.toFixed(3)} km lebih jauh dari rute optimal`,
      distance: formatKm(candidate.total_distance_m),
      tag: candidate.is_optimal ? 'Optimal' : `+${differenceKm.toFixed(3)} km`,
      selected: candidate.is_optimal,
      rank: candidate.rank,
    };
  });
}

export function createSearchRows(astar) {
  return (astar?.search_steps ?? []).map((step) => ({
    iteration: String(step.step).padStart(3, '0'),
    node: String(step.node),
    g: formatKm(step.g, 3),
    h: formatKm(step.h, 3),
    f: formatKm(step.f, 3),
    status: step.node === astar.path.at(-1) ? 'Goal reached' : 'Evaluated',
    tone: step.node === astar.path.at(-1) ? 'strong' : 'green',
  }));
}

export function createOptimalExplanation(optimal, alternatives) {
  if (!optimal || !alternatives) return 'Hasil optimasi akan ditampilkan setelah backend terhubung.';
  return `Urutan ini dipilih karena memiliki total jarak ${formatKm(optimal.total_distance_m)} yang paling rendah dari ${alternatives.count} kandidat rute. Jarak tiap leg dihitung oleh custom A* pada graf jalan OSM.`;
}
