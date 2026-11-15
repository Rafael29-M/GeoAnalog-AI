import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Orbit, Globe2 } from 'lucide-react';

// Corrección de marcadores Leaflet en entornos bundler Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Iconos distintivos con pin espacial y terrestre
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      width: 22px; 
      height: 22px; 
      background: ${color}; 
      border: 2px solid #ffffff; 
      border-radius: 50% 50% 50% 0; 
      transform: rotate(-45deg); 
      box-shadow: 0 2px 4px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -22]
  });
};

const moonPin = createCustomIcon('#b9c6cc');
const marsPin = createCustomIcon('#bda085');
const earthPin = createCustomIcon('#a4b69d');

// Controlador de clics en el mapa extraterrestre
const PlanetaryMapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
    }
  });
  return null;
};

// Controlador para mover la cámara suavemente
const CameraFlyTo = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    const safeLat = Math.max(-78, Math.min(78, center[0]));
    map.setView([safeLat, center[1]], zoom, { animate: false });
  }, [center[0], center[1], zoom]);
  return null;
};

export const PlanetaryDualViewer = ({
  selectedBody = 'MOON',
  comparison = null,
  onMapClick,
  isLoading = false,
  activeEarthCoords,
  activeEarthName
}) => {
  const isMoon = selectedBody === 'MOON' || selectedBody === 'moon';

  // Configuración de capas oficiales de la NASA
  const moonTileUrl =
    'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
  const marsTileUrl =
    'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg';
  const earthTileUrl =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  const currentPlanetaryTile = isMoon ? moonTileUrl : marsTileUrl;
  const currentPin = isMoon ? moonPin : marsPin;

  // Si no hay comparación, usar coordenadas centrales e iluminadas por defecto
  const targetCoords = comparison
    ? [comparison.target.coordinates.latitude, comparison.target.coordinates.longitude]
    : isMoon
    ? [9.62, -20.08] // Cráter Copérnico
    : [18.38, 77.58]; // Cráter Jezero

  // Coordenadas del análogo terrestre activo
  const earthCoords = activeEarthCoords
    ? activeEarthCoords
    : comparison
    ? [comparison.earthAnalog.coordinates.latitude, comparison.earthAnalog.coordinates.longitude]
    : [35.0275, -111.0228]; // Meteor Crater default

  const safeTargetCenter = [
    Math.max(-78, Math.min(78, targetCoords[0])),
    targetCoords[1]
  ];

  return (
    <div className="dual-map-grid">
      {/* PANEL IZQUIERDO: LUNA O MARTE */}
      <div className="relative w-full h-full border-b lg:border-b-0 lg:border-r border-[#343d44] overflow-hidden">
        {/* Cabecera flotante */}
        <div className="map-caption">
          <Orbit size={15} color={isMoon ? '#b9c6cc' : '#bda085'} />
          <span className="text-slate-100 font-medium">
            {isMoon ? 'NASA Lunar Trek (LROC WAC)' : 'NASA Mars Trek (Viking/MOLA)'}
          </span>
          {isLoading && (
            <span className="text-amber-400 text-[11px]  font-mono">Buscando análogo...</span>
          )}
        </div>

        <MapContainer
          key={`planetary-${isMoon ? 'moon' : 'mars'}`}
          center={safeTargetCenter}
          zoom={3}
          minZoom={1}
          maxZoom={8}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', background: '#15191d' }}
        >
          <PlanetaryMapClickHandler onMapClick={onMapClick} />
          <CameraFlyTo center={safeTargetCenter} zoom={4} />

          <TileLayer
            attribution={
              isMoon
                ? 'NASA / GSFC / ASU / Lunar Trek'
                : 'NASA / JPL-Caltech / USGS / Mars Trek'
            }
            url={currentPlanetaryTile}
            noWrap={false}
          />

          <Marker position={targetCoords} icon={currentPin}>
            <Popup>
              <div className="text-slate-900 text-xs font-sans">
                <strong className="block font-bold text-sm mb-0.5">{comparison?.target.name || 'Punto Seleccionado'}</strong>
                <div className="font-mono text-slate-700">Lat: {targetCoords[0]}°, Lon: {targetCoords[1]}°</div>
                {comparison && <div className="text-slate-600 mt-1">Tipo: <code className="bg-slate-200 px-1 py-0.5 rounded">{comparison.target.terrainType}</code></div>}
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Badge inferior interactivo */}
        <div className="map-hint">
          
          <span>Selecciona un punto del mapa para buscar terrenos similares.</span>
        </div>
      </div>

      {/* PANEL DERECHO: TIERRA (ANÁLOGO) */}
      <div className="relative w-full h-full overflow-hidden">
        {/* Cabecera flotante */}
        <div className="map-caption">
          <Globe2 size={15} className="text-emerald-400" />
          <span className="text-slate-100 font-medium">
            Tierra · {activeEarthName || comparison?.earthAnalog.name || 'Meteor Crater / Salar de Atacama'}
          </span>

        </div>

        <MapContainer
          center={earthCoords}
          zoom={11}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%', background: '#15191d' }}
        >
          <CameraFlyTo center={earthCoords} zoom={11} />

          <TileLayer
            attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics & NASA"
            url={earthTileUrl}
          />

          <Marker position={earthCoords} icon={earthPin}>
            <Popup>
              <div className="text-slate-900 text-xs font-sans">
                <strong className="block font-bold text-sm mb-0.5">{comparison?.earthAnalog.name || 'Análogo Terrestre'}</strong>
                <div className="text-slate-700">{comparison?.earthAnalog.country}</div>
                <div className="font-mono text-slate-700">Lat: {earthCoords[0]}°, Lon: {earthCoords[1]}°</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default PlanetaryDualViewer;
