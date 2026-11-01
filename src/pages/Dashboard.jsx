import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/layout/Header.jsx';
import RouteConfiguration from '../components/route/RouteConfiguration.jsx';
import RouteMap from '../components/route/RouteMap.jsx';
import WholeNodeJourney from '../components/route/WholeNodeJourney.jsx';
import RouteSummary from '../components/route/RouteSummary.jsx';
import RoutePlan from '../components/route/RoutePlan.jsx';
import AlternativeRoutes from '../components/route/AlternativeRoutes.jsx';
import WhyOptimal from '../components/route/WhyOptimal.jsx';
import AStarVisualization from '../components/astar/AStarVisualization.jsx';
import SearchTable from '../components/astar/SearchTable.jsx';
import { createAlternativeRows, createOptimalExplanation, createRouteStops, createSearchRows, createSummaryStats } from '../api/adapters/routeData.js';
import { getDataset, solveRoute } from '../api/routeApi.js';

export default function Dashboard() {
  const [dataset, setDataset] = useState(null);
  const [selected, setSelected] = useState([]);
  const [heuristic, setHeuristic] = useState('mst');
  const [compare, setCompare] = useState(true);
  const [blocked, setBlocked] = useState([]);
  const [closureEdge, setClosureEdge] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(true);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(250);
  const request = useRef(null);
  const errorBox = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    getDataset(controller.signal).then((data) => {
      setDataset(data); setSelected(data.locations.slice(1).map((point) => point.name));
      setApiStatus('connected'); setLoading(false);
    }).catch((cause) => {
      if (cause.name !== 'AbortError') { setError(cause.message); setApiStatus('offline'); setLoading(false); }
    });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!playing || !result) return undefined;
    const timer = window.setInterval(() => setCursor((value) => Math.min(value + speed, result.trace.length - 1)), 500);
    return () => window.clearInterval(timer);
  }, [playing, speed, result]);
  useEffect(() => { if (result && cursor >= result.trace.length - 1) setPlaying(false); }, [cursor, result]);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  const change = (setter, value) => { setter(value); setDirty(true); setPlaying(false); setError(''); };
  const toggleDestination = (name) => change(setSelected, selected.includes(name) ? selected.filter((value) => value !== name) : [...selected, name]);
  const compute = async () => {
    if (busy || !selected.length || !dataset) return;
    setBusy(true); setPlaying(false); setError('');
    request.current = new AbortController();
    try {
      const fresh = await solveRoute({ warehouse: dataset.locations[0].name, destinations: selected,
        heuristic, compare_baseline: compare, blocked_edges: blocked }, request.current.signal);
      setResult(fresh); setCursor(0); setFilter(''); setDirty(false); setApiStatus('connected');
      if (!blocked.length) setClosureEdge({ source: fresh.combined_path[0], target: fresh.combined_path[1] });
    } catch (cause) {
      if (cause.name !== 'AbortError') { setError(cause.message); setDirty(true); }
    } finally { setBusy(false); }
  };
  const locations = useMemo(() => {
    if (!dataset) return null;
    const points = dataset.locations.map((point) => ({ ...point, latitude: point.road_latitude, longitude: point.road_longitude }));
    const names = result?.request.destinations ?? selected;
    return { warehouse: points[0], destinations: points.slice(1).filter((point) => names.includes(point.name)) };
  }, [dataset, selected, result]);
  const stats = useMemo(() => createSummaryStats(result), [result]);
  const edgeOptions = useMemo(() => {
    const unique = new Map();
    (result?.combined_path ?? []).slice(1).forEach((target, index) => {
      const source = result.combined_path[index];
      unique.set(`${source}:${target}`, { source, target, label: `Ruas ${index + 1} · ${source} → ${target}` });
    });
    if (closureEdge && !unique.has(`${closureEdge.source}:${closureEdge.target}`)) unique.set(`${closureEdge.source}:${closureEdge.target}`, { ...closureEdge, label: 'Ruas dari skenario sebelumnya' });
    return [...unique.values()];
  }, [result, closureEdge]);
  const chooseClosure = (key) => {
    const { source, target } = edgeOptions.find((edge) => `${edge.source}:${edge.target}` === key);
    setClosureEdge({ source, target });
    if (blocked.length) change(setBlocked, [{ source, target }]);
  };
  const stops = useMemo(() => createRouteStops(result), [result]);
  const alternatives = useMemo(() => createAlternativeRows(result), [result]);
  const rows = useMemo(() => createSearchRows(result), [result]);
  const visibleRows = useMemo(() => rows.filter((row) => `${row.node} ${row.status} ${row.iteration} ${row.mask}`.toLowerCase().includes(filter.toLowerCase())), [rows, filter]);
  const navigate = (tab, target) => { setActiveTab(tab); setMenuOpen(false); document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `rute-simulasi-${result.run_id}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const selectStep = (index) => { setCursor(index); setPlaying(false); };
  return <div className="app-shell" id="top">
    <a href="#workbench" className="skip-link">Lewati ke konfigurasi</a>
    <Header activeTab={activeTab} onNavigate={navigate} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} apiStatus={apiStatus}/>
    <main className="dashboard-content">
      <section className="page-intro"><div><div className="intro-kicker"><span>SIMULASI DISTRIBUSI</span><small>Jaringan jalan OpenStreetMap · Nganjuk</small></div><h1>Optimasi perjalanan multi-tujuan</h1></div><div className="intro-actions"><span className="solver-chip">A* · state posisi dan tujuan dikunjungi</span><button className="reset-button" disabled={!result || busy} onClick={download}>Unduh hasil JSON</button></div></section>
      <div className="simulation-notice"><strong>Titik referensi, bukan lokasi pengiriman terverifikasi.</strong> {dataset?.notice ?? 'Memuat dataset jalan lokal…'}</div>
      {loading && <p className="api-loading" role="status">Memeriksa dataset jalan…</p>}
      {error && <div className="api-error" role="alert" tabIndex="-1" ref={errorBox}><strong>Permintaan belum berhasil</strong><span>{error}</span>{!dataset && <button onClick={() => window.location.reload()}>Muat ulang</button>}</div>}
      {result && dirty && <p className="stale-notice" role="status">Konfigurasi berubah. Peta dan tabel masih menampilkan hasil perhitungan sebelumnya sampai Anda menghitung ulang.</p>}
      <section className="workbench-grid" id="workbench"><RouteConfiguration dataset={dataset} selected={selected} onSelect={toggleDestination} heuristic={heuristic} onHeuristic={(value) => change(setHeuristic, value)} compare={compare} onCompare={(value) => change(setCompare, value)} blocked={blocked} onBlock={(checked) => change(setBlocked, checked ? [closureEdge] : [])} edgeOptions={edgeOptions} closureEdge={closureEdge} onClosureEdge={chooseClosure} canBlock={Boolean(result?.combined_path?.length > 1)} onOptimize={compute} busy={busy} dirty={dirty}/><RouteMap locations={locations} optimal={result} currentStep={result?.trace[cursor]} loading={loading} error={error} busy={busy} dirty={dirty}/></section>
      {result && <p className="run-metadata" role="status">Perhitungan baru · {new Date(result.computed_at_utc).toLocaleString('id-ID')} · ID {result.run_id.slice(0, 8)} · Dataset {result.dataset.version}{result.request.blocked_edges.length ? ` · ${result.request.blocked_edges.length} ruas berarah ditutup` : ''}</p>}
      <WholeNodeJourney optimal={result} locations={locations} busy={busy} dirty={dirty}/>
      <RouteSummary stats={stats}/>
      <div className="detail-grid">
        <div className="detail-column"><RoutePlan stops={stops}/><AlternativeRoutes routes={alternatives} count={alternatives.length} enabled={result?.comparison.enabled}/><WhyOptimal explanation={createOptimalExplanation(result)}/></div>
        <div className="detail-column"><AStarVisualization result={result} cursor={cursor} onCursor={selectStep} playing={playing} onPlaying={() => { if (cursor === result.trace.length - 1) setCursor(0); setPlaying((value) => !value); }} speed={speed} onSpeed={setSpeed}/><div className="ledger-tools"><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Cari node, langkah, atau mask…" aria-label="Cari pada log ekspansi"/><button onClick={() => setFilter('')}>Reset filter</button></div><SearchTable key={result?.run_id ?? 'empty'} rows={visibleRows} cursor={cursor} onSelect={selectStep}/></div>
      </div>
    </main>
    <footer className="site-footer"><span>RouteBawang · Simulasi akademik A* multi-tujuan</span><span>Graf OSM lokal · Tanpa lalu lintas waktu nyata</span></footer>
    {busy && <div className="loading-toast" role="status"><span className="spinner"/> Menghitung ulang, memeriksa baseline, dan menyiapkan trace…</div>}
  </div>;
}
