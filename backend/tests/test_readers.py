import zipfile

import numpy as np
import pytest

from app.services.dataset_loader import load_nasadem, load_pds, pds_fields
from tests.conftest import synthetic_pds


@pytest.mark.parametrize('body,scale,order', [('moon', 0.5, 'little'), ('mars', 1, 'big')])
def test_pds_endian_scale_nodata(tmp_path, body, scale, order):
    image, label, raw = synthetic_pds(tmp_path, body)
    source = load_pds(image, label, body)
    result = source.read()
    assert result.shape == (64, 64)
    assert np.isnan(result[0, 0])
    np.testing.assert_array_equal(result[1:], raw[1:]*scale)
    assert source.metadata.unit == 'm'
    assert source.metadata.applied_offset == 0
    assert source.metadata.byte_order == order
    assert abs(result[1, 1]) < 10000  # Never add the lunar reference radius.


@pytest.mark.parametrize('old,new', [('UNIT = METER', 'UNIT = KM'),
                                    ('SAMPLE_TYPE = LSB_INTEGER', 'SAMPLE_TYPE = MSB_INTEGER'),
                                    ('NAME = HEIGHT', 'NAME = RADIUS'),
                                    ('SAMPLE_BITS = 16', 'SAMPLE_BITS = 32'),
                                    ('MAP_PROJECTION_ROTATION = 0', 'MAP_PROJECTION_ROTATION = 1')])
def test_rejects_wrong_product_units_and_encoding(tmp_path, old, new):
    image, label, _ = synthetic_pds(tmp_path)
    label.write_text(label.read_text().replace(old, new))
    with pytest.raises(ValueError):
        load_pds(image, label, 'moon')


def test_truncated_file(tmp_path):
    image, label, _ = synthetic_pds(tmp_path)
    image.write_bytes(b'\x01\x02')
    with pytest.raises(ValueError, match='Dimensiones'):
        load_pds(image, label, 'moon')


def test_no_invented_nodata(tmp_path):
    image, label, _ = synthetic_pds(tmp_path, nodata=False)
    source = load_pds(image, label, 'moon')
    assert source.metadata.nodata == []
    assert source.metadata.nodata_declared is False


def test_pds_multiline_comments_and_groups(tmp_path):
    _, label, _ = synthetic_pds(tmp_path)
    label.write_text(label.read_text().replace('PDS_VERSION_ID = PDS3',
        '/* SAMPLE_BITS = 8 */\nPDS_VERSION_ID = PDS3\nDESCRIPTION = "a multi\nline value"'))
    groups = pds_fields(label)
    assert groups['ROOT']['DESCRIPTION'] == 'a multi\nline value'
    assert groups['IMAGE']['SAMPLE_BITS'] == '16'


def test_nasadem_hgt_and_zip(tmp_path):
    # Synthetic sparse HGT with official dimensions; no real terrestrial science claim.
    path = tmp_path/'s24w071.hgt'
    with path.open('wb') as stream:
        stream.write(np.array([-32768, -1234, 256], dtype='>i2').tobytes())
        stream.seek(3601*3601*2-1)
        stream.write(b'\0')
    for zipped in (False, True):
        target = path
        if zipped:
            target = tmp_path/'NASADEM_HGT_s24w071.zip'
            with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                archive.write(path, path.name)
        source = load_nasadem(target)
        result = source.read(0, 1, 0, 3)
        assert np.isnan(result[0, 0])
        np.testing.assert_array_equal(result[0, 1:], [-1234, 256])
        assert source.metadata.vertical_reference == 'EGM96_geoid'
        assert source.metadata.bounds.west == -71
        assert source.metadata.bounds.south == -24


def test_nasadem_rejects_small_hgt(tmp_path):
    path = tmp_path/'s24w071.hgt'
    path.write_bytes(b'\0'*128)
    with pytest.raises(ValueError, match='25934402'):
        load_nasadem(path)
