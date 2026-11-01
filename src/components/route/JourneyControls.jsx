import Icon from '../common/Icon.jsx';

export default function JourneyControls({ model, playback, disabled, busy, dirty, error }) {
  const frame = playback.frame;
  return <section className="journey-panel" aria-label="Simulasi perjalanan kendaraan">
    <div className="journey-heading"><div><h2>Perjalanan kendaraan</h2><p>Gudang adalah tempat bawang dimuat, kendaraan berangkat, dan kembali.</p></div><Icon name="truck" size={22}/></div>
    {!model ? <p className="journey-empty">{error || 'Tekan Hitung rute dahulu. Setelah itu, putar perjalanan pada Simulasi Node atau Simulasi Peta.'}</p> : <>
      <div className="journey-actions"><button className="journey-play" onClick={playback.toggle} disabled={disabled} aria-pressed={playback.playing}><Icon name="truck" size={16}/>{playback.playing ? 'Jeda perjalanan' : frame.finished ? 'Putar lagi' : playback.timeMs > 0 ? 'Lanjutkan perjalanan' : 'Mulai perjalanan'}</button><button className="journey-reset" onClick={playback.reset} disabled={disabled || playback.timeMs === 0}>Ulang dari gudang</button><label>Kecepatan animasi<select aria-label="Kecepatan animasi" value={playback.speed} onChange={(event) => playback.setSpeed(Number(event.target.value))} disabled={disabled}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div>
      <div className="journey-caption" role="status" aria-live="polite" aria-atomic="true"><strong>{frame.title}</strong><p>{frame.explanation}</p></div>
      <label className="journey-progress">Posisi perjalanan<input aria-label="Posisi perjalanan" type="range" min="0" max="1000" value={Math.round(frame.progress * 1000)} onChange={(event) => playback.seek(Number(event.target.value) / 1000)} disabled={disabled}/></label>
      <div className="journey-distance"><span>{Math.round(frame.progress * 100)}% animasi</span><span>{(frame.roadDistanceM / 1000).toFixed(3)} / {(model.totalDistanceM / 1000).toFixed(3)} km</span></div>
      <ol className="journey-stops" aria-label="Urutan perjalanan">{model.route.map((name, index) => <li key={`${index}-${name}`} className={index < frame.stopIndex || frame.phase === 'finished' ? 'done' : index === frame.stopIndex ? 'active' : ''}><span>{index < frame.stopIndex || frame.phase === 'finished' ? <Icon name="check" size={12}/> : index + 1}</span>{index === 0 ? `Gudang ${name}` : index === model.route.length - 1 ? `Kembali ${name}` : name}</li>)}</ol>
      <p className="journey-note">{disabled ? busy ? 'Perhitungan baru sedang berjalan; animasi dijeda.' : dirty ? 'Konfigurasi berubah. Hitung ulang untuk menjalankan perjalanan baru.' : 'Pilih mode Perjalanan kendaraan untuk memutar animasi.' : 'Gerakan dan jeda bongkar adalah ilustrasi, bukan waktu tempuh atau aktivitas lapangan sebenarnya.'}</p>
    </>}
  </section>;
}
