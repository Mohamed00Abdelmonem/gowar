import L from 'leaflet';

const OSM_PRIMARY_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_FALLBACK_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

/**
 * Attach a street map tile layer to a Leaflet map instance.
 * Uses OpenStreetMap Standard (rich Arabic street names & landmarks) as primary,
 * and automatically falls back to CARTO Voyager if OSM tiles fail to load.
 */
export function addStreetTileLayer(map: L.Map): L.TileLayer {
  let switchedToFallback = false;

  const primary = L.tileLayer(OSM_PRIMARY_URL, {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  primary.on('tileerror', () => {
    if (switchedToFallback) return;
    switchedToFallback = true;
    if (map.hasLayer(primary)) {
      map.removeLayer(primary);
    }
    L.tileLayer(CARTO_FALLBACK_URL, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
  });

  return primary;
}
