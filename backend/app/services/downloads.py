"""Explicit, bounded PDS downloads. This module is never imported by API routes."""
from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.core.config import Settings
from app.core.files import sha256, utc_now
from app.models.schemas import DatasetFile

PDS_HOST = 'pds-geosciences.wustl.edu'


class DownloadBlocked(ValueError):
    pass


def validate_url(url: str) -> None:
    parsed = urlparse(url)
    if (parsed.scheme != 'https' or parsed.hostname != PDS_HOST or parsed.port not in (None, 443)
            or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise DownloadBlocked('Solo URLs HTTPS públicas verificadas de PDS, sin credenciales ni redirecciones.')


def target_path(item: DatasetFile, config: Settings) -> Path:
    path = config.path(item.local_path)
    if not path.is_relative_to(config.path('data/raw')) or path.name != item.filename:
        raise DownloadBlocked('Destino fuera de data/raw o nombre incompatible.')
    return path


def raw_bytes(config: Settings) -> int:
    return sum(p.stat().st_size for p in config.path('data/raw').rglob('*') if p.is_file())


def inspect_remote(item: DatasetFile, config: Settings, client: httpx.Client) -> dict:
    if item.url is None:
        raise DownloadBlocked('Descarga manual: falta URL individual autorizada.')
    validate_url(item.url)
    target_path(item, config)
    response = client.head(item.url)
    if response.is_redirect:
        raise DownloadBlocked('La redirección requiere revisar la fuente.')
    response.raise_for_status()
    length = response.headers.get('content-length')
    if not length or not length.isdecimal() or int(length) <= 0:
        raise DownloadBlocked('Tamaño desconocido: no se descarga automáticamente.')
    size = int(length)
    if item.expected_bytes is not None and size != item.expected_bytes:
        raise DownloadBlocked(f'Tamaño remoto {size} B distinto del manifiesto {item.expected_bytes} B.')
    if size > config.max_file_bytes:
        raise DownloadBlocked(f'{size} B supera el límite por archivo de {config.max_file_bytes} B.')
    return {'filename': item.filename, 'url': item.url, 'size_bytes': size}


def download_file(item: DatasetFile, config: Settings, client: httpx.Client) -> dict:
    path = target_path(item, config)
    if path.exists():
        actual_hash = sha256(path)
        if item.expected_bytes and path.stat().st_size != item.expected_bytes:
            raise DownloadBlocked(f'{path.name}: archivo existente de tamaño incorrecto; revisar manualmente.')
        if item.sha256 and item.sha256 != actual_hash:
            raise DownloadBlocked(f'{path.name}: SHA-256 cambió; no se sobrescribe.')
        item.sha256 = actual_hash
        item.size_bytes = path.stat().st_size
        return {'filename': item.filename, 'status': 'already_present', 'size_bytes': item.size_bytes}
    plan = inspect_remote(item, config, client)
    size = plan['size_bytes']
    occupied = raw_bytes(config)
    if occupied + size > config.total_download_bytes:
        raise DownloadBlocked(f'Total previsto {occupied + size} B supera {config.total_download_bytes} B.')
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + '.part')
    if part.exists():
        raise DownloadBlocked(f'Existe {part.name}; revisar descarga interrumpida antes de reintentar.')
    received = 0
    try:
        with client.stream('GET', item.url, headers={'Accept-Encoding': 'identity'}) as response:
            response.raise_for_status()
            if response.status_code != 200 or 'text/html' in response.headers.get('content-type', ''):
                raise DownloadBlocked('Respuesta inesperada, parcial o página HTML.')
            with part.open('xb') as stream:
                for chunk in response.iter_bytes(chunk_size=262144):
                    received += len(chunk)
                    if received > size or received > config.max_file_bytes or occupied + received > config.total_download_bytes:
                        raise DownloadBlocked('La descarga excedió el tamaño permitido.')
                    stream.write(chunk)
        if received != size:
            raise DownloadBlocked(f'Descarga incompleta: {received}/{size} B.')
        part.replace(path)
    except BaseException:
        part.unlink(missing_ok=True)
        raise
    item.size_bytes = received
    item.sha256 = sha256(path)
    item.downloaded_at = utc_now()
    return {**plan, 'status': 'downloaded', 'sha256': item.sha256}
