from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Body = Literal['earth', 'moon', 'mars']

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Bounds(Model):
    west: float = Field(ge=-180, le=360)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=360)
    north: float = Field(ge=-90, le=90)

    @model_validator(mode='after')
    def ordered(self):
        if self.west >= self.east or self.south >= self.north:
            raise ValueError('Límites desordenados; dividir regiones que cruzan el meridiano de corte.')
        if self.east - self.west > 360:
            raise ValueError('Amplitud longitudinal inválida.')
        return self


class DatasetFile(Model):
    filename: str
    local_path: str
    role: Literal['image', 'label', 'xml', 'header']
    url: str | None = None
    expected_bytes: int | None = Field(default=None, gt=0)
    size_bytes: int | None = None
    downloaded_at: str | None = None
    sha256: str | None = None


class Metadata(Model):
    rows: int
    columns: int
    dtype: str
    byte_order: str
    unit: str
    scale: float
    applied_offset: float
    label_offset: float | None = None
    nodata: list[float] = []
    nodata_declared: bool = False
    nodata_provenance: str | None = None
    coordinate_system: str
    vertical_reference: str
    resolution_degrees: float
    nominal_resolution_m: float | None = None
    reference_radius_m: float | None = None
    bounds: Bounds
    registration: Literal['pixel', 'grid_node']
    product_id: str
    version: str | None = None
    provenance: str
    raw_minimum: float | None = None
    raw_maximum: float | None = None
    declared_raw_minimum: float | None = None
    declared_raw_maximum: float | None = None
    warnings: list[str] = []


class Dataset(Model):
    id: str = Field(pattern=r'^[a-z0-9][a-z0-9_-]*$')
    body: Body
    source: str
    instrument: str
    product: str
    version: str | None = None
    source_url: str
    format: str
    coverage: Bounds | None = None
    files: list[DatasetFile] = []
    metadata: Metadata | None = None
    status: str = 'missing'
    diagnostic: str | None = None
    inspected_at: str | None = None
    remote_subset: str


class Region(Model):
    id: str = Field(pattern=r'^[a-z0-9][a-z0-9_-]*$')
    name: str
    body: Body
    dataset_id: str
    bounds: Bounds
    roughness_window_m: float = Field(default=12000, gt=0, le=100000)
    analysis_resolution_m: float | None = Field(default=None, ge=100, le=20000)
    analysis_size_m: float | None = Field(default=None, ge=1000, le=200000)
    source_url: str
    purpose: str

    @model_validator(mode='after')
    def analysis_grid(self):
        if (self.analysis_resolution_m is None) != (self.analysis_size_m is None):
            raise ValueError('Indicar resolución y extensión física juntas.')
        if self.analysis_resolution_m is not None:
            cells = self.analysis_size_m / self.analysis_resolution_m
            if cells < 16 or cells > 256 or abs(cells-round(cells)) > 1e-8:
                raise ValueError('La malla debe tener de 16 a 256 celdas enteras por eje.')
        return self


class Statistics(Model):
    count: int
    minimum: float
    maximum: float
    mean: float
    std: float
    median: float
    p10: float | None = None
    p25: float | None = None
    p75: float | None = None
    p90: float | None = None


class AnalysisScale(Model):
    dx_min_m: float
    dx_max_m: float
    dx_m: float
    dy_m: float
    width_m: float
    height_m: float
    roughness_rows: int
    roughness_columns: int
    roughness_width_m: float
    roughness_height_m: float
    roughness_requested_m: float
    resampling: str = 'none_native_grid'
    native_dx_m: float | None = None
    native_dy_m: float | None = None


class Metrics(Model):
    region_id: str
    dataset_id: str
    body: Body
    created_at: str
    region_fingerprint: str
    source_sha256: str
    label_sha256: str | None = None
    method_version: str = 'native-terrain-v1'
    slope_method: str = 'central_difference_physical_distances'
    roughness_method: str = 'local_population_std_height_full_window'
    height_unit: str = 'm'
    slope_unit: str = 'degree'
    roughness_unit: str = 'm'
    vertical_reference: str
    bounds: Bounds
    rows: int
    columns: int
    valid_fraction: float
    slope_valid_fraction: float | None = None
    roughness_valid_fraction: float | None = None
    quality: Literal['validation_only', 'insufficient']
    scale: AnalysisScale
    height: Statistics
    slope: Statistics
    roughness: Statistics
    artifacts: dict[str, str]
    warnings: list[str]
    runtime: dict[str, str] = {}


class RegionResult(Model):
    region: Region
    status: str
    diagnostic: str | None = None
    metrics: Metrics | None = None


class BodySummary(Model):
    id: Body
    name: str
    dataset_ids: list[str]
    region_ids: list[str]
    processed_regions: int
    status: str
    note: str


class SearchRequest(Model):
    target_region_id: str
    earth_region_ids: list[str] | None = Field(default=None, max_length=7)
    limit: int = Field(default=5, ge=1, le=7)
    weight_height: float | None = None
    weight_slope: float | None = None
    weight_roughness: float | None = None


class Match(Model):
    region_id: str
    name: str | None = None
    bounds: Bounds | None = None
    distance: float
    slope_difference: float
    roughness_difference: float
    metadata_source: str | None = None
    dataset_urns: list[str] | None = None


class SearchResponse(Model):
    status: Literal['ok', 'no_compatible_regions', 'target_not_processed']
    target_region_id: str
    matches: list[Match] = []
    excluded: dict[str, list[str]] = {}
    explanation: str
    pds_metadata: dict[str, str | int | list[str]] | None = None
