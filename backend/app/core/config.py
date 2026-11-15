from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / '.env', extra='ignore')
    root: Path = ROOT
    database_url: str = ''
    max_file_bytes: int = Field(default=40_000_000, gt=0)
    total_download_bytes: int = Field(default=120_000_000, gt=0)
    max_regions: int = Field(default=7, gt=0)
    cors_origins: list[str] = []

    def path(self, relative: str) -> Path:
        result = (self.root / relative).resolve()
        if not result.is_relative_to(self.root.resolve()):
            raise ValueError('La ruta debe permanecer dentro de backend.')
        return result

    def prepare(self) -> None:
        for body in ('earth', 'moon', 'mars'):
            self.path(f'data/raw/{body}').mkdir(parents=True, exist_ok=True)
            self.path(f'data/processed/{body}').mkdir(parents=True, exist_ok=True)


settings = Settings()
