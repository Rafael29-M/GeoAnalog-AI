import json

from app.core.config import settings
from app.core.files import sha256, utc_now, write_json
from app.repositories.catalog import Catalog
from app.services.dataset_loader import load_dataset


def inspect_all(config=settings):
    config.prepare()
    if config.path('data/download.lock').exists():
        raise ValueError('Espere a que termine la descarga antes de inspeccionar.')
    catalog = Catalog(config)
    datasets, report = catalog.datasets(), []
    datasets = discover_nasadem(datasets, config)
    for dataset in datasets:
        if not dataset.files:
            dataset.status = 'selection_pending'
            dataset.diagnostic = 'Falta seleccionar y descargar el mosaico terrestre con Earthdata.'
            report.append({'id': dataset.id, 'status': dataset.status, 'diagnostic': dataset.diagnostic, 'metadata': None})
            continue
        try:
            source = load_dataset(dataset, config)
            minimum, maximum = source.raw_range()
            meta = source.metadata
            if ((meta.declared_raw_minimum is not None and minimum < meta.declared_raw_minimum)
                    or (meta.declared_raw_maximum is not None and maximum > meta.declared_raw_maximum)):
                raise ValueError('Rango observado fuera de los extremos declarados en la etiqueta.')
            source.metadata.raw_minimum, source.metadata.raw_maximum = minimum, maximum
            dataset.metadata = source.metadata
            dataset.coverage = source.metadata.bounds
            dataset.version = source.metadata.version
            for item in dataset.files:
                path = config.path(item.local_path)
                if path.exists():
                    actual_hash = sha256(path)
                    if item.sha256 and item.sha256 != actual_hash:
                        raise ValueError(f'Integridad: cambió SHA-256 de {item.filename}.')
                    item.size_bytes, item.sha256 = path.stat().st_size, actual_hash
            dataset.status, dataset.diagnostic = 'inspected', None
        except (ValueError, OSError, KeyError) as exc:
            dataset.status = 'missing' if isinstance(exc, FileNotFoundError) else 'invalid'
            dataset.diagnostic = str(exc)
            dataset.metadata = None
        dataset.inspected_at = utc_now()
        report.append({'id': dataset.id, 'status': dataset.status, 'diagnostic': dataset.diagnostic,
                       'metadata': dataset.metadata.model_dump() if dataset.metadata else None})
    catalog.save_datasets(datasets)
    write_json(config.path('data/processed/inspection.json'), report)
    return report


def discover_nasadem(datasets, config):
    """Detect only explicitly named HGT files in the manual NASADEM inbox, offline."""
    import re
    from app.models.schemas import Dataset, DatasetFile
    registered = {x.local_path.lower() for d in datasets for x in d.files}
    seen_tiles = {d.id for d in datasets}
    for path in sorted(config.path('data/raw/earth').iterdir()):
        match = re.fullmatch(r'(?:NASADEM_HGT_)?([ns]\d{2}[ew]\d{3})\.(hgt|zip)', path.name, flags=re.I)
        if not match or not path.is_file():
            continue
        relative = path.relative_to(config.root).as_posix()
        identifier = 'earth-nasadem-' + match[1].lower()
        if relative.lower() in registered or identifier in seen_tiles:
            continue  # Do not import both the compressed and uncompressed tile.
        datasets.append(Dataset(id=identifier, body='earth', source='NASA LP DAAC / entrega manual',
                                instrument='SRTM (NASADEM)', product='NASADEM_HGT.001', version='001',
                                source_url='https://search.earthdata.nasa.gov/', format='NASADEM HGT / ZIP',
                                files=[DatasetFile(filename=path.name, local_path=relative, role='image')],
                                remote_subset='Entrega manual de un mosaico; URL original individual desconocida.'))
        seen_tiles.add(identifier)
    if any(d.body == 'earth' and d.files for d in datasets):
        datasets = [d for d in datasets if d.id != 'earth-nasadem-pending']
    return datasets


if __name__ == '__main__':
    reports = inspect_all()
    print(json.dumps(reports, indent=2, ensure_ascii=False))
    raise SystemExit(1 if any(x['status'] == 'invalid' for x in reports) else 0)
