import pytest

from app.core.files import write_json
from app.repositories.catalog import Catalog
from scripts.inspect_datasets import discover_nasadem


def test_region_budget(synthetic_project):
    config, _, region, _ = synthetic_project
    regions = [region.model_copy(update={'id': f'test-{i}'}).model_dump() for i in range(8)]
    write_json(config.path('manifests/regions.json'), {'regions': regions})
    with pytest.raises(ValueError, match='Máximo'):
        Catalog(config).regions()


def test_manual_detection_does_not_duplicate_zip_and_hgt(synthetic_project):
    config, dataset, _, _ = synthetic_project
    # Deliberately empty placeholders here test discovery only, never a successful reader.
    config.path('data/raw/earth/NASADEM_HGT_s24w071.zip').touch()
    config.path('data/raw/earth/s24w071.hgt').touch()
    discovered = discover_nasadem([dataset], config)
    assert len(discovered) == 2
    earth = next(d for d in discovered if d.body == 'earth')
    assert earth.id == 'earth-nasadem-s24w071'
    assert earth.files[0].downloaded_at is None
    assert earth.files[0].url is None
    assert len(discover_nasadem(discovered, config)) == 2
