import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '../components/layout/Header.jsx';
import RouteConfiguration from '../components/route/RouteConfiguration.jsx';
import RouteMap from '../components/route/RouteMap.jsx';
import RouteSummary from '../components/route/RouteSummary.jsx';
import RoutePlan from '../components/route/RoutePlan.jsx';
import AlternativeRoutes from '../components/route/AlternativeRoutes.jsx';
import WhyOptimal from '../components/route/WhyOptimal.jsx';
import AStarVisualization from '../components/astar/AStarVisualization.jsx';
import SearchTable from '../components/astar/SearchTable.jsx';
import Icon from '../components/common/Icon.jsx';
import {
  createAlternativeRows,
  createOptimalExplanation,
  createRouteStops,
  createSearchRows,
  createSummaryStats,
} from '../api/adapters/routeData.js';
import {
  getAStar,
  getAlternativeRoutes,
  getHealth,
  getLocations,
  getOptimization,
  getOptimalRoute,
} from '../api/routeApi.js';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [error, setError] = useState('');
  const [apiStatus, setApiStatus] = useState('checking');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const loadDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setResultReady(false);
    try {
      const [health, locations, optimization, optimal, alternatives] = await Promise.all([
        getHealth(), getLocations(), getOptimization(), getOptimalRoute(), getAlternativeRoutes(),
      ]);
      if (health.status !== 'ok') throw new Error('FastAPI merespons, tetapi health check menyatakan service tidak siap.');
      if (optimization.total_distance_m !== optimal.total_distance_m || optimization.optimal_route.join('|') !== optimal.route.join('|')) {
        throw new Error('Hasil endpoint optimasi tidak konsisten dengan detail rute optimal.');
      }
      const firstLeg = optimal.route?.[1];
      const astar = firstLeg ? await getAStar(optimal.route[0], firstLeg) : null;
      setData({ health, locations, optimization, optimal, alternatives, astar });
      setApiStatus('connected');
      setError('');
      setResultReady(true);
    } catch (requestError) {
      setApiStatus('offline');
      setError(requestError instanceof Error ? requestError.message : 'Gagal memuat data dari backend RouteBawang AI.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboardData(); }, [loadDashboardData]);

  const stats = useMemo(() => createSummaryStats(data?.optimal, data?.locations, data?.astar), [data]);
  const stops = useMemo(() => createRouteStops(data?.optimal), [data]);
  const alternativeRows = useMemo(() => createAlternativeRows(data?.alternatives), [data]);
  const searchRows = useMemo(() => createSearchRows(data?.astar), [data]);
  const visibleRows = useMemo(() => searchRows.filter((row) => `${row.node} ${row.status} ${row.iteration}`.toLowerCase().includes(filter.toLowerCase())), [searchRows, filter]);
  const explanation = useMemo(() => createOptimalExplanation(data?.optimal, data?.alternatives), [data]);

  const navigate = (tab, target) => {
    setActiveTab(tab);
    setMenuOpen(false);
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const refresh = () => loadDashboardData(true);

  return <div className="app-shell" id="top">
    <Header activeTab={activeTab} onNavigate={navigate} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} apiStatus={apiStatus}/>
    <main className="dashboard-content">
      <section className="page-intro"><div><div className="intro-kicker"><span>LIVE API DATA</span><small>Graf Jaringan Jalan Riil Kab. Nganjuk</small></div><h1>Workbench Optimasi Distribusi Bawang Merah</h1></div><div className="intro-actions"><div className="solver-chip"><Icon name="filter" size={14}/><span>Optimasi Rute: <b>Custom A* + Evaluasi 6 Urutan</b></span></div><button className="reset-button" onClick={refresh} disabled={loading || refreshing}><Icon name="refresh" size={13}/> {refreshing ? 'Memuat…' : 'Muat Ulang Data'}</button></div></section>
      {error && <div className="api-error" role="alert"><Icon name="info" size={16}/><div><strong>Data backend tidak tersedia</strong><span>{error}</span></div><button onClick={refresh} disabled={refreshing}>Coba lagi</button></div>}
      {loading && <div className="api-loading" role="status"><span className="spinner dark-spinner"/> Menghubungkan ke FastAPI dan memuat hasil optimasi…</div>}
      <section className="workbench-grid"><RouteConfiguration locations={data?.locations} onOptimize={refresh} optimizing={refreshing} resultReady={resultReady}/><RouteMap locations={data?.locations} optimal={data?.optimal} loading={loading} error={error}/></section>
      <RouteSummary stats={stats}/>
      <div className="detail-grid">
        <div className="detail-column"><RoutePlan stops={stops}/><AlternativeRoutes routes={alternativeRows} count={data?.alternatives?.count ?? 0}/><WhyOptimal explanation={explanation}/></div>
        <div className="detail-column"><AStarVisualization result={data?.astar}/><div className="ledger-tools"><div><Icon name="search" size={15}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Cari simpul atau status…" aria-label="Cari pada log ekspansi"/></div><button onClick={() => setFilter('')}>Reset filter</button></div><SearchTable rows={visibleRows}/></div>
      </div>
    </main>
    <footer className="site-footer"><span>© 2025 RouteBawang AI • Kabupaten Nganjuk Agro-Logistics Optimization System</span><div><span className="engine-pill"><i/> Custom A* • Optimasi Multi-Destinasi v1.0</span><strong className={`footer-api-status ${apiStatus}`}>Backend: {apiStatus === 'connected' ? 'Connected' : apiStatus === 'offline' ? 'Offline' : 'Checking'}</strong></div></footer>
    {refreshing && <div className="loading-toast" role="status"><span className="spinner"/> Memuat ulang data hasil backend…</div>}
  </div>;
}
