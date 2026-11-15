"""JSON supports the offline prototype; PostgreSQL is primary when configured."""
from app.core.config import Settings
from app.core.files import fingerprint, read_json, write_json
from app.models.schemas import Dataset, Region, RegionResult
from app.repositories.catalog import Catalog


class StorageUnavailable(RuntimeError):
    pass


class LocalRepository:
    def __init__(self, config: Settings):
        self.config = config
        self.catalog = Catalog(config)

    def datasets(self) -> list[Dataset]:
        try:
            items = self.catalog.datasets()
            for item in items:
                if item.files and any(not self.config.path(f.local_path).exists() for f in item.files if f.role in ('image', 'label')):
                    item.status = 'missing_local_files'
                    item.diagnostic = 'Faltan archivos originales locales; los metadatos registrados son de la inspección anterior.'
            return items
        except (OSError, ValueError) as exc:
            raise StorageUnavailable('Catálogo local ausente o inválido; revisar manifests/datasets.json.') from exc

    def regions(self) -> list[RegionResult]:
        try:
            return [self.result(region) for region in self.catalog.regions()]
        except (OSError, ValueError) as exc:
            raise StorageUnavailable('Manifiesto o resultados locales inválidos; revisar los JSON y reprocesar.') from exc

    def result(self, region: Region) -> RegionResult:
        path = self.config.path(f'data/processed/{region.body}/{region.id}/result.json')
        if not path.exists():
            return RegionResult(region=region, status='not_processed', diagnostic='Ejecutar scripts.process_datasets con archivos locales.')
        result = RegionResult.model_validate(read_json(path))
        if result.region != region or (result.metrics and result.metrics.region_fingerprint != fingerprint(region.model_dump())):
            return RegionResult(region=region, status='stale', diagnostic='Cambió el manifiesto de la región; reprocesar.')
        return result

    def save(self, result: RegionResult) -> None:
        r = result.region
        write_json(self.config.path(f'data/processed/{r.body}/{r.id}/result.json'), result.model_dump())


SCHEMA = """
CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    body TEXT NOT NULL CHECK (body IN ('earth', 'moon', 'mars')),
    product TEXT NOT NULL,
    payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL REFERENCES datasets(id),
    body TEXT NOT NULL CHECK (body IN ('earth', 'moon', 'mars')),
    payload JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS measurements (
    region_id TEXT PRIMARY KEY REFERENCES regions(id),
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


class PostgresRepository:
    def __init__(self, config: Settings):
        self.config = config

    def connect(self):
        import psycopg
        return psycopg.connect(self.config.database_url, connect_timeout=5)

    def initialize(self):
        with self.connect() as conn:
            conn.execute(SCHEMA)

    def sync(self, datasets: list[Dataset], results: list[RegionResult]):
        """One transaction; files and complete matrices never enter PostgreSQL."""
        from psycopg.types.json import Jsonb
        with self.connect() as conn:
            for d in datasets:
                conn.execute('INSERT INTO datasets (id,body,product,payload) VALUES (%s,%s,%s,%s) '
                             'ON CONFLICT (id) DO UPDATE SET body=EXCLUDED.body, product=EXCLUDED.product, payload=EXCLUDED.payload',
                             (d.id, d.body, d.product, Jsonb(d.model_dump())))
            for result in results:
                r = result.region
                conn.execute('INSERT INTO regions (id,dataset_id,body,payload) VALUES (%s,%s,%s,%s) '
                             'ON CONFLICT (id) DO UPDATE SET dataset_id=EXCLUDED.dataset_id, body=EXCLUDED.body, payload=EXCLUDED.payload',
                             (r.id, r.dataset_id, r.body, Jsonb(r.model_dump())))
                conn.execute('INSERT INTO measurements (region_id,status,payload) VALUES (%s,%s,%s) '
                             'ON CONFLICT (region_id) DO UPDATE SET status=EXCLUDED.status, payload=EXCLUDED.payload, updated_at=now()',
                             (r.id, result.status, Jsonb(result.model_dump())))

    def _read(self, sql: str):
        try:
            with self.connect() as conn:
                return [row[0] for row in conn.execute(sql).fetchall()]
        except Exception as exc:
            # Never expose a DSN, hostname, username or driver error to public clients.
            raise StorageUnavailable('PostgreSQL no disponible o esquema pendiente. Ejecutar scripts.sync_postgres.') from exc

    def datasets(self) -> list[Dataset]:
        return [Dataset.model_validate(x) for x in self._read('SELECT payload FROM datasets ORDER BY id')]

    def regions(self) -> list[RegionResult]:
        return [RegionResult.model_validate(x) for x in self._read('SELECT payload FROM measurements ORDER BY region_id')]


def repository(config: Settings):
    return PostgresRepository(config) if config.database_url else LocalRepository(config)
