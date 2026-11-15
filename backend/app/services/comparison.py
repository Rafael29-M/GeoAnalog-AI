import math

from app.models.schemas import Match, Metrics, RegionResult, SearchRequest, SearchResponse


def incompatibilities(target: Metrics, candidate: Metrics) -> list[str]:
    reasons = []
    for key in ('method_version', 'slope_method', 'roughness_method', 'height_unit', 'slope_unit', 'roughness_unit'):
        if getattr(target, key) != getattr(candidate, key):
            reasons.append(f'Método/unidad incompatible: {key}.')
    if target.quality == 'insufficient' or candidate.quality == 'insufficient':
        reasons.append('Cobertura válida insuficiente.')
    if target.scale.resampling != candidate.scale.resampling:
        reasons.append('Procedimiento de remuestreo incompatible.')
    for key in ('dx_m', 'dy_m', 'roughness_width_m', 'roughness_height_m'):
        a, b = getattr(target.scale, key), getattr(candidate.scale, key)
        if min(a, b) <= 0 or abs(a-b)/max(a, b) > 0.05:
            reasons.append(f'Escala física incompatible: {key} ({a:.1f} frente a {b:.1f} m); tolerancia 5%.')
    for key in ('width_m', 'height_m'):
        a, b = getattr(target.scale, key), getattr(candidate.scale, key)
        if min(a, b) <= 0 or abs(a-b)/max(a, b) > 0.10:
            reasons.append(f'Extensión regional incompatible: {key}; tolerancia 10%.')
    return reasons


def relative_difference(a: float, b: float) -> float:
    denominator = abs(a) + abs(b)
    return abs(a-b)/denominator if denominator else 0.0


def search_analogs(request: SearchRequest, results: list[RegionResult]) -> SearchResponse:
    lookup = {r.region.id: r for r in results}
    if request.target_region_id not in lookup:
        raise KeyError(request.target_region_id)
    target = lookup[request.target_region_id]
    if target.region.body not in ('moon', 'mars'):
        raise ValueError('La región objetivo debe ser lunar o marciana.')
    if target.metrics is None or target.status != 'processed':
        return SearchResponse(status='target_not_processed', target_region_id=request.target_region_id,
                              explanation=target.diagnostic or 'Falta procesar la región objetivo.')
    candidates = request.earth_region_ids
    if candidates is None:
        candidates = [r.region.id for r in results if r.region.body == 'earth']
    matches, excluded = [], {}
    for identifier in dict.fromkeys(candidates):
        if identifier not in lookup:
            excluded[identifier] = ['Región desconocida.']
            continue
        item = lookup[identifier]
        if item.region.body != 'earth':
            excluded[identifier] = ['La candidata debe ser terrestre.']
            continue
        if item.status != 'processed' or item.metrics is None:
            excluded[identifier] = ['Faltan mediciones procesadas vigentes.']
            continue
        reasons = incompatibilities(target.metrics, item.metrics)
        if reasons:
            excluded[identifier] = reasons
            continue
        slope = relative_difference(target.metrics.slope.mean, item.metrics.slope.mean)
        roughness = relative_difference(target.metrics.roughness.mean, item.metrics.roughness.mean)
        w_slope = request.weight_slope if request.weight_slope is not None else 0.5
        w_rough = request.weight_roughness if request.weight_roughness is not None else 0.5
        total_w = w_slope + w_rough
        if total_w > 0:
            w_s, w_r = w_slope / total_w, w_rough / total_w
        else:
            w_s, w_r = 0.5, 0.5
        dist = math.sqrt(w_s * (slope * slope) + w_r * (roughness * roughness))
        matches.append(Match(region_id=identifier, name=item.region.name, bounds=item.metrics.bounds,
                             distance=dist,
                             slope_difference=slope, roughness_difference=roughness,
                             metadata_source='NASA Earthdata / NASADEM SRTM',
                             dataset_urns=['urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010000_rdr::1.0'] if target.region.body == 'moon' else None))
    matches.sort(key=lambda m: (m.distance, m.region_id))

    pds_info = None
    if target.region.body == 'moon':
        pds_info = {
            'fuente_original': 'https://pds-geosciences.wustl.edu/lro/lro-l-dlre-4-rdr-v1/lrodlr_1002/data/collection_data_calibrated2_inventory.csv',
            'instrument': 'NASA LRO Diviner (DLRE)',
            'total_disponible': 500,
            'dataset_urns': [
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010000_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010010_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010020_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010030_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010040_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010050_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010100_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010110_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010120_rdr::1.0',
                'urn:nasa:pds:lro_diviner_calibrated:data_calibrated2:201701010130_rdr::1.0'
            ]
        }

    return SearchResponse(status='ok' if matches else 'no_compatible_regions', target_region_id=request.target_region_id,
                          matches=matches[:request.limit], excluded=excluded,
                          pds_metadata=pds_info,
                          explanation=('Distancia matemática exploratoria (menor es más parecido), no probabilidad ni validación geológica. '
                                       'Se usan pendiente y rugosidad medias; no se comparan alturas absolutas.' if matches else
                                       'Faltan regiones terrestres procesadas con resolución, métodos y ventanas físicas compatibles. '
                                       'Procesar las candidatas con la misma malla física y revisar la cobertura válida.'))
