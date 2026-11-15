import os
import platform

import numpy as np
import rasterio

from app.core.config import Settings
from app.core.files import fingerprint, sha256, utc_now
from app.models.schemas import Dataset, Metrics, Region, RegionResult
from app.repositories.results import LocalRepository
from app.services.dataset_loader import load_dataset
from app.services.raster_processor import crop_region
from app.services.terrain_metrics import calculate, statistics


def process_region(dataset: Dataset, region: Region, config: Settings) -> RegionResult:
    store = LocalRepository(config)
    store.save(RegionResult(region=region, status='processing'))
    try:
        if dataset.body != region.body or dataset.id != region.dataset_id:
            raise ValueError('La región y el dataset no corresponden al mismo cuerpo/producto.')
        source = load_dataset(dataset, config)
        hashes = {}
        for item in dataset.files:
            path = config.path(item.local_path)
            if path.exists():
                digest = sha256(path)
                if item.sha256 and item.sha256 != digest:
                    raise ValueError(f'Integridad: SHA-256 diferente para {item.filename}.')
                hashes[item.role] = digest
        crop = crop_region(source, region)
        slope, roughness, scale = calculate(crop, region.roughness_window_m)
        fraction = float(np.isfinite(crop.heights).mean())
        slope_fraction = np.isfinite(slope[1:-1, 1:-1]).mean()
        ry, rx = scale.roughness_rows//2, scale.roughness_columns//2
        roughness_fraction = np.isfinite(roughness[ry:-ry, rx:-rx]).mean()
        warnings = list(source.metadata.warnings)
        warnings.extend(['Estadísticas exploratorias; no prueba de analogía geológica.',
                         'Rugosidad = desviación estándar local de altura; incluye tendencias de pendiente.',
                         'Se excluyen bordes y vecindarios con nodata; la ventana efectiva se registra en metros.'])
        quality = 'validation_only'
        if min(fraction, slope_fraction, roughness_fraction) < 0.90:
            quality = 'insufficient'
            warnings.append('Menos del 90% de cobertura válida en alturas o vecindarios: excluir de comparaciones.')
        directory = config.path(f'data/processed/{region.body}/{region.id}')
        directory.mkdir(parents=True, exist_ok=True)
        artifacts = {
            'geotiff': f'data/processed/{region.body}/{region.id}/terrain.tif',
        }
        method = 'common-grid-terrain-v2' if region.analysis_resolution_m else 'native-terrain-v1'
        if region.analysis_resolution_m:
            warnings.append('Agregación a malla física común; ranking exploratorio, con distinta densidad/calidad de observaciones de origen.')
        tif = config.path(artifacts['geotiff'])
        with rasterio.open(tif.with_suffix('.tif.tmp'), 'w', driver='GTiff', height=crop.heights.shape[0],
                           width=crop.heights.shape[1], count=3, dtype='float32', crs=crop.crs, transform=crop.transform,
                           nodata=np.nan, compress='deflate') as dst:
            for index, (values, name, unit) in enumerate(((crop.heights, 'height', 'm'), (slope, 'slope', 'degree'),
                                                        (roughness, 'roughness_std', 'm')), 1):
                dst.write(values.astype(np.float32), index)
                dst.set_band_description(index, name)
                dst.update_tags(index, units=unit)
            dst.update_tags(vertical_reference=source.metadata.vertical_reference, source_sha256=hashes['image'],
                            method_version=method, coordinate_system=source.metadata.coordinate_system,
                            resampling=crop.resampling)
        os.replace(tif.with_suffix('.tif.tmp'), tif)
        result_metrics = Metrics(region_id=region.id, dataset_id=dataset.id, body=region.body, created_at=utc_now(),
                                 region_fingerprint=fingerprint(region.model_dump()), source_sha256=hashes['image'],
                                 label_sha256=hashes.get('label'), vertical_reference=source.metadata.vertical_reference,
                                 bounds=crop.bounds, rows=crop.heights.shape[0], columns=crop.heights.shape[1],
                                 valid_fraction=fraction, slope_valid_fraction=float(slope_fraction),
                                 roughness_valid_fraction=float(roughness_fraction), quality=quality, scale=scale,
                                 height=statistics(crop.heights),
                                 slope=statistics(slope), roughness=statistics(roughness), artifacts=artifacts, warnings=warnings,
                                 method_version=method,runtime={'python':platform.python_version(),'numpy':np.__version__,
                                                               'rasterio':rasterio.__version__,'gdal':rasterio.__gdal_version__})
        result = RegionResult(region=region, status='processed', metrics=result_metrics)
    except (ValueError, OSError, KeyError) as exc:
        result = RegionResult(region=region, status='missing_data' if isinstance(exc, FileNotFoundError) else 'failed',
                              diagnostic=str(exc))
    store.save(result)
    return result
