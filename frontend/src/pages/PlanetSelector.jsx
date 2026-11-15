import React, { useState } from 'react';
import PlanetCanvas from '../components/PlanetCanvas';
import { ArrowUpRight, Globe2, Mountain, ArrowRight } from 'lucide-react';

const destinations = [
  { id: 'moon', name: 'La Luna', category: 'Satélite natural', description: 'Cráteres, mares basálticos y la memoria geológica de nuestro vecino más cercano.', gravity: '1.62', radius: '1,737', source: 'LOLA · Altimetría lunar' },
  { id: 'mars', name: 'Marte', category: 'Planeta terrestre', description: 'Volcanes gigantes y antiguos valles que encuentran ecos en los paisajes de la Tierra.', gravity: '3.72', radius: '3,390', source: 'MOLA · Altimetría marciana' },
];

export default function PlanetSelector({ onSelectPlanet, onSelectRegion, regions = [] }) {
  const [filter, setFilter] = useState('all');
  const sites = regions.map(r => r.region || r).filter(r => ['moon', 'mars'].includes(r.body) && (filter === 'all' || r.body === filter));
  return (
    <main className="destination-page">
      <header className="destination-intro">
        <div>
          <p className="section-caption">Exploración planetaria</p>
          <h1>Otros mundos.<br /><span>Terrenos en común.</span></h1>
        </div>
        <p className="intro-description">Explora la superficie de la Luna y Marte, compara sus relieves con la Tierra y prepara una misión de exploración.</p>
      </header>
      <section className="destination-grid" aria-label="Destinos de exploración">
        {destinations.map(destination => (
          <article key={destination.id} className={'destination destination--' + destination.id}>
            <div className="destination-heading">
              <div><p className="section-caption">{destination.category}</p><h2>{destination.name}</h2></div>
              <span className="destination-source">{destination.source}</span>
            </div>
            <div className="destination-globe"><PlanetCanvas type={destination.id} /></div>
            <p className="globe-instruction">Arrastra para explorar la superficie</p>
            <div className="destination-details">
              <p>{destination.description}</p>
              <dl className="destination-stats">
                <div><dt>Gravedad</dt><dd>{destination.gravity} <span>m/s²</span></dd></div>
                <div><dt>Radio medio</dt><dd>{destination.radius} <span>km</span></dd></div>
                <div><dt>Regiones</dt><dd>{regions.filter(r => (r.region?.body || r.body) === destination.id).length}</dd></div>
              </dl>
              <button className="destination-action" onClick={() => onSelectPlanet(destination.id)}>
                Explorar {destination.id === 'moon' ? 'la Luna' : 'Marte'}<ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </div>
          </article>
        ))}
      </section>
      <section className="region-library" aria-labelledby="regions-title">
        <header className="library-heading">
          <div><h2 id="regions-title">Regiones de estudio</h2><p>Selecciona un lugar para comparar su relieve con análogos terrestres.</p></div>
          <div className="segmented-control" role="group" aria-label="Filtrar regiones por astro">
            {[['all', 'Todas'], ['moon', 'Luna'], ['mars', 'Marte']].map(([id, label]) => <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
        </header>
        <div className="region-list">
          {sites.map(site => <button className="region-row" key={site.id} onClick={() => onSelectRegion(site.id)}>
            <span className={'region-icon region-icon--' + site.body}><Mountain size={21} aria-hidden="true" /></span>
            <span className="region-name"><strong>{site.name}</strong><span>{site.purpose || 'Ver características del terreno y regiones comparables'}</span></span>
            <span className="region-body">{site.body === 'moon' ? 'Luna' : 'Marte'}</span>
            <ArrowRight size={17} aria-hidden="true" />
          </button>)}
          {sites.length === 0 && <div className="region-empty"><Globe2 size={24} /><p>No hay regiones disponibles para este filtro.</p><span>Prueba otro astro o comprueba la conexión de datos.</span></div>}
        </div>
      </section>
      <footer className="destination-footer"><span>GeoAnalog AI · Atlas de exploración</span><span>Datos de relieve NASA · LOLA / MOLA</span></footer>
    </main>
  );
}
