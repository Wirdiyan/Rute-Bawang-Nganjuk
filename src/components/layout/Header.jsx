import Icon from '../common/Icon.jsx';

export default function Header({ activeTab, onNavigate, menuOpen, onToggleMenu, apiStatus = 'checking' }) {
  const navItems = [
    { id: 'dashboard', label: 'Praktikum', target: 'workbench' },
    { id: 'simulation', label: 'Simulasi lengkap', target: 'whole-simulation' },
    { id: 'analysis', label: 'Analisis rute', target: 'route-analysis' },
    { id: 'about', label: 'Panduan', target: 'why-optimal' },
  ];

  return <header className="site-header">
    <div className="header-inner">
      <button className="mobile-menu icon-button" onClick={onToggleMenu} aria-label="Buka navigasi" aria-expanded={menuOpen}><Icon name="menu" /></button>
      <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); onNavigate('dashboard', 'top'); }}>
        <img className="brand-logo" src="/brand/simantri.png" width="64" height="64" alt="" aria-hidden="true"/>
        <span className="brand-copy"><strong>SIMANTRI</strong><small>Simulasi distribusi bawang merah</small></span>
      </a>
      <span className="header-divider" />
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navigasi utama">
        {navItems.map((item) => <button key={item.id} aria-current={activeTab === item.id ? 'location' : undefined} className={`nav-link ${activeTab === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id, item.target)}>{item.label}</button>)}
      </nav>
      <div className="header-actions">
        <div className={`session-pill api-session ${apiStatus}`} title="Status layanan simulasi"><span className="live-dot"/><span>{apiStatus === 'connected' ? 'Sistem siap' : apiStatus === 'offline' ? 'Tidak terhubung' : 'Menghubungkan…'}</span></div>
      </div>
    </div>
  </header>;
}
