import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import Icon from '../common/Icon.jsx';

const warehouseIcon = L.divIcon({
  className: 'route-marker-shell',
  html: '<span class="route-marker warehouse-marker">W</span>',
  iconSize: [32, 40],
  iconAnchor: [16, 38],
  popupAnchor: [0, -34],
});
const destinationIcon = L.divIcon({
  className: 'route-marker-shell',
  html: '<span class="route-marker map-destination-marker">D</span>',
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -32],
});

function FitMapToData({ boundsPoints }) {
  const map = useMap();
  useEffect(() => {
    if (!boundsPoints.length) return undefined;
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      const bounds = L.latLngBounds(boundsPoints);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [map, boundsPoints]);
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
    {error ? 'Unable to load route map data.' : <><span className="spinner dark-spinner"/> Memuat data peta…</>}
  </div>;
}

export default function RouteMap({ locations, optimal, currentStep, loading = false, error = '' }) {
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState(false);
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

  return <section className="map-card" aria-label="Peta rute OpenStreetMap" data-route-node-count={optimal?.combined_path?.length ?? 0}>
    <div className="map-canvas">
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
        <FitMapToData boundsPoints={boundsPoints}/>
        <MapControls boundsPoints={boundsPoints}/>
        {warehouse && <Marker position={[warehouse.latitude, warehouse.longitude]} icon={warehouseIcon}>
          <Popup><strong>{warehouse.name}</strong><br/>Warehouse • titik awal dan kembali</Popup>
        </Marker>}
        {destinations.map((destination, index) => <Marker
          key={destination.name}
          position={[destination.latitude, destination.longitude]}
          icon={destinationIcon}
        >
          <Popup><strong>{destination.name}</strong><br/>Destination • tujuan distribusi #{index + 1}</Popup>
        </Marker>)}
        {routeCoordinates.length > 1 && <Polyline
          positions={routeCoordinates}
          pathOptions={{ color: '#15803d', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }}
        />}
        {currentStep && <CircleMarker center={[currentStep.latitude, currentStep.longitude]} radius={8} pathOptions={{ color: '#92400e', fillColor: '#fbbf24', fillOpacity: 1, weight: 2 }}><Popup>Ekspansi {currentStep.step} · node {currentStep.node} · mask {currentStep.mask}</Popup></CircleMarker>}
      </MapContainer> : <MapLoading error={mapError || (!loading && Boolean(error))}/>}

      {initialCenter && <>
        <div className="map-location"><span className="live-dot"/>{`Kabupaten Nganjuk [${warehouse.longitude.toFixed(3)}°, ${warehouse.latitude.toFixed(3)}°]`}</div>
        <div className="map-total"><Icon name="route" size={15}/><strong>{optimal ? `${(optimal.total_distance_m / 1000).toFixed(3)} km Total` : 'Rute belum tersedia'}</strong><span/>{optimal?.path_coordinates?.length ? 'Geometry jalan OSM' : 'Menunggu geometry rute'}</div>
        <div className="map-legend"><strong>LEGENDA PETA</strong><div><i className="legend-depot"/>Warehouse</div><div><i className="legend-destination"/>Destination</div><div><i className="legend-route"/>Rute optimal • OSM</div></div>
        {optimal && optimal.path_coordinates?.length < 2 && <div className="map-geometry-error" role="alert">Geometry rute belum tersedia dari backend.</div>}
        {tileError && <div className="map-tile-notice" role="status">Peta dasar belum termuat. Perhitungan graf dan garis rute tetap berasal dari data lokal.</div>}
      </>}
      {!mapReady && initialCenter && <div className="map-init-status" role="status">Memuat OpenStreetMap…</div>}
    </div>
  </section>;
}
