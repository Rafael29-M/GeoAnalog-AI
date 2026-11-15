# Método: common-grid-terrain-v2

## Lectura

Los originales no se modifican. El lector PDS valida producto, cuerpo, instrumento, dimensiones, endian, escala, unidades, registro y proyección; contrasta LBL/XML. Acepta los IMG cilíndricos int16 declarados, sin cabeceras adicionales ni rotación.

LOLA: `z = DN × 0,5 m`, relativo al radio lunar; no se suma el radio de 1 737 400 m. MOLA: `z = DN m`, relativo al areoide GMM3. NASADEM HGT: `z = DN m`, relativo a EGM96. No se comparan alturas absolutas entre cuerpos.

Se enmascara nodata antes de escalar. No se descartan ceros ni negativos por su valor. MOLA conserva ceros porque LBL/XML no los declaran nodata, aunque el HDR difiere. NASADEM trata −32768 como inválido siguiendo HGT; la guía da rango válido −32767…32767.

Los ZIP NASADEM conservan HGT, NUM y SWB. Si están presentes, se aplica `SWB == 0`, `NUM > 0`, `NUM != 255` antes de agregar, excluyendo agua y errores de fuente. Esto no elimina todas las diferencias de calidad y rellenos; sin estas máscaras se registra una advertencia.

## Escala común

Las cuatro ventanas actuales miden **64 × 64 km**, con **16 × 16 celdas de 4 km**. Esta resolución es más gruesa que las fuentes en las latitudes elegidas; no se aumenta artificialmente la resolución.

El centro se obtiene de la caja del manifiesto. Se crea una proyección azimutal equidistante local: WGS84 para Tierra, radio cartográfico de la etiqueta para Luna/Marte. Las distancias entre celdas se aproximan con coordenadas de esta proyección regional; la proyección no preserva todas las distancias entre pares de puntos.

La ventana debe caber en la caja seleccionada y el archivo. Límites: cajas de hasta 10° por eje, latitudes ±75°, 16 millones de celdas originales. Se distingue el registro de postes HGT del de celdas PDS.

GDAL `Resampling.average` agrega las alturas con su ponderación de contribuciones. Es un promedio de remuestreo, no una integración exacta de áreas geodésicas. Se agrega la máscara por separado y se exige al menos 99% de cobertura válida por celda de destino. No se rellenan huecos rechazados. Se registra `area_average_local_aeqd_v1` y la resolución nativa.

El GeoTIFF conserva CRS y transformación; los límites JSON son su envolvente geográfica. Igualar el tamaño de celda no convierte fuentes distintas en observaciones equivalentes.

## Pendiente, rugosidad y calidad

La pendiente utiliza derivadas centrales con distancias físicas:

```text
p = dz / distancia este
q = dz / distancia norte
pendiente = atan(sqrt(p² + q²)) × 180/π
```

Se excluyen el borde y los centros/vecinos inválidos. Rugosidad es la desviación estándar poblacional de alturas de una ventana completa de 3 × 3 celdas: **12 × 12 km**. Incluye tendencias de pendiente; no es rugosidad detrendida. Cualquier celda inválida invalida su ventana.

Una región queda `insufficient` si alturas, pendientes interiores o ventanas interiores de rugosidad tienen menos de 90% de cobertura válida. Las tres fracciones se guardan. Las demás regiones son `validation_only`, no analogías confirmadas.

Regiones sin parámetros de malla común conservan el método nativo `native-terrain-v1`: geodesia WGS84 en Tierra; R × Δφ y R × cos(φ) × Δλ en cuerpos esféricos. Se excluyen de comparaciones con el nuevo método.

## Comparación y alcance

Se requieren métodos, unidades, remuestreo y calidad compatibles. Pasos de malla y ventanas de rugosidad: tolerancia 5%; extensión: 10%. Las cuatro selecciones actuales coinciden exactamente en los parámetros físicos.

```text
d(a,b) = |a-b| / (|a|+|b|), o 0 si ambos son cero
D = sqrt((d_pendiente_media² + d_rugosidad_media²) / 2)
```

Pesos iguales, orden ascendente. No intervienen altura absoluta ni aprendizaje automático. Dos medias no describen todo el terreno; geología, composición y procesos requieren evaluación adicional.

Los originales lunares y marcianos son globales, pero se analiza una ventana de cada uno, mostrada como Luna o Marte. En Tierra se busca solo entre Atacama y Arizona. Las cajas son decisiones del prototipo, no límites geológicos oficiales.

Cada región conserva `result.json` con parámetros, métricas, hashes y versiones, y `terrain.tif` de tres bandas. El cálculo usa float64; el GeoTIFF guarda float32. Cambiar la selección requiere reprocesar. Los hashes son controles locales, no certificados del proveedor.
