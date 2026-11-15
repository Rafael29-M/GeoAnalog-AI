"""All fixtures here are SYNTHETIC and never enter the production manifests."""
from pathlib import Path

import numpy as np
import pytest

from app.core.config import Settings
from app.core.files import write_json
from app.models.schemas import Bounds, Dataset, DatasetFile, Region


def synthetic_pds(directory: Path, body='moon', rows=64, columns=64, nodata=True):
    directory.mkdir(parents=True, exist_ok=True)
    moon = body == 'moon'
    name = 'synthetic_lola' if moon else 'synthetic_mola'
    image, label = directory/f'{name}.img', directory/f'{name}.lbl'
    values = (np.arange(rows)[:, None]*10 + np.arange(columns)[None, :]*2 - 1000).astype(np.int16)
    if nodata:
        values[0, 0] = -32768
    values.astype('<i2' if moon else '>i2').tofile(image)
    label.write_text(f'''PDS_VERSION_ID = PDS3
TARGET_NAME = {body.upper()}
INSTRUMENT_ID = {'LOLA' if moon else 'MOLA'}
PRODUCT_ID = SYNTHETIC_TEST_ONLY
PRODUCT_VERSION_ID = TEST
RECORD_BYTES = {columns*2}
FILE_RECORDS = {rows}
^IMAGE = "{image.name}"
OBJECT = IMAGE
 NAME = {'HEIGHT' if moon else 'MEDIAN_TOPOGRAPHY'}
 LINES = {rows}
 LINE_SAMPLES = {columns}
 SAMPLE_TYPE = {'LSB_INTEGER' if moon else 'MSB_INTEGER'}
 SAMPLE_BITS = 16
 UNIT = METER
 SCALING_FACTOR = {0.5 if moon else 1}
 OFFSET = {1737400 if moon else 0}
 {'MISSING_CONSTANT = -32768' if nodata else ''}
END_OBJECT = IMAGE
OBJECT = IMAGE_MAP_PROJECTION
 MAP_PROJECTION_TYPE = "SIMPLE CYLINDRICAL"
 MAP_PROJECTION_ROTATION = 0
 POSITIVE_LONGITUDE_DIRECTION = EAST
 MAP_RESOLUTION = 16 <PIXEL/DEGREE>
 MAP_SCALE = {1895.21 if moon else 3705} <M/PIXEL>
 A_AXIS_RADIUS = {1737.4 if moon else 3396} <KM>
 B_AXIS_RADIUS = {1737.4 if moon else 3396} <KM>
 C_AXIS_RADIUS = {1737.4 if moon else 3396} <KM>
 MAXIMUM_LATITUDE = {rows/16}
 MINIMUM_LATITUDE = 0
 WESTERNMOST_LONGITUDE = 0
 EASTERNMOST_LONGITUDE = {columns/16}
 COORDINATE_SYSTEM_NAME = SYNTHETIC_TEST_SPHERE
END_OBJECT = IMAGE_MAP_PROJECTION
END
''', encoding='ascii')
    return image, label, values


@pytest.fixture
def synthetic_project(tmp_path):
    config = Settings(root=tmp_path, database_url='', _env_file=None)
    config.prepare()
    image, label, raw = synthetic_pds(tmp_path/'data/raw/moon')
    dataset = Dataset(id='test-moon', body='moon', source='SYNTHETIC TEST ONLY', instrument='LOLA', product='TEST',
                      source_url='https://example.invalid/synthetic', format='PDS3', remote_subset='test only',
                      files=[DatasetFile(filename=image.name, local_path=image.relative_to(tmp_path).as_posix(), role='image'),
                             DatasetFile(filename=label.name, local_path=label.relative_to(tmp_path).as_posix(), role='label')])
    region = Region(id='test-region', name='SYNTHETIC TEST ONLY', body='moon', dataset_id=dataset.id,
                    bounds=Bounds(west=0, east=4, south=0, north=4), roughness_window_m=12000,
                    source_url='https://example.invalid/synthetic', purpose='Unit test, not a scientific measurement.')
    write_json(config.path('manifests/datasets.json'), {'datasets': [dataset.model_dump()]})
    write_json(config.path('manifests/regions.json'), {'regions': [region.model_dump()]})
    return config, dataset, region, raw
