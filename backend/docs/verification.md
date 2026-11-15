# Verificación

**14 de noviembre de 2026**. Windows, Python 3.13.7, NumPy 2.5.4, Rasterio 1.5.2, GDAL 3.12.2. Versiones por resultado: `metrics.runtime`.

## Evidencia

- **53 pruebas aprobadas**, cero fallos y cero omitidas: `data/processed/tests.xml`.
- Cuatro productos auténticos: etiquetas, dimensiones, endian, unidades, escalas, rangos y hashes; máscaras NUM/SWB terrestres.
- Cuatro regiones procesadas: `processing_report.json` y `summary.csv`.
- API comprobada por HTTP real: health, cuerpos, datasets, regiones, métricas y ambas búsquedas. Registro: `data/processed/api_verification.json`.
- `/bodies` devuelve Tierra, Luna y Marte. Los cuatro IDs anteriores separados por sitios lunares/marcianos devuelven 404.

Las pruebas cubren matemáticas sintéticas identificadas, nodata, recortes, almacenamiento, cambios de selección, errores, descargas y comparación. La malla común prueba conservación de altura constante, escala, propagación de inválidos y rechazo de aumento artificial de resolución o cobertura incompleta.

## Datos reales procesados

Todas las ventanas miden 64 × 64 km, con celdas de 4 km y rugosidad en 12 × 12 km. Estado `processed`, calidad `validation_only`.

| Entrada | Pendiente media (°) | Rugosidad media (m) |
| --- | ---: | ---: |
| Luna | 0,651780 | 37,634501 |
| Marte | 7,142250 | 425,785449 |
| Atacama | 1,900072 | 113,847437 |
| Arizona | 1,584672 | 94,035475 |

| Objetivo | Primera candidata / distancia | Segunda / distancia |
| --- | --- | --- |
| Luna | Arizona / 0,422778 | Atacama / 0,496192 |
| Marte | Atacama / 0,578898 | Arizona / 0,637516 |

Ambas búsquedas incluyen nombres y coordenadas, sin exclusiones. Solo ordenan dos candidatas; no confirman analogías geológicas. Atacama tiene 99,22% de altura válida, 96,94% de pendiente interior y 93,88% de rugosidad interior.

## Simplificación y límites

Cada región conserva un JSON y un GeoTIFF. Dejaron de generarse NPZ, PNG y JSON separados de métricas/trazabilidad. Se retiraron Pillow, variables Firebase sin uso y scripts de una sola ejecución. Se conservan controles de calidad, originales científicos y soporte PostgreSQL.

PostgreSQL no tiene conexión real configurada ni comprobada; las pruebas cubren su fallo explícito. No se implementaron Firebase, autenticación ni despliegue. No se modificó el frontend.

Las consultas y el procesamiento usan archivos locales; no se hizo una prueba desconectando físicamente la red. La escala común permite esta comparación matemática gruesa, sin eliminar diferencias entre fuentes e interpolaciones. Ver `methodology.md`.
