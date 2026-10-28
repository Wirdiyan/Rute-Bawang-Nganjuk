import { useState } from 'react';
import Icon from '../common/Icon.jsx';

const initialNodes = [
  { id: 'nganjuk', x: 20, y: 66, label: 'Pasar Wage Nganjuk', sub: 'Destinasi 1 (800 kg)', number: '1', labelX: 9, labelY: 72, anchor: 'start' },
  { id: 'rejoso', x: 34, y: 31, label: 'Sentra Rejoso', sub: 'Destinasi 2 (900 kg)', number: '2', labelX: 34, labelY: 20, anchor: 'middle' },
  { id: 'gondang', x: 76, y: 45, label: 'Gudang Gondang', sub: 'Destinasi 3 (800 kg)', number: '3', labelX: 80, labelY: 52, anchor: 'start' },
];

export default function RouteMap({ destinations }) {
  const [zoom, setZoom] = useState(1);
  const active = initialNodes.filter((node) => destinations.some((destination) => destination.id === node.id && destination.enabled));
  const points = [{ id: 'depot', x: 48, y: 52 }, ...active.map((node) => ({ id: node.id, x: node.x, y: node.y }))];
  const routePoints = [...points.slice(0, 1), ...points.slice(1), points[0]].map((point) => `${point.x},${point.y}`).join(' ');
  return <section className="map-card" aria-label="Peta simulasi rute">
    <div className="map-canvas">
      <div className="map-waterway"/><div className="map-park park-one"/><div className="map-park park-two"/><div className="map-park park-three"/>
      <svg className="map-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ transform: `scale(${zoom})` }}>
        <g className="road-network"><path d="M3 20 18 30 34 20 48 26 62 12 84 25 97 20M4 48 18 39 33 48 50 35 65 43 80 34 97 42M2 80 20 72 35 82 48 68 64 74 78 62 96 66M16 7 21 35 18 60 25 90M42 6 40 27 46 48 40 69 44 94M69 6 65 31 71 51 67 80 75 96M89 7 82 33 87 55 80 83"/><path d="M9 14 26 27 45 22 60 32 78 27 91 37M8 57 27 64 40 56 58 65 75 56 94 60"/></g>
        <polyline className="route-alternative" points={routePoints}/><polyline className="route-main" points={routePoints}/>
        {active.map((node) => <g key={node.id}><circle className="route-node-halo" cx={node.x} cy={node.y} r="2.8"/><circle className="route-node" cx={node.x} cy={node.y} r="2.15"/><text className="route-node-number" x={node.x} y={node.y + .65}>{node.number}</text><text className="map-node-title" x={node.labelX} y={node.labelY} textAnchor={node.anchor}>{node.label}</text><text className="map-node-subtitle" x={node.labelX} y={node.labelY + 3} textAnchor={node.anchor}>{node.sub}</text></g>)}
        <g className="depot-node" transform="translate(48 52)"><circle r="3.1"/><circle r="2.2"/><path d="M-1.2.6h2.4v-2L0-2.3l-1.2.9z"/><text x="1" y="7.7" className="depot-label">Gudang Sukomoro</text><text x="1" y="10.1" className="depot-subtitle">Depot Utama • Start/Finish</text></g>
        <g className="distance-chip" transform="translate(19 48)"><rect width="8" height="3" rx="1.4"/><text x="4" y="2.05" textAnchor="middle">11.2</text></g>
        <g className="distance-chip" transform="translate(34 50)"><rect width="8" height="3" rx="1.4"/><text x="4" y="2.05" textAnchor="middle">8.4</text></g>
        <g className="distance-chip" transform="translate(51 30)"><rect width="8" height="3" rx="1.4"/><text x="4" y="2.05" textAnchor="middle">14.5</text></g>
      </svg>
      <div className="map-location"><span className="live-dot"/>Kabupaten Nganjuk [E: 111.90°, S: 7.60°]</div>
      <div className="map-zoom"><button onClick={() => setZoom((value) => Math.min(1.24, value + .08))} aria-label="Perbesar peta"><Icon name="plus" size={16}/></button><button onClick={() => setZoom((value) => Math.max(.88, value - .08))} aria-label="Perkecil peta"><Icon name="minus" size={16}/></button><button onClick={() => setZoom(1)} aria-label="Atur ulang peta"><Icon name="target" size={15}/></button></div>
      <div className="map-total"><Icon name="route" size={15}/><strong>46.4 km Total</strong><span/>Estimasi Waktu: ~1 Jam 23 Menit</div>
      <div className="map-legend"><strong>LEGENDA VISUALISASI</strong><div><i className="legend-depot"/>Gudang Sukomoro (Depot)</div><div><i className="legend-destination"/>Titik Distribusi Bawang</div><div><i className="legend-route"/>Rute Optimal A* (46.4 km)</div><div><i className="legend-alt"/>Cabang Evaluasi Alternatif</div></div>
    </div>
  </section>;
}
