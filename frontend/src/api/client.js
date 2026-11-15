/**
 * Cliente API para el backend de Cosmic Apus.
 * Se conecta a través del proxy de Vite (/api) o directamente al puerto 8000.
 */

const API_BASE = '/api/v1';

export async function fetchHealth() {
  try {
    const res = await fetch('/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Backend /health unreachable:', err);
    return null;
  }
}

export async function fetchBodies() {
  const res = await fetch(`${API_BASE}/bodies`);
  if (!res.ok) throw new Error('Error al obtener cuerpos celestes');
  return await res.json();
}

export async function fetchRegions(body = null) {
  const url = body ? `${API_BASE}/regions?body=${body}` : `${API_BASE}/regions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al obtener regiones');
  return await res.json();
}

export async function fetchRegionMetrics(regionId) {
  const res = await fetch(`${API_BASE}/regions/${regionId}/metrics`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.message || 'Error al obtener métricas');
  }
  return await res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/summary`);
  if (!res.ok) throw new Error('Error al obtener el resumen de regiones');
  return await res.json();
}

export async function searchAnalogs(targetRegionId, weights = { height: 0.33, slope: 0.33, roughness: 0.34 }) {
  const payload = { target_region_id: targetRegionId };
  if (weights) {
    if (weights.height !== undefined) payload.weight_height = Number(weights.height);
    if (weights.slope !== undefined) payload.weight_slope = Number(weights.slope);
    if (weights.roughness !== undefined) payload.weight_roughness = Number(weights.roughness);
  }
  const res = await fetch(`${API_BASE}/analogs/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Error en la búsqueda de análogos');
  }
  return await res.json();
}

export function getGeoTiffUrl(regionId) {
  return `${API_BASE}/regions/${regionId}/geotiff`;
}
