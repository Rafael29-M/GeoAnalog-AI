"""Read-only, OFFLINE tests against the two authentic downloaded PDS products.

These skip in a fresh clone with no files. They never download test fixtures.
"""
import numpy as np
import pytest
import rasterio

from app.core.config import settings
from app.core.files import sha256
from app.repositories.catalog import Catalog
from app.services.dataset_loader import load_dataset, load_pds
from app.services.raster_processor import crop_region
from app.services.terrain_metrics import calculate
from app.repositories.results import LocalRepository
from app.models.schemas import SearchRequest
from app.services.comparison import search_analogs


@pytest.mark.real_data
@pytest.mark.parametrize('identifier,order,scale,expected_range', [
    ('moon-lola16', 'little', 0.5, (-17963, 21371)),
    ('mars-mola16', 'big', 1, (-8177, 21171)),
])
def test_authentic_pds_product(identifier, order, scale, expected_range):
    catalog = Catalog(settings)
    dataset = next(d for d in catalog.datasets() if d.id == identifier)
    if not all(settings.path(f.local_path).exists() for f in dataset.files):
        pytest.skip('Archivos oficiales ausentes; descargar manualmente o con download_selected.')
    source = load_dataset(dataset, settings)
    assert source.metadata.rows == 2880
    assert source.metadata.columns == 5760
    assert source.metadata.byte_order == order
    assert source.metadata.scale == scale
    assert source.metadata.applied_offset == 0
    assert source.raw_range() == expected_range
    label = next(f for f in dataset.files if f.role == 'label')
    # Independent GDAL decoder cross-check; read() returns DN, not scaled radii.
    with rasterio.open(settings.path(label.local_path)) as gdal_source:
        raw = gdal_source.read(1, window=((1400, 1404), (370, 374)))
        np.testing.assert_array_equal(source.read(1400, 1404, 370, 374), raw*scale)
    for item in dataset.files:
        assert sha256(settings.path(item.local_path)) == item.sha256
    for region in catalog.regions():
        if region.dataset_id == identifier:
            crop = crop_region(source, region)
            slope, roughness, spacing = calculate(crop, region.roughness_window_m)
            assert np.isfinite(crop.heights).all()
            assert np.nanmin(slope) >= 0 and np.nanmax(slope) < 90
            assert np.nanmin(roughness) >= 0
            assert spacing.dx_m > 1000


@pytest.mark.real_data
def test_xml_inconsistent_scale_is_rejected(tmp_path):
    dataset = next(d for d in Catalog(settings).datasets() if d.id == 'moon-lola16')
    paths = {f.role: settings.path(f.local_path) for f in dataset.files}
    if not all(p.exists() for p in paths.values()):
        pytest.skip('Faltan archivos oficiales para comprobar XML.')
    xml = tmp_path/'modified_label.xml'
    xml.write_text(paths['xml'].read_text().replace('<scaling_factor>0.5</scaling_factor>',
                                                  '<scaling_factor>1</scaling_factor>'), encoding='utf-8')
    with pytest.raises(ValueError, match='escala/offset'):
        load_pds(paths['image'], paths['label'], 'moon', xml)


@pytest.mark.real_data
@pytest.mark.parametrize('identifier',['earth-nasadem-s25w070','earth-nasadem-n35w112'])
def test_authentic_nasadem_zip(identifier):
    dataset=next(d for d in Catalog(settings).datasets() if d.id==identifier)
    if not settings.path(dataset.files[0].local_path).exists():
        pytest.skip('Falta NASADEM oficial.')
    source=load_dataset(dataset,settings)
    assert source.metadata.byte_order=='big'
    assert (source.metadata.rows,source.metadata.columns)==(3601,3601)
    assert source.quality_members is not None
    assert source.metadata.vertical_reference=='EGM96_geoid'
    assert sha256(source.path)==dataset.files[0].sha256
    mask=source.quality_mask(0,20,0,20)
    assert mask.shape==(20,20) and mask.dtype==np.bool_


@pytest.mark.real_data
def test_real_earth_planet_searches():
    results=LocalRepository(settings).regions()
    if any(r.status!='processed' for r in results):
        pytest.skip('Procesar primero los cuatro archivos/regiones reales.')
    non_earth_names = [r.region.name for r in results if r.region.body != 'earth']
    assert 'Luna' in non_earth_names and 'Marte' in non_earth_names
    for target in ('luna', 'marte'):
        response=search_analogs(SearchRequest(target_region_id=target),results)
        assert response.status=='ok'
        assert {m.region_id for m in response.matches}=={'tierra-arizona','tierra-atacama'}
        assert all(0<=m.distance<=1 and m.bounds is not None for m in response.matches)
    for result in results:
        assert result.metrics.scale.dx_m==result.metrics.scale.dy_m==4000
        assert result.metrics.scale.roughness_width_m==12000
        assert result.metrics.quality=='validation_only'
