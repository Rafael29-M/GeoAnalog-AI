import numpy as np

from app.models.schemas import AnalysisScale, Statistics
from app.services.raster_processor import Crop


def statistics(values: np.ndarray) -> Statistics:
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        raise ValueError('No hay suficientes valores válidos para calcular estadísticas.')
    p10, p25, p75, p90 = np.percentile(finite, [10, 25, 75, 90])
    return Statistics(count=int(finite.size), minimum=float(finite.min()), maximum=float(finite.max()),
                      mean=float(finite.mean()), std=float(finite.std()), median=float(np.median(finite)),
                      p10=float(p10), p25=float(p25), p75=float(p75), p90=float(p90))


def slope_degrees(heights: np.ndarray, dx_m: np.ndarray, northing_m: np.ndarray) -> np.ndarray:
    """Central differences, real row-wise east spacing and physical north coordinates."""
    dz_dn = np.gradient(heights, northing_m, axis=0)
    dz_de = np.gradient(heights, axis=1) / dx_m[:, None]
    slope = np.degrees(np.arctan(np.hypot(dz_de, dz_dn)))
    slope[~np.isfinite(heights)] = np.nan
    slope[[0, -1], :] = np.nan
    slope[:, [0, -1]] = np.nan
    return slope


def window_sum(values: np.ndarray, rows: int, columns: int) -> np.ndarray:
    integral = np.pad(values, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return integral[rows:, columns:] - integral[:-rows, columns:] - integral[rows:, :-columns] + integral[:-rows, :-columns]


def roughness_std(heights: np.ndarray, rows: int, columns: int) -> np.ndarray:
    """Population std of height, full valid odd rectangular windows; edges are masked.

    Integral sums avoid allocating enormous sliding-window matrices for NASADEM.
    Subtract a global origin first to reduce cancellation for large height offsets.
    """
    if rows < 3 or columns < 3 or rows % 2 == 0 or columns % 2 == 0:
        raise ValueError('Rugosidad requiere dimensiones impares ≥3.')
    if rows > heights.shape[0] or columns > heights.shape[1]:
        raise ValueError('La ventana de rugosidad no cabe en el recorte.')
    valid = np.isfinite(heights)
    if not valid.any():
        raise ValueError('Recorte sin alturas válidas.')
    centered = np.where(valid, heights - np.mean(heights[valid]), 0.0)
    count = window_sum(valid.astype(np.float64), rows, columns)
    total = window_sum(centered, rows, columns)
    total_sq = window_sum(centered * centered, rows, columns)
    n = rows * columns
    variance = np.maximum(total_sq/n - (total/n)**2, 0)
    inner = np.where(count == n, np.sqrt(variance), np.nan)
    result = np.full_like(heights, np.nan, dtype=np.float64)
    result[rows//2:heights.shape[0]-rows//2, columns//2:heights.shape[1]-columns//2] = inner
    return result


def nearest_odd_count(length_m: float, spacing_m: float) -> int:
    # Physical footprint = number of samples × spacing. Never silently expand <3 pixels.
    if length_m < 3 * spacing_m:
        raise ValueError(f'Ventana física insuficiente: requiere al menos {3 * spacing_m:.1f} m.')
    return max(3, int(round((length_m/spacing_m-1)/2))*2+1)


def calculate(crop: Crop, roughness_window_m: float):
    dx, dy = float(np.mean(crop.dx_m)), float(np.mean(-np.diff(crop.northing_m)))
    columns, rows = nearest_odd_count(roughness_window_m, dx), nearest_odd_count(roughness_window_m, dy)
    if rows > crop.heights.shape[0] // 2 or columns > crop.heights.shape[1] // 2:
        raise ValueError('La región debe medir al menos dos ventanas de rugosidad por eje.')
    slope = slope_degrees(crop.heights, crop.dx_m, crop.northing_m)
    roughness = roughness_std(crop.heights, rows, columns)
    scale = AnalysisScale(dx_min_m=float(crop.dx_m.min()), dx_max_m=float(crop.dx_m.max()), dx_m=dx, dy_m=dy,
                          width_m=dx*crop.heights.shape[1], height_m=dy*crop.heights.shape[0],
                          roughness_rows=rows, roughness_columns=columns, roughness_width_m=columns*dx,
                          roughness_height_m=rows*dy, roughness_requested_m=roughness_window_m,
                          resampling=crop.resampling,native_dx_m=crop.native_dx_m,native_dy_m=crop.native_dy_m)
    return slope, roughness, scale
