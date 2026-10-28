import { searchLedger } from '../../data/mockData.js';

export default function SearchTable({ rows = searchLedger }) {
  return <section className="panel ledger-panel">
    <div className="section-heading ledger-heading"><div><h2>A* Node Expansion Ledger</h2><p>Transparansi Algoritma untuk Evaluasi Riset &amp; Logistik</p></div><span className="log-badge">Log v1.0</span></div>
    <div className="table-scroll"><table><thead><tr><th>ITER</th><th>SIMPUL TERPILIH (N)</th><th>G(N) RIIL</th><th>H(N) EST</th><th>F(N) TOTAL</th><th>STATUS NODE</th></tr></thead><tbody>{rows.map((row) => <tr key={row.iteration + row.node}><td>{row.iteration}</td><td className={row.status === 'Expanded' ? 'node-start' : ''}>{row.node}</td><td>{row.g}</td><td>{row.h}</td><td className={row.status === 'Goal Closed' ? 'goal-cost' : ''}>{row.f}</td><td><span className={`node-status ${row.tone}`}>{row.status}</span></td></tr>)}</tbody></table></div>
    <div className="table-footnote"><span><i/> 18 simpul lainnya diringkas untuk tampilan demo</span><button><span>⌄</span> Lihat log lengkap</button></div>
  </section>;
}
