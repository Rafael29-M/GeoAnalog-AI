# Datos oficiales descargados

Adquisición y verificación: **14 de noviembre de 2026**. URLs individuales, tamaños, hashes y fechas UTC: `manifests/datasets.json`.

| Producto | Archivo | Bytes |
| --- | --- | ---: |
| LOLA, Luna | `ldem_16.img` | 33 177 600 |
| MOLA, Marte | `megt90n000eb.img` | 33 177 600 |
| NASADEM, Atacama | `NASADEM_HGT_s25w070.zip` | 12 390 568 |
| NASADEM, Arizona | `NASADEM_HGT_n35w112.zip` | 10 464 865 |
| Etiquetas planetarias | LBL/XML/HDR | 38 463 |
| **Total** | | **89 249 096** |

Quedan 30 750 904 bytes del presupuesto de 120 MB. Los ZIP se leen sin extraer duplicados al disco. Los originales están excluidos de Git.

## Tierra — NASADEM_HGT.001

Se descargaron dos gránulos de **C2763264762-LPCLOUD** usando la sesión Earthdata del usuario:

- Atacama: [G2816781179-LPCLOUD](https://cmr.earthdata.nasa.gov/search/concepts/G2816781179-LPCLOUD.umm_json), `s25w070`: oeste −70°, este −69°, sur −25°, norte −24°.
- Arizona: [G2816849633-LPCLOUD](https://cmr.earthdata.nasa.gov/search/concepts/G2816849633-LPCLOUD.umm_json), `n35w112`: oeste −112°, este −111°, sur 35°, norte 36°.

En `data/raw/earth/`, cada ZIP contiene HGT, NUM y SWB. HGT: 3601 × 3601 postes int16 big-endian, un segundo de arco, alturas EGM96; 25 934 402 bytes descomprimido. Se aplican máscaras NUM/SWB según la [guía NASADEM V1.3](https://lpdaac.usgs.gov/documents/2237/NASADEM_User_Guide_V13.pdf). El tratamiento de −32768 sigue el [formato GDAL SRTMHGT](https://gdal.org/en/stable/drivers/raster/srtmhgt.html).

No se guardaron credenciales en el proyecto. Para otro mosaico: descargar un archivo NASADEM_HGT.001 mediante [Earthdata Search](https://search.earthdata.nasa.gov/), revisar presupuesto, colocarlo en `data/raw/earth/`, ejecutar `scripts.inspect_datasets`, declarar su región y procesarla. Conservar la procedencia; un HGT aislado no demuestra que sea NASADEM.

La selección se apoya en fuentes NASA sobre [Atacama](https://astrobiology.nasa.gov/nai/annual-reports/2008/seti/planetary-scale-transition-from-abiotic-to-biotic-nitrogen-cycle/) y [análogos de Arizona](https://science.nasa.gov/solar-system/planetary-analogs/10-things-to-know-about-planetary-analogs/). Las cajas exactas son decisiones del prototipo. En Atacama se revisaron tres centros por cobertura NUM/SWB y se eligió −24,35°, −69,5°, sin usar la puntuación de similitud. Arizona se centra en 35,5°, −111,5°. Son ventanas regionales de 64 km por eje.

## Luna — LOLA

[Directorio PDS](https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/). En `data/raw/moon/`: `ldem_16.img`, `.lbl`, `.xml`.

Etiqueta científica V3.1: matriz global 2880 × 5760, int16 little-endian, 16 píxeles/grado, escala 0,5 m, radio 1 737 400 m. Paso ecuatorial aproximado 1895 m. Rango binario observado −17963…21371; no se inventa nodata.

Una entrada `luna`, con ventana centrada en 0,6875°, 23,5°, en contexto documentado por [NASA NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html). El archivo permite escoger otra zona modificando el manifiesto y reprocesando. La métrica actual no representa toda la Luna.

## Marte — MOLA

[Directorio MEG016](https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/). En `data/raw/mars/`: `megt90n000eb.img`, `.lbl`, `.xml`, `.hdr`.

Versión 2.0: matriz global 2880 × 5760, int16 big-endian, metros de topografía respecto al areoide GMM3 (mgm1025), grado/orden 50. Coordenadas planetocéntricas IAU2000; radio cartográfico 3 396 000 m. Paso norte-sur 3704,46 m; rango binario −8177…21171.

El HDR ignora ceros, pero LBL/XML no los declaran nodata: se conservan y se registra la discrepancia. Se usa topografía, no radio, areoide ni conteo.

Una entrada `marte`, centrada en −5°, 138°, en contexto documentado por [JPL](https://www.jpl.nasa.gov/images/pia12507-perspective-view-of-layered-mound-in-gale-crater-mars/). Sus métricas describen una ventana regional, no todo Marte.

## Adquisición

La descarga asistida de PDS respeta 40 MB por archivo, 120 MB total y ausencia de descargas recursivas. NASADEM se incorpora por descarga autenticada individual. Ningún endpoint descarga datos.

LOLA64 completo supera 530 MB y no se descargó. MOLA MEG064/128 requieren seleccionar mosaicos concretos. [Lunar ODE](https://ode.rsl.wustl.edu/moon/) y [ODE GDS](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Additional_Resources/ODE_REST_API.htm) permiten investigar subconjuntos oficiales de observaciones. No se asume recorte remoto de IMG ni HTTP Range. Los archivos actuales validan un flujo regional de resolución gruesa.
