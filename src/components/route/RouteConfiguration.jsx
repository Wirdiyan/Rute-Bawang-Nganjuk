import Icon from '../common/Icon.jsx';

export default function RouteConfiguration({ destinations, setDestinations, candidates, heuristic, setHeuristic, onOptimize, optimizing, resultReady }) {
  const selectedCount = destinations.filter((item) => item.enabled).length;
  const toggleDestination = (id) => setDestinations((items) => items.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  const addDestination = (event) => {
    const id = event.target.value;
    const option = candidates.find((candidate) => candidate.id === id);
    if (option && !destinations.some((destination) => destination.id === id)) setDestinations((items) => [...items, { ...option, sequence: items.length + 1, enabled: true }]);
    event.target.value = '';
  };
  const removeDestination = (id) => setDestinations((items) => items.filter((item) => item.id !== id).map((item, index) => ({ ...item, sequence: index + 1 })));

  return <aside className="control-column" aria-label="Konfigurasi rute">
    <section className="panel route-panel">
      <div className="panel-heading">
        <div className="panel-title"><Icon name="truck" size={17} className="green-icon"/><h2>Konfigurasi Rute</h2></div>
        <span className="eyebrow-badge">RUTE TERKUNCI</span>
      </div>
      <label className="field-label">PUSAT DISTRIBUSI ASAL &amp; KEMBALI (DEPOT)</label>
      <div className="warehouse-card">
        <span className="warehouse-icon"><Icon name="warehouse" size={18}/></span>
        <div className="warehouse-copy"><div><strong>Gudang Sukomoro</strong><span className="start-tag">Start/End</span></div><small>Pusat Distribusi Utama Bawang Merah</small></div>
        <Icon name="lock" size={14} className="lock-icon"/>
      </div>
      <div className="destination-heading"><label className="field-label">TITIK TUJUAN DISTRIBUSI ({selectedCount} DIPILIH)</label><label className="add-destination"><Icon name="plus" size={13}/><span>Tambah Titik</span><select aria-label="Tambah titik tujuan" value="" onChange={addDestination}><option value="" disabled></option>{candidates.filter((item) => !destinations.some((destination) => destination.id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
      <div className="destination-list">{destinations.map((destination, index) => <article className={`destination-row ${destination.enabled ? '' : 'disabled'}`} key={destination.id}>
        <label className="destination-select"><input type="checkbox" checked={destination.enabled} onChange={() => toggleDestination(destination.id)} aria-label={`Pilih ${destination.name}`} /><span className="custom-check" /></label>
        <span className={`destination-marker ${destination.accent || 'red'}`} />
        <div className="destination-copy"><div className="destination-name"><strong>{destination.name}</strong><span className="market-tag">{destination.market}</span></div><small>Alokasi: {destination.load} kg • {destination.priority}</small></div>
        <span className="sequence-tag">Seq #{String(index + 1).padStart(2, '0')}</span>
        {destination.id.startsWith('loc-') || destination.id === 'barat' ? <button className="remove-stop" onClick={() => removeDestination(destination.id)} aria-label={`Hapus ${destination.name}`}>×</button> : null}
      </article>)}</div>
      <div className="panel-divider" />
      <div className="panel-heading algorithm-heading">
        <div className="panel-title"><span className="sigma-mark">Σ</span><h2>Konfigurasi Algoritma</h2></div><span className="algorithm-badge">TSP Heuristic</span>
      </div>
      <div className="formula-card"><div className="formula-line"><strong>f(n) = g(n) + h(n)</strong><small>A* Evaluation Cost</small></div><p><strong>g(n):</strong> Jarak riil terakumulasi dari depot <span>|</span> <strong>h(n):</strong> Estimasi jarak ke target</p></div>
      <div className="heuristic-label field-label">PILIHAN FUNGSI HEURISTIK</div>
      <div className="heuristic-list">{[
        { id: 'road', title: 'Road Distance', caption: 'Riil Graf Nganjuk', state: 'Aktif' },
        { id: 'euclidean', title: 'Euclidean Distance', caption: 'Garis Lurus', state: 'Non-aktif' },
        { id: 'manhattan', title: 'Manhattan Distance', caption: 'Grid L1', state: 'Non-aktif' },
      ].map((option) => <label className={`heuristic-option ${heuristic === option.id ? 'selected' : ''}`} key={option.id}><input type="radio" name="heuristic" checked={heuristic === option.id} onChange={() => setHeuristic(option.id)}/><span className="radio-indicator"/><span className="heuristic-copy"><strong>{option.title}</strong><span>({option.caption})</span></span><small>{heuristic === option.id ? 'Aktif' : option.state}</small></label>)}</div>
      <div className="graph-metadata"><span><i/>142 Simpul<br/>Jalan</span><b>·</b><span>218 Sisi Graf<br/>(Edges)</span><b>·</b><span>✓ Tervalidasi<br/>BFS</span></div>
      <div className="optimize-actions"><button className="primary-button" onClick={onOptimize} disabled={optimizing || selectedCount === 0}><Icon name={optimizing ? 'clock' : 'sparkles'} size={17}/>{optimizing ? 'MENGHITUNG RUTE…' : 'CARI RUTE OPTIMAL (A*)'}</button></div>
      <div className={`result-note ${resultReady ? 'visible' : ''}`}><Icon name="check" size={13}/><span>{resultReady ? 'Simulasi mock selesai • hasil ditampilkan' : 'Rute Optimal Ditemukan • Siklus Hamiltonian Selesai'}</span></div>
    </section>
  </aside>;
}
