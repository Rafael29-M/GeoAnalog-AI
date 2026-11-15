import argparse
import csv
import json

from app.core.config import settings
from app.core.files import write_json
from app.repositories.catalog import Catalog
from app.repositories.results import LocalRepository, PostgresRepository
from app.services.processing import process_region


def main():
    parser = argparse.ArgumentParser(description='Procesa regiones del manifiesto sin consultar internet.')
    parser.add_argument('--region', action='append', help='ID; se puede repetir. Por defecto todas las seleccionadas.')
    args = parser.parse_args()
    settings.prepare()
    if settings.path('data/download.lock').exists():
        parser.error('Espere a que termine la descarga antes de procesar.')
    catalog = Catalog(settings)
    datasets = {d.id: d for d in catalog.datasets()}
    regions = catalog.regions()
    if args.region:
        missing = set(args.region) - {r.id for r in regions}
        if missing:
            parser.error(f'Regiones desconocidas: {sorted(missing)}')
        regions = [r for r in regions if r.id in args.region]
    report, failed = [], False
    for region in regions:
        result = process_region(datasets[region.dataset_id], region, settings)
        row = {'region_id': region.id, 'status': result.status, 'diagnostic': result.diagnostic}
        report.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
        failed |= result.status != 'processed'
    all_results = LocalRepository(settings).regions()
    for dataset in datasets.values():
        related = [r for r in all_results if r.region.dataset_id == dataset.id]
        if related:
            dataset.status = 'processed' if all(r.status == 'processed' for r in related) else 'partially_processed' if any(r.status == 'processed' for r in related) else 'processing_failed'
    catalog.save_datasets(list(datasets.values()))
    write_json(settings.path('data/processed/processing_report.json'), report)
    with settings.path('data/processed/summary.csv').open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=['region_id', 'body', 'status', 'height_mean_m', 'slope_mean_degrees',
                                                   'roughness_mean_m', 'dx_m', 'dy_m', 'quality'])
        writer.writeheader()
        for item in all_results:
            row = {'region_id': item.region.id, 'body': item.region.body, 'status': item.status}
            if item.metrics:
                m = item.metrics
                row.update(height_mean_m=m.height.mean, slope_mean_degrees=m.slope.mean, roughness_mean_m=m.roughness.mean,
                           dx_m=m.scale.dx_m, dy_m=m.scale.dy_m, quality=m.quality)
            writer.writerow(row)
    if settings.database_url:
        try:
            postgres = PostgresRepository(settings)
            postgres.initialize()
            postgres.sync(list(datasets.values()), all_results)
            print('PostgreSQL sincronizado.')
        except Exception:
            print('PostgreSQL no disponible: resultados locales conservados. Ejecutar scripts.sync_postgres después.')
            failed = True
    return int(failed)


if __name__ == '__main__':
    raise SystemExit(main())
