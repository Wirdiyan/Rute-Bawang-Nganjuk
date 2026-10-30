import Icon from '../common/Icon.jsx';

function TokenList({ items, tone }) { return <div className="token-list">{items.map((item, index) => <span className={`node-token ${tone}`} key={`${item}-${index}`}>{item}</span>)}</div>; }

const formatKm = (meters) => `${(meters / 1000).toFixed(3)} km`;

export default function AStarVisualization({ result }) {
  const steps = result?.search_steps ?? [];
  const current = steps.at(-1);
  const openNodes = (result?.open_nodes ?? []).slice(0, 8).map((node) => `#${node}`);
  const closedNodes = steps.slice(-8).map((step) => `#${step.node}`);
  return <section className="panel astar-panel">
    <div className="section-heading"><div><div className="heading-title"><Icon name="nodes" size={18} className="violet-icon"/><h2>Status Eksplorasi A* Terakhir</h2></div><p>{result ? `${result.from} → ${result.to} • trace dari backend` : 'Menunggu trace pencarian dari backend'}</p></div><span className="search-status">{result ? 'PENCARIAN SELESAI' : 'MENUNGGU API'}</span></div>
    <div className="search-overview">
      <div className="overview-box"><label>ITERASI AKTIF</label><strong>{current ? `Iterasi ${current.step} (Goal reached)` : '—'}</strong><small>{current ? `Node Saat Ini: ${current.node}` : 'Node saat ini belum tersedia'}</small></div>
      <div className="overview-box cost-box"><label>EVALUASI FUNGSI BIAYA</label><strong>g(n): {current ? formatKm(current.g) : '—'} + h(n): {current ? formatKm(current.h) : '—'} = <b>{current ? formatKm(current.f) : '—'}</b></strong><small>{current ? `f(n) pada node ${current.node}` : 'Menunggu hasil A*'}</small></div>
    </div>
    <div className="set-section"><div className="set-heading"><label>OPEN SET (KANDIDAT TERSISA)</label><span>{result?.open_nodes?.length ?? 0} Node{openNodes.length < (result?.open_nodes?.length ?? 0) ? ` • ${openNodes.length} ditampilkan` : ''}</span></div><TokenList items={openNodes} tone="open"/>{result && !openNodes.length && <small className="empty-data">Tidak ada kandidat tersisa saat pencarian selesai.</small>}</div>
    <div className="set-section closed-section"><div className="set-heading"><label>CLOSED SET (NODE TEREVALUASI)</label><span>{result?.closed_nodes?.length ?? 0} Node{closedNodes.length < (result?.closed_nodes?.length ?? 0) ? ` • ${closedNodes.length} terakhir ditampilkan` : ''}</span></div><TokenList items={closedNodes} tone="closed"/></div>
    <div className="admissible-note"><Icon name="info" size={14}/><span>Trace memuat <b>{result?.evaluated_nodes ?? 0}</b> node yang dievaluasi oleh custom A*.</span><strong>Backend A*</strong></div>
  </section>;
}
