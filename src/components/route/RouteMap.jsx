import { useMemo, useState } from 'react';
import Icon from '../common/Icon.jsx';

const destinationSlots = [
  { x: 20, y: 66, labelX: 9, labelY: 72, anchor: 'start' },
  { x: 34, y: 31, labelX: 34, labelY: 20, anchor: 'middle' },
  { x: 76, y: 45, labelX: 80, labelY: 52, anchor: 'start' },
];
const warehousePoint = { x: 48, y: 52 };

export default function RouteMap({ locations, optimal }) {
  const [zoom, setZoom] = useState(1);
  const warehouse = locations?.warehouse;
  const destinationPoints = (locations?.destinations ?? []).map((location, index) => ({
    ...location,
    number: String(index + 1),
    ...(destinationSlots[index] ?? { x: 12 + (index % 5) * 17, y: 15 + (index % 3) * 27, labelX: 12 + (index % 5) * 17, labelY: 12 + (index % 3) * 27, anchor: 'middle' }),
  }));
  const pointByName = useMemo(() => Object.fromEntries([
    ...(warehouse ? [[warehouse.name, warehousePoint]] : []),
    ...destinationPoints.map((point) => [point.name, point]),
  ]), [warehouse?.name, locations]);
  const routePoints = (optimal?.route ?? []).map((name) => pointByName[name]).filter(Boolean);
  const polyline = routePoints.map((point) => `${point.x},${point.y}`).join(' ');
  const distanceChips = (optimal?.legs ?? []).map((leg, index) => {
    const from = pointByName[leg.from];
    const to = pointByName[leg.to];
    if (!from || !to) return null;
    const offsetY = index % 2 === 0 ? -2 : 2;
    return {
      key: `${leg.from}-${leg.to}`,
      x: (from.x + to.x) / 2 - 5.5,
      y: (from.y + to.y) / 2 + offsetY,
      label: (leg.distance_m / 1000).toFixed(1),
    };
  });

  return <section className="map-card" aria-label="Skema urutan rute" data-route-node-count={optimal?.combined_path?.length ?? 0}>
    <div className="map-canvas">
      <div className="map-waterway"/><div className="map-park park-one"/><div className="map-park park-two"/><div className="map-park park-three"/>
      <svg className="map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ transform: `scale(${zoom})` }}>
        <g className="road-network"><path d="M3 20 18 30 34 20 48 26 62 12 84 25 97 20M4 48 18 39 33 48 50 35 65 43 80 34 97 42M2 80 20 72 35 82 48 68 64 74 78 62 96 66M16 7 21 35 18 60 25 90M42 6 40 27 46 48 40 69 44 94M69 6 65 31 71 51 67 80 75 96M89 7 82 33 87 55 80 83"/><path d="M9 14 26 27 45 22 60 32 78 27 91 37M8 57 27 64 40 56 58 65 75 56 94 60"/></g>
        {polyline && <polyline className="route-main" points={polyline}/>}
        {destinationPoints.map((node) => <g key={node.name}><circle className="route-node-halo" cx={node.x} cy={node.y} r="2.8"/><circle className="route-node" cx={node.x} cy={node.y} r="2.15"/><text className="route-node-number" x={node.x} y={node.y + .65}>{node.number}</text><text className="map-node-title" x={node.labelX} y={node.labelY} textAnchor={node.anchor}>{node.name}</text><text className="map-node-subtitle" x={node.labelX} y={node.labelY + 3} textAnchor={node.anchor}>{`Tujuan ${node.number}`}</text></g>)}
        {warehouse && <g className="depot-node" transform={`translate(${warehousePoint.x} ${warehousePoint.y})`}><circle r="3.1"/><circle r="2.2"/><path d="M-1.2.6h2.4v-2L0-2.3l-1.2.9z"/><text x="1" y="7.7" className="depot-label">Gudang {warehouse.name}</text><text x="1" y="10.1" className="depot-subtitle">Depot Utama • Start/Finish</text></g>}
        {distanceChips.filter(Boolean).map((chip) => <g className="distance-chip" transform={`translate(${chip.x} ${chip.y})`} key={chip.key}><rect width="11" height="3.3" rx="1.4"/><text x="5.5" y="2.2" textAnchor="middle">{chip.label}</text></g>)}
      </svg>
      <div className="map-location"><span className="live-dot"/>{warehouse ? `Kabupaten Nganjuk [${warehouse.longitude.toFixed(3)}°, ${warehouse.latitude.toFixed(3)}°]` : 'Lokasi menunggu data API'}</div>
      <div className="map-zoom"><button onClick={() => setZoom((value) => Math.min(1.24, value + .08))} aria-label="Perbesar peta"><Icon name="plus" size={16}/></button><button onClick={() => setZoom((value) => Math.max(.88, value - .08))} aria-label="Perkecil peta"><Icon name="minus" size={16}/></button><button onClick={() => setZoom(1)} aria-label="Atur ulang peta"><Icon name="target" size={15}/></button></div>
      <div className="map-total"><Icon name="route" size={15}/><strong>{optimal ? `${(optimal.total_distance_m / 1000).toFixed(3)} km Total` : 'Rute belum tersedia'}</strong><span/>Skema urutan kunjungan</div>
      <div className="map-legend"><strong>LEGENDA VISUALISASI</strong><div><i className="legend-depot"/>Gudang {warehouse?.name ?? 'Depot'}</div><div><i className="legend-destination"/>Titik distribusi dari API</div><div><i className="legend-route"/>Urutan rute optimal</div><small>Skema placeholder, bukan geometri jalan</small></div>
    </div>
  </section>;
}
