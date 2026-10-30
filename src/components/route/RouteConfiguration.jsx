import Icon from '../common/Icon.jsx';

export default function RouteConfiguration({ locations, onOptimize, optimizing, resultReady }) {
  const warehouse = locations?.warehouse;
  const destinations = locations?.destinations ?? [];

  return <aside className="control-column" aria-label="Konfigurasi rute">
    <section className="panel route-panel">
      <div className="panel-heading">
        <div className="panel-title"><Icon name="truck" size={17} className="green-icon"/><h2>Konfigurasi Rute</h2></div>
        <span className="eyebrow-badge">RUTE TERKUNCI</span>
      </div>
      <label className="field-label">PUSAT DISTRIBUSI ASAL &amp; KEMBALI (DEPOT)</label>
      <div className="warehouse-card">
        <span className="warehouse-icon"><Icon name="warehouse" size={18}/></span>
        <div className="warehouse-copy"><div><strong>{warehouse ? `Gudang ${warehouse.name}` : 'Memuat lokasi…'}</strong><span className="start-tag">Start/End</span></div><small>{warehouse ? `${warehouse.latitude.toFixed(5)}, ${warehouse.longitude.toFixed(5)}` : 'Menunggu respons API'}</small></div>
        <Icon name="lock" size={14} className="lock-icon"/>
      </div>
      <div className="destination-heading"><label className="field-label">TITIK TUJUAN DISTRIBUSI ({destinations.length} DARI API)</label></div>
      <div className="destination-list">{destinations.map((destination, index) => <article className="destination-row" key={destination.name}>
        <label className="destination-select"><input type="checkbox" checked disabled readOnly aria-label={`${destination.name} wajib dikunjungi`} /><span className="custom-check" /></label>
        <span className="destination-marker red" />
        <div className="destination-copy"><div className="destination-name"><strong>{destination.name}</strong><span className="market-tag">Tujuan #{index + 1}</span></div><small>{destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)}</small></div>
        <span className="sequence-tag">API</span>
      </article>)}</div>
      <div className="panel-divider" />
      <div className="panel-heading algorithm-heading">
        <div className="panel-title"><span className="sigma-mark">Σ</span><h2>Konfigurasi Algoritma</h2></div><span className="algorithm-badge">Custom A*</span>
      </div>
      <div className="formula-card"><div className="formula-line"><strong>f(n) = g(n) + h(n)</strong><small>A* Evaluation Cost</small></div><p><strong>g(n):</strong> Jarak jalan dari graf OSM <span>|</span> <strong>h(n):</strong> Heuristic Haversine</p></div>
      <div className="heuristic-label field-label">FUNGSI HEURISTIK BACKEND</div>
      <div className="heuristic-list"><div className="heuristic-option selected"><span className="radio-indicator"/><span className="heuristic-copy"><strong>Haversine Distance</strong><span>(Estimasi garis lurus)</span></span><small>Aktif</small></div></div>
      <div className="graph-metadata"><span><i/>Data lokasi<br/>FastAPI</span><b>·</b><span>Jaringan jalan<br/>OpenStreetMap</span><b>·</b><span>1 kendaraan<br/>3 tujuan wajib</span></div>
      <div className="optimize-actions"><button className="primary-button" onClick={onOptimize} disabled={optimizing || !locations}><Icon name={optimizing ? 'clock' : 'sparkles'} size={17}/>{optimizing ? 'MEMUAT DATA…' : 'PERBARUI HASIL API'}</button></div>
      <div className={`result-note ${resultReady ? 'visible' : ''}`}><Icon name="check" size={13}/><span>{resultReady ? 'Data hasil optimizer berhasil dimuat dari backend' : 'Menampilkan hasil optimizer backend'}</span></div>
    </section>
  </aside>;
}
