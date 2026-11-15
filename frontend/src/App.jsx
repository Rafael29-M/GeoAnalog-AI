import React, { useState, useEffect } from 'react';
import PlanetSelector from './pages/PlanetSelector';
import SurfaceExplorer from './pages/SurfaceExplorer';
import AnalogCompare from './pages/AnalogCompare';
import RoverTelemetry from './pages/RoverTelemetry';
import { fetchHealth, fetchRegions, fetchSummary } from './api/client';
import { Globe, Radio, Compass, Disc, ShieldCheck, AlertCircle } from 'lucide-react';

export default function App() {
  // Estado de navegación entre las 4 interfaces: 'selector' | 'explorer' | 'compare' | 'rover'
  const [currentView, setCurrentView] = useState('selector');
  const [selectedPlanet, setSelectedPlanet] = useState('mars'); // 'moon' | 'mars'
  const [selectedRegionId, setSelectedRegionId] = useState('marte-olympus');

  // Datos globales del backend
  const [regions, setRegions] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [healthRes, regionsRes, summaryRes] = await Promise.all([
          fetchHealth(),
          fetchRegions().catch(() => []),
          fetchSummary().catch(() => []),
        ]);
        setBackendHealth(healthRes);
        setRegions(regionsRes);
        setSummaryData(summaryRes);
      } catch (err) {
        console.error('Error al inicializar datos:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Handlers de transición entre pantallas
  const handleSelectPlanet = (planet) => {
    setSelectedPlanet(planet);
    setCurrentView('explorer');
  };

  const handleSelectRegionFromSelector = (regionId) => {
    setSelectedRegionId(regionId);
    // Determinar planeta de la región
    const found = regions.find((r) => (r.region?.id === regionId) || (r.id === regionId));
    const body = found?.region?.body || found?.body;
    if (body) setSelectedPlanet(body);
    setCurrentView('compare');
  };

  const handleSelectRegionForCompare = (regionId) => {
    setSelectedRegionId(regionId);
    setCurrentView('compare');
  };

  const handleSelectRegionForRover = (regionId) => {
    setSelectedRegionId(regionId);
    setCurrentView('rover');
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col font-sans">
      <a className="skip-link" href="#workspace">Saltar al contenido</a>
      <header className="app-header">
        <button className="app-brand" onClick={() => setCurrentView('selector')} aria-label="GeoAnalog AI, inicio">
          <Globe size={22} strokeWidth={1.4} aria-hidden="true" />
          <span>GeoAnalog AI<small>DIGITAL TWIN MATRIX</small></span>
        </button>
        <nav className="app-navigation" aria-label="Navegación principal">
          {[
            ['selector', 'Astros', Globe],
            ['explorer', 'Cartografía', Compass],
            ['compare', 'Comparador', Disc],
            ['rover', 'Wall - E', Radio],
          ].map(([view, label, Icon]) => (
            <button key={view} onClick={() => setCurrentView(view)} aria-current={currentView === view ? 'page' : undefined}>
              <Icon size={16} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <span className="connection-status" role="status">
          <span className={(backendHealth || regions.length > 0) ? 'connection-dot is-connected' : 'connection-dot'} />
          {loading ? 'Conectando' : (backendHealth || regions.length > 0) ? 'Datos disponibles' : 'Sin conexión'}
        </span>
      </header>

      {/* Renderizado de la Pantalla Activa */}
      <div className="flex-1" id="workspace" tabIndex={-1}>
        {currentView === 'selector' && (
          <PlanetSelector
            onSelectPlanet={handleSelectPlanet}
            onSelectRegion={handleSelectRegionFromSelector}
            regions={regions}
          />
        )}

        {currentView === 'explorer' && (
          <SurfaceExplorer
            planet={selectedPlanet}
            onBack={() => setCurrentView('selector')}
            onSelectRegionForCompare={handleSelectRegionForCompare}
            onSelectRegionForRover={handleSelectRegionForRover}
            regions={regions}
            summaryData={summaryData}
          />
        )}

        {currentView === 'compare' && (
          <AnalogCompare
            targetRegionId={selectedRegionId}
            onBack={() => setCurrentView('explorer')}
            onDeployRover={handleSelectRegionForRover}
            regions={regions}
          />
        )}

        {currentView === 'rover' && (
          <RoverTelemetry
            regionId={selectedRegionId}
            onBack={() => setCurrentView('compare')}
            regions={regions}
          />
        )}
      </div>
    </div>
  );
}
