from app.core.config import Settings
from app.core.files import read_json, write_json
from app.models.schemas import Dataset, Region


class Catalog:
    def __init__(self, config: Settings):
        self.config = config

    def datasets(self) -> list[Dataset]:
        path = self.config.path('manifests/datasets.json')
        items = [Dataset.model_validate(x) for x in read_json(path)['datasets']]
        if len({x.id for x in items}) != len(items):
            raise ValueError('IDs de datasets duplicados.')
        return items

    def regions(self) -> list[Region]:
        path = self.config.path('manifests/regions.json')
        items = [Region.model_validate(x) for x in read_json(path)['regions']]
        if len(items) > self.config.max_regions:
            raise ValueError(f'Máximo de regiones: {self.config.max_regions}.')
        if len({x.id for x in items}) != len(items):
            raise ValueError('IDs de regiones duplicados.')
        datasets = {x.id: x for x in self.datasets()}
        for item in items:
            if item.dataset_id not in datasets or datasets[item.dataset_id].body != item.body:
                raise ValueError(f'{item.id}: dataset/cuerpo incompatible.')
        return items

    def save_datasets(self, datasets: list[Dataset]) -> None:
        write_json(self.config.path('manifests/datasets.json'),
                   {'schema_version': 1, 'datasets': [x.model_dump() for x in datasets]})
