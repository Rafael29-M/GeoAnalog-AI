"""Deliberately narrow readers: detached PDS3 cylindrical int16 and NASADEM HGT.

Unknown projections/encodings fail explicitly; this is not a general PDS parser.
"""
import re
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from app.core.config import Settings
from app.models.schemas import Bounds, Dataset, Metadata


def pds_fields(path: Path) -> dict[str, dict[str, str]]:
    text = path.read_text(encoding='ascii')
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    fields: dict[str, dict[str, str]] = {'ROOT': {}}
    stack = ['ROOT']
    expression = r'^\s*(\^?\w+)\s*=\s*(.*?)(?=^\s*\^?\w+\s*=|^\s*END\s*$|\Z)'
    for match in re.finditer(expression, text, re.M | re.S):
        key, value = match.group(1), match.group(2).strip()
        if key == 'OBJECT':
            stack.append(value.strip('"'))
            fields.setdefault(stack[-1], {})
        elif key == 'END_OBJECT':
            if len(stack) == 1 or stack[-1] != value.strip('"'):
                raise ValueError('Estructura de etiqueta PDS inválida.')
            stack.pop()
        else:
            fields[stack[-1]][key] = value.strip('"')
    if len(stack) != 1 or fields['ROOT'].get('PDS_VERSION_ID') != 'PDS3':
        raise ValueError('Se requiere etiqueta PDS3 válida y separada.')
    return fields


def number(value: str) -> float:
    token = value.split('<', 1)[0].strip()
    based = re.fullmatch(r'(\d+)#([0-9A-Fa-f]+)#', token)
    return float(int(based[2], int(based[1]))) if based else float(token)


def check_xml(path: Path, meta: Metadata, filename: str) -> None:
    root = ET.parse(path).getroot()
    ns = {'p': 'http://pds.nasa.gov/pds4/pds/v1', 'cart': 'http://pds.nasa.gov/pds4/cart/v1'}
    array = root.find('.//p:File_Area_Observational/p:Array_2D_Image', ns)
    if array is None:
        raise ValueError('XML PDS4 sin Array_2D_Image.')
    get = lambda key: array.findtext(key, namespaces=ns)
    axes = {axis.findtext('p:axis_name', namespaces=ns): int(axis.findtext('p:elements', namespaces=ns))
            for axis in array.findall('p:Axis_Array', ns)}
    expected_type = 'SignedLSB2' if meta.byte_order == 'little' else 'SignedMSB2'
    xml_name = root.findtext('.//p:File_Area_Observational/p:File/p:file_name', namespaces=ns)
    if (axes != {'Line': meta.rows, 'Sample': meta.columns}
            or get('p:Element_Array/p:data_type') != expected_type
            or number(get('p:offset') or '0') != 0
            or xml_name.lower() != filename.lower()):
        raise ValueError('XML y LBL discrepan en dimensiones, tipo, offset de bytes o archivo.')
    xml_scale = number(get('p:Element_Array/p:scaling_factor') or '1')
    xml_offset = number(get('p:Element_Array/p:value_offset') or '0')
    if xml_scale != meta.scale or xml_offset != (meta.label_offset or 0):
        raise ValueError('XML y LBL discrepan en escala/offset.')
    if (get('p:Element_Array/p:unit') or '').lower() != 'meter':
        raise ValueError('Unidad XML distinta de metros.')
    for key, value in [('west_bounding_coordinate', meta.bounds.west), ('east_bounding_coordinate', meta.bounds.east),
                       ('north_bounding_coordinate', meta.bounds.north), ('south_bounding_coordinate', meta.bounds.south),
                       ('pixel_scale_x', 1/meta.resolution_degrees), ('pixel_scale_y', 1/meta.resolution_degrees)]:
        xml_value = root.findtext(f'.//cart:{key}', namespaces=ns)
        if xml_value is None or not np.isclose(number(xml_value), value):
            raise ValueError(f'XML y LBL discrepan en georreferencia: {key}.')


@dataclass
class RasterSource:
    path: Path
    metadata: Metadata
    rasterio_uri: str | None = None
    quality_members: tuple[str, str] | None = None

    def quality_mask(self, row_start: int, row_stop: int, col_start: int, col_stop: int):
        """NASADEM land/valid-source mask; the original HGT is never changed."""
        if self.quality_members is None:
            return None
        with zipfile.ZipFile(self.path) as archive:
            arrays = [np.frombuffer(archive.read(name),dtype=np.uint8).reshape(self.metadata.rows,self.metadata.columns)
                      [row_start:row_stop,col_start:col_stop] for name in self.quality_members]
        num, swb = arrays
        return (swb == 0) & (num > 0) & (num != 255)

    def read(self, row_start=0, row_stop=None, col_start=0, col_stop=None) -> np.ndarray:
        m = self.metadata
        row_stop = m.rows if row_stop is None else row_stop
        col_stop = m.columns if col_stop is None else col_stop
        if not (0 <= row_start < row_stop <= m.rows and 0 <= col_start < col_stop <= m.columns):
            raise ValueError('Ventana fuera del raster.')
        if self.rasterio_uri:
            with rasterio.open(self.rasterio_uri) as src:
                raw = src.read(1, window=Window(col_start, row_start, col_stop-col_start, row_stop-row_start))
        else:
            mapped = np.memmap(self.path, dtype=m.dtype, mode='r', shape=(m.rows, m.columns))
            raw = np.array(mapped[row_start:row_stop, col_start:col_stop])
            del mapped
        result = raw.astype(np.float64)
        for invalid in m.nodata:
            result[raw == invalid] = np.nan
        return result * m.scale + m.applied_offset

    def raw_range(self) -> tuple[float, float]:
        low, high = np.inf, -np.inf
        for start in range(0, self.metadata.rows, 128):
            values = self.read(start, min(start + 128, self.metadata.rows))
            valid = values[np.isfinite(values)]
            if valid.size:
                raw = (valid - self.metadata.applied_offset) / self.metadata.scale
                low, high = min(low, float(raw.min())), max(high, float(raw.max()))
        if not np.isfinite(low):
            raise ValueError('Raster sin ninguna medición válida.')
        return low, high


def load_pds(image: Path, label: Path, body: str, xml: Path | None = None) -> RasterSource:
    groups = pds_fields(label)
    root, img, proj = groups['ROOT'], groups['IMAGE'], groups['IMAGE_MAP_PROJECTION']
    file_fields = groups.get('UNCOMPRESSED_FILE', root)
    if file_fields.get('^IMAGE', '').lower() != image.name.lower():
        raise ValueError('^IMAGE no identifica el archivo local; solo etiquetas separadas sin cabecera.')
    if root.get('TARGET_NAME', '').lower() != body:
        raise ValueError('Cuerpo planetario diferente a la etiqueta.')
    is_lola = body == 'moon' and root.get('INSTRUMENT_ID') == 'LOLA' and img.get('NAME') == 'HEIGHT'
    is_mola = body == 'mars' and root.get('INSTRUMENT_ID') == 'MOLA' and img.get('NAME') == 'MEDIAN_TOPOGRAPHY'
    if not (is_lola or is_mola):
        raise ValueError('Producto no admitido: se necesita HEIGHT LOLA o MEDIAN_TOPOGRAPHY MOLA.')
    if (proj.get('MAP_PROJECTION_TYPE') != 'SIMPLE CYLINDRICAL'
            or proj.get('POSITIVE_LONGITUDE_DIRECTION') != 'EAST'
            or number(proj.get('MAP_PROJECTION_ROTATION', '0')) != 0
            or number(img['SAMPLE_BITS']) != 16 or img.get('UNIT') != 'METER'):
        raise ValueError('Proyección, rotación, unidad o tipo no admitido.')
    for key in ('LINE_PREFIX_BYTES', 'LINE_SUFFIX_BYTES'):
        if number(img.get(key, '0')) != 0:
            raise ValueError('No se admiten bytes adicionales por línea.')
    dtype = {'LSB_INTEGER': '<i2', 'MSB_INTEGER': '>i2'}.get(img['SAMPLE_TYPE'])
    if dtype is None or (is_lola and dtype != '<i2') or (is_mola and dtype != '>i2'):
        raise ValueError('Orden de bytes no corresponde al producto seleccionado.')
    rows, columns = int(number(img['LINES'])), int(number(img['LINE_SAMPLES']))
    expected = rows * columns * 2
    if image.stat().st_size != expected:
        raise ValueError(f'Dimensiones incompatibles: esperado {expected} B, encontrado {image.stat().st_size} B.')
    if int(number(file_fields['RECORD_BYTES'])) != columns * 2 or int(number(file_fields['FILE_RECORDS'])) != rows:
        raise ValueError('Registros incompatibles con la matriz declarada.')
    bounds = Bounds(west=number(proj['WESTERNMOST_LONGITUDE']), east=number(proj['EASTERNMOST_LONGITUDE']),
                    south=number(proj['MINIMUM_LATITUDE']), north=number(proj['MAXIMUM_LATITUDE']))
    step = 1 / number(proj['MAP_RESOLUTION'])
    if not np.allclose([(bounds.north-bounds.south)/step, (bounds.east-bounds.west)/step], [rows, columns]):
        raise ValueError('Cobertura y resolución no corresponden a las dimensiones.')
    radii = [number(proj[key]) * 1000 for key in ('A_AXIS_RADIUS', 'B_AXIS_RADIUS', 'C_AXIS_RADIUS')]
    if len(set(radii)) != 1:
        raise ValueError('Este lector planetario requiere esfera de referencia.')
    invalid = [number(img[key]) for key in ('MISSING_CONSTANT', 'INVALID_CONSTANT', 'NULL', 'CORE_NULL') if key in img]
    scale, label_offset = number(img.get('SCALING_FACTOR', '1')), img.get('OFFSET')
    if is_lola and (scale != 0.5 or label_offset is None or number(label_offset) != radii[0]):
        raise ValueError('LOLA: revisar escala y radio de referencia.')
    if is_mola and (scale != 1 or number(label_offset or '0') != 0):
        raise ValueError('MOLA topográfico esperado en metros sin desplazamiento.')
    map_scale = number(proj['MAP_SCALE']) * (1000 if '<KM/' in proj['MAP_SCALE'].upper() else 1)
    warnings = ['Resolución gruesa: validación regional, no interpretación geológica detallada.',
                'La interpolación del producto no equivale a observaciones independientes por píxel.']
    if not invalid:
        warnings.append('La etiqueta no declara nodata; no se inventa un valor centinela.')
    meta = Metadata(rows=rows, columns=columns, dtype=dtype, byte_order='little' if dtype == '<i2' else 'big',
                    unit='m', scale=scale, applied_offset=0, label_offset=number(label_offset) if label_offset else None,
                    nodata=invalid, nodata_declared=bool(invalid), nodata_provenance='LBL IMAGE' if invalid else None,
                    coordinate_system=('IAU2000 / ' if 'IAU2000' in root.get('DESCRIPTION', '') else '') + proj['COORDINATE_SYSTEM_NAME'],
                    vertical_reference=f'height_above_reference_sphere_{radii[0]:.0f}_m' if is_lola else 'MOLA_areoid_GMM3_degree_order_50',
                    resolution_degrees=step, nominal_resolution_m=map_scale, reference_radius_m=radii[0],
                    bounds=bounds, registration='pixel', product_id=root['PRODUCT_ID'], version=root.get('PRODUCT_VERSION_ID'),
                    provenance=f'{label.name}: IMAGE y IMAGE_MAP_PROJECTION; conversión específica del producto',
                    declared_raw_minimum=number(img['MINIMUM']) if 'MINIMUM' in img else None,
                    declared_raw_maximum=number(img['MAXIMUM']) if 'MAXIMUM' in img else None,
                    warnings=warnings)
    if xml and xml.exists():
        check_xml(xml, meta, image.name)
    return RasterSource(image, meta)


def load_nasadem(path: Path) -> RasterSource:
    uri, filename = str(path), path.name.lower()
    quality_members = None
    if path.suffix.lower() == '.zip':
        with zipfile.ZipFile(path) as archive:
            members = [x for x in archive.infolist() if re.fullmatch(r'[ns]\d{2}[ew]\d{3}\.hgt', x.filename.lower())]
            if len(members) != 1 or members[0].file_size != 3601 * 3601 * 2:
                raise ValueError('ZIP NASADEM debe contener un HGT de 3601 × 3601 int16.')
            filename = members[0].filename.lower()
            uri = f'/vsizip/{path.as_posix()}/{members[0].filename}'
            names = {x.filename.lower():x for x in archive.infolist()}
            quality_names = (filename[:-4]+'.num',filename[:-4]+'.swb')
            if all(name in names for name in quality_names):
                if any(names[name].file_size != 3601*3601 for name in quality_names):
                    raise ValueError('Dimensiones NUM/SWB incompatibles con el HGT.')
                quality_members = tuple(names[name].filename for name in quality_names)
    match = re.fullmatch(r'([ns])(\d{2})([ew])(\d{3})\.hgt', filename)
    if not match:
        raise ValueError('Se requiere HGT NASADEM con nombre de mosaico (ej. s24w071.hgt).')
    south = int(match[2]) * (1 if match[1] == 'n' else -1)
    west = int(match[4]) * (1 if match[3] == 'e' else -1)
    if not (-56 <= south < 60 and -180 <= west < 180):
        raise ValueError('Mosaico fuera de cobertura NASADEM.')
    if path.suffix.lower() == '.hgt' and path.stat().st_size != 3601 * 3601 * 2:
        raise ValueError('NASADEM HGT requiere exactamente 25934402 bytes.')
    with rasterio.open(uri) as src:
        if (src.width != 3601 or src.height != 3601 or src.count != 1 or src.dtypes[0] != 'int16'
                or src.crs is None or src.crs.to_epsg() != 4326):
            raise ValueError('Dimensiones, tipo o CRS HGT incorrectos.')
        if src.nodata != -32768:
            raise ValueError('Nodata HGT inesperado.')
    metadata = Metadata(rows=3601, columns=3601, dtype='>i2', byte_order='big', unit='m', scale=1,
                        applied_offset=0, nodata=[-32768], nodata_declared=False,
                        nodata_provenance='GDAL SRTMHGT: -32768; fuera del rango válido [-32767,32767] de la guía NASADEM. La guía indica nodata N/A.',
                        coordinate_system='EPSG:4326 (WGS84)',
                        vertical_reference='EGM96_geoid', resolution_degrees=1/3600, bounds=Bounds(
                            west=west, east=west+1, south=south, north=south+1), registration='grid_node',
                        product_id='NASADEM_HGT', version='001',
                        provenance='NASADEM User Guide V1.3 (2025), nombre de mosaico y driver GDAL SRTMHGT',
                        warnings=['NASADEM combina varias fuentes y rellenos; una celda no implica una observación independiente.',
                                  ('Se aplican NUM y SWB: se excluyen agua y errores de fuente antes de agregar.' if quality_members else
                                   'NUM/SWB no disponibles; la calidad local requiere revisión.')])
    return RasterSource(path, metadata, uri, quality_members)


def load_dataset(dataset: Dataset, config: Settings) -> RasterSource:
    images = [x for x in dataset.files if x.role == 'image']
    if len(images) != 1:
        raise ValueError('Seleccione exactamente un archivo científico en el manifiesto.')
    path = config.path(images[0].local_path)
    if not path.is_file():
        raise FileNotFoundError(f'Falta {images[0].local_path}; use descarga manual o asistida.')
    if dataset.body == 'earth':
        if dataset.product != 'NASADEM_HGT.001':
            raise ValueError('Solo se admite NASADEM_HGT.001 terrestre.')
        return load_nasadem(path)
    labels = [x for x in dataset.files if x.role == 'label']
    if len(labels) != 1:
        raise ValueError('Falta la etiqueta PDS LBL en el manifiesto.')
    xmls = [x for x in dataset.files if x.role == 'xml']
    source = load_pds(path, config.path(labels[0].local_path), dataset.body,
                      config.path(xmls[0].local_path) if xmls else None)
    headers = [x for x in dataset.files if x.role == 'header']
    if headers and config.path(headers[0].local_path).exists():
        text = config.path(headers[0].local_path).read_text(encoding='ascii')
        ignore = re.search(r'^data ignore value\s*=\s*(.+)$', text, re.M | re.I)
        if ignore and number(ignore[1]) not in source.metadata.nodata:
            source.metadata.warnings.append(f'HDR ENVI declara data ignore value={ignore[1].strip()}, pero LBL/XML no lo declaran; '
                                            'se priorizan las etiquetas científicas y se conservan esos valores de topografía.')
    return source
