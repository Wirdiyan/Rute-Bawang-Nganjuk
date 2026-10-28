import Header from '../components/layout/Header.jsx';
import RouteConfiguration from '../components/route/RouteConfiguration.jsx';
import RouteMap from '../components/route/RouteMap.jsx';
import RouteSummary from '../components/route/RouteSummary.jsx';
import RoutePlan from '../components/route/RoutePlan.jsx';
import AlternativeRoutes from '../components/route/AlternativeRoutes.jsx';
import WhyOptimal from '../components/route/WhyOptimal.jsx';
import AStarVisualization from '../components/astar/AStarVisualization.jsx';
import SearchTable from '../components/astar/SearchTable.jsx';
import { availableDestinations, closedSet, initialDestinations, routeStops, searchLedger, summaryStats, openSet } from '../data/mockData.js';
import { useState } from 'react';
import Icon from '../components/common/Icon.jsx';

export default function Dashboard() {
  const [destinations, setDestinations] = useState(() => initialDestinations.map((item) => ({ ...item, enabled: true })));
  const [heuristic, setHeuristic] = useState('road');
  const [optimizing, setOptimizing] = useState(false);
  const [resultReady, setResultReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const optimize = () => {
    if (optimizing) return;
    setOptimizing(true);
    setResultReady(false);
    window.setTimeout(() => { setOptimizing(false); setResultReady(true); }, 750);
  };
  const reset = () => { setDestinations(initialDestinations.map((item) => ({ ...item, enabled: true }))); setHeuristic('road'); setResultReady(false); setOptimizing(false); };
  const navigate = (tab, target) => { setActiveTab(tab); setMenuOpen(false); document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const visibleRows = searchLedger.filter((row) => `${row.node} ${row.status} ${row.iteration}`.toLowerCase().includes(filter.toLowerCase()));
  const displayedStats = summaryStats.map((stat) => stat.id === 'destinations' ? { ...stat, value: String(destinations.filter((destination) => destination.enabled).length) } : stat);

  return <div className="app-shell" id="top">
    <Header activeTab={activeTab} onNavigate={navigate} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
    <main className="dashboard-content">
      <section className="page-intro"><div><div className="intro-kicker"><span>LIVE SIMULATION</span><small>Graf Jaringan Jalan Riil Kab. Nganjuk</small></div><h1>Workbench Optimasi Distribusi Bawang Merah</h1></div><div className="intro-actions"><div className="solver-chip"><Icon name="filter" size={14}/><span>TSP Solver: <b>A* Admissible Heuristic</b></span></div><button className="reset-button" onClick={reset} disabled={optimizing}><Icon name="refresh" size={13}/> Hitung Ulang</button></div></section>
      <section className="workbench-grid"><RouteConfiguration destinations={destinations} setDestinations={setDestinations} candidates={availableDestinations} heuristic={heuristic} setHeuristic={setHeuristic} onOptimize={optimize} optimizing={optimizing} resultReady={resultReady}/><RouteMap destinations={destinations}/></section>
      <RouteSummary stats={displayedStats}/>
      <div className="detail-grid">
        <div className="detail-column"><RoutePlan stops={routeStops}/><AlternativeRoutes/><WhyOptimal/></div>
        <div className="detail-column"><AStarVisualization open={openSet} closed={closedSet}/><div className="ledger-tools"><div><Icon name="search" size={15}/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Cari simpul atau status…" aria-label="Cari pada log ekspansi"/></div><button onClick={() => setFilter('')}>Reset filter</button></div><SearchTable rows={visibleRows}/></div>
      </div>
    </main>
    <footer className="site-footer"><span>© 2025 RouteBawang AI • Kabupaten Nganjuk Agro-Logistics Optimization System</span><div><span className="engine-pill"><i/> A* Multi-Destination TSP Engine v1.0</span><strong>Status: Online</strong></div></footer>
    {optimizing && <div className="loading-toast" role="status"><span className="spinner"/> Menyiapkan hasil simulasi mock…</div>}
  </div>;
}
