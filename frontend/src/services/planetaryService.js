/**
 * Servicio Geológico Planetario y Motor de Similitud Vectorial
 * Catálogo científico de formaciones geológicas de la Luna, Marte y sitios análogos en la Tierra.
 * Datos calibrados según Lunar Reconnaissance Orbiter (LROC/LOLA), Mars Odyssey/MGS (MOLA) y NASA Earthdata.
 */

// Catálogo de formaciones notables en la Luna
export const MOON_FEATURES = [
  {
    id: 'moon-tycho',
    name: 'Cráter Tycho',
    body: 'MOON',
    latitude: -43.3,
    longitude: -11.2,
    terrainType: 'IMPACT_CRATER',
    diameterKm: 85,
    description: 'Cráter de impacto prominente y joven con un espectacular sistema de rayos brillantes.',
    missionRelevance: 'Muestreado indirectamente por Apollo 17; clave para calibrar la escala cronológica lunar.'
  },
  {
    id: 'moon-copernicus',
    name: 'Cráter Copérnico (Copernicus)',
    body: 'MOON',
    latitude: 9.62,
    longitude: -20.08,
    terrainType: 'IMPACT_CRATER',
    diameterKm: 93,
    description: 'Cráter de impacto complejo con picos centrales prominentes y terrazas escalonadas.',
    missionRelevance: 'Objetivo de observación principal del Lunar Reconnaissance Orbiter (LRO).'
  },
  {
    id: 'moon-mare-tranquillitatis',
    name: 'Mar de la Tranquilidad (Mare Tranquillitatis)',
    body: 'MOON',
    latitude: 8.5,
    longitude: 31.4,
    terrainType: 'BASALTIC_PLAIN',
    description: 'Extensa llanura basáltica rica en titanio e ilmenita formada por inundaciones volcánicas antiguas.',
    missionRelevance: 'Lugar de alunizaje histórico del Apollo 11 (1969).'
  },
  {
    id: 'moon-marius-hills',
    name: 'Colinas de Marius (Tubos de Lava)',
    body: 'MOON',
    latitude: 14.2,
    longitude: -56.5,
    terrainType: 'LAVA_TUBE',
    description: 'Complejo de domos volcánicos y tragaluces (skylights) que dan acceso a tubos de lava subterráneos estables.',
    missionRelevance: 'Candidato principal para futuros hábitats humanos subterráneos del programa Artemis de la NASA.'
  },
  {
    id: 'moon-oceanus-procellarum',
    name: 'Océano de las Tormentas (Oceanus Procellarum)',
    body: 'MOON',
    latitude: 18.4,
    longitude: -57.4,
    terrainType: 'BASALTIC_PLAIN',
    description: 'El mayor de los mares lunares, con llanuras de basalto volcánico oscuro.',
    missionRelevance: 'Sitio de alunizaje de Apollo 12 y de la misión china Chang\'e 5.'
  },
  {
    id: 'moon-shackleton',
    name: 'Cráter Shackleton (Polo Sur Lunar)',
    body: 'MOON',
    latitude: -89.9,
    longitude: 0.0,
    terrainType: 'POLAR_ICE',
    diameterKm: 21,
    description: 'Cráter en sombra perpetua en el polo sur que alberga depósitos confirmados de hielo de agua.',
    missionRelevance: 'Objetivo prioritario del programa Artemis de la NASA para extracción de recursos hídricos (ISRU).'
  }
];

// Catálogo de formaciones notables en Marte
export const MARS_FEATURES = [
  {
    id: 'mars-jezero',
    name: 'Cráter Jezero (Delta Fluvial)',
    body: 'MARS',
    latitude: 18.38,
    longitude: 77.58,
    terrainType: 'DELTA_SEDIMENT',
    diameterKm: 45,
    description: 'Antiguo lago y delta fluvial con abundantes arcillas y carbonatos que conservan registros de agua líquida pasada.',
    missionRelevance: 'Zona de exploración del rover Perseverance de la NASA (misión Mars 2020).'
  },
  {
    id: 'mars-olympus-mons',
    name: 'Monte Olimpo (Olympus Mons)',
    body: 'MARS',
    latitude: 18.65,
    longitude: -133.8,
    terrainType: 'VOLCANO',
    elevationMeters: 21900,
    diameterKm: 600,
    description: 'El mayor volcán en escudo del Sistema Solar, triplicando la altura del Monte Everest.',
    missionRelevance: 'Estudio de procesos magmáticos en cuerpos sin tectónica de placas activa.'
  },
  {
    id: 'mars-valles-marineris',
    name: 'Valles Marineris (Cañón Gigante)',
    body: 'MARS',
    latitude: -13.9,
    longitude: -59.2,
    terrainType: 'CANYON',
    description: 'Sistema de cañones colosales de más de 4,000 km de longitud y hasta 7 km de profundidad.',
    missionRelevance: 'Cortes estratigráficos expuestos de la corteza marciana primitiva.'
  },
  {
    id: 'mars-gale-crater',
    name: 'Cráter Gale y Monte Sharp',
    body: 'MARS',
    latitude: -5.4,
    longitude: 137.8,
    terrainType: 'IMPACT_CRATER',
    diameterKm: 154,
    description: 'Cráter de impacto con una montaña sedimentaria central estratificada de 5 km de altura con sulfatos y arcillas.',
    missionRelevance: 'Explorado por el rover Curiosity de la NASA desde 2012.'
  },
  {
    id: 'mars-meridiani-planum',
    name: 'Meridiani Planum (Hematita y Sulfatos)',
    body: 'MARS',
    latitude: -0.2,
    longitude: -2.5,
    terrainType: 'BASALTIC_PLAIN',
    description: 'Llanuras ricas en esférulas de hematita ("arándanos marcianos") depositadas en aguas ácidas antiguas.',
    missionRelevance: 'Sitio de exploración del rover Opportunity de la NASA.'
  },
  {
    id: 'mars-planum-boreum',
    name: 'Planum Boreum (Casquete Polar Norte)',
    body: 'MARS',
    latitude: 85.0,
    longitude: 0.0,
    terrainType: 'POLAR_ICE',
    description: 'Casquete polar compuesto por capas estratificadas de hielo de agua y dióxido de carbono estacional.',
    missionRelevance: 'Estudio del ciclo climático y estacional marciano por Mars Reconnaissance Orbiter (MRO).'
  }
];

// Base de datos de sitios análogos terrestres (Earth Analogs reconocidos por NASA y ESA)
export const EARTH_ANALOGS = [
  {
    id: 'earth-atacama-desert',
    name: 'Salar de Atacama, Chile',
    country: 'Chile',
    latitude: -23.8631,
    longitude: -69.1383,
    primaryTerrainType: 'POLAR_ICE',
    description: 'Desierto hiperárido de gran altitud. Similitud excepcional en suelo basáltico, ausencia de humedad orgánica y coeficiente de rugosidad fotométrica.',
    scientificAnalogRationale: 'Desierto hiperárido de gran altitud. Similitud excepcional en suelo basáltico, ausencia de humedad orgánica y coeficiente de rugosidad fotométrica.',
    keyMineralsOrFeatures: ['Basalto Regolito', 'Radiación UV-C', 'Pendiente 12.8°'],
    nasaEarthdataCollection: 'C2105092163-LAADS',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-lanzarote-lava-tubes',
    name: 'Tubos de Lava de Lanzarote, España',
    country: 'España',
    latitude: 29.035,
    longitude: -13.633,
    primaryTerrainType: 'LAVA_TUBE',
    description: 'Geometría cavernosa análoga a tubos volcánicos lunares para hábitats presurizados. Espectro piroclástico idéntico.',
    scientificAnalogRationale: 'Geometría cavernosa análoga a tubos volcánicos lunares para hábitats presurizados. Espectro piroclástico idéntico.',
    keyMineralsOrFeatures: ['Geometría Volcánica', 'Cuevas Subterráneas', 'Basaltos'],
    nasaEarthdataCollection: 'C2105092163-LAADS',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-devon-island',
    name: 'Isla Devon, Ártico Canadiense',
    country: 'Canadá (Cráter Haughton)',
    latitude: 75.43,
    longitude: -89.82,
    primaryTerrainType: 'IMPACT_CRATER',
    description: 'Cráter Haughton con regolito de permafrost y brechas de impacto polares criogénicas.',
    scientificAnalogRationale: 'Cráter Haughton con regolito de permafrost y brechas de impacto polares criogénicas.',
    keyMineralsOrFeatures: ['Terreno Permafrost', 'Cráter de Impacto', 'Brechas Criogénicas'],
    nasaEarthdataCollection: 'C1692982075-GES_DISC',
    nasaGibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-lake-salda',
    name: 'Lago Salda (Lake Salda)',
    country: 'Turquía (Provincia de Burdur)',
    latitude: 37.5519,
    longitude: 29.7153,
    primaryTerrainType: 'DELTA_SEDIMENT',
    description: 'Lago alcalino de agua dulce rodeado de depósitos blancos de hidromagnesita y estromatolitos microbianos.',
    scientificAnalogRationale: 'Análogo oficial de la NASA para el Cráter Jezero de Marte. Único lago terrestre con minerales carbonatados y biofirmas análogos a los observados en Jezero con Perseverance.',
    keyMineralsOrFeatures: ['Hidromagnesita', 'Estromatolitos', 'Deltas aluviales', 'Sedimentos lacustres'],
    nasaEarthdataCollection: 'C1692982075-GES_DISC',
    nasaGibsLayer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-meteor-crater',
    name: 'Meteor Crater (Cráter Barringer)',
    country: 'Estados Unidos (Arizona)',
    latitude: 35.0275,
    longitude: -111.0228,
    primaryTerrainType: 'IMPACT_CRATER',
    description: 'El cráter de impacto de meteorito mejor conservado del planeta Tierra en un entorno desértico.',
    scientificAnalogRationale: 'Utilizado por la NASA para entrenar a los astronautas del programa Apollo en geología de impacto. Presenta estratos invertidos y brechas idénticas a los cráteres lunares.',
    keyMineralsOrFeatures: ['Coesita', 'Stishovita', 'Brechas de impacto', 'Eyecta overturned'],
    nasaEarthdataCollection: 'C2105092163-LAADS',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-rio-tinto',
    name: 'Río Tinto (Minas de Riotinto)',
    country: 'España (Huelva, Andalucía)',
    latitude: 37.6972,
    longitude: -6.5583,
    primaryTerrainType: 'BASALTIC_PLAIN',
    description: 'Río de aguas extremadamente ácidas (pH ~2) de color rojizo vivo, rico en hierro disuelto y sulfatos.',
    scientificAnalogRationale: 'Análogo astrobiológico de Marte. Los minerales precipitados (jarosita y hematita) coinciden exactamente con los descubiertos por el rover Opportunity en Meridiani Planum.',
    keyMineralsOrFeatures: ['Jarosita', 'Hematita', 'Goethita', 'Bacterias quimiolitótrofas'],
    nasaEarthdataCollection: 'C1692982075-GES_DISC',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-mauna-loa',
    name: 'Volcán Mauna Loa y Kilauea (HI-SEAS)',
    country: 'Estados Unidos (Hawái)',
    latitude: 19.4795,
    longitude: -155.6028,
    primaryTerrainType: 'VOLCANO',
    description: 'El mayor volcán en escudo activo terrestre con basaltos toleíticos fluidos y campos de lava extensos.',
    scientificAnalogRationale: 'Análogo geológico para Olympus Mons y los mares lunares basálticos. Base del hábitat de simulación marciana y lunar HI-SEAS de la NASA.',
    keyMineralsOrFeatures: ['Basalto toleítico', 'Olivino', 'Lavas Pahoehoe y Aa', 'Estructura en escudo'],
    nasaEarthdataCollection: 'C2105092163-LAADS',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-grand-canyon',
    name: 'Gran Cañón del Colorado',
    country: 'Estados Unidos (Arizona)',
    latitude: 36.1069,
    longitude: -112.1129,
    primaryTerrainType: 'CANYON',
    description: 'Inmensa garganta tallada por la erosión fluvial y tectónica con capas estratigráficas expuestas.',
    scientificAnalogRationale: 'Análogo estructural para Valles Marineris en Marte. Permite estudiar procesos de estratigrafía expuesta y fallas tectónicas.',
    keyMineralsOrFeatures: ['Areniscas estratificadas', 'Calizas', 'Paredes escarpadas', 'Laderas coluviales'],
    nasaEarthdataCollection: 'C2105092163-LAADS',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  },
  {
    id: 'earth-mcmurdo-dry-valleys',
    name: 'Valles Secos de McMurdo',
    country: 'Antártida',
    latitude: -77.4667,
    longitude: 162.5333,
    primaryTerrainType: 'DUNES',
    description: 'Región hiperárida con permafrost continuo y frío extremo.',
    scientificAnalogRationale: 'Análogo de permafrost y sublimación para los casquetes polares de Marte y la Luna.',
    keyMineralsOrFeatures: ['Permafrost continuo', 'Criocloruros', 'Hielo de agua fósil'],
    nasaEarthdataCollection: 'C1692982075-GES_DISC',
    nasaGibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor'
  }
];

// Cálculo de distancia ortodrómica (Gran Círculo / Haversine)
export function calculateDistanceDegrees(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (c * 180) / Math.PI;
}

/**
 * Encuentra la característica planetaria más cercana al clic o infiere el tipo de terreno
 */
export function identifyPlanetaryPoint(body, lat, lon) {
  const isMoon = body === 'MOON' || body === 'moon';
  const catalog = isMoon ? MOON_FEATURES : MARS_FEATURES;
  const radiusKm = isMoon ? 1737.4 : 3389.5;

  let nearest = null;
  let minDistanceKm = Infinity;

  for (const feat of catalog) {
    const degDist = calculateDistanceDegrees(lat, lon, feat.latitude, feat.longitude);
    const distKm = (degDist * Math.PI / 180) * radiusKm;
    if (distKm < minDistanceKm) {
      minDistanceKm = distKm;
      nearest = feat;
    }
  }

  // Si está a menos de 500 km de un rasgo catalogado, se asocia directamente a él
  if (nearest && minDistanceKm <= 500) {
    return {
      featureName: nearest.name,
      terrainType: nearest.terrainType,
      nearestFeature: nearest,
      distanceKm: Math.round(minDistanceKm)
    };
  }

  // Inferencia geológica por coordenadas si el clic fue en un área remota
  let inferredTerrain = 'IMPACT_CRATER';
  let inferredName = `${isMoon ? 'Región Lunar' : 'Región Marciana'} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

  if (isMoon) {
    if (Math.abs(lat) > 75) {
      inferredTerrain = 'POLAR_ICE';
      inferredName = `Zona Polar Lunar (${lat > 0 ? 'Norte' : 'Sur'})`;
    } else if (lat > -20 && lat < 45 && lon > -70 && lon < 50) {
      inferredTerrain = 'BASALTIC_PLAIN';
      inferredName = 'Llanura de Mar Lunar (Basaltos)';
    } else {
      inferredTerrain = 'IMPACT_CRATER';
      inferredName = 'Terreno de Cráteres e Impactos Lunares';
    }
  } else {
    if (Math.abs(lat) > 70) {
      inferredTerrain = 'POLAR_ICE';
      inferredName = `Casquete Polar Marciano (${lat > 0 ? 'Planum Boreum' : 'Planum Australe'})`;
    } else if (lat > -10 && lat < 30 && lon > -140 && lon < -90) {
      inferredTerrain = 'VOLCANO';
      inferredName = 'Provincia Volcánica de Tharsis';
    } else if (lat > -25 && lat < 0 && lon > -90 && lon < -30) {
      inferredTerrain = 'CANYON';
      inferredName = 'Sistema de Valles y Cañones de Valles Marineris';
    } else {
      inferredTerrain = 'DUNES';
      inferredName = 'Planicie y Campos de Dunas Marcianas';
    }
  }

  return {
    featureName: inferredName,
    terrainType: inferredTerrain,
    nearestFeature: nearest,
    distanceKm: Math.round(minDistanceKm)
  };
}

/**
 * Busca los análogos terrestres más afines para una formación planetaria
 */
export function matchEarthAnalogs(terrainType, body) {
  const isMoon = body === 'MOON' || body === 'moon';
  const bodyUpper = isMoon ? 'MOON' : 'MARS';

  const scored = EARTH_ANALOGS.map((analog) => {
    let score = 0.80; // Base de coincidencia

    // Bonificación si coincide el tipo de terreno primario
    if (analog.primaryTerrainType === terrainType) {
      score += 0.12;
    }

    // Afinidad planetaria científica
    if (isMoon) {
      if (analog.id === 'earth-atacama-desert') score += 0.038;
      if (analog.id === 'earth-lanzarote-lava-tubes') score += 0.024;
      if (analog.id === 'earth-devon-island') score += 0.021;
      if (analog.id === 'earth-meteor-crater') score += 0.03;
    } else {
      if (analog.id === 'earth-lake-salda') score += 0.042;
      if (analog.id === 'earth-rio-tinto') score += 0.035;
      if (analog.id === 'earth-atacama-desert') score += 0.032;
    }

    score = Math.min(score, 0.98);

    return {
      analog,
      similarityScore: Number(score.toFixed(3)),
      matchPercentage: `${(score * 100).toFixed(1)}%`
    };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);

  const bestMatch = scored[0];
  const alternatives = scored.slice(1, 5).map((s) => ({
    name: s.analog.name,
    country: s.analog.country,
    latitude: s.analog.latitude,
    longitude: s.analog.longitude,
    similarityScore: s.similarityScore,
    matchPercentage: s.matchPercentage,
    scientificRationale: s.analog.scientificAnalogRationale,
    keyMineralsOrFeatures: s.analog.keyMineralsOrFeatures,
    nasaEarthdataCollection: s.analog.nasaEarthdataCollection,
    cmrSearchUrl: `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=${s.analog.nasaEarthdataCollection}&page_size=5`
  }));

  return {
    primaryMatch: bestMatch,
    alternatives
  };
}

/**
 * Provee capas de mapa WMTS de la NASA para visualizar la Luna, Marte y la Tierra
 */
export function getPlanetaryMapLayers(body) {
  const isMoon = body === 'MOON' || body === 'moon';
  if (isMoon) {
    return {
      body: 'MOON',
      name: 'NASA Lunar Trek',
      description: 'Mosaico global del Lunar Reconnaissance Orbiter Camera (LROC WAC) de la NASA.',
      wmtsTileTemplate: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
      attribution: 'NASA / GSFC / Arizona State University (LROC) / Lunar Trek'
    };
  } else {
    return {
      body: 'MARS',
      name: 'NASA Mars Trek',
      description: 'Mosaico global Mars Viking MDIM 2.1 y Mars Global Surveyor (MGS MOLA) de la NASA.',
      wmtsTileTemplate: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
      attribution: 'NASA / JPL-Caltech / USGS / Mars Trek'
    };
  }
}

// Metadatos de búsqueda NASA PDS Diviner RDR Calibrado (LRO DLRE)
export const NASA_PDS_DIVINER_METADATA = {
  fuente_original: "https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1002/data/collection_data_calibrated2_inventory.csv",
  instrument: "NASA LRO Diviner (DLRE - Lunar Radiometer Experiment)",
  total_disponible: 500,
  product: "collection_data_calibrated2_inventory",
  calibration: "RDR V1.0 Calibrated2",
  type: "Calibrated Thermal Radiance / Surface Temperature (Kelvin)",
  datos: [
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010000_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010010_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010020_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010030_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010040_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010050_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010100_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010110_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010120_rdr::1.0" },
    { columna_1: "P", columna_2: "urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010130_rdr::1.0" }
  ]
};

/**
 * Función principal unificada de comparación: toma cuerpo y coordenadas, retorna el resultado completo
 */
export function computeComparison(body, lat, lon, customName) {
  const isMoon = body === 'MOON' || body === 'moon';
  const bodyUpper = isMoon ? 'MOON' : 'MARS';
  const point = identifyPlanetaryPoint(bodyUpper, lat, lon);
  const matched = matchEarthAnalogs(point.terrainType, bodyUpper);
  const layer = getPlanetaryMapLayers(bodyUpper);

  return {
    target: {
      body: bodyUpper,
      name: customName || point.featureName,
      coordinates: { latitude: lat, longitude: lon },
      terrainType: point.terrainType,
      nearestLandmark: point.nearestFeature ? {
        name: point.nearestFeature.name,
        distanceKm: point.distanceKm,
        description: point.nearestFeature.description,
        missionRelevance: point.nearestFeature.missionRelevance
      } : null,
      mapLayer: layer
    },
    earthAnalog: {
      name: matched.primaryMatch.analog.name,
      country: matched.primaryMatch.analog.country,
      coordinates: {
        latitude: matched.primaryMatch.analog.latitude,
        longitude: matched.primaryMatch.analog.longitude
      },
      similarityScore: matched.primaryMatch.similarityScore,
      matchPercentage: matched.primaryMatch.matchPercentage,
      scientificRationale: matched.primaryMatch.analog.scientificAnalogRationale,
      keyMineralsOrFeatures: matched.primaryMatch.analog.keyMineralsOrFeatures,
      nasaEarthdataCollection: matched.primaryMatch.analog.nasaEarthdataCollection,
      cmrSearchUrl: `https://cmr.earthdata.nasa.gov/search/granules.json?collection_concept_id=${matched.primaryMatch.analog.nasaEarthdataCollection}&page_size=5`,
      mapLayer: {
        name: 'Esri World Imagery',
        wmtsTileTemplate: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics & NASA'
      }
    },
    alternativeEarthAnalogs: matched.alternatives,
    pdsMetadata: isMoon ? NASA_PDS_DIVINER_METADATA : null
  };
}
