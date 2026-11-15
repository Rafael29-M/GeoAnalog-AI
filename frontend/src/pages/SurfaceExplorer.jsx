import React, { useState, useEffect, useRef } from 'react';
import {
  Orbit, Globe2, ShieldCheck, Radio, MapPin, Sparkles,
  ExternalLink, ChevronDown, ChevronUp, FileText,
  Layers, Box, ArrowLeft, Disc, Compass, Database
} from 'lucide-react';
import PlanetaryDualViewer from '../components/PlanetaryDualViewer';
import ThreeTerrainViewer from '../components/ThreeTerrainViewer';
import RoverHUD from '../components/RoverHUD';
import RadarChart from '../components/RadarChart';
import ESP32Modal from '../components/ESP32Modal';
import CertificateModal from '../components/CertificateModal';
import serialManager from '../utils/serialManager';
import {
  MOON_FEATURES,
  MARS_FEATURES,
  computeComparison,
  identifyPlanetaryPoint
} from '../services/planetaryService';

export default function SurfaceExplorer({
  planet = 'moon',
  onBack,
  onSelectRegionForCompare,
  onSelectRegionForRover,
  regions = [],
  summaryData = []
}) {
  // Cuerpo activo ('MOON' | 'MARS')
  const initialBody = (planet === 'mars' || planet === 'MARS') ? 'MARS' : 'MOON';
  const [selectedBody, setSelectedBody] = useState(initialBody);

  // Sincronizar si cambia el prop planet
  useEffect(() => {
    const nextBody = (planet === 'mars' || planet === 'MARS') ? 'MARS' : 'MOON';
    if (nextBody !== selectedBody) {
      setSelectedBody(nextBody);
    }
  }, [planet]);

  // Modo de visualización: Satelital Real (NASA Treks) vs Gemelo 3D Procedural
  const [viewType, setViewType] = useState('SATELLITE'); // 'SATELLITE' | '3D'
  const [threeShaderMode, setThreeShaderMode] = useState('normal'); // 'normal' | 'dem' | 'roughness'
  const [syncCameras, setSyncCameras] = useState(true);
  const [syncedCamState, setSyncedCamState] = useState(null);

  // Comparación actual calculada por el motor de similitud vectorial
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Análogo terrestre activamente enfocado en mapa derecho
  const [activeEarthAnalog, setActiveEarthAnalog] = useState(null);

  // Acordeón de análogos expandidos (índice 0 expandido por defecto)
  const [expandedAnalogs, setExpandedAnalogs] = useState([0]);

  // Modales
  const [isEsp32ModalOpen, setIsEsp32ModalOpen] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Telemetría 10Hz del Rover
  const [telemetry, setTelemetry] = useState({
    pitch: 18.5,
    roll: 2.1,
    radiation: 0.385,
    temperature: 24.2,
    humidity: 48.0,
    distance_cm: 115.0,
    obstacle_alert: 'CLEAR',
    battery: 92,
    speed: 0.18,
    rpm: 120,
    voltage: 24.8,
    current: 11.6,
    power: 408,
    torque: 14.2,
    slipMoon: 27.1,
    slipAtacama: 8.7,
    tractionRisk: 18.4,
    source: 'SIM_PYTHON_TWIN',
    timestamp: new Date().toISOString()
  });

  // Terminal ROS 2 stream
  const [logs, setLogs] = useState([
    { id: '1', timestamp: '10:04:12.102', level: 'INFO', message: 'ros2_bridge linked to core telemetry node (10Hz)' },
    { id: '2', timestamp: '10:04:12.185', level: 'SYNC', message: 'WMTS NASA Treks tile projection matrix active' },
    { id: '3', timestamp: '10:04:12.240', level: 'ANALOG', message: 'Vector Similarity Engine online (k-NN Cosine metric)' },
    { id: '4', timestamp: '10:04:12.312', level: 'SYS', message: 'Mission Ground Control system nominal' }
  ]);

  // Suscripción al enlace hardware ESP32
  useEffect(() => {
    const unsubscribe = serialManager.subscribe((data) => {
      setTelemetry((prev) => ({
        ...prev,
        ...data,
        source: 'HARDWARE_ESP32'
      }));
    });
    return unsubscribe;
  }, []);

  // Cargar comparación inicial al montar o al cambiar de cuerpo celeste
  useEffect(() => {
    if (selectedBody === 'MOON') {
      executeComparison('MOON', 8.5, 31.4, 'Mar de la Tranquilidad (Mare Tranquillitatis)');
    } else {
      executeComparison('MARS', 18.38, 77.58, 'Cráter Jezero (Delta Fluvial)');
    }
  }, [selectedBody]);

  // Simulación dinámica de telemetría (fluctuación suave en reposo/marcha)
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        if (prev.source === 'HARDWARE_ESP32') return prev; // No sobreescribir datos reales de hardware
        const speedDelta = (Math.random() - 0.5) * 0.04;
        const newSpeed = Math.max(0.12, Math.min(0.25, prev.speed + speedDelta));
        const newRpm = Math.round(newSpeed * 650);
        const slipDelta = (Math.random() - 0.5) * 0.4;
        const newSlipMoon = Math.max(22, Math.min(38, Number((prev.slipMoon + slipDelta).toFixed(1))));
        const newTemp = Number((24.0 + Math.sin(Date.now() * 0.001) * 1.2).toFixed(1));
        const newHum = Number((48.0 + Math.cos(Date.now() * 0.0008) * 3.0).toFixed(1));
        const distDelta = (Math.random() - 0.5) * 12;
        const newDist = Math.max(18, Math.min(220, Number(((prev.distance_cm || 115) + distDelta).toFixed(1))));
        const newAlert = newDist < 25 ? 'CRITICAL_BRAKE' : newDist < 50 ? 'WARNING_PROXIMITY' : 'CLEAR';
        const newRad = Number((0.380 + (Math.random() - 0.5) * 0.015).toFixed(3));
        const newPower = Math.round(newSpeed * 2200);

        return {
          ...prev,
          speed: Number(newSpeed.toFixed(2)),
          rpm: newRpm,
          slipMoon: newSlipMoon,
          temperature: newTemp,
          humidity: newHum,
          distance_cm: newDist,
          obstacle_alert: newAlert,
          radiation: newRad,
          power: newPower,
          current: Number((newPower / prev.voltage).toFixed(1)),
          timestamp: new Date().toISOString()
        };
      });
    }, 1200);

    return () => clearInterval(interval);
  }, []);

  // Ejecución de la comparación científica
  const executeComparison = (body, lat, lon, customName) => {
    setIsLoading(true);

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 900 + 100);

    setLogs((prev) => [
      ...prev.slice(-30),
      {
        id: Math.random().toString(),
        timestamp: timeStr,
        level: 'INFO',
        message: `Coordenada: [${lat > 0 ? '+' : ''}${lat.toFixed(2)}°, ${lon > 0 ? '+' : ''}${lon.toFixed(2)}°] ➔ IA calculando análogos...`
      }
    ]);

    try {
      const res = computeComparison(body, lat, lon, customName);
      setComparison(res);

      const best = res.earthAnalog;
      setActiveEarthAnalog({
        name: best.name,
        country: best.country,
        coords: [best.coordinates.latitude, best.coordinates.longitude],
        matchPercentage: best.matchPercentage
      });

      setExpandedAnalogs([0]);

      const resTime = new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 900 + 100);
      setLogs((prev) => [
        ...prev.slice(-30),
        {
          id: Math.random().toString(),
          timestamp: resTime,
          level: 'ANALOG',
          message: `Target: ${res.target.name} ➔ Análogo: ${best.name} [${best.matchPercentage} MATCH]`
        }
      ]);
    } catch (err) {
      console.error('Error calculando análogos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = (lat, lon) => {
    executeComparison(selectedBody, lat, lon);
  };

  const handleSelectFeature = (feat) => {
    executeComparison(selectedBody, feat.latitude, feat.longitude, feat.name);
  };

  const handleSelectActiveAnalog = (analog) => {
    setActiveEarthAnalog({
      name: analog.name,
      country: analog.country,
      coords: [analog.latitude, analog.longitude],
      matchPercentage: analog.matchPercentage
    });
  };

  const toggleAnalogExpanded = (idx) => {
    setExpandedAnalogs((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const currentFeatures = selectedBody === 'MOON' ? MOON_FEATURES : MARS_FEATURES;

  // Lista unificada de análogos para el Vector Similarity Engine
  const allAnalogs = comparison
    ? [
        {
          rank: 1,
          name: comparison.earthAnalog.name,
          country: comparison.earthAnalog.country,
          latitude: comparison.earthAnalog.coordinates.latitude,
          longitude: comparison.earthAnalog.coordinates.longitude,
          matchPercentage: comparison.earthAnalog.matchPercentage,
          scientificRationale: comparison.earthAnalog.scientificRationale,
          keyMineralsOrFeatures: comparison.earthAnalog.keyMineralsOrFeatures,
          cmrSearchUrl: comparison.earthAnalog.cmrSearchUrl,
          nasaEarthdataCollection: comparison.earthAnalog.nasaEarthdataCollection
        },
        ...(comparison.alternativeEarthAnalogs || []).map((alt, i) => ({
          rank: i + 2,
          name: alt.name,
          country: alt.country,
          latitude: alt.latitude,
          longitude: alt.longitude,
          matchPercentage: alt.matchPercentage,
          scientificRationale: alt.scientificRationale || 'Análogo geológico terrestre reconocido por la NASA para calibración.',
          keyMineralsOrFeatures: alt.keyMineralsOrFeatures || ['Regolito análogo', 'Similitud espectral'],
          cmrSearchUrl: alt.cmrSearchUrl,
          nasaEarthdataCollection: alt.nasaEarthdataCollection || 'C2105092163-LAADS'
        }))
      ]
    : [];

  return (
    <div className="cartography-workspace">
      <header className="cartography-toolbar">
        <div className="cartography-location">
          <button className="quiet-button" onClick={onBack}><ArrowLeft size={16} /><span>Astros</span></button>
          <label className="location-select">
            <span>Región de estudio</span>
            <select value={comparison?.target.name || ''} onChange={(e) => {
              const found = currentFeatures.find(f => f.name === e.target.value);
              if (found) handleSelectFeature(found);
            }}>
              {!currentFeatures.some(f => f.name === comparison?.target.name) && <option value={comparison?.target.name || ''}>{comparison?.target.name || 'Seleccionar región'}</option>}
              {currentFeatures.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
          </label>
          <div className="segmented-control" role="group" aria-label="Astro">
            <button aria-pressed={selectedBody === 'MOON'} onClick={() => setSelectedBody('MOON')}>Luna</button>
            <button aria-pressed={selectedBody === 'MARS'} onClick={() => setSelectedBody('MARS')}>Marte</button>
          </div>
        </div>
        <div className="cartography-tools">
          <div className="segmented-control" role="group" aria-label="Tipo de vista">
            <button aria-pressed={viewType === 'SATELLITE'} onClick={() => setViewType('SATELLITE')}><Layers size={14} /> Satélite</button>
            <button aria-pressed={viewType === '3D'} onClick={() => setViewType('3D')}><Box size={14} /> Relieve 3D</button>
          </div>
          <label className="source-select"><span>Telemetría</span>
            <select value={telemetry.source} onChange={e => setTelemetry(prev => ({...prev, source:e.target.value}))}>
              <option value="SIM_PYTHON_TWIN">Simulador</option><option value="HARDWARE_ESP32">ESP32</option>
            </select>
          </label>
          <button className="quiet-button" onClick={() => setIsEsp32ModalOpen(true)}><Radio size={15} /> Configurar ESP32</button>
          <button className="report-button" onClick={() => setIsCertModalOpen(true)}><FileText size={15} /> Crear reporte</button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: VISOR LADO A LADO + PANEL LATERAL DERECHO */}
      <div className="cartography-layout">
        {/* VISOR PRINCIPAL (DUAL LEAFLET O DUAL THREE.JS) */}
        <div className="cartography-map-stage">
          {viewType === 'SATELLITE' ? (
            <PlanetaryDualViewer
              selectedBody={selectedBody}
              comparison={comparison}
              onMapClick={handleMapClick}
              isLoading={isLoading}
              activeEarthCoords={activeEarthAnalog?.coords}
              activeEarthName={activeEarthAnalog?.name}
            />
          ) : (
            <div className="dual-map-grid relative">
              {/* Controles 3D flotantes */}
              <div className="absolute bottom-4 right-4 left-4 z-20 flex flex-wrap justify-end items-center gap-2">
                <button
                  aria-pressed={syncCameras}
                  onClick={() => setSyncCameras(!syncCameras)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-colors backdrop-blur-md ${
                    syncCameras
                      ? 'bg-emerald-600/90 text-slate-950 border-emerald-400'
                      : 'bg-slate-800/85 text-slate-300 border-[#374151]'
                  }`}
                >
                  Cámaras vinculadas: {syncCameras ? 'ON' : 'OFF'}
                </button>

                <div className="flex bg-[#111827]/90 rounded-md p-0.5 border border-[#374151] backdrop-blur-md">
                  {['normal', 'dem', 'roughness'].map((m) => (
                    <button
                      key={m}
                      aria-pressed={threeShaderMode === m}
                      onClick={() => setThreeShaderMode(m)}
                      className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums  transition-colors ${
                        threeShaderMode === m
                          ? 'bg-slate-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'dem' ? 'DEM' : m === 'roughness' ? 'Rugosidad' : 'Normal'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3D Terreno 1: Luna o Marte */}
              <div className="relative w-full h-full border-b lg:border-b-0 lg:border-r border-[#1f2937]">
                <ThreeTerrainViewer
                  type={selectedBody}
                  title={`${comparison?.target.name || (selectedBody === 'MOON' ? 'Copérnico' : 'Jezero')}`}
                  subtitle={`${selectedBody} • g=${selectedBody === 'MOON' ? '1.62' : '3.72'} m/s²`}
                  beaconText={`TARGET • ${comparison?.target.coordinates.latitude.toFixed(2) || '9.62'}°`}
                  viewMode={threeShaderMode}
                  pitch={telemetry.pitch}
                  roll={telemetry.roll}
                  syncedCameraState={syncCameras ? syncedCamState : null}
                  onCameraChange={(rot, dist) => {
                    if (syncCameras) setSyncedCamState({ rotation: rot, distance: dist });
                  }}
                />
              </div>

              {/* 3D Terreno 2: Tierra Análogo */}
              <div className="relative w-full h-full">
                <ThreeTerrainViewer
                  type="EARTH"
                  title={`${activeEarthAnalog?.name || comparison?.earthAnalog.name || 'Salar de Atacama'}`}
                  subtitle={`${activeEarthAnalog?.country || comparison?.earthAnalog.country || 'Tierra'} • ${activeEarthAnalog?.matchPercentage || comparison?.earthAnalog.matchPercentage || '92.0%'} de afinidad`}
                  beaconText={`ANALOG • ${activeEarthAnalog?.coords ? activeEarthAnalog.coords[0].toFixed(2) : '-23.86'}°`}
                  viewMode={threeShaderMode}
                  pitch={telemetry.pitch * 0.4}
                  roll={telemetry.roll * 0.4}
                  syncedCameraState={syncCameras ? syncedCamState : null}
                  onCameraChange={(rot, dist) => {
                    if (syncCameras) setSyncedCamState({ rotation: rot, distance: dist });
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <aside className="cartography-sidebar" aria-label="Regiones y análogos terrestres">
          <section className="sidebar-section">
            <div className="sidebar-heading"><h2>Explorar {selectedBody === 'MOON' ? 'la Luna' : 'Marte'}</h2><Compass size={16} /></div>
            <div className="feature-list">
              {currentFeatures.map(feat => <button key={feat.id}
                aria-pressed={Boolean(comparison?.target.name.includes(feat.name))}
                onClick={() => handleSelectFeature(feat)}>
                {feat.name.split(' (')[0].replace('Cráter ', '')}
              </button>)}
            </div>
          </section>
          <section className="sidebar-section analog-section">
            <div className="sidebar-heading"><h2>Análogos terrestres</h2><span>{allAnalogs.length} sitios</span></div>
            <p className="sidebar-description">Afinidad del terreno con regiones de la Tierra.</p>
            <div className="analog-list">
              {allAnalogs.map((item, idx) => {
                const isExpanded = expandedAnalogs.includes(idx);
                const isActive = activeEarthAnalog?.name === item.name || (!activeEarthAnalog && idx === 0);
                return <article key={item.name} className={'analog-entry' + (isActive ? ' is-active' : '')}>
                  <button className="analog-toggle" aria-expanded={isExpanded} aria-controls={'analog-detail-' + idx} onClick={() => toggleAnalogExpanded(idx)}>
                    <span className="analog-rank">{item.rank}</span>
                    <span className="analog-title">{item.name}<small>{isActive ? 'Visible en el mapa' : item.country}</small></span>
                    <span className="analog-score">{item.matchPercentage}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {isExpanded && <div className="analog-detail" id={'analog-detail-' + idx}>
                    <p className="analog-coordinates">{item.country} · {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°</p>
                    <p>{item.scientificRationale}</p>
                    <div className="mineral-tags">{item.keyMineralsOrFeatures.map((min, i) => <span key={i}>{min}</span>)}</div>
                    {item.cmrSearchUrl && <a className="source-link" href={item.cmrSearchUrl} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Consultar NASA Earthdata</a>}
                    <button className="analog-map-action" disabled={isActive} onClick={() => handleSelectActiveAnalog(item)}><Globe2 size={14} />{isActive ? 'Mostrando en el mapa' : 'Ver en el mapa'}</button>
                  </div>}
                </article>;
              })}
            </div>
          </section>
          {/* SECCIÓN: METADATOS CIENTÍFICOS NASA PDS / DIVINER RDR */}
          {comparison?.pdsMetadata && (
            <section className="bg-[#111827]/85 border border-[#1f2937] rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-extrabold tracking-wider">
                  <Database size={12} />
                  <span>METADATOS NASA PDS (DIVINER RDR)</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono font-bold">500 Gránulos</span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono mb-1">
                Instrumento: <span className="text-white font-semibold">LRO Diviner (DLRE)</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mb-2">
                Tipo: <span className="text-slate-300">Calibrated Thermal Radiance (RDR Calibrated2)</span>
              </div>
              <div className="space-y-1.5">
                <div className="text-[10px] text-slate-400 font-mono">
                  Muestra de Gránulos Calibrados (PDS4 URN):
                </div>
                <div className="max-h-24 overflow-y-auto bg-[#070b13] border border-[#1f2937] rounded p-1.5 font-mono text-[9px] text-slate-300 space-y-1 select-all">
                  {comparison.pdsMetadata.datos.map((d, i) => (
                    <div key={i} className="truncate hover:text-cyan-300 transition-colors" title={d.columna_2}>
                      • {d.columna_2}
                    </div>
                  ))}
                </div>
                <a
                  href={comparison.pdsMetadata.fuente_original}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 text-[10px] font-mono mt-1"
                >
                  <ExternalLink size={10} />
                  <span>Ver inventario oficial en NASA PDS Geosciences</span>
                </a>
              </div>
            </section>
          )}

          <section className="sidebar-section">
            <RadarChart targetName={comparison?.target.name.split(' ')[0] || 'Región'} analogName={activeEarthAnalog?.name.split(' ')[0] || 'Análogo'} />
          </section>
          <div className="sidebar-actions">
            <button className="quiet-button" onClick={() => onSelectRegionForCompare?.(selectedBody === 'MOON' ? 'luna' : 'marte-olympus')}><Disc size={15} /> Comparador</button>
            <button className="quiet-button" onClick={() => onSelectRegionForRover?.(selectedBody === 'MOON' ? 'luna' : 'marte-olympus')}><Radio size={15} /> Explorar con Wall - E</button>
          </div>
        </aside>
      </div>

      {/* 3. ROVER COCKPIT HUD (TELEMETRÍA EN VIVO Y TERMINAL ROS STREAM) */}
      <RoverHUD telemetry={telemetry} logs={logs} />

      {/* MODAL CONFIGURACIÓN ESP32 */}
      {isEsp32ModalOpen && (
        <ESP32Modal
          onClose={() => setIsEsp32ModalOpen(false)}
          telemetry={telemetry}
          onSelectSource={(source) => setTelemetry((prev) => ({ ...prev, source }))}
          onTelemetryUpdate={(data) => setTelemetry((prev) => ({ ...prev, ...data, source: 'HARDWARE_ESP32' }))}
        />
      )}

      {/* MODAL CERTIFICADO DE FIDELIDAD & COSTES AHORRADOS */}
      {isCertModalOpen && (
        <CertificateModal
          onClose={() => setIsCertModalOpen(false)}
          comparison={comparison}
          selectedBody={selectedBody}
        />
      )}
    </div>
  );
}
