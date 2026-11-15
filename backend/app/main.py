from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.terrain import terrain_router
from app.core.config import Settings, settings
from app.repositories.results import StorageUnavailable, repository


def create_app(config: Settings = settings) -> FastAPI:
    application = FastAPI(title='Cosmic Apus — terreno local', version='0.1.0',
                          description='Datos científicos previamente descargados. Ningún endpoint consulta NASA.')
    store = repository(config)
    if config.cors_origins:
        application.add_middleware(CORSMiddleware, allow_origins=config.cors_origins,
                                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])

    @application.exception_handler(StorageUnavailable)
    async def storage_error(request, exc):
        return JSONResponse(status_code=503, content={'detail': str(exc)})

    @application.get('/health')
    def health():
        datasets, regions = store.datasets(), store.regions()
        return {'status': 'ok', 'storage': 'postgresql' if config.database_url else 'local_json',
                'nasa_connection_required': False, 'datasets_registered': len(datasets),
                'regions_processed': sum(r.status == 'processed' for r in regions)}

    application.include_router(terrain_router(store))
    return application


app = create_app()
