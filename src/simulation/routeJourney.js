const EARTH_RADIUS_M = 6371000;
const distance = (a, b) => {
  const rad = Math.PI / 180;
  const phi = (b[0] - a[0]) * rad;
  const lambda = (b[1] - a[1]) * rad;
  const h = Math.sin(phi / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(lambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
};

export function createJourneyModel({ coordinates, route, legs, stops, travelMs = 45000, dwellMs = 1800, loadingMs = 1200 }) {
  if (!coordinates?.length || coordinates.length < 2 || coordinates.some((point) => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 90 || Math.abs(point[1]) > 180)) throw new Error('Geometri jalan belum valid untuk animasi.');
  if (!route?.length || route.length !== legs?.length + 1 || route[0] !== route.at(-1)) throw new Error('Rute harus kembali ke gudang.');
  if ([travelMs, dwellMs, loadingMs].some((value) => !Number.isFinite(value) || value <= 0)) throw new Error('Durasi animasi tidak valid.');
  const measures = [0];
  for (let index = 1; index < coordinates.length; index += 1) measures.push(measures.at(-1) + distance(coordinates[index - 1], coordinates[index]));
  const totalDistanceM = legs.reduce((sum, leg) => sum + leg.distance_m, 0);
  if (!Number.isFinite(totalDistanceM) || totalDistanceM <= 0 || legs.some((leg) => !Number.isFinite(leg.distance_m) || leg.distance_m < 0)) throw new Error('Jarak perjalanan tidak valid.');
  const pointByName = new Map(stops.map((stop) => [stop.name, [stop.latitude, stop.longitude]]));
  const start = pointByName.get(route[0]);
  if (!start || distance(start, coordinates[0]) > 2) throw new Error('Geometri awal tidak sesuai titik gudang.');
  const phases = [];
  let time = 0;
  let roadDistance = 0;
  let startIndex = 0;
  const addPhase = (phase, durationMs) => {
    phases.push({ ...phase, startMs: time, endMs: time + durationMs });
    time += durationMs;
  };
  addPhase({ type: 'loading', stopIndex: 0, index: 0, roadDistanceM: 0, completedStops: 0 }, loadingMs);
  legs.forEach((leg, legIndex) => {
    if (leg.from !== route[legIndex] || leg.to !== route[legIndex + 1]) throw new Error('Urutan ruas tidak sesuai rute.');
    const target = pointByName.get(leg.to);
    if (!target) throw new Error(`Koordinat ${leg.to} belum tersedia.`);
    const returning = legIndex === legs.length - 1;
    let endIndex = returning ? coordinates.length - 1 : -1;
    if (!returning) {
      // Search forward: a road or depot can appear more than once in a trip.
      for (let index = startIndex + 1; index < coordinates.length; index += 1) {
        if (distance(target, coordinates[index]) < 0.15) { endIndex = index; break; }
      }
    }
    if (endIndex < 0 || distance(target, coordinates[endIndex]) > 2 || measures[endIndex] <= measures[startIndex]) throw new Error(`Titik berhenti ${leg.to} tidak ditemukan pada geometri jalan.`);
    const completedStops = legIndex;
    addPhase({ type: 'travel', legIndex, stopIndex: legIndex + 1, startIndex, endIndex, returning,
      from: leg.from, to: leg.to, completedStops, roadStartM: roadDistance, roadEndM: roadDistance + leg.distance_m }, travelMs * leg.distance_m / totalDistanceM);
    roadDistance += leg.distance_m;
    addPhase({ type: returning ? 'finished' : 'unloading', legIndex, stopIndex: legIndex + 1,
      index: endIndex, roadDistanceM: roadDistance, completedStops: returning ? legs.length - 1 : completedStops }, dwellMs);
    startIndex = endIndex;
  });
  return { coordinates, measures, route, legs, phases, totalMs: time, totalDistanceM, destinationCount: legs.length - 1 };
}

export function sampleJourney(model, elapsedMs) {
  const time = Math.max(0, Math.min(model.totalMs, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const phase = model.phases.find((item) => time < item.endMs) ?? model.phases.at(-1);
  const finished = time >= model.totalMs;
  let position;
  let coordinateIndex;
  let roadDistanceM;
  if (phase.type === 'travel') {
    const fraction = (time - phase.startMs) / (phase.endMs - phase.startMs);
    const targetMeasure = model.measures[phase.startIndex] + fraction * (model.measures[phase.endIndex] - model.measures[phase.startIndex]);
    let low = phase.startIndex, high = phase.endIndex;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (model.measures[middle] <= targetMeasure) low = middle; else high = middle;
    }
    const segmentLength = model.measures[high] - model.measures[low];
    const part = segmentLength ? (targetMeasure - model.measures[low]) / segmentLength : 0;
    position = model.coordinates[low].map((value, index) => value + part * (model.coordinates[high][index] - value));
    coordinateIndex = low;
    roadDistanceM = phase.roadStartM + fraction * (phase.roadEndM - phase.roadStartM);
  } else {
    coordinateIndex = phase.index;
    position = model.coordinates[coordinateIndex];
    roadDistanceM = phase.roadDistanceM;
  }
  const warehouse = model.route[0];
  let title, explanation;
  if (phase.type === 'loading') {
    title = `Di gudang ${warehouse}`;
    explanation = 'Bawang dimuat ke kendaraan. Gudang atau depot adalah titik berangkat dan tempat kembali.';
  } else if (phase.type === 'unloading') {
    title = `Bongkar di ${model.route[phase.stopIndex]}`;
    explanation = `Kendaraan berhenti untuk menyimulasikan pengiriman bawang di tujuan ${phase.stopIndex} dari ${model.destinationCount}.`;
  } else if (phase.type === 'finished') {
    title = `Kembali di gudang ${warehouse}`;
    explanation = `Semua ${model.destinationCount} tujuan sudah dilayani. Perjalanan pulang-pergi selesai.`;
  } else {
    title = phase.returning ? `Kembali ke gudang ${warehouse}` : `Menuju ${phase.to}`;
    explanation = phase.returning ? 'Seluruh pengiriman selesai. Kendaraan mengikuti jalan untuk pulang ke gudang.' : `Berangkat dari ${phase.from}, mengikuti jalan menuju ${phase.to}. Tujuan yang sudah dilayani: ${phase.completedStops} dari ${model.destinationCount}.`;
  }
  return { timeMs: time, progress: time / model.totalMs, phase: phase.type, title, explanation,
    position, coordinateIndex, roadDistanceM, stopIndex: phase.stopIndex, completedStops: phase.completedStops, finished,
    legIndex: phase.legIndex ?? null,
    legProgress: phase.type === 'travel' ? (time-phase.startMs)/(phase.endMs-phase.startMs) : phase.type === 'loading' ? 0 : 1 };
}
