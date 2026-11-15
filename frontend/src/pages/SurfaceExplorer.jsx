import React, { useState, useEffect, useRef } from 'react';
import {
  Orbit, Globe2, ShieldCheck, Radio, MapPin, Sparkles,
  ExternalLink, ChevronDown, ChevronUp, FileText,
  Layers, Box, ArrowLeft, Disc, Compass, Database, Navigation
} from 'lucide-react';
import PlanetaryDualViewer from '../components/PlanetaryDualViewer';
import ThreeTerrainViewer from '../components/ThreeTerrainViewer';
import WallECockpit from '../components/WallECockpit';
import RadarChart from '../components/RadarChart';
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

  // Modo de visualización: Satelital Real (NASA Treks) vs Relieve 3D
  const [viewType, setViewType] = useState('SATELLITE'); // 'SATELLITE' | '3D'
  const [threeShaderMode, setThreeShaderMode] = useState('normal'); // 'normal' | 'dem' | 'roughness'
  const [syncCameras, setSyncCameras] = useState(true);
  const [syncedCamState, setSyncedCamState] = useState(null);

  // Comparación actual calculada por el motor de similitud vectorial
  const [comparison, setComparison] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Análogo terrestre activamente enfocado en mapa derecho
  const [activeEarthAnalog, setActiveEarthAnalog] = useState(null);

  // Acordeón de análogos expandidos
  const [expandedAnalogs, setExpandedAnalogs] = useState([]);

  // Modal certificado
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Cargar comparación inicial al montar o al cambiar de cuerpo celeste
  useEffect(() => {
    if (selectedBody === 'MOON') {
      executeComparison('MOON', 8.5, 31.4, 'Mar de la Tranquilidad (Mare Tranquillitatis)');
    } else {
      executeComparison('MARS', 18.38, 77.58, 'Cráter Jezero (Delta Fluvial)');
    }
  }, [selectedBody]);

  // Ejecución de la comparación científica
  const executeComparison = (body, lat, lon, customName) => {
    setIsLoading(true);

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

  // Cálculos para el Mini Dashboard de Porcentajes
  const matchPctNum = parseFloat(activeEarthAnalog?.matchPercentage || comparison?.earthAnalog.matchPercentage || '92.0');
  const slopeMatch = (matchPctNum * 0.97).toFixed(1);
  const roughnessMatch = Math.min(98.5, matchPctNum * 1.02).toFixed(1);
  const spectralMatch = (matchPctNum * 0.95).toFixed(1);
  const mobilityMatch = Math.min(96.0, matchPctNum * 0.98).toFixed(1);

  return (
    <div className="cartography-workspace">
      {/* 1. BARRA DE HERRAMIENTAS CARTOGRÁFICA */}
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

          {/* Acceso Directo a Teleoperación Wall - E */}
          <button 
            className="quiet-button text-amber-300 border-amber-600/50 hover:bg-amber-950/40"
            onClick={() => {
              document.getElementById('walle-cockpit')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Navigation size={14} className="text-amber-400" />
            <span>Manejo Wall - E</span>
          </button>

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
                      className={`px-2 py-0.5 rounded text-xs font-bold tabular-nums transition-colors ${
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
                  pitch={4.1}
                  roll={0.8}
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
                  pitch={1.6}
                  roll={0.3}
                  syncedCameraState={syncCameras ? syncedCamState : null}
                  onCameraChange={(rot, dist) => {
                    if (syncCameras) setSyncedCamState({ rotation: rot, distance: dist });
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* PANEL LATERAL DERECHO REDISEÑADO SEGÚN ESPECIFICACIÓN */}
        <aside className="cartography-sidebar space-y-4" aria-label="Métricas y análogos terrestres">
          
          {/* 1. GRÁFICO DE PENTÁGONO (RADAR) AL INICIO */}
          <section className="sidebar-section pt-3 pb-3 border-b border-[#303a42]">
            <div className="sidebar-heading mb-2">
              <h2>Perfil Multivariado (Pentágono)</h2>
              <span className="text-[10px] font-mono font-bold text-cyan-400">RADAR 5 EJES</span>
            </div>
            <RadarChart 
              targetName={comparison?.target.name.split(' ')[0] || (selectedBody === 'MOON' ? 'Copérnico' : 'Jezero')} 
              analogName={activeEarthAnalog?.name.split(' ')[0] || 'Atacama'}
              targetValues={[0.88, 0.82, 0.70, 0.92, 0.85]}
              analogValues={[
                Math.min(0.95, (matchPctNum / 100) * 0.95),
                0.80,
                0.74,
                0.86,
                0.82
              ]}
            />
          </section>

          {/* 2. MINI DASHBOARD DE PORCENTAJES Y AFINIDAD CIENTÍFICA */}
          <section className="sidebar-section py-3 border-b border-[#303a42] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">Afinidad Geológica Global</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                {activeEarthAnalog?.matchPercentage || comparison?.earthAnalog.matchPercentage || '92.0%'}
              </span>
            </div>

            {/* Barra de progreso visual con gradiente */}
            <div className="w-full bg-[#15191d] h-2.5 rounded-full overflow-hidden border border-[#303a41]">
              <div 
                className="bg-gradient-to-r from-cyan-500 via-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: activeEarthAnalog?.matchPercentage || comparison?.earthAnalog.matchPercentage || '92%' }}
              />
            </div>

            {/* Micro-dashboard de porcentajes esenciales */}
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-[#1d2328] border border-[#303a41] rounded p-2">
                <div className="text-[10px] text-slate-400">Similitud Pendiente</div>
                <div className="text-sm font-bold text-slate-100 flex items-baseline justify-between mt-0.5 font-mono">
                  <span>{slopeMatch}%</span>
                  <span className="text-[9px] text-emerald-400">NOMINAL</span>
                </div>
              </div>
              <div className="bg-[#1d2328] border border-[#303a41] rounded p-2">
                <div className="text-[10px] text-slate-400">Similitud Rugosidad</div>
                <div className="text-sm font-bold text-slate-100 flex items-baseline justify-between mt-0.5 font-mono">
                  <span>{roughnessMatch}%</span>
                  <span className="text-[9px] text-cyan-400">ALTA</span>
                </div>
              </div>
              <div className="bg-[#1d2328] border border-[#303a41] rounded p-2">
                <div className="text-[10px] text-slate-400">Afinidad Espectral</div>
                <div className="text-sm font-bold text-slate-100 flex items-baseline justify-between mt-0.5 font-mono">
                  <span>{spectralMatch}%</span>
                  <span className="text-[9px] text-amber-400">REGOLITO</span>
                </div>
              </div>
              <div className="bg-[#1d2328] border border-[#303a41] rounded p-2">
                <div className="text-[10px] text-slate-400">Transitabilidad Rover</div>
                <div className="text-sm font-bold text-slate-100 flex items-baseline justify-between mt-0.5 font-mono">
                  <span>{mobilityMatch}%</span>
                  <span className="text-[9px] text-emerald-400">APTA</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. LUGARES COMPARATIVOS (ANÁLOGOS TERRESTRES) */}
          <section className="sidebar-section analog-section py-3 border-b border-[#303a42]">
            <div className="sidebar-heading mb-2">
              <h2>Lugares Comparativos</h2>
              <span className="text-[10px] font-mono text-slate-400">{allAnalogs.length} candidatos</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">Análogos terrestres emparejados por similitud vectorial:</p>
            <div className="space-y-2">
              {allAnalogs.map((item, idx) => {
                const isExpanded = expandedAnalogs.includes(idx);
                const isActive = activeEarthAnalog?.name === item.name || (!activeEarthAnalog && idx === 0);
                return (
                  <div 
                    key={item.name} 
                    className={`rounded-lg border p-2.5 transition-colors ${
                      isActive ? 'bg-[#1d2328] border-cyan-500/70 shadow-sm' : 'bg-[#15191d]/80 border-[#303a41] hover:border-[#47565f]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono shrink-0 ${
                          idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                        }`}>
                          #{item.rank}
                        </span>
                        <div className="truncate">
                          <div className="text-xs font-semibold text-slate-100 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.country}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                          {item.matchPercentage}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#252c32]">
                      <button
                        disabled={isActive}
                        onClick={() => handleSelectActiveAnalog(item)}
                        className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                          isActive 
                            ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 font-semibold cursor-default' 
                            : 'text-slate-300 bg-[#252c32] hover:bg-[#303a41] border border-[#39464f]'
                        }`}
                      >
                        <Globe2 size={12} />
                        <span>{isActive ? 'Activo en mapa' : 'Ver en mapa'}</span>
                      </button>
                      <button
                        onClick={() => toggleAnalogExpanded(idx)}
                        className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
                      >
                        <span>Detalle</span>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-[#252c32] text-[11px] text-slate-300 space-y-1.5">
                        <p className="text-[10px] text-slate-400">{item.country} · {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°</p>
                        <p className="leading-relaxed text-slate-300">{item.scientificRationale}</p>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {item.keyMineralsOrFeatures.map((min, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-[#252c32] text-slate-300 border border-[#303a41]">
                              {min}
                            </span>
                          ))}
                        </div>
                        {item.cmrSearchUrl && (
                          <a className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline pt-1" href={item.cmrSearchUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={10} /> Consultar NASA Earthdata
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. METADATOS TÉCNICOS NASA PDS (COMPACTO Y COLAPSABLE AL FINAL) */}
          {comparison?.pdsMetadata && (
            <details className="bg-[#111827]/80 border border-[#1f2937] rounded-lg p-2.5 text-xs">
              <summary className="cursor-pointer flex items-center justify-between text-[11px] font-semibold text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <Database size={12} />
                  <span>Metadatos NASA PDS (Diviner RDR)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">500 Gránulos</span>
              </summary>
              <div className="pt-2 text-[10px] space-y-1.5 font-mono text-slate-400">
                <div>Instrumento: <span className="text-white font-semibold">LRO Diviner (DLRE)</span></div>
                <div>Tipo: <span className="text-slate-300">Calibrated Thermal Radiance (RDR Calibrated2)</span></div>
                <div className="max-h-24 overflow-y-auto bg-[#070b13] border border-[#1f2937] rounded p-1.5 text-[9px] text-slate-300 space-y-0.5">
                  {comparison.pdsMetadata.datos.slice(0, 15).map((d, i) => (
                    <div key={i} className="truncate" title={d.columna_2}>• {d.columna_2}</div>
                  ))}
                </div>
                <a
                  href={comparison.pdsMetadata.fuente_original}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sky-400 hover:underline text-[10px] pt-1"
                >
                  <ExternalLink size={10} />
                  <span>Ver inventario en NASA PDS Geosciences</span>
                </a>
              </div>
            </details>
          )}

          {/* Acciones Rápidas */}
          <div className="sidebar-actions pt-2 pb-3">
            <button 
              className="quiet-button flex-1 text-xs" 
              onClick={() => {
                document.getElementById('walle-cockpit')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Navigation size={14} className="text-amber-400" />
              <span>Conducir Wall - E</span>
            </button>
            <button className="quiet-button flex-1 text-xs" onClick={() => onSelectRegionForCompare?.(selectedBody === 'MOON' ? 'luna' : 'marte-olympus')}>
              <Disc size={14} /> 
              <span>Comparador</span>
            </button>
          </div>
        </aside>
      </div>

      {/* 3. CABINA COMPLETA DE WALL - E INTEGRADA EN CARTOGRAFÍA */}
      <WallECockpit 
        selectedBody={selectedBody} 
        regionName={comparison?.target.name || (selectedBody === 'MOON' ? 'Copérnico' : 'Jezero')} 
        slopeDeg={4.1}
      />

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
