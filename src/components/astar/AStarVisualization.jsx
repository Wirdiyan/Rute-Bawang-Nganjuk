import { useMemo } from 'react';
import { replayTrace, visitedNames } from '../../api/adapters/searchTrace.js';
import { formatKm } from '../../api/adapters/routeData.js';

export default function AStarVisualization({ result, cursor, onCursor, playing, onPlaying, speed, onSpeed }) {
  const trace = result?.trace ?? [];
  const step = trace[cursor];
  const snapshot = useMemo(() => replayTrace(trace, result?.initial_state, cursor), [trace, result, cursor]);
  const names = result?.request.destinations ?? [];
  return <section className="panel astar-panel" aria-label="Pemutaran pencarian A-star">
    <div className="section-heading"><div><h2>Proses A* multi-tujuan</h2><p>OPEN dan CLOSED setelah ekspansi yang dipilih.</p></div><span className="search-status">{step?.status === 'goal' ? 'GOAL' : step ? 'REPLAY' : 'BELUM DIHITUNG'}</span></div>
    {!result ? <p className="empty-data">Hitung rute untuk memutar proses pencarian seluruh perjalanan.</p> : <>
      <div className="trace-controls"><button onClick={() => onCursor(0)} disabled={cursor === 0} aria-label="Langkah pertama">Awal</button><button onClick={() => onCursor(cursor - 1)} disabled={cursor === 0} aria-label="Langkah sebelumnya">←</button><button onClick={onPlaying} aria-pressed={playing}>{playing ? 'Jeda' : 'Putar'}</button><button onClick={() => onCursor(cursor + 1)} disabled={cursor >= trace.length - 1} aria-label="Langkah berikutnya">→</button><button onClick={() => onCursor(trace.length - 1)} disabled={cursor >= trace.length - 1}>Goal</button></div>
      <label className="trace-range">Langkah {step.step.toLocaleString('id-ID')} / {trace.length.toLocaleString('id-ID')}<input type="range" min="0" max={trace.length - 1} value={cursor} onChange={(event) => onCursor(Number(event.target.value))} aria-label="Langkah pencarian"/></label>
      <label className="trace-speed">Kecepatan pemutaran<select value={speed} onChange={(event) => onSpeed(Number(event.target.value))}><option value="1">1 langkah / jeda</option><option value="25">25 langkah / jeda</option><option value="250">250 langkah / jeda</option><option value="1000">1.000 langkah / jeda</option></select></label>
      <div className="search-overview"><div className="overview-box"><label>STATE TERPILIH</label><strong>Node {step.node}</strong><small>Mask {step.mask.toString(2).padStart(names.length, '0')} · {visitedNames(step.mask, names).join(', ') || 'belum ada tujuan tercapai'}</small></div><div className="overview-box"><label>BIAYA STATE</label><strong>f = {formatKm(step.f)}</strong><small>g {formatKm(step.g)} + h {formatKm(step.h)}</small></div></div>
      <p className="trace-parent">Parent: {step.parent ?? '— (state awal)'} · tersisa: {names.filter((_, index) => !(step.mask & (1 << index))).join(', ') || (step.status === 'goal' ? 'selesai' : 'kembali ke gudang')}</p>
      <div className="set-section"><div className="set-heading"><label>OPEN · KANDIDAT</label><span>{snapshot.openCount.toLocaleString('id-ID')} state</span></div><div className="token-list">{snapshot.open.map((state) => <span className="node-token open" key={state.key}>#{state.node} / {state.mask.toString(2).padStart(names.length, '0')} · f {(state.f / 1000).toFixed(2)}</span>)}</div><small className="config-intro">Maksimal 8 kandidat dengan f terkecil ditampilkan.</small></div>
      <div className="set-section"><div className="set-heading"><label>CLOSED · SUDAH DIEKSPANSI</label><span>{snapshot.closedCount.toLocaleString('id-ID')} state</span></div><div className="token-list">{snapshot.closed.map((state) => <span className="node-token closed" key={state.key}>#{state.node} / {state.mask.toString(2).padStart(names.length, '0')}</span>)}</div><small className="config-intro">8 state terakhir; state boleh dibuka kembali jika g membaik.</small></div>
      <p className="config-intro">Digit mask mengikuti urutan input dari kanan ke kiri: {names.join(', ')}. Angka biaya dalam km. Pilih Simulasi Peta, lalu Proses pencarian A*, untuk melihat node ekspansi terpilih.</p>
    </>}
  </section>;
}
