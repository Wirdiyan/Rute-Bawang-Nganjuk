import { useState } from 'react';

export default function SearchTable({ rows = [], cursor, onSelect }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const active = Math.min(page, pages - 1);
  const visible = rows.slice(active * 25, active * 25 + 25);
  return <section className="panel ledger-panel">
    <div className="section-heading ledger-heading"><div><h2>Log ekspansi state</h2><p>Pilih langkah untuk melihat OPEN, CLOSED, dan posisi pada peta.</p></div><span className="log-badge">{rows.length.toLocaleString('id-ID')} langkah</span></div>
    <div className="table-scroll"><table><thead><tr><th>LANGKAH</th><th>NODE / MASK</th><th>g</th><th>h</th><th>f</th><th>STATUS</th></tr></thead><tbody>{visible.map((row) => <tr key={`${row.index}-${row.key}`} className={cursor === row.index ? 'trace-selected' : ''}><td><button className="step-link" onClick={() => onSelect(row.index)} aria-label={`Lihat langkah ${row.iteration}`}>{row.iteration}</button></td><td>{row.node}<small className="mask-cell">mask {row.mask.toString(2)}</small></td><td>{row.g}</td><td>{row.h}</td><td>{row.f}</td><td>{row.status}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="empty-data">Belum ada langkah yang sesuai.</p>}
    <div className="table-footnote"><span>Halaman {active + 1} / {pages.toLocaleString('id-ID')} · 25 baris per halaman</span><div className="pagination"><button onClick={() => setPage(Math.max(0, active - 1))} disabled={!active}>Sebelumnya</button><button onClick={() => setPage(active + 1)} disabled={active >= pages - 1}>Berikutnya</button></div></div>
  </section>;
}
