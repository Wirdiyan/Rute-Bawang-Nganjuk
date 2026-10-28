import Icon from '../common/Icon.jsx';

export default function RoutePlan({ stops }) {
  return <section className="panel route-plan-panel" id="route-analysis">
    <div className="section-heading"><div><div className="heading-title"><Icon name="route" size={18} className="green-icon"/><h2>Urutan Rute Optimal Distribusi</h2></div><p>Urutan kunjungan armada untuk satu siklus distribusi</p></div><span className="recommend-badge">REKOMENDASI UTAMA</span></div>
    <ol className="route-timeline">{stops.map((stop) => <li className={`route-stop ${stop.kind}`} key={stop.id}><span className="stop-number">{stop.number}</span><div className="stop-content"><div className="stop-title-row"><strong>{stop.title}</strong><span className={`stop-badge ${stop.kind}`}>{stop.badge}</span></div><p>{stop.load}</p>{stop.distance && <div className="travel-chip"><span>↓</span><strong>{stop.distance}</strong><small>({stop.travel})</small></div>}</div></li>)}</ol>
  </section>;
}
