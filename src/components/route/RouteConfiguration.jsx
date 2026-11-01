import Icon from '../common/Icon.jsx';

export default function RouteConfiguration({ dataset, selected, onSelect, heuristic, onHeuristic, compare, onCompare, blocked, onBlock, edgeOptions, closureEdge, onClosureEdge, canBlock, onOptimize, busy, dirty }) {
  const locations = dataset?.locations ?? [];
  const warehouse = locations[0];
  return <aside className="control-column" aria-label="Konfigurasi rute">
    <form className="panel route-panel" onSubmit={(event) => { event.preventDefault(); onOptimize(); }}>
      <div className="panel-heading"><div className="panel-title"><Icon name="truck" size={17}/><h2>Konfigurasi rute</h2></div><span className="eyebrow-badge">SIMULASI</span></div>
      <p className="config-intro">Satu kendaraan, beberapa tujuan, lalu kembali ke gudang.</p>
      <label className="field-label">GUDANG SIMULASI</label>
      <div className="warehouse-card"><span className="warehouse-icon"><Icon name="warehouse" size={18}/></span><div className="warehouse-copy"><strong>{warehouse?.name ?? 'Memuat lokasi…'}</strong><small>Titik referensi OSM · asal dan akhir</small></div></div>
      <fieldset className="location-fieldset" disabled={busy}>
        <legend className="field-label">TUJUAN WAJIB · PILIH MINIMAL SATU</legend>
        {locations.slice(1).map((point) => <label className="location-option" key={point.name}>
          <input type="checkbox" checked={selected.includes(point.name)} onChange={() => onSelect(point.name)}/>
          <span><strong>{point.name}</strong><small>{point.road_latitude.toFixed(5)}, {point.road_longitude.toFixed(5)}</small></span>
        </label>)}
      </fieldset>
      <div className="panel-divider"/>
      <label className="solver-field">Heuristik<select value={heuristic} onChange={(event) => onHeuristic(event.target.value)} disabled={busy}>
        <option value="mst">MST · batas bawah geometris</option><option value="zero">Tanpa heuristik · h = 0</option>
      </select></label>
      <p className="config-intro">f(q) = g(q) + h(q) · q = (node, tujuan dikunjungi)</p>
      <label className="solver-check"><input type="checkbox" checked={compare} onChange={(event) => onCompare(event.target.checked)} disabled={busy}/><span>Periksa dengan semua urutan kunjungan</span></label>
      <details className="scenario-details"><summary>Skenario penutupan jalan</summary><label className="solver-field">Ruas simulasi<select disabled={busy || !edgeOptions.length} value={closureEdge ? `${closureEdge.source}:${closureEdge.target}` : ''} onChange={(event) => onClosureEdge(event.target.value)}>{!edgeOptions.length && <option value="">Hitung rute terlebih dahulu</option>}{edgeOptions.map((edge) => <option key={`${edge.source}:${edge.target}`} value={`${edge.source}:${edge.target}`}>{edge.label}</option>)}</select></label><label className="solver-check"><input type="checkbox" checked={blocked.length > 0} onChange={(event) => onBlock(event.target.checked)} disabled={busy || !closureEdge || !canBlock && !blocked.length}/><span>Tutup ruas yang dipilih</span></label><p className="config-intro">{blocked.length ? `${blocked[0].source} → ${blocked[0].target} ditutup untuk simulasi berikutnya.` : 'Pilih ruas pada hasil terakhir, lalu aktifkan penutupannya. Arah sebaliknya tetap berlaku.'}</p></details>
      <button type="submit" className="primary-button" disabled={busy || !dataset || !selected.length}>{busy ? <><span className="spinner"/> Menghitung rute…</> : <><Icon name="route" size={17}/> Hitung rute</>}</button>
      <p className="config-intro" aria-live="polite">{!selected.length ? 'Pilih minimal satu tujuan.' : busy ? 'A* sedang dijalankan pada graf lokal. Hasil lama tetap tersimpan.' : dirty ? 'Konfigurasi belum dihitung.' : 'Hasil sesuai konfigurasi di atas.'}</p>
      <details className="scenario-details"><summary>Sumber dan validasi lokasi</summary><p className="config-intro">Lokasi adalah titik referensi permukiman OSM, bukan gudang/penerima yang sudah dikonfirmasi. Penanda peta berada pada node jalan yang dipakai algoritma.</p>{locations.map((point) => <p className="location-audit" key={point.name}><strong>{point.name}</strong> · {point.place_type}<br/>{point.display_name}<br/>Pergeseran ke jalan: {point.snap_distance_m.toFixed(1)} m</p>)}<p className="config-intro">Dataset {dataset?.version ?? '—'} · {dataset?.node_count.toLocaleString('id-ID') ?? '—'} node</p></details>
    </form>
  </aside>;
}
