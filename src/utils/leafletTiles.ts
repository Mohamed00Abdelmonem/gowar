import L from 'leaflet';

const CARTO_VOYAGER_URL =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Attach a reliable street map tile layer to a Leaflet map instance.
 * Uses CARTO Voyager as primary (fast CDN, bilingual labels, no aggressive
 * referrer throttling) and automatically falls back to OpenStreetMap if tiles fail.
 */
export function addStreetTileLayer(map: L.Map): L.TileLayer {
  let switchedToFallback = false;

  const primary = L.tileLayer(CARTO_VOYAGER_URL, {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  primary.on('tileerror', () => {
    if (switchedToFallback) return;
    switchedToFallback = true;
    if (map.hasLayer(primary)) {
      map.removeLayer(primary);
    }
    L.tileLayer(OSM_FALLBACK_URL, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
  });

  return primary;
}
