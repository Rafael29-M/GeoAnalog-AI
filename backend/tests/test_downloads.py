import httpx
import pytest

from app.core.config import Settings
from app.models.schemas import DatasetFile
from app.services.downloads import DownloadBlocked, download_file, inspect_remote, validate_url


@pytest.fixture
def download_setup(tmp_path):
    config = Settings(root=tmp_path, max_file_bytes=20, total_download_bytes=30, _env_file=None)
    config.prepare()
    item = DatasetFile(filename='test.img', local_path='data/raw/moon/test.img', role='image',
                       url='https://pds-geosciences.wustl.edu/test.img', expected_bytes=4)
    return config, item


def client_for(length='4', content=b'abcd', content_type='application/octet-stream'):
    def handler(request):
        if request.method == 'HEAD':
            headers = {} if length is None else {'content-length': length}
            return httpx.Response(200, headers=headers)
        return httpx.Response(200, headers={'content-type': content_type}, content=content)
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=False)


def test_download_hash_and_idempotence(download_setup):
    config, item = download_setup
    with client_for() as client:
        result = download_file(item, config, client)
        assert result['status'] == 'downloaded'
        assert config.path(item.local_path).read_bytes() == b'abcd'
        assert len(item.sha256) == 64
        assert item.downloaded_at is not None
    def no_requests(request):
        raise AssertionError('Existing downloads must not make network requests')
    with httpx.Client(transport=httpx.MockTransport(no_requests)) as client:
        assert download_file(item, config, client)['status'] == 'already_present'


@pytest.mark.parametrize('size', [None, '100', '5'])
def test_refuse_unknown_large_or_changed_size(download_setup, size):
    config, item = download_setup
    with client_for(length=size) as client, pytest.raises(DownloadBlocked):
        download_file(item, config, client)
    assert not config.path(item.local_path).exists()


@pytest.mark.parametrize('content', [b'ab', b'abcdef'])
def test_incomplete_or_overrun_removed(download_setup, content):
    config, item = download_setup
    with client_for(content=content) as client, pytest.raises(DownloadBlocked):
        download_file(item, config, client)
    assert not config.path(item.local_path).exists()
    assert not list(config.path('data/raw').rglob('*.part'))


def test_budget_includes_existing_files(download_setup):
    config, item = download_setup
    config.path('data/raw/earth/existing.hgt').write_bytes(b'x'*28)
    with client_for() as client, pytest.raises(DownloadBlocked, match='Total previsto'):
        download_file(item, config, client)


def test_html_not_scientific_file(download_setup):
    config, item = download_setup
    with client_for(content_type='text/html') as client, pytest.raises(DownloadBlocked):
        download_file(item, config, client)


@pytest.mark.parametrize('url', ['http://pds-geosciences.wustl.edu/a', 'https://evil.example/a',
                               'https://pds-geosciences.wustl.edu.evil.example/a',
                               'https://user:secret@pds-geosciences.wustl.edu/a'])
def test_download_source_allowlist(url):
    with pytest.raises(DownloadBlocked):
        validate_url(url)


def test_path_traversal_blocked(download_setup):
    config, item = download_setup
    item.local_path = '../test.img'
    with client_for() as client, pytest.raises(ValueError):
        download_file(item, config, client)


def test_existing_file_integrity_mismatch(download_setup):
    config, item = download_setup
    config.path(item.local_path).write_bytes(b'xxxx')
    item.sha256 = '0'*64
    with client_for() as client, pytest.raises(DownloadBlocked, match='SHA-256'):
        download_file(item, config, client)


def test_explicit_per_file_limit(download_setup):
    config, item = download_setup
    item.expected_bytes = None
    with client_for(length='100') as client, pytest.raises(DownloadBlocked, match='límite por archivo'):
        inspect_remote(item, config, client)


def test_redirect_requires_source_review(download_setup):
    config, item = download_setup
    with httpx.Client(transport=httpx.MockTransport(lambda request: httpx.Response(
            302, headers={'location': 'https://example.invalid/file'}))) as client:
        with pytest.raises(DownloadBlocked, match='redirección'):
            inspect_remote(item, config, client)
