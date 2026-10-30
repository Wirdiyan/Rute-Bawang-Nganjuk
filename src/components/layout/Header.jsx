import Icon from '../common/Icon.jsx';

export default function Header({ activeTab, onNavigate, menuOpen, onToggleMenu, apiStatus = 'checking' }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', target: 'top' },
    { id: 'analysis', label: 'Route Analysis', target: 'route-analysis' },
    { id: 'about', label: 'About', target: 'why-optimal' },
  ];

  return <header className="site-header">
    <div className="header-inner">
      <button className="mobile-menu icon-button" onClick={onToggleMenu} aria-label="Buka navigasi"><Icon name="menu" /></button>
      <a className="brand" href="#top" onClick={(event) => { event.preventDefault(); onNavigate('dashboard', 'top'); }}>
        <span className="brand-mark"><Icon name="onion" size={21} strokeWidth={1.65} /></span>
        <span className="brand-copy"><strong>RouteBawang AI</strong><small>OPTIMASI DISTRIBUSI BAWANG MERAH</small></span>
      </a>
      <span className="header-divider" />
      <nav className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navigasi utama">
        {navItems.map((item) => <button key={item.id} className={`nav-link ${activeTab === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id, item.target)}>{item.label}</button>)}
      </nav>
      <div className="header-actions">
        <div className={`session-pill api-session ${apiStatus}`} title={`Backend status: ${apiStatus}`}><span className="live-dot"/><span>{apiStatus === 'connected' ? 'Backend Connected' : apiStatus === 'offline' ? 'Backend Offline' : 'Connecting API…'}</span></div>
        <button className="profile-button" aria-label="Profil pengguna"><Icon name="user" size={17} /></button>
      </div>
    </div>
  </header>;
}
