import Icon from '../common/Icon.jsx';

const iconByStat = { route: 'route', pin: 'pin', nodes: 'nodes', time: 'time' };
export default function RouteSummary({ stats }) {
  return <section className="summary-grid" aria-label="Ringkasan rute">{stats.map((stat) => <article className="summary-card" key={stat.id}><div className="summary-top"><span>{stat.label}</span><span className={`summary-icon ${stat.tone}`}><Icon name={iconByStat[stat.icon]} size={16}/></span></div><div className="summary-value">{stat.value}<small className={stat.tone}>{stat.unit}</small></div><p className={`summary-note ${stat.id === 'distance' || stat.id === 'nodes' ? 'positive' : ''}`}>{stat.id === 'distance' ? '⌁ ' : stat.id === 'nodes' ? 'ϟ ' : ''}{stat.note}</p></article>)}</section>;
}
