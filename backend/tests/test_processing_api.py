import socket

import numpy as np
import pytest
import rasterio
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.schemas import Bounds, Metrics, RegionResult, SearchRequest
from app.repositories.results import LocalRepository, PostgresRepository
from app.services.comparison import incompatibilities, search_analogs
from app.services.processing import process_region


def test_outputs_and_offline_api(synthetic_project, monkeypatch):
    config, dataset, region, _ = synthetic_project

    original_connect = socket.socket.connect
    def no_network(sock, address):
        # Windows asyncio uses a loopback socket pair for its own event loop.
        if isinstance(address, tuple) and address[0] in ('127.0.0.1', '::1'):
            return original_connect(sock, address)
        raise AssertionError('External network not allowed in processing/API tests')

    monkeypatch.setattr(socket.socket, 'connect', no_network)
    result = process_region(dataset, region, config)
    assert result.status == 'processed', result.diagnostic
    m = result.metrics
    assert LocalRepository(config).result(region).metrics == m
    with rasterio.open(config.path(m.artifacts['geotiff'])) as src:
        assert src.count == 3
        assert src.descriptions == ('height', 'slope', 'roughness_std')
        assert src.tags()['vertical_reference'] == m.vertical_reference
        assert src.transform.c == 0
        assert src.read(1).shape == (64,64)
    assert set(m.artifacts) == {'geotiff'}
    with TestClient(create_app(config)) as client:
        assert client.get('/health').json()['regions_processed'] == 1
        assert client.get('/api/v1/datasets').json()[0]['id'] == dataset.id
        assert client.get('/api/v1/regions').status_code == 200
        assert [x['name'] for x in client.get('/api/v1/bodies').json()] == ['Tierra','Luna','Marte']
        assert client.get('/api/v1/regions/test-region').status_code == 200
        response = client.get('/api/v1/regions/test-region/metrics')
        assert response.status_code == 200
        assert response.json()['source_sha256'] == m.source_sha256
        search = client.post('/api/v1/analogs/search', json={'target_region_id': region.id})
        assert search.json()['status'] == 'no_compatible_regions'
        assert search.json()['matches'] == []


def test_not_processed_and_unknown_states(synthetic_project):
    config, _, region, _ = synthetic_project
    with TestClient(create_app(config)) as client:
        assert client.get('/health').status_code == 200
        assert client.get('/api/v1/regions/test-region/metrics').status_code == 409
        assert client.get('/api/v1/regions/unknown').status_code == 404
        assert client.post('/api/v1/analogs/search', json={'target_region_id': region.id}).json()['status'] == 'target_not_processed'
        assert client.post('/api/v1/analogs/search', json={'target_region_id': 'unknown'}).status_code == 404
        assert client.post('/api/v1/analogs/search', json={'target_region_id': region.id, 'limit': 0}).status_code == 422


def test_stale_and_failed_reprocessing_does_not_serve_old_metrics(synthetic_project):
    config, dataset, region, _ = synthetic_project
    result = process_region(dataset, region, config)
    assert result.status == 'processed'
    changed = region.model_copy(update={'roughness_window_m': 14000})
    assert LocalRepository(config).result(changed).status == 'stale'
    config.path(dataset.files[0].local_path).unlink()
    result = process_region(dataset, region, config)
    assert result.status == 'missing_data'
    assert LocalRepository(config).result(region).metrics is None
    with TestClient(create_app(config)) as client:
        assert client.get('/api/v1/regions/test-region/metrics').status_code == 409


def test_comparison_compatible_and_invalid_scales(synthetic_project):
    config, dataset, region, _ = synthetic_project
    target = process_region(dataset, region, config)
    # SYNTHETIC comparison only: clone the fixture to exercise the metric algebra.
    earth_region = region.model_copy(update={'id': 'test-earth', 'body': 'earth'})
    earth_metrics = target.metrics.model_copy(deep=True, update={'region_id': 'test-earth', 'body': 'earth',
                                                                'vertical_reference': 'EGM96_geoid'})
    earth = RegionResult(region=earth_region, status='processed', metrics=earth_metrics)
    request = SearchRequest(target_region_id=region.id)
    result = search_analogs(request, [target, earth])
    assert result.status == 'ok'
    assert result.matches[0].distance == 0
    earth.metrics.slope.mean = target.metrics.slope.mean * 3
    expected_slope_difference = 0.5
    result = search_analogs(request, [target, earth])
    assert result.matches[0].distance == pytest.approx(expected_slope_difference / np.sqrt(2))
    earth.metrics.scale.dx_m *= 2
    assert incompatibilities(target.metrics, earth.metrics)
    result = search_analogs(request, [target, earth])
    assert result.status == 'no_compatible_regions'
    assert 'test-earth' in result.excluded


def test_incompatible_method_and_quality(synthetic_project):
    config, dataset, region, _ = synthetic_project
    m = process_region(dataset, region, config).metrics
    altered = m.model_copy(update={'quality': 'insufficient', 'roughness_method': 'different', 'slope_unit': 'radians'})
    assert len(incompatibilities(m, altered)) == 3


def test_postgres_failure_is_explicit_and_redacted(synthetic_project, monkeypatch):
    config, _, _, _ = synthetic_project
    config = config.model_copy(update={'database_url': 'postgresql://secret@invalid/example'})
    def unavailable(self):
        raise RuntimeError('secret credentials')
    monkeypatch.setattr(PostgresRepository, 'connect', unavailable)
    with TestClient(create_app(config)) as client:
        response = client.get('/health')
        assert response.status_code == 503
        assert 'secret' not in response.text
