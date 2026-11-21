import math

MIN_RADIUS_KM = 1
MAX_RADIUS_KM = 20
DEFAULT_RADIUS_KM = 3


def validate_coordinates(latitude: float, longitude: float) -> tuple[float, float]:
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError) as exc:
        raise ValueError("Latitude and longitude must be valid numbers.") from exc

    if not math.isfinite(lat) or not (-90.0 <= lat <= 90.0):
        raise ValueError("Latitude must be between -90 and 90 degrees.")
    if not math.isfinite(lng) or not (-180.0 <= lng <= 180.0):
        raise ValueError("Longitude must be between -180 and 180 degrees.")
    return lat, lng


def validate_search_radius_km(radius_km: float | int) -> int:
    try:
        val = int(float(radius_km))
    except (TypeError, ValueError) as exc:
        raise ValueError("Search radius must be a valid integer in kilometers.") from exc

    if not (MIN_RADIUS_KM <= val <= MAX_RADIUS_KM):
        raise ValueError(
            f"Search radius must be between {MIN_RADIUS_KM} and {MAX_RADIUS_KM} km."
        )
    return val
