from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.models.schemas import BodySummary, Dataset, Metrics, RegionResult, SearchRequest, SearchResponse
from app.services.comparison import search_analogs


def terrain_router(store) -> APIRouter:
    router = APIRouter(prefix='/api/v1')

    @router.get('/bodies', response_model=list[BodySummary])
    def bodies():
        datasets, regions = store.datasets(), store.regions()
        result = []
        for body, name in [('earth', 'Tierra'), ('moon', 'Luna'), ('mars', 'Marte')]:
            selected = [r for r in regions if r.region.body == body]
            count = sum(r.status == 'processed' for r in selected)
            result.append(BodySummary(id=body, name=name, dataset_ids=[d.id for d in datasets if d.body == body],
                region_ids=[r.region.id for r in selected], processed_regions=count,
                status='ready' if count else 'not_processed',
                note='Las métricas describen ventanas de terreno, no una media de todo el cuerpo.'))
        return result

    @router.get('/datasets', response_model=list[Dataset])
    def datasets(body: str | None = Query(default=None, description='Filtrar por cuerpo: earth, moon o mars')):
        items = store.datasets()
        if body is not None:
            items = [d for d in items if d.body == body]
        return items

    @router.get('/summary')
    def summary():
        """Resumen JSON de todas las regiones: métricas clave de altura, pendiente y rugosidad."""
        regions = store.regions()
        result = []
        for r in regions:
            entry = {
                'region_id': r.region.id,
                'name': r.region.name,
                'body': r.region.body,
                'status': r.status,
            }
            if r.metrics:
                entry['height_mean_m'] = r.metrics.height.mean
                entry['height_std_m'] = r.metrics.height.std
                entry['height_p10_m'] = r.metrics.height.p10
                entry['height_p90_m'] = r.metrics.height.p90
                entry['slope_mean_deg'] = r.metrics.slope.mean
                entry['slope_std_deg'] = r.metrics.slope.std
                entry['slope_p10_deg'] = r.metrics.slope.p10
                entry['slope_p90_deg'] = r.metrics.slope.p90
                entry['roughness_mean_m'] = r.metrics.roughness.mean
                entry['roughness_std_m'] = r.metrics.roughness.std
                entry['roughness_p10_m'] = r.metrics.roughness.p10
                entry['roughness_p90_m'] = r.metrics.roughness.p90
                entry['dx_m'] = r.metrics.scale.dx_m
                entry['dy_m'] = r.metrics.scale.dy_m
                entry['quality'] = r.metrics.quality
                entry['valid_fraction'] = r.metrics.valid_fraction
            result.append(entry)
        return result

    @router.get('/regions', response_model=list[RegionResult], response_model_exclude={'__all__': {'metrics'}})
    def regions(
        body: str | None = Query(default=None, description='Filtrar por cuerpo: earth, moon o mars'),
        status: str | None = Query(default=None, description='Filtrar por estado: processed, not_processed, failed, stale'),
    ):
        items = store.regions()
        if body is not None:
            items = [r for r in items if r.region.body == body]
        if status is not None:
            items = [r for r in items if r.status == status]
        return items

    def find_region(identifier: str):
        for result in store.regions():
            if result.region.id == identifier:
                return result
        raise HTTPException(status_code=404, detail='Región desconocida.')

    @router.get('/regions/{identifier}', response_model=RegionResult)
    def region(identifier: str):
        return find_region(identifier)

    @router.get('/regions/{identifier}/metrics', response_model=Metrics)
    def metrics(identifier: str):
        result = find_region(identifier)
        if result.status != 'processed' or result.metrics is None:
            raise HTTPException(status_code=409, detail={'status': result.status, 'message': result.diagnostic})
        return result.metrics

    @router.get('/regions/{identifier}/geotiff', response_class=FileResponse)
    def geotiff(identifier: str):
        """Descarga el GeoTIFF de terreno (altura, pendiente, rugosidad) de la región."""
        result = find_region(identifier)
        if result.status != 'processed' or result.metrics is None:
            raise HTTPException(status_code=409, detail={'status': result.status, 'message': result.diagnostic})
        tif_relative = result.metrics.artifacts.get('geotiff')
        if not tif_relative:
            raise HTTPException(status_code=404, detail='GeoTIFF no registrado en esta región.')
        from app.core.config import settings
        tif_path: Path = settings.path(tif_relative)
        if not tif_path.exists():
            raise HTTPException(status_code=404, detail='Archivo GeoTIFF no encontrado en disco. Reprocesar la región.')
        return FileResponse(
            path=str(tif_path),
            media_type='image/tiff',
            filename=f'terrain_{identifier}.tif',
        )

    @router.post('/analogs/search', response_model=SearchResponse)
    def analogs(request: SearchRequest):
        try:
            return search_analogs(request, store.regions())
        except KeyError:
            raise HTTPException(status_code=404, detail='Región objetivo desconocida.')
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))

    @router.get('/metadata/pds')
    def pds_metadata():
        """Devuelve los metadatos oficiales del inventario NASA PDS Diviner RDR Calibrado."""
        return {
            'fuente_original': 'https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1002/data/collection_data_calibrated2_inventory.csv',
            'instrument': 'NASA LRO Diviner Lunar Radiometer Experiment (DLRE)',
            'total_disponible': 500,
            'dataset_urns': [
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010000_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010010_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010020_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010030_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010040_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010050_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010100_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010110_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010120_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010130_rdr::1.0'
            ],
            'calibration_product': 'RDR V1.0 Calibrated2',
            'measurement_type': 'Calibrated Thermal Radiance / Surface Temperature (Kelvin)'
        }

    return router
