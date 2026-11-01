import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../common/Icon.jsx';
import JourneyControls from './JourneyControls.jsx';
import NodeSimulation from './NodeSimulation.jsx';
import { createJourneyModel } from '../../simulation/routeJourney.js';
import useJourneyPlayback from '../../simulation/useJourneyPlayback.js';

const warehouseIcon = L.divIcon({
  className: 'route-marker-shell',
  html: '<span class="route-marker warehouse-marker">G</span>',
  iconSize: [32, 40],
  iconAnchor: [16, 38],
  popupAnchor: [0, -34],
});
const destinationIcon = L.divIcon({
  className: 'route-marker-shell',
  html: '<span class="route-marker map-destination-marker">T</span>',
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -32],
});

const vehicleIcon = L.divIcon({
  className: 'journey-vehicle-shell',
  html: '<span class="journey-vehicle"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="17.5" cy="19" r="1.5"/></svg></span>',
  iconSize: [38,38], iconAnchor: [19,19], popupAnchor: [0,-22],
});

function FitMapToData({ boundsPoints, active }) {
  const map = useMap();
  useEffect(() => {
    if (!active || !boundsPoints.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      const bounds = L.latLngBounds(boundsPoints);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, boundsPoints, active]);
  return null;
}

function MapControls({ boundsPoints }) {
  const map = useMap();
  const fitRoute = () => {
    if (!boundsPoints.length) return;
    const bounds = L.latLngBounds(boundsPoints);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
  };
  return <div className="map-zoom" aria-label="Kontrol peta">
    <button onClick={() => map.zoomIn()} aria-label="Perbesar peta"><Icon name="plus" size={16}/></button>
    <button onClick={() => map.zoomOut()} aria-label="Perkecil peta"><Icon name="minus" size={16}/></button>
    <button onClick={fitRoute} aria-label="Tampilkan seluruh rute"><Icon name="target" size={15}/></button>
  </div>;
}

function MapLoading({ error }) {
  return <div className={`map-state ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
    {error ? 'Data peta belum berhasil dimuat.' : <><span className="spinner dark-spinner"/> Memuat data peta…</>}
  </div>;
}

export default function RouteMap({ locations, optimal, currentStep, loading = false, error = '', busy = false, dirty = false }) {
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [mode, setMode] = useState('search');
  const [view, setView] = useState('node');
  const warehouse = locations?.warehouse;
  const destinations = locations?.destinations ?? [];
  const routeCoordinates = useMemo(
    () => (optimal?.path_coordinates ?? [])
      .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
      .map((point) => [point.latitude, point.longitude]),
    [optimal?.path_coordinates],
  );
  const locationPoints = useMemo(() => [
    ...(warehouse ? [[warehouse.latitude, warehouse.longitude]] : []),
    ...destinations.map((destination) => [destination.latitude, destination.longitude]),
  ].filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude)), [warehouse, destinations]);
  const boundsPoints = useMemo(() => [...routeCoordinates, ...locationPoints], [routeCoordinates, locationPoints]);
  const initialCenter = warehouse ? [warehouse.latitude, warehouse.longitude] : null;
  const mapError = Boolean(error) && !locations;
  const journey = useMemo(() => {
    if (!optimal || !locations) return { model: null, error: '' };
    try {
      return { model: createJourneyModel({ coordinates: routeCoordinates, route: optimal.route, legs: optimal.legs,
        stops: [locations.warehouse, ...locations.destinations] }), error: '' };
    } catch (cause) { return { model: null, error: cause.message }; }
  }, [optimal, locations, routeCoordinates]);
  const playback = useJourneyPlayback(journey.model, mode === 'journey' && !busy && !dirty);
  const startLine = useMemo(() => journey.model ? [journey.model.coordinates[0],journey.model.coordinates[0]] : [], [journey.model]);

  return <section className="map-card simulation-panel" aria-label="Simulasi rute node dan peta" data-route-node-count={optimal?.combined_path?.length ?? 0}>
    <div className="simulation-kind" role="group" aria-label="Jenis simulasi"><button aria-pressed={view === 'node'} onClick={() => setView('node')}><Icon name="nodes" size={17}/> Simulasi Node</button><button aria-pressed={view === 'map'} onClick={() => setView('map')}><Icon name="pin" size={17}/> Simulasi Peta</button></div>
    <div className="map-view-tabs" role="group" aria-label="Tampilan simulasi"><button aria-pressed={mode === 'search'} onClick={() => setMode('search')}>{view === 'node' ? 'Pelajari pencarian A*' : 'Proses pencarian A*'}</button><button aria-pressed={mode === 'journey'} onClick={() => setMode('journey')}>Perjalanan kendaraan</button></div>
    <div className="node-view" hidden={view !== 'node'}><NodeSimulation key={optimal?.run_id ?? 'empty'} optimal={optimal} playback={playback} mode={mode} disabled={busy || dirty || view !== 'node'}/></div>
    <div className="map-canvas" hidden={view !== 'map'}>
      {initialCenter ? <MapContainer
        center={initialCenter}
        zoom={11}
        scrollWheelZoom
        zoomControl={false}
        className="route-leaflet-map"
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <FitMapToData boundsPoints={boundsPoints} active={view === 'map'}/>
        <MapControls boundsPoints={boundsPoints}/>
        {warehouse && <Marker position={[warehouse.latitude, warehouse.longitude]} icon={warehouseIcon}>
          <Tooltip permanent direction="bottom" offset={[0,3]}>Gudang {warehouse.name}</Tooltip>
          <Popup><strong>Gudang {warehouse.name}</strong><br/>Tempat kendaraan memuat bawang, berangkat, dan kembali. Disebut juga depot.</Popup>
        </Marker>}
        {destinations.map((destination, index) => <Marker
          key={destination.name}
          position={[destination.latitude, destination.longitude]}
          icon={destinationIcon}
        >
          <Tooltip permanent direction="bottom" offset={[0,3]}>{destination.name}{destination.postal_code ? ` (${destination.postal_code})` : ''}</Tooltip>
          <Popup><strong>{destination.name}</strong>{destination.reference_label && <><br/>{destination.reference_label}</>}{destination.postal_code && <><br/>Kode pos {destination.postal_code}</>}<br/>Titik simulasi · tujuan #{index + 1}</Popup>
        </Marker>)}
        {routeCoordinates.length > 1 && <Polyline
          positions={routeCoordinates}
          pathOptions={{ color: mode === 'journey' ? '#789b85' : '#15803d', weight: 4, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
        />}
        {journey.model && mode === 'journey' && <>
          <Polyline ref={playback.trailRef} positions={startLine} pathOptions={{color:'#15803d',weight:6,opacity:1}}/>
          <Marker ref={playback.markerRef} position={journey.model.coordinates[0]} icon={vehicleIcon} zIndexOffset={1200} title="Kendaraan simulasi" alt="Kendaraan simulasi pengiriman bawang"><Popup>Kendaraan pengiriman bawang mengikuti rute yang telah dihitung.</Popup></Marker>
        </>}
        {currentStep && mode === 'search' && <CircleMarker center={[currentStep.latitude, currentStep.longitude]} radius={8} pathOptions={{ color: '#92400e', fillColor: '#fbbf24', fillOpacity: 1, weight: 2 }}><Popup>Ekspansi {currentStep.step} · node {currentStep.node} · mask {currentStep.mask}</Popup></CircleMarker>}
      </MapContainer> : <MapLoading error={mapError || (!loading && Boolean(error))}/>}

      {initialCenter && <>
        <div className="map-location"><span className="live-dot"/>Simulasi distribusi · Nganjuk</div>
        <div className="map-total"><Icon name="route" size={15}/><strong>{optimal ? `${(optimal.total_distance_m / 1000).toFixed(3)} km Total` : 'Rute belum tersedia'}</strong><span/>{optimal?.path_coordinates?.length ? 'Jaringan jalan OSM' : 'Hitung rute terlebih dahulu'}</div>
        <div className="map-legend"><strong>LEGENDA PETA</strong><div><i className="legend-depot"/>Gudang / depot</div><div><i className="legend-destination"/>Tujuan pengiriman</div><div><i className="legend-route"/>Rute yang dihitung</div>{mode === 'journey' && journey.model && <div><i className="legend-vehicle"/>Kendaraan simulasi</div>}{mode === 'search' && <div><i className="legend-search"/>State pencarian A*</div>}</div>
        {optimal && optimal.path_coordinates?.length < 2 && <div className="map-geometry-error" role="alert">Geometry rute belum tersedia dari backend.</div>}
        {tileError && <div className="map-tile-notice" role="status">Peta dasar belum termuat. Perhitungan graf dan garis rute tetap berasal dari data lokal.</div>}
      </>}
      {!mapReady && initialCenter && <div className="map-init-status" role="status">Memuat OpenStreetMap…</div>}
    </div>
    <div hidden={mode !== 'journey'}><JourneyControls model={journey.model} playback={playback} disabled={mode !== 'journey' || busy || dirty} busy={busy} dirty={dirty} error={journey.error}/></div>
    <details className="journey-guide"><summary>Cara membaca simulasi</summary><ol><li><strong>Hitung rute.</strong> A* multi-tujuan menentukan perjalanan yang mengunjungi semua tujuan dan kembali ke gudang.</li><li><strong>Pelajari ruas pada Simulasi Node.</strong> Setiap ruas menampilkan 2–4 node perantara dan beberapa koridor jalan OSM. Mulai dari OPEN, periksa g, h, f, lalu lihat jalur hasil setelah tujuan tercapai. Ini pelajaran satu ruas, terpisah dari trace multi-tujuan di bawah.</li><li><strong>Putar perjalanan.</strong> Pilih Perjalanan kendaraan. Node menunjukkan kendaraan melewati simpang yang diringkas; Peta mengikuti geometri jalan. Keduanya memakai waktu animasi yang sama.</li><li><strong>Periksa graf penuh.</strong> Pada Simulasi Peta, pilih Proses pencarian A*, lalu putar log multi-tujuan di bagian bawah untuk melihat ekspansi pada graf jalan penuh.</li></ol></details>
  </section>;
}
