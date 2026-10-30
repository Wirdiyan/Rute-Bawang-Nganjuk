import { useState } from 'react';

export default function SearchTable({ rows = [] }) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? rows : rows.slice(0, 25);
  return <section className="panel ledger-panel">
    <div className="section-heading ledger-heading"><div><h2>A* Node Expansion Ledger</h2><p>Trace evaluasi node dari custom A* backend</p></div><span className="log-badge">{rows.length} Steps</span></div>
    <div className="table-scroll"><table><thead><tr><th>ITER</th><th>SIMPUL TERPILIH (N)</th><th>G(N) RIIL</th><th>H(N) EST</th><th>F(N) TOTAL</th><th>STATUS NODE</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={`${row.iteration}-${row.node}`}><td>{row.iteration}</td><td className={row.status === 'Goal reached' ? 'node-start' : ''}>{row.node}</td><td>{row.g}</td><td>{row.h}</td><td className={row.status === 'Goal reached' ? 'goal-cost' : ''}>{row.f}</td><td><span className={`node-status ${row.tone}`}>{row.status}</span></td></tr>)}</tbody></table></div>
    <div className="table-footnote"><span><i/> {rows.length ? `${showAll ? rows.length : Math.min(rows.length, 25)} dari ${rows.length} langkah pencarian` : 'Search trace belum tersedia'}</span>{rows.length > 25 && <button onClick={() => setShowAll((value) => !value)}><span>{showAll ? '⌃' : '⌄'}</span> {showAll ? 'Ringkas log' : 'Lihat log lengkap'}</button>}</div>
  </section>;
}
