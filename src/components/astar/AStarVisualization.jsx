import Icon from '../common/Icon.jsx';

function TokenList({ items, tone }) { return <div className="token-list">{items.map((item) => <span className={`node-token ${tone}`} key={item}>{item}</span>)}</div>; }

export default function AStarVisualization({ open, closed }) {
  return <section className="panel astar-panel">
    <div className="section-heading"><div><div className="heading-title"><Icon name="nodes" size={18} className="violet-icon"/><h2>Status Eksplorasi A* Terakhir</h2></div><p>Ringkasan kondisi pencarian rute (data simulasi)</p></div><span className="search-status">PENCARIAN KONVERGEN</span></div>
    <div className="search-overview">
      <div className="overview-box"><label>ITERASI AKTIF</label><strong>Iterasi 04 (Goal Achieved)</strong><small>Node Saat Ini: Gondang → Depot</small></div>
      <div className="overview-box cost-box"><label>EVALUASI FUNGSI BIAYA</label><strong>g(n): 34.1 + h(n): 12.3 = <b>46.4 km</b></strong><small>f(n) global minimum tercapai</small></div>
    </div>
    <div className="set-section"><div className="set-heading"><label>OPEN SET (KANDIDAT DALAM ANTREAN PRIORITAS)</label><span>{open.length} Node</span></div><TokenList items={open} tone="open"/></div>
    <div className="set-section closed-section"><div className="set-heading"><label>CLOSED SET (NODE TEREVALUASI OPTIMAL)</label><span>{closed.length} Node Selesai</span></div><TokenList items={closed} tone="closed"/></div>
    <div className="admissible-note"><Icon name="info" size={14}/><span>Teorema Admissible: <b>h(n) ≤ h*(n)</b> menjamin solusi bersifat Pareto-Optimal.</span><strong>No Overestimation</strong></div>
  </section>;
}
