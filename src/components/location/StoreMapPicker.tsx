import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Check,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Search,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  reverseGeocodeCoordinates,
  searchEgyptAddresses,
  type GeocodingSuggestion,
} from '../../services/locationService';

interface StoreMapPickerProps {
  storeName: string;
  coordinates: { lat: number; lng: number };
  deliveryRadiusKm?: number;
  defaultEditing?: boolean;
  heightClass?: string;
  onChange: (next: { lat: number; lng: number }, resolvedAddress?: string) => void;
  onSaveLocation?: (
    next: { lat: number; lng: number },
    resolvedAddress?: string
  ) => Promise<void> | void;
}

function createStorePinIcon(label: string, editing: boolean) {
  const safeLabel = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ring = editing ? '0 0 0 4px rgba(214,69,13,0.28)' : '0 4px 12px rgba(0,0,0,0.25)';
  return L.divIcon({
    className: 'gowar-store-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="padding:2px 8px;border-radius:8px;background:#1C1917;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.25);margin-bottom:4px;">${safeLabel || 'Gowar'}</div>
      <div style="width:34px;height:34px;border-radius:9999px;background:#D6450D;border:3px solid #fff;box-shadow:${ring};display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;">🏪</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #D6450D;margin-top:-2px;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export const StoreMapPicker: React.FC<StoreMapPickerProps> = ({
  storeName,
  coordinates,
  deliveryRadiusKm = 3,
  defaultEditing = false,
  heightClass = 'h-72',
  onChange,
  onSaveLocation,
}) => {
  const { language, t } = useApp();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const reverseAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [editing, setEditing] = useState(defaultEditing);
  const [draft, setDraft] = useState(coordinates);
  const [resolvedAddress, setResolvedAddress] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const editingRef = useRef(editing);
  editingRef.current = editing;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setDraft({ lat: coordinates.lat, lng: coordinates.lng });
  }, [coordinates.lat, coordinates.lng]);

  const selectPoint = async (lat: number, lng: number, explicitAddress?: string) => {
    const rounded = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    setDraft(rounded);
    setStatusNote(null);

    if (explicitAddress) {
      setResolvedAddress(explicitAddress);
      onChangeRef.current(rounded, explicitAddress);
      return;
    }

    onChangeRef.current(rounded);
    reverseAbortRef.current?.abort();
    const ctrl = new AbortController();
    reverseAbortRef.current = ctrl;
    try {
      const rev = await reverseGeocodeCoordinates(rounded, language, ctrl.signal);
      if (!ctrl.signal.aborted && rev.ok) {
        setResolvedAddress(rev.label);
        onChangeRef.current(rounded, rev.label);
      }
    } catch {
      // Ignore abort / network errors during reverse lookup
    }
  };

  // Mount real OpenStreetMap Leaflet instance once
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [coordinates.lat, coordinates.lng],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const circle = L.circle([coordinates.lat, coordinates.lng], {
      radius: Math.max(500, deliveryRadiusKm * 1000),
      color: '#D6450D',
      weight: 2,
      opacity: 0.7,
      fillColor: '#D6450D',
      fillOpacity: 0.1,
    }).addTo(map);

    const marker = L.marker([coordinates.lat, coordinates.lng], {
      icon: createStorePinIcon(storeName, editingRef.current),
      draggable: editingRef.current,
    }).addTo(map);

    marker.on('dragend', () => {
      if (!editingRef.current) return;
      const pos = marker.getLatLng();
      void selectPoint(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!editingRef.current) return;
      void selectPoint(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    const timer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(timer);
      reverseAbortRef.current?.abort();
      searchAbortRef.current?.abort();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // Mount once; state synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker position, icon, draggability, and delivery radius circle
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;

    const nextLatLng = L.latLng(draft.lat, draft.lng);
    marker.setLatLng(nextLatLng);
    marker.setIcon(createStorePinIcon(storeName, editing));
    if (marker.dragging) {
      if (editing) marker.dragging.enable();
      else marker.dragging.disable();
    }
    circle.setLatLng(nextLatLng);
    circle.setRadius(Math.max(500, deliveryRadiusKm * 1000));
    map.panTo(nextLatLng, { animate: true });
  }, [draft.lat, draft.lng, storeName, editing, deliveryRadiusKm]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setStatusNote(null);
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    try {
      const res = await searchEgyptAddresses(q, language, ctrl.signal);
      if (!ctrl.signal.aborted) {
        if (res.ok) {
          setSuggestions(res.results);
          if (res.results.length === 0) {
            setStatusNote(t('لم يتم العثور على نتائج لهذا العنوان.', 'No matching locations found.'));
          }
        } else if (res.error !== 'aborted') {
          setStatusNote(t('تعذر البحث عن العنوان حالياً.', 'Address lookup failed.'));
        }
      }
    } finally {
      if (!ctrl.signal.aborted) setSearching(false);
    }
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setStatusNote(t('المتصفح لا يدعم تحديد الموقع GPS.', 'Geolocation not supported.'));
      return;
    }
    setGpsLoading(true);
    setStatusNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        void selectPoint(pos.coords.latitude, pos.coords.longitude);
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 16);
      },
      () => {
        setGpsLoading(false);
        setStatusNote(
          t('تعذر الوصول لموقعك الحالي. تأكد من صلاحيات الموقع.', 'Could not retrieve GPS location.')
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleConfirmSave = async () => {
    if (!onSaveLocation) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSaveLocation(draft, resolvedAddress);
      setEditing(false);
      setSuggestions([]);
      setSearchQuery('');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(coordinates);
    setResolvedAddress(undefined);
    setSuggestions([]);
    setSearchQuery('');
    setStatusNote(null);
    onChange(coordinates);
    setEditing(false);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-bold text-[#6E6A66]">
            {t('موقع المحل على الخريطة الحقيقية', 'Store Location on Map')}
          </label>
          <p className="text-[11px] text-[#6E6A66]" dir="ltr">
            {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)} •{' '}
            {t(`نطاق التوصيل: ${deliveryRadiusKm} كم`, `Delivery radius: ${deliveryRadiusKm} km`)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF2EB] hover:bg-[#FDE2D2] text-[#D6450D] text-xs font-extrabold border border-[#FBD8C5]"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t('تعديل الموقع', 'Edit Location')}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleUseGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#EAE6E1] bg-white hover:bg-[#FAF9F7] text-xs font-bold text-[#1C1917]"
              >
                {gpsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D6450D]" />
                ) : (
                  <Navigation className="w-3.5 h-3.5 text-[#D6450D]" />
                )}
                <span>{t('موقعي الحالي', 'Use GPS')}</span>
              </button>
              {onSaveLocation && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmSave}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#D6450D] hover:bg-[#B33808] disabled:opacity-60 text-white text-xs font-bold"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ الموقع', 'Save Location')}</span>
                </button>
              )}
              {!defaultEditing && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#6E6A66] hover:text-[#1C1917]"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('إلغاء', 'Cancel')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6E6A66] absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
                placeholder={t('ابحث عن الشارع أو المعلم في مصر...', 'Search street or landmark in Egypt...')}
                className="w-full ps-9 pe-3 py-2 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching}
              className="px-4 py-2 rounded-xl bg-[#1C1917] text-white text-xs font-bold shrink-0"
            >
              {searching ? t('جاري البحث...', 'Searching...') : t('بحث', 'Search')}
            </button>
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-xl border border-[#EAE6E1] bg-white divide-y divide-[#EAE6E1] max-h-40 overflow-y-auto shadow-xs">
              {suggestions.map((sug) => (
                <button
                  key={sug.id}
                  type="button"
                  onClick={() => {
                    setSuggestions([]);
                    mapRef.current?.setView([sug.lat, sug.lng], 16);
                    void selectPoint(sug.lat, sug.lng, sug.shortLabel || sug.displayName);
                  }}
                  className="w-full px-3 py-2 text-start text-xs hover:bg-[#FFF2EB]/60 flex items-start gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#D6450D] shrink-0 mt-0.5" />
                  <span className="text-[#1C1917] line-clamp-1">{sug.displayName}</span>
                </button>
              ))}
            </div>
          )}

          {statusNote && <p className="text-[11px] font-bold text-amber-700">{statusNote}</p>}
          <p className="text-[11px] text-[#6E6A66]">
            {t(
              'اضغط في أي مكان على الخريطة أو اسحب الدبوس لتحديث موقع المحل بدقة.',
              'Click anywhere on the map or drag the pin to reposition your store.'
            )}
          </p>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full ${heightClass} rounded-2xl border ${
          editing ? 'border-[#D6450D] ring-2 ring-[#D6450D]/15' : 'border-[#EAE6E1]'
        } overflow-hidden z-0`}
      />
    </div>
  );
};
