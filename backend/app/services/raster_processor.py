from dataclasses import dataclass

import numpy as np
from pyproj import Geod
from rasterio.crs import CRS
from rasterio.transform import from_origin
from rasterio.warp import reproject, Resampling, transform_bounds

from app.models.schemas import Bounds, Region
from app.services.dataset_loader import RasterSource


@dataclass
class Crop:
    heights: np.ndarray
    latitudes: np.ndarray
    longitudes: np.ndarray
    dx_m: np.ndarray
    northing_m: np.ndarray
    bounds: Bounds
    transform: object = None
    crs: str | None = None
    resampling: str = 'none_native_grid'
    native_dx_m: float | None = None
    native_dy_m: float | None = None


def common_grid(source: RasterSource, region: Region) -> Crop:
    """Area-average onto a local azimuthal equidistant grid in physical meters.

    Retain missing cells rather than manufacturing values. The requested square
    must fit within both the selected box and the source. No upsampling allowed.
    """
    m, b = source.metadata, region.bounds
    resolution, size = region.analysis_resolution_m, region.analysis_size_m
    if resolution is None or size is None:
        raise ValueError('Faltan parámetros de la malla física.')
    latitude, longitude = (b.north+b.south)/2, (b.west+b.east)/2
    if max(abs(b.north), abs(b.south)) > 75 or b.east-b.west > 10 or b.north-b.south > 10:
        raise ValueError('La malla local requiere una caja pequeña dentro de ±75°.')
    geographic = 'EPSG:4326' if region.body == 'earth' else f'+proj=longlat +R={m.reference_radius_m} +no_defs'
    shape = '+ellps=WGS84' if region.body == 'earth' else f'+R={m.reference_radius_m}'
    projected = CRS.from_string(f'+proj=aeqd +lat_0={latitude} +lon_0={longitude} {shape} +units=m +no_defs')
    extent = size/2
    west, south, east, north = transform_bounds(projected, geographic, -extent, -extent, extent, extent, densify_pts=41)
    if region.body != 'earth' and b.west >= 180:
        west, east = west+360, east+360
    requested = Bounds(west=west, south=south, east=east, north=north)
    for outer in (m.bounds, b):
        if not (outer.west <= west < east <= outer.east and outer.south <= south < north <= outer.north):
            raise ValueError('La ventana física no cabe en la cobertura seleccionada.')
    step = m.resolution_degrees
    if region.body == 'earth':
        geod = Geod(ellps='WGS84')
        native_dx = geod.inv(longitude,latitude,longitude+step,latitude)[2]
        native_dy = geod.inv(longitude,latitude,longitude,latitude+step)[2]
    else:
        native_dy = m.reference_radius_m*np.deg2rad(step)
        native_dx = native_dy*np.cos(np.deg2rad(latitude))
    if resolution < max(native_dx,native_dy):
        raise ValueError('La resolución común no puede ser más fina que la del archivo original.')
    # Include two native pixels around the output footprint so all average bins
    # have full source support. The output itself keeps exactly the chosen extent.
    half = 0.5 if m.registration == 'pixel' else 0
    row0 = max(0, int(np.floor((m.bounds.north-north)/step-half))-2)
    row1 = min(m.rows, int(np.ceil((m.bounds.north-south)/step-half))+3)
    col0 = max(0, int(np.floor((west-m.bounds.west)/step-half))-2)
    col1 = min(m.columns, int(np.ceil((east-m.bounds.west)/step-half))+3)
    if (row1-row0)*(col1-col0) > 16_000_000:
        raise ValueError('El recorte de origen supera 16 millones de celdas.')
    data = source.read(row0,row1,col0,col1)
    quality_mask = source.quality_mask(row0,row1,col0,col1)
    if quality_mask is not None:
        data[~quality_mask] = np.nan
    transform = from_origin(m.bounds.west+(col0+half-0.5)*step,
                            m.bounds.north-(row0+half-0.5)*step,step,step)
    n = int(round(size/resolution))
    target_transform = from_origin(-extent,extent,resolution,resolution)
    target = np.full((n,n),np.nan,dtype=np.float64)
    coverage = np.zeros((n,n),dtype=np.float32)
    kwargs = dict(src_transform=transform,src_crs=geographic,dst_transform=target_transform,
                  dst_crs=projected,resampling=Resampling.average)
    reproject(data,target,src_nodata=np.nan,dst_nodata=np.nan,**kwargs)
    reproject(np.isfinite(data).astype(np.float32),coverage,dst_nodata=0,**kwargs)
    target[coverage < 0.99] = np.nan
    # Coordinates here are local easting/northing, not angular values. The
    # authoritative georeferencing is the GeoTIFF CRS and affine transform.
    coordinate = -extent+(np.arange(n)+0.5)*resolution
    return Crop(target,-coordinate,coordinate,np.full(n,resolution),-coordinate,
                requested,target_transform,projected.to_wkt(),'area_average_local_aeqd_v1',
                float(native_dx),float(native_dy))


def crop_region(source: RasterSource, region: Region) -> Crop:
    if region.analysis_resolution_m is not None:
        return common_grid(source, region)
    m, b = source.metadata, region.bounds
    if max(abs(b.north), abs(b.south)) > 75:
        raise ValueError('Prototipo limitado a |latitud| ≤ 75°; regiones polares requieren otro tratamiento.')
    if b.east-b.west > 10 or b.north-b.south > 10:
        raise ValueError('Seleccione una región de hasta 10° por eje.')
    west, east = b.west, b.east
    # A continuous signed interval can be shifted to the planetary 0..360 convention.
    if m.bounds.west == 0 and west < 0:
        west, east = west + 360, east + 360
    if not (m.bounds.west <= west < east <= m.bounds.east
            and m.bounds.south <= b.south < b.north <= m.bounds.north):
        raise ValueError('Región fuera de cobertura o cruzando el meridiano de corte; dividirla.')
    step = m.resolution_degrees
    half = 0.5 if m.registration == 'pixel' else 0.0
    latitudes = m.bounds.north - (np.arange(m.rows) + half) * step
    longitudes = m.bounds.west + (np.arange(m.columns) + half) * step
    # Half-open on north/east: no duplicate nodes when neighboring regions share edges.
    rows = np.flatnonzero((latitudes >= b.south) & (latitudes < b.north))
    cols = np.flatnonzero((longitudes >= west) & (longitudes < east))
    if len(rows) < 16 or len(cols) < 16:
        raise ValueError(f'Ventana demasiado pequeña ({len(rows)} × {len(cols)}); mínimo 16 × 16 píxeles nativos.')
    if len(rows) * len(cols) > 4_000_000:
        raise ValueError('Recorte supera 4 millones de celdas; reducir región.')
    heights = source.read(int(rows[0]), int(rows[-1])+1, int(cols[0]), int(cols[-1])+1)
    latitudes, longitudes = latitudes[rows], longitudes[cols]
    if region.body == 'earth':
        geod = Geod(ellps='WGS84')
        _, _, dx = geod.inv(np.zeros_like(latitudes), latitudes,
                           np.full_like(latitudes, step), latitudes)
        _, _, dy = geod.inv(np.zeros(len(latitudes)-1), latitudes[:-1],
                           np.zeros(len(latitudes)-1), latitudes[1:])
    else:
        if not m.reference_radius_m:
            raise ValueError('Radio planetario desconocido.')
        dy = np.full(len(latitudes)-1, m.reference_radius_m * np.deg2rad(step))
        dx = m.reference_radius_m * np.cos(np.deg2rad(latitudes)) * np.deg2rad(step)
    northing = np.concatenate(([0.0], -np.cumsum(dy)))
    if np.ptp(dx) / np.mean(dx) > 0.05:
        raise ValueError('Variación de escala horizontal >5%; reducir la extensión latitudinal.')
    cell_bounds = Bounds(west=float(longitudes[0]-step/2), east=float(longitudes[-1]+step/2),
                         south=float(latitudes[-1]-step/2), north=float(latitudes[0]+step/2))
    quality_mask = source.quality_mask(int(rows[0]),int(rows[-1])+1,int(cols[0]),int(cols[-1])+1)
    if quality_mask is not None:
        heights[~quality_mask] = np.nan
    crs = 'EPSG:4326' if region.body == 'earth' else f'+proj=longlat +R={m.reference_radius_m} +no_defs'
    transform = from_origin(cell_bounds.west,cell_bounds.north,step,step)
    return Crop(heights, latitudes, longitudes, dx, northing, cell_bounds,transform,crs)
