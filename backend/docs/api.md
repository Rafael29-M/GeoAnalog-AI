# API para el equipo

Base: `http://127.0.0.1:8000`. Documentación interactiva: `/docs`; contrato: `/openapi.json`. Los endpoints leen resultados procesados, sin descargar ni procesar matrices durante la petición.

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/health` | Almacenamiento y cantidad de regiones procesadas |
| GET | `/api/v1/bodies` | Tierra, Luna y Marte, con sus datasets y regiones |
| GET | `/api/v1/datasets` | Productos, archivos, fuentes, metadatos y estado |
| GET | `/api/v1/regions` | Regiones y estado, sin métricas |
| GET | `/api/v1/regions/{id}` | Región y métricas disponibles |
| GET | `/api/v1/regions/{id}/metrics` | Métricas; 409 si no están vigentes |
| POST | `/api/v1/analogs/search` | Candidatas terrestres ordenadas y exclusiones |

Los IDs de cuerpos son `earth`, `moon`, `mars`; sus nombres son **Tierra**, **Luna**, **Marte**. Los IDs de análisis son `luna`, `marte`, `tierra-atacama`, `tierra-arizona`. Los antiguos IDs separados por sitios lunares/marcianos ya no existen.

## Buscar

Enviar a `POST /api/v1/analogs/search`:

```json
{"target_region_id":"luna","limit":2}
```

Cambiar `luna` por `marte` para el otro objetivo. `earth_region_ids` es opcional: omitido considera todas las candidatas; `[]` no considera ninguna. Máximo siete candidatas y siete resultados.

Cada elemento de `matches` contiene `region_id`, `name`, `bounds` (west, south, east, north), `distance`, `slope_difference` y `roughness_difference`. Menor distancia significa menor diferencia matemática. La respuesta incluye `explanation` y `excluded`.

Actualmente ambas búsquedas devuelven dos candidatas. Arizona aparece primero para Luna y Atacama para Marte. Esto ordena solo las dos ventanas descargadas; no confirma analogías geológicas ni representa una probabilidad.

```javascript
const response = await fetch('http://127.0.0.1:8000/api/v1/analogs/search', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({target_region_id: 'marte'})
});
const payload = await response.json();
if (!response.ok) throw new Error(JSON.stringify(payload.detail));
console.log(payload.matches, payload.explanation);
```

## Métricas y estados

`height`, `slope` y `roughness` contienen cantidad, mínimo, máximo, media, desviación estándar y mediana; sus unidades son metros, grados y metros. Leer `vertical_reference`, `quality` y `warnings`.

`scale` distingue resolución original (`native_dx_m`, `native_dy_m`) de malla de análisis (`dx_m`, `dy_m`), y registra extensión, rugosidad y remuestreo. `bounds` es la envolvente geográfica; el GeoTIFF conserva CRS y transformación.

`valid_fraction`, `slope_valid_fraction` y `roughness_valid_fraction` describen cobertura. Los hashes, `region_fingerprint`, `method_version` y `runtime` registran trazabilidad. `artifacts.geotiff` es una ruta local relativa al backend, no una URL pública.

Errores: 404 ID desconocido; 409 métricas pendientes/fallidas/desactualizadas; 422 petición inválida; 503 almacenamiento no disponible. Sin candidatas compatibles: 200, `status="no_compatible_regions"`, `matches=[]`. Sin objetivo procesado: `target_not_processed`. No rellenar estos estados con datos ficticios.

Configurar `CORS_ORIGINS=["http://localhost:5173"]` en `.env` para el origen correspondiente y reiniciar. No hay autenticación en esta etapa.
