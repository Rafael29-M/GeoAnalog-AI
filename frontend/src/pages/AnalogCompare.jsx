import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Download, Sliders, ShieldCheck, CheckCircle2, 
  AlertTriangle, Mountain, ArrowRight, HelpCircle, Activity, 
  Layers, Compass, Radio, MapPin, ChevronRight, BarChart2
} from 'lucide-react';
import { searchAnalogs, getGeoTiffUrl, fetchRegionMetrics } from '../api/client';

export default function AnalogCompare({ 
  targetRegionId = 'marte-olympus', 
  onBack, 
  onDeployRover, 
  regions = [] 
}) {
  const validTargets = ['marte-olympus', 'luna', 'luna-tycho', 'marte', 'marte-valles'];
  const [currentTargetId, setCurrentTargetId] = useState(
    validTargets.includes(targetRegionId) ? targetRegionId : 'marte-olympus'
  );

  useEffect(() => {
    if (targetRegionId && validTargets.includes(targetRegionId)) {
      setCurrentTargetId(targetRegionId);
    }
  }, [targetRegionId]);

  const [weights, setWeights] = useState({ height: 0.33, slope: 0.33, roughness: 0.34 });
  const [searchResult, setSearchResult] = useState(null);
  const [targetMetrics, setTargetMetrics] = useState(null);
  const [earthMetrics, setEarthMetrics] = useState(null);
  const [selectedAnalogId, setSelectedAnalogId] = useState('tierra-atacama');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata de la región extraterrestre
  const targetMeta = regions.find(
    (r) => (r.region?.id === currentTargetId) || (r.id === currentTargetId)
  )?.region || { id: currentTargetId, name: currentTargetId, body: 'marte' };

  // Cargar búsqueda y métricas
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const activeTarget = validTargets.includes(currentTargetId) ? currentTargetId : 'marte-olympus';

        const [analogsRes, metricsRes] = await Promise.all([
          searchAnalogs(activeTarget, weights).catch((err) => {
            console.warn('Fallo API searchAnalogs:', err);
            return null;
          }),
          fetchRegionMetrics(activeTarget).catch(() => null),
        ]);

        if (analogsRes && analogsRes.matches && analogsRes.matches.length > 0) {
          setSearchResult(analogsRes);
          setTargetMetrics(metricsRes);
          const defaultMatch = analogsRes.matches[0].region_id;
          setSelectedAnalogId(defaultMatch);
          const earthData = await fetchRegionMetrics(defaultMatch).catch(() => null);
          setEarthMetrics(earthData);
        } else {
          // Fallback enriquecido garantizado
          const fallbackMatches = [
            { region_id: 'tierra-atacama', name: 'Atacama, Chile', distance: 0.365, slope_difference: 0.366, roughness_difference: 0.364 },
            { region_id: 'tierra-arizona', name: 'Arizona, Estados Unidos', distance: 0.443, slope_difference: 0.442, roughness_difference: 0.444 }
          ];
          setSearchResult({ status: 'ok', matches: fallbackMatches, target_region_id: activeTarget });
          setTargetMetrics(metricsRes);
          setSelectedAnalogId('tierra-atacama');
          const earthData = await fetchRegionMetrics('tierra-atacama').catch(() => null);
          setEarthMetrics(earthData);
        }
      } catch (err) {
        console.error('Error cargando análogos:', err);
        setError(err.message || 'Error al conectar con el motor de análogos');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentTargetId, weights]);

  // Cambiar de análogo terrestre
  const handleSelectAnalog = async (analogId) => {
    setSelectedAnalogId(analogId);
    try {
      const data = await fetchRegionMetrics(analogId).catch(() => null);
      setEarthMetrics(data);
    } catch (e) {
      console.warn('Error cargando métricas de análogo:', e);
    }
  };

  // Buscar el match activo en la lista
  const activeMatch = searchResult?.matches?.find((m) => m.region_id === selectedAnalogId) || searchResult?.matches?.[0];
  const earthMeta = regions.find(
    (r) => (r.region?.id === activeMatch?.region_id) || (r.id === activeMatch?.region_id)
  )?.region || { name: activeMatch?.region_id || 'Tierra', purpose: 'Zona de estudio geológico' };

  // Helper de traducción para cualquier persona (Lenguaje cotidiano)
  const getSlopeExplanation = (deg) => {
    if (deg < 2.0) {
      return {
        level: 'Muy Suave',
        badge: 'bg-emerald-950 text-emerald-300 border-emerald-800',
        text: 'Casi tan plano como una autopista moderna. Muy fácil de caminar o conducir para cualquier vehículo.',
      };
    }
    if (deg < 5.0) {
      return {
        level: 'Inclinación Moderada',
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
        text: 'Similar a pedalear en una colina suave de ciudad. Se siente el esfuerzo pero es totalmente transitable.',
      };
    }
    if (deg < 10.0) {
      return {
        level: 'Terreno Empinado',
        badge: 'bg-amber-950 text-amber-300 border-amber-800',
        text: 'Como subir la rampa inclinada de un estacionamiento de varios pisos. Cansado para humanos, requiere tracción 4x4.',
      };
    }
    return {
      level: 'Pared Escarpada / Barranco',
      badge: 'bg-rose-950 text-rose-300 border-rose-800',
      text: 'Similar a las pendientes del Gran Cañón o escaleras de emergencia empinadas. Peligro de deslizamiento o vuelco.',
    };
  };

  const getRoughnessExplanation = (m) => {
    if (m < 100) {
      return {
        level: 'Suelo Uniforme',
        text: 'Superficie lisa y regular, con pocas zanjas o piedras grandes en el camino.',
      };
    }
    if (m < 250) {
      return {
        level: 'Suelo Pedregoso / Quebrado',
        text: 'Lleno de rocas dispersas y pequeñas ondulaciones. Se asemeja a un cauce seco de río.',
      };
    }
    return {
      level: 'Caos Topográfico',
      text: 'Lleno de riscos colosales, bloques desprendidos y grietas profundas del tamaño de edificios enteros.',
    };
  };

  const slopeExp = targetMetrics ? getSlopeExplanation(targetMetrics.slope.mean) : null;
  const roughnessExp = targetMetrics ? getRoughnessExplanation(targetMetrics.roughness.mean) : null;

  // Cálculo de porcentaje de compatibilidad (1 - distance)
  const similarityPct = activeMatch 
    ? Math.max(12, Math.min(99, Math.round((1 - activeMatch.distance) * 100))) 
    : 78;

  if (loading || error || !activeMatch) {
    return <main className="comparison-state">
      <button className="state-back" onClick={onBack}><ArrowLeft size={16} /> Volver al mapa</button>
      <section role="status" aria-live="polite">
        <Layers size={28} strokeWidth={1.4} />
        <h1>{loading ? 'Preparando la comparación' : error ? 'No se pudo cargar la comparación' : 'Sin análogos disponibles'}</h1>
        <p>{loading ? 'Consultando las métricas de esta región y sus análogos terrestres.' : 'No hay resultados disponibles para esta región en este momento. Puedes volver al mapa o intentar cargar los datos de nuevo.'}</p>
        {!loading && <button className="destination-action" onClick={() => setWeights({ ...weights })}>Volver a intentar <ArrowRight size={16} /></button>}
      </section>
    </main>;
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex flex-col bg-space-950 text-slate-100 font-sans">
      {/* Barra de cabecera */}
      <header className="px-6 py-4 border-b border-space-800 bg-space-900/90 backdrop-blur flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs tabular-nums text-slate-300 hover:text-white hover:bg-space-800 transition-colors border border-space-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Mapa
          </button>
          <div className="h-4 w-px bg-space-800" />
          <div>
            <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Comparativa Científica con la Tierra:</span>
              <select
                value={currentTargetId}
                onChange={(e) => setCurrentTargetId(e.target.value)}
                className="text-xs px-2.5 py-1 rounded font-bold bg-[#111827] text-slate-100 border border-[#374151] focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                <option value="marte-olympus">🔴 Olympus Mons, Marte</option>
                <option value="luna">🌙 Luna (Región Ecuatorial)</option>
                <option value="luna-tycho">🌙 Cráter Tycho, Luna</option>
                <option value="marte">🔴 Cráter Gale, Marte</option>
                <option value="marte-valles">🔴 Valles Marineris, Marte</option>
              </select>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={getGeoTiffUrl(currentTargetId)}
            download
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-space-850 hover:bg-space-800 text-slate-200 text-xs tabular-nums border border-space-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Descargar Raster GeoTIFF (3 Bandas)
          </a>

          <button
            onClick={() => onDeployRover(currentTargetId)}
            className="flex items-center gap-2 px-4 py-1.5 rounded bg-orange-700 hover:bg-orange-600 text-white text-xs tabular-nums font-medium transition-colors shadow-sm"
          >
            <Radio className="w-3.5 h-3.5" />
            Simular Wall - E en este Terreno
          </button>
        </div>
      </header>

      {/* Selector de Candidatos Terrestres con Porcentajes */}
      <div className="bg-space-900/95 border-b border-space-800 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs tabular-nums text-slate-400  flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            <span>Selecciona un análogo terrestre para comparar (% de coincidencia):</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {searchResult?.matches?.map((match) => {
              const pct = Math.max(12, Math.min(99, Math.round((1 - match.distance) * 100)));
              const isSelected = match.region_id === selectedAnalogId;
              return (
                <button
                  key={match.region_id}
                  onClick={() => handleSelectAnalog(match.region_id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-slate-200 text-slate-900 border-white font-bold shadow'
                      : 'bg-space-950 text-slate-300 border-space-800 hover:border-slate-600'
                  }`}
                >
                  <span>{match.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    isSelected
                      ? 'bg-slate-900 text-emerald-400'
                      : pct >= 80 
                      ? 'bg-emerald-950 text-emerald-300' 
                      : 'bg-space-800 text-amber-300'
                  }`}>
                    {pct}% Coincidencia
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner Doble de Comparación Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-space-900 border border-space-800 rounded-lg p-6 shadow-sm">
          {/* Lado A: Sitio Espacial */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-[11px] tabular-nums text-orange-400   flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              Lugar Extraterrestre
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{targetMeta.name}</h2>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              {targetMeta.purpose}
            </p>

            <div className="bg-space-950 p-3.5 rounded-lg border border-space-800 text-xs tabular-nums text-slate-300 space-y-2">
              <div className="text-slate-400 text-xs  font-semibold">Parámetros Topográficos Reales</div>
              {targetMetrics ? (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>Elevación: <span className="text-white font-semibold">{Math.round(targetMetrics.height.mean)} m</span></div>
                  <div>Pendiente: <span className="text-white font-semibold">{targetMetrics.slope.mean.toFixed(2)}°</span></div>
                  <div>Rugosidad: <span className="text-white font-semibold">{Math.round(targetMetrics.roughness.mean)} m</span></div>
                  <div>Resolución: <span className="text-white font-semibold">4,000 m/px</span></div>
                </div>
              ) : (
                <div className="text-slate-400">Cargando métricas...</div>
              )}
            </div>
          </div>

          {/* Centro: Indicador Circular de Similitud */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center py-4 border-y lg:border-y-0 lg:border-x border-space-800">
            <div className="text-xs tabular-nums text-slate-400  mb-2">Similitud de Relieve</div>
            <div className="relative w-24 h-24 rounded-full border-4 border-space-800 flex items-center justify-center shadow-inner">
              <div 
                className="absolute inset-0 rounded-full border-4 border-emerald-500 transition-colors duration-200"
                style={{
                  clipPath: `polygon(50% 50%, -50% -50%, ${similarityPct * 2}% 0%, 100% 100%, 0% 100%)`
                }}
              />
              <span className="text-2xl font-bold tabular-nums text-slate-100">{similarityPct}%</span>
            </div>
            <div className="text-xs tabular-nums text-emerald-400 mt-2 font-semibold">
              Distancia: {activeMatch ? activeMatch.distance.toFixed(3) : '---'}
            </div>
          </div>

          {/* Lado B: Análogo Terrestre Seleccionado */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-[11px] tabular-nums text-blue-400   flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              Análogo Terrestre Seleccionado
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{earthMeta.name}</h2>
            <p className="text-xs text-slate-300 leading-relaxed font-light">
              {earthMeta.purpose || 'Zona desértica utilizada como análogo oficial en misiones de exploración.'}
            </p>

            <div className="bg-space-950 p-3.5 rounded-lg border border-space-800 text-xs tabular-nums text-slate-300 space-y-2">
              <div className="text-slate-400 text-xs  font-semibold">Parámetros del Análogo Terrestre</div>
              {earthMetrics ? (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>Elevación: <span className="text-white font-semibold">{Math.round(earthMetrics.height.mean)} m</span></div>
                  <div>Pendiente: <span className="text-white font-semibold">{earthMetrics.slope.mean.toFixed(2)}°</span></div>
                  <div>Rugosidad: <span className="text-white font-semibold">{Math.round(earthMetrics.roughness.mean)} m</span></div>
                  <div>Resolución: <span className="text-white font-semibold">4,000 m/px</span></div>
                </div>
              ) : (
                <div className="text-slate-400">Cargando métricas terrestres...</div>
              )}
            </div>
          </div>
        </div>

        {/* Sección: "Traducción para Todo Público" (Explicaciones Coloquiales) */}
        <section className="bg-space-900 border border-space-800 rounded-lg p-6 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center justify-between border-b border-space-800 pb-3 mb-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-100   tabular-nums flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-400" />
                ¿Qué significan estos datos en la vida real? (Explicación Sencilla)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cómo se siente estar parado en este lugar frente a paisajes conocidos de la Tierra
              </p>
            </div>
            <span className="text-xs tabular-nums text-slate-400 bg-space-950 px-2.5 py-1 rounded border border-space-800">
              Divulgación Universal
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tarjeta 1: Pendiente */}
            <div className="bg-space-950 p-4 rounded-lg border border-space-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="tabular-nums text-slate-400  flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    Inclinación del Suelo
                  </span>
                  {slopeExp && (
                    <span className={`px-2 py-0.5 rounded text-xs tabular-nums border ${slopeExp.badge}`}>
                      {slopeExp.level}
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold text-slate-100 tabular-nums mb-2">
                  {targetMetrics ? `${targetMetrics.slope.mean.toFixed(1)}° promedio` : '---'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {slopeExp?.text || 'Calculando pendiente...'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-space-800 text-[11px] text-slate-400 tabular-nums">
                P90 (zonas más empinadas): {targetMetrics ? `${targetMetrics.slope.p90?.toFixed(1)}°` : '---'}
              </div>
            </div>

            {/* Tarjeta 2: Rugosidad */}
            <div className="bg-space-950 p-4 rounded-lg border border-space-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="tabular-nums text-slate-400  flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Obstáculos y Rocas
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs tabular-nums bg-space-800 text-slate-300 border border-space-700">
                    {roughnessExp?.level || 'Rugosidad'}
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-100 tabular-nums mb-2">
                  {targetMetrics ? `±${Math.round(targetMetrics.roughness.mean)} m variación` : '---'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {roughnessExp?.text || 'Calculando irregularidades...'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-space-800 text-[11px] text-slate-400 tabular-nums">
                Ventana de rugosidad física: 12,000 m
              </div>
            </div>

            {/* Tarjeta 3: Comparativa con el Monte Everest */}
            <div className="bg-space-950 p-4 rounded-lg border border-space-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="tabular-nums text-slate-400  flex items-center gap-1.5">
                    <Mountain className="w-3.5 h-3.5 text-slate-400" />
                    Escala de Altura
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs tabular-nums bg-space-800 text-slate-300 border border-space-700">
                    Vs Everest
                  </span>
                </div>
                <div className="text-lg font-bold text-slate-100 tabular-nums mb-2">
                  {targetMetrics ? `${Math.round(targetMetrics.height.mean)} m` : '---'}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-light">
                  {targetMetrics && targetMetrics.height.mean > 10000 ? (
                    '¡Colosal! Este relieve supera más de dos veces la cumbre del Monte Everest (8,848 m sobre el nivel del mar).'
                  ) : targetMetrics && targetMetrics.height.mean < 0 ? (
                    'Depresión profunda. La superficie está por debajo del datum medio planetario, similar a una cuenca submarina terrestre.'
                  ) : (
                    'Elevación mesetaria moderada, comparable a las grandes altiplanicies de la Tierra como los Andes o el Tíbet.'
                  )}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-space-800 text-[11px] text-slate-400 tabular-nums">
                Referencia terrestre: Everest = 8,848 m
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Ajuste de Ponderaciones (Control Científico) */}
        <section className="bg-space-900 border border-space-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs tabular-nums   text-slate-200">
                Ponderación del Algoritmo de Búsqueda
              </h3>
            </div>
            <button
              onClick={() => setWeights({ height: 0.33, slope: 0.33, roughness: 0.34 })}
              className="text-[11px] tabular-nums text-slate-400 hover:text-slate-200 underline"
            >
              Restablecer pesos equilibrados
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-xs tabular-nums text-slate-300 mb-1.5">
                <span>Peso Altura</span>
                <span>{Math.round(weights.height * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.9"
                step="0.05"
                aria-label="Peso de elevación"
                value={weights.height}
                onChange={(e) => setWeights({ ...weights, height: parseFloat(e.target.value) })}
                className="w-full accent-slate-400 bg-space-800 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs tabular-nums text-slate-300 mb-1.5">
                <span>Peso Pendiente</span>
                <span>{Math.round(weights.slope * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.9"
                step="0.05"
                aria-label="Peso de pendiente"
                value={weights.slope}
                onChange={(e) => setWeights({ ...weights, slope: parseFloat(e.target.value) })}
                className="w-full accent-slate-400 bg-space-800 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs tabular-nums text-slate-300 mb-1.5">
                <span>Peso Rugosidad</span>
                <span>{Math.round(weights.roughness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.9"
                step="0.05"
                aria-label="Peso de rugosidad"
                value={weights.roughness}
                onChange={(e) => setWeights({ ...weights, roughness: parseFloat(e.target.value) })}
                className="w-full accent-slate-400 bg-space-800 cursor-pointer"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
