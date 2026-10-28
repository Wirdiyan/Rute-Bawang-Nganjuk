import { alternativeRoutes } from '../../data/mockData.js';

export default function AlternativeRoutes() {
  return <section className="panel alternatives-panel"><div className="section-heading"><div><h2>Komparasi Alternatif Rute (TSP Permutasi)</h2><p>Evaluasi beberapa urutan distribusi</p></div><span className="route-count">3! = 6 Jalur Terkalkulasi</span></div><div className="alternative-list">{alternativeRoutes.map((route) => <article className={`alternative-row ${route.selected ? 'selected' : ''}`} key={route.id}><span className={`alternative-dot ${route.selected ? 'active' : ''}`}/><div className="alternative-copy"><div><strong>{route.name}:</strong> {route.sequence}</div><small>{route.note}</small></div><strong className="alternative-distance">{route.distance}</strong><span className={`alternative-tag ${route.selected ? 'optimal' : ''}`}>{route.tag}</span></article>)}</div></section>;
}
