# Cosmic Apus — backend

FastAPI compara terrenos de Tierra, Luna y Marte usando archivos NASA descargados. La API y el procesamiento trabajan con datos locales.

## Ejecutar

Desde `backend`, en PowerShell:

```powershell
# El entorno ya está instalado. Para otra máquina:
py -3.13 -m venv .venv
& .venv/Scripts/python.exe -m pip install -r requirements.lock.txt

# Iniciar la API:
& .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Abrir [documentación interactiva](http://127.0.0.1:8000/docs). Python 3.13 está probado en Windows; no es necesario activar el entorno.

## Disponible

| Cuerpo | Archivos originales | Análisis |
| --- | --- | --- |
| Tierra | NASADEM de Atacama y Arizona | Dos lugares candidatos |
| Luna | LOLA global con etiquetas | Una entrada: `luna` |
| Marte | MOLA global con etiquetas | Una entrada: `marte` |

Los originales suman **89 249 096 bytes (89,25 MB)**, incluidos **22 855 433 bytes terrestres**. URLs, fechas y hashes están en `manifests/datasets.json`.

`GET /api/v1/bodies` agrupa los datos como Tierra, Luna y Marte. Luna y Marte tienen una ventana de análisis cada uno; sus métricas describen esa zona, no todo el cuerpo. Todas las ventanas miden 64 × 64 km, con celdas de 4 km y rugosidad en 12 × 12 km.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/bodies
Invoke-RestMethod http://127.0.0.1:8000/api/v1/regions/luna/metrics
$requestBody = @{ target_region_id = 'marte' } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/v1/analogs/search -Method Post -ContentType application/json -Body $requestBody
```

La búsqueda ordena los dos lugares terrestres por diferencias de pendiente y rugosidad, con nombre y coordenadas. El ranking es exploratorio y no representa una probabilidad ni una analogía geológica confirmada.

## Procesar y verificar

```powershell
& .venv/Scripts/python.exe -m scripts.inspect_datasets
& .venv/Scripts/python.exe -m scripts.process_datasets
# Solo una región:
& .venv/Scripts/python.exe -m scripts.process_datasets --region luna
& .venv/Scripts/python.exe -m pytest -q
```

**53 pruebas aprobadas**, incluidas lecturas auténticas de los cuatro productos y búsquedas reales. Si faltan originales en otra máquina, las pruebas que los requieren se omiten explícitamente.

Cada región genera `result.json` con estado, parámetros, métricas, hashes y versiones, y `terrain.tif` con altura, pendiente y rugosidad. `data/processed/summary.csv` resume las cuatro regiones. Cambiar una selección exige reprocesarla; un fallo no publica métricas anteriores como vigentes.

## Organización y configuración

- `app/`: API, lectores, procesamiento, comparación y repositorios.
- `scripts/`: inspeccionar, descargar, procesar y sincronizar PostgreSQL.
- `manifests/`: productos y regiones.
- `data/raw/`: originales intactos; `data/processed/`: resultados. Ambos excluidos de Git.
- `tests/` y `docs/`: pruebas y documentación.

Descarga asistida opcional de PDS: `python -m scripts.download_selected moon-lola16 mars-mola16` muestra el plan; añadir `--execute` descarga o verifica los archivos existentes. NASADEM se obtiene mediante Earthdata y se coloca en `data/raw/earth/`, sin guardar credenciales en el proyecto. Límites: 40 MB por archivo, 120 MB total y siete regiones. Ejecutar una tarea de adquisición/procesamiento a la vez.

Sin `DATABASE_URL` se usan JSON locales. PostgreSQL está preparado: configurar esa variable en `.env` y ejecutar `python -m scripts.sync_postgres`. No hay conexión real comprobada en este equipo. Las matrices permanecen en disco. La sincronización inserta/actualiza registros y conserva históricos; un fallo de PostgreSQL configurado devuelve 503. Firebase queda para una etapa posterior.

Configurar `CORS_ORIGINS` con los orígenes reales del frontend. Consultar [API](docs/api.md), [datos](docs/datasets.md), [metodología](docs/methodology.md) y [verificación](docs/verification.md).
