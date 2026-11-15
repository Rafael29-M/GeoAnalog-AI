from app.core.config import settings
from app.repositories.results import LocalRepository, PostgresRepository


def main():
    if not settings.database_url:
        print('DATABASE_URL no configurada; los archivos locales siguen disponibles.')
        return 1
    local, postgres = LocalRepository(settings), PostgresRepository(settings)
    try:
        postgres.initialize()
        postgres.sync(local.datasets(), local.regions())
    except Exception:
        print('No se pudo sincronizar PostgreSQL. Revisar servicio, conexión y permisos; no se imprimen credenciales.')
        return 1
    print('Datasets, regiones y mediciones sincronizados en PostgreSQL.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
