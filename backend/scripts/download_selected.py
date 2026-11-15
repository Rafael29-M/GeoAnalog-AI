"""Run from backend: python -m scripts.download_selected moon-lola16 --execute"""
import argparse
import json

import httpx

from app.core.config import settings
from app.repositories.catalog import Catalog
from app.services.downloads import download_file, inspect_remote, raw_bytes


def main():
    parser = argparse.ArgumentParser(description='Plan por defecto; --execute descarga los IDs explícitos.')
    parser.add_argument('dataset_ids', nargs='+')
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args()
    settings.prepare()
    catalog = Catalog(settings)
    datasets = catalog.datasets()
    selected = set(args.dataset_ids)
    unknown = selected - {d.id for d in datasets}
    if unknown:
        parser.error(f'IDs desconocidos: {sorted(unknown)}')
    reports, failed, planned = [], False, raw_bytes(settings)
    # One downloader process at a time; an exclusive lock protects the total budget.
    lock = settings.path('data/download.lock')
    try:
        with lock.open('x') as stream:
            stream.write('Una sola descarga a la vez. Eliminar solo si el proceso terminó.\n')
        try:
            seen_urls = set()
            with httpx.Client(timeout=60, follow_redirects=False, trust_env=False) as client:
                for dataset in datasets:
                    if dataset.id not in selected:
                        continue
                    if not dataset.files or dataset.coverage is None:
                        reports.append({'dataset_id': dataset.id, 'error': 'Producto manual sin archivo/cobertura verificada.'})
                        failed = True
                        continue
                    print(json.dumps({'product': dataset.product, 'coverage': dataset.coverage.model_dump(),
                                      'remote_subset': dataset.remote_subset}, ensure_ascii=False), flush=True)
                    for item in sorted(dataset.files, key=lambda x: x.role == 'image'):
                        try:
                            if item.url in seen_urls:
                                raise ValueError('URL duplicada en la selección; no se descarga otra copia.')
                            seen_urls.add(item.url)
                            if args.execute:
                                print(f'Verificando/descargando {item.filename}...', flush=True)
                                result = download_file(item, settings, client)
                                catalog.save_datasets(datasets)
                            elif settings.path(item.local_path).exists():
                                result = {'filename': item.filename, 'status': 'already_present'}
                            else:
                                result = inspect_remote(item, settings, client)
                                planned += result['size_bytes']
                                if planned > settings.total_download_bytes:
                                    raise ValueError(f'Plan acumulado {planned} B supera presupuesto.')
                            reports.append({'dataset_id': dataset.id, **result})
                        except (ValueError, OSError, httpx.HTTPError) as exc:
                            reports.append({'dataset_id': dataset.id, 'filename': item.filename, 'error': str(exc)})
                            failed = True
                            break
        finally:
            lock.unlink(missing_ok=True)
    except FileExistsError:
        parser.error('Ya hay una descarga activa (data/download.lock).')
    print(json.dumps(reports, indent=2, ensure_ascii=False))
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
