import numpy as np
import pytest

from app.models.schemas import Bounds
from app.services.dataset_loader import load_dataset
from app.services.raster_processor import crop_region
from app.services.terrain_metrics import calculate, roughness_std, slope_degrees


def test_physical_plane_slope():
    northing = -np.arange(20)*200.0
    east = np.arange(30)*100.0
    height = 0.2*northing[:, None] + 0.1*east[None, :]
    result = slope_degrees(height, np.full(20, 100.0), northing)
    np.testing.assert_allclose(result[1:-1, 1:-1], np.degrees(np.arctan(np.hypot(0.1, 0.2))))
    assert np.isnan(result[0]).all()


def test_flat_terrain():
    z = np.full((20, 20), 1000.0)
    np.testing.assert_allclose(slope_degrees(z, np.full(20, 30), -np.arange(20)*30.0)[1:-1, 1:-1], 0)
    np.testing.assert_allclose(roughness_std(z, 3, 3)[1:-1, 1:-1], 0)


def test_roughness_population_std_and_nodata():
    z = np.tile(np.arange(9, dtype=float)*10, (9, 1))
    result = roughness_std(z, 3, 3)
    np.testing.assert_allclose(result[1:-1, 1:-1], np.sqrt(2/3)*10)
    z[4, 4] = np.nan
    result = roughness_std(z, 3, 3)
    assert np.isnan(result[3:6, 3:6]).all()
    assert np.isfinite(result[1, 1])


def test_crop_centers_orientation_and_spacing(synthetic_project):
    config, dataset, region, raw = synthetic_project
    source = load_dataset(dataset, config)
    region = region.model_copy(update={'bounds': Bounds(west=1, east=3, south=1, north=3)})
    crop = crop_region(source, region)
    assert crop.heights.shape == (32, 32)
    np.testing.assert_array_equal(crop.heights, raw[16:48, 16:48]*0.5)
    assert crop.latitudes[0] == 2.96875
    assert crop.longitudes[0] == 1.03125
    np.testing.assert_allclose(crop.dx_m, 1737400*np.deg2rad(1/16)*np.cos(np.deg2rad(crop.latitudes)))
    slope, roughness, scale = calculate(crop, 12000)
    assert scale.roughness_rows == 7
    assert scale.roughness_height_m == pytest.approx(7*1737400*np.deg2rad(1/16))
    assert np.isfinite(slope[1:-1, 1:-1]).all()


@pytest.mark.parametrize('bounds', [dict(west=0, east=0.5, south=0, north=0.5),
                                  dict(west=3, east=5, south=0, north=2)])
def test_reject_small_or_outside_crop(synthetic_project, bounds):
    config, dataset, region, _ = synthetic_project
    with pytest.raises(ValueError):
        crop_region(load_dataset(dataset, config), region.model_copy(update={'bounds': Bounds(**bounds)}))


def test_reject_underresolved_roughness(synthetic_project):
    config, dataset, region, _ = synthetic_project
    crop = crop_region(load_dataset(dataset, config), region)
    with pytest.raises(ValueError, match='insuficiente'):
        calculate(crop, 1000)


def test_common_grid_preserves_constant_height(synthetic_project):
    config, dataset, region, raw = synthetic_project
    np.full(raw.shape,1200,dtype='<i2').tofile(config.path(dataset.files[0].local_path))
    common = region.model_copy(update={'analysis_resolution_m':4000,'analysis_size_m':64000})
    crop = crop_region(load_dataset(dataset,config),common)
    assert crop.heights.shape == (16,16)
    np.testing.assert_allclose(crop.heights,600,atol=1e-10)
    assert crop.transform.a == 4000 and crop.transform.e == -4000
    slope, roughness, scale = calculate(crop,12000)
    np.testing.assert_allclose(slope[1:-1,1:-1],0,atol=1e-10)
    np.testing.assert_allclose(roughness[1:-1,1:-1],0,atol=1e-8)
    assert scale.roughness_width_m == scale.roughness_height_m == 12000
    assert scale.dx_m == scale.dy_m == 4000
    assert scale.width_m == scale.height_m == 64000
    assert scale.resampling == 'area_average_local_aeqd_v1'


def test_common_grid_does_not_upsample(synthetic_project):
    config,dataset,region,_ = synthetic_project
    common=region.model_copy(update={'analysis_resolution_m':1000,'analysis_size_m':32000})
    with pytest.raises(ValueError,match='más fina'):
        crop_region(load_dataset(dataset,config),common)


def test_common_grid_rejects_partial_source_coverage(synthetic_project):
    config,dataset,region,_ = synthetic_project
    common=region.model_copy(update={'analysis_resolution_m':4000,'analysis_size_m':64000,
                                     'bounds':Bounds(west=0,east=0.5,south=0,north=0.5)})
    with pytest.raises(ValueError,match='cobertura'):
        crop_region(load_dataset(dataset,config),common)


def test_common_grid_propagates_invalid_cells(synthetic_project):
    config,dataset,region,raw = synthetic_project
    raw[:,:32]=-32768
    raw.astype('<i2').tofile(config.path(dataset.files[0].local_path))
    common=region.model_copy(update={'analysis_resolution_m':4000,'analysis_size_m':64000})
    crop=crop_region(load_dataset(dataset,config),common)
    assert np.isnan(crop.heights[:,:7]).all()
    assert np.isfinite(crop.heights[:,9:]).all()
