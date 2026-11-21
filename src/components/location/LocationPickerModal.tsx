import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  Check,
  LocateFixed,
  Loader2,
  MapPin,
  Navigation,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import {
  inferNearestArea,
  reverseGeocodeCoordinates,
  searchEgyptAddresses,
  type GeocodingSuggestion,
} from '../../services/locationService';
import type { CustomerLocationState } from '../../types';

interface LocationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmed?: (loc: {
    lat: number;
    lng: number;
    formattedAddressAr: string;
    formattedAddressEn: string;
    areaId: string;
    selectedAddressId: string | null;
    source: CustomerLocationState['source'];
  }) => void;
}

const PIN_ICON = L.divIcon({
  className: 'gowar-customer-pin',
  html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
    <div style="width:38px;height:38px;border-radius:9999px;background:#D6450D;border:3px solid #FFFFFF;box-shadow:0 6px 16px rgba(214,69,13,0.45);display:flex;align-items:center;justify-content:center;">
      <div style="width:10px;height:10px;border-radius:9999px;background:#FFFFFF;"></div>
    </div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:10px solid #D6450D;margin-top:-2px;"></div>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  open,
  onClose,
  onConfirmed,
}) => {
  const {
    language,
    t,
    areas,
    activeCustomer,
    customerLocation,
    confirmCustomerLocation,
  } = useApp();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [draftCoords, setDraftCoords] = useState({
    lat: customerLocation.lat,
    lng: customerLocation.lng,
  });
  const [draftAddressAr, setDraftAddressAr] = useState(customerLocation.formattedAddressAr);
  const [draftAddressEn, setDraftAddressEn] = useState(customerLocation.formattedAddressEn);
  const [draftAreaId, setDraftAreaId] = useState(customerLocation.areaId);
  const [draftSavedId, setDraftSavedId] = useState<string | null>(
    customerLocation.selectedAddressId
  );
  const [draftSource, setDraftSource] = useState<CustomerLocationState['source']>(
    customerLocation.source
  );

  const [searchText, setSearchText] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [reverseLoading, setReverseLoading] = useState(false);

  const reverseControllerRef = useRef<AbortController | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);

  // Sync draft state whenever modal opens
  useEffect(() => {
    if (!open) return;
    setDraftCoords({ lat: customerLocation.lat, lng: customerLocation.lng });
    setDraftAddressAr(customerLocation.formattedAddressAr);
    setDraftAddressEn(customerLocation.formattedAddressEn);
    setDraftAreaId(customerLocation.areaId);
    setDraftSavedId(customerLocation.selectedAddressId);
    setDraftSource(customerLocation.source);
    setSearchText('');
    setSuggestions([]);
    setSearchError(null);
    setGpsError(null);
  }, [open, customerLocation]);

  const applyManualPoint = async (
    lat: number,
    lng: number,
    source: CustomerLocationState['source'],
    explicitLabel?: string
  ) => {
    setDraftCoords({ lat, lng });
    setDraftSavedId(null);
    setDraftSource(source);

    const nearestArea = inferNearestArea({ lat, lng }, areas);
    const resolvedAreaId = nearestArea?.id ?? customerLocation.areaId;
    setDraftAreaId(resolvedAreaId);

    if (explicitLabel) {
      setDraftAddressAr(explicitLabel);
      setDraftAddressEn(explicitLabel);
      return;
    }

    reverseControllerRef.current?.abort();
    const controller = new AbortController();
    reverseControllerRef.current = controller;

    setReverseLoading(true);
    const fallbackAr = nearestArea
      ? `${nearestArea.nameAr} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const fallbackEn = nearestArea
      ? `${nearestArea.nameEn} (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const res = await reverseGeocodeCoordinates({ lat, lng }, language, controller.signal);
    if (controller.signal.aborted) return;
    setReverseLoading(false);

    if (res.ok) {
      setDraftAddressAr(res.label);
      setDraftAddressEn(res.label);
    } else {
      setDraftAddressAr(fallbackAr);
      setDraftAddressEn(fallbackEn);
    }
  };

  // Initialize Leaflet map inside modal container
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [customerLocation.lat, customerLocation.lng],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([customerLocation.lat, customerLocation.lng], {
      draggable: true,
      icon: PIN_ICON,
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      void applyManualPoint(pos.lat, pos.lng, 'map');
    });

    map.on('click', (ev: L.LeafletMouseEvent) => {
      marker.setLatLng(ev.latlng);
      void applyManualPoint(ev.latlng.lat, ev.latlng.lng, 'map');
    });

    mapRef.current = map;
    markerRef.current = marker;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      window.clearTimeout(timer);
      reverseControllerRef.current?.abort();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Intentionally initialize once per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const moveMapPin = (lat: number, lng: number, zoom = 15) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], zoom, { animate: true });
    }
  };

  const handleUseCurrentLocation = () => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError(
        t(
          'متصفحك لا يدعم تحديد الموقع التلقائي. يمكنك البحث عن منطقتك أو تحريك العلامة يدوياً.',
          'Your browser does not support GPS geolocation. Please search or move the marker manually.'
        )
      );
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLoading(false);
        const { latitude, longitude } = position.coords;
        moveMapPin(latitude, longitude, 16);
        void applyManualPoint(latitude, longitude, 'gps');
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            t(
              'تم رفض صلاحية الوصول للموقع. اسمح بالموقع من إعدادات المتصفح أو حرّك العلامة على الخريطة يدوياً.',
              'Location permission was denied. Enable browser location access or select manually on the map.'
            )
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError(
            t(
              'خدمة تحديد الموقع (GPS) غير متاحة حالياً. حدد موقعك يدوياً على الخريطة أو ابحث بالمنطقة.',
              'GPS location is currently unavailable. Pick your spot manually on the map or search.'
            )
          );
        } else if (err.code === err.TIMEOUT) {
          setGpsError(
            t(
              'انتهت مهلة تحديد الموقع. حاول مرة أخرى أو حدد المكان يدوياً على الخريطة.',
              'Location request timed out. Please retry or tap your location on the map.'
            )
          );
        } else {
          setGpsError(
            t(
              'تعذر الوصول لموقعك الحالي. يمكنك اختيار المكان على الخريطة يدوياً.',
              'Unable to determine your current location. Select your spot on the map.'
            )
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleSearchAddresses = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchText.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }

    searchControllerRef.current?.abort();
    const controller = new AbortController();
    searchControllerRef.current = controller;

    setSearching(true);
    setSearchError(null);
    const res = await searchEgyptAddresses(q, language, controller.signal);
    if (controller.signal.aborted) return;
    setSearching(false);

    if (!res.ok) {
      setSuggestions([]);
      setSearchError(
        t(
          'تعذر الاتصال بخدمة البحث عن العناوين حالياً. يمكنك تحريك العلامة يدوياً على الخريطة أو اختيار حي قريب.',
          'Address search is currently unavailable. Please move the pin manually or pick a neighborhood.'
        )
      );
      return;
    }

    setSuggestions(res.results);
    if (res.results.length === 0) {
      setSearchError(
        t(
          'لم نجد نتائج مطابقة. جرّب كتابة اسم الشارع والحي مثل "عباس العقاد مدينة نصر".',
          'No matching Egyptian address found. Try street + district, e.g. "Abbas El Akkad Nasr City".'
        )
      );
    }
  };

  const handleSelectSuggestion = (item: GeocodingSuggestion) => {
    setSuggestions([]);
    setSearchError(null);
    setSearchText(item.shortLabel);
    moveMapPin(item.lat, item.lng, 16);
    void applyManualPoint(item.lat, item.lng, 'search', item.shortLabel);
  };

  const handleSelectAreaShortcut = (areaId: string) => {
    const area = areas.find((a) => a.id === areaId);
    if (!area?.coordinates) return;
    setGpsError(null);
    setSearchError(null);
    setSuggestions([]);
    moveMapPin(area.coordinates.lat, area.coordinates.lng, 14);
    setDraftCoords({ lat: area.coordinates.lat, lng: area.coordinates.lng });
    setDraftAreaId(area.id);
    setDraftAddressAr(`${area.nameAr}، ${area.cityAr}`);
    setDraftAddressEn(`${area.nameEn}, ${area.cityEn}`);
    setDraftSavedId(null);
    setDraftSource('area');
  };

  const handleSelectSavedAddress = (addrId: string) => {
    const addr = activeCustomer.addresses.find((a) => a.id === addrId);
    if (!addr) return;
    const area = areas.find((a) => a.id === addr.areaId);
    const coords = addr.coordinates ?? area?.coordinates ?? draftCoords;
    setGpsError(null);
    setSearchError(null);
    setSuggestions([]);
    moveMapPin(coords.lat, coords.lng, 16);
    setDraftCoords({ lat: coords.lat, lng: coords.lng });
    setDraftAreaId(addr.areaId);
    setDraftAddressAr(addr.streetAr);
    setDraftAddressEn(addr.streetEn);
    setDraftSavedId(addr.id);
    setDraftSource('saved');
  };

  const handleConfirm = () => {
    const payload = {
      lat: draftCoords.lat,
      lng: draftCoords.lng,
      formattedAddressAr: draftAddressAr,
      formattedAddressEn: draftAddressEn,
      areaId: draftAreaId,
      selectedAddressId: draftSavedId,
      source: draftSource,
    };
    confirmCustomerLocation(payload);
    onConfirmed?.(payload);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('حدد مكان التوصيل', 'Select Delivery Location')}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Address Search + Prominent Current Location CTA */}
        <div className="flex flex-col sm:flex-row gap-2">
          <form onSubmit={handleSearchAddresses} className="flex-1 flex gap-2 relative">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#6E6A66] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('ابحث عن عنوان أو منطقة...', 'Search street, area, or landmark...')}
                className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-[#FAF9F7] border border-[#EAE6E1] text-xs sm:text-sm focus:outline-none focus:border-[#D6450D]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#332E2A] text-white text-xs font-bold shrink-0 disabled:opacity-60"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : t('بحث', 'Search')}
            </button>
          </form>

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={gpsLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FFF2EB] hover:bg-[#FDE2D2] border border-[#FBD8C5] text-[#D6450D] text-xs font-extrabold transition-colors shrink-0 disabled:opacity-60"
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LocateFixed className="w-4 h-4" />
            )}
            <span>
              {gpsLoading
                ? t('جاري تحديد موقعك...', 'Locating...')
                : t('استخدم موقعي الحالي', 'Use My Current Location')}
            </span>
          </button>
        </div>

        {/* Geocoding Search Results */}
        {suggestions.length > 0 && (
          <div className="rounded-xl border border-[#EAE6E1] bg-white divide-y divide-[#EAE6E1] max-h-44 overflow-y-auto shadow-sm">
            {suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-start px-3.5 py-2.5 hover:bg-[#FFF2EB]/70 transition-colors flex items-start gap-2.5"
              >
                <MapPin className="w-4 h-4 text-[#D6450D] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#1C1917] truncate">
                    {item.shortLabel}
                  </div>
                  <div className="text-[11px] text-[#6E6A66] truncate">
                    {item.displayName}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search Error or GPS Error States */}
        {(gpsError || searchError) && (
          <div
            role="alert"
            className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2 text-xs text-amber-900"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{gpsError ?? searchError}</span>
          </div>
        )}

        {/* Map Container with Clear Drag Instruction */}
        <div className="relative rounded-2xl overflow-hidden border border-[#EAE6E1] bg-[#F5F2EE]">
          <div ref={mapContainerRef} className="w-full h-64 sm:h-72" />
          <div className="pointer-events-none absolute top-2.5 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[400] px-3 py-1 rounded-full bg-white/95 border border-[#EAE6E1] shadow-sm text-[11px] font-bold text-[#1C1917] whitespace-nowrap flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-[#D6450D]" />
            <span>{t('حرّك العلامة لتحديد مكانك أو اضغط على الخريطة', 'Drag the marker or tap anywhere on the map')}</span>
          </div>
        </div>

        {/* Saved Addresses + Quick Neighborhood Shortcuts */}
        <div className="space-y-2.5">
          {activeCustomer.addresses.length > 0 && (
            <div>
              <span className="block text-[11px] font-bold text-[#6E6A66] mb-1.5">
                {t('عناوينك المحفوظة', 'Saved Addresses')}
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {activeCustomer.addresses.map((addr) => {
                  const selected = draftSavedId === addr.id;
                  return (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSelectSavedAddress(addr.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                        selected
                          ? 'bg-[#FFF2EB] border-[#D6450D] text-[#D6450D]'
                          : 'bg-[#FAF9F7] border-[#EAE6E1] text-[#1C1917] hover:border-[#D6450D]'
                      }`}
                    >
                      {selected && <Check className="w-3.5 h-3.5" />}
                      <span>{language === 'ar' ? addr.labelAr : addr.labelEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <span className="block text-[11px] font-bold text-[#6E6A66] mb-1.5">
              {t('أو انتقل سريعاً لمنطقة:', 'Quick jump to neighborhood:')}
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {areas
                .filter((a) => a.isActive)
                .map((area) => {
                  const active = !draftSavedId && draftAreaId === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => handleSelectAreaShortcut(area.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap transition-colors shrink-0 ${
                        active
                          ? 'bg-[#1C1917] text-white border-[#1C1917]'
                          : 'bg-white text-[#6E6A66] border-[#EAE6E1] hover:border-[#D6450D]'
                      }`}
                    >
                      {language === 'ar' ? area.nameAr : area.nameEn}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Selected Address Preview & Confirm CTA */}
        <div className="rounded-2xl bg-[#FAF9F7] border border-[#EAE6E1] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#FFF2EB] text-[#D6450D] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block text-[11px] font-bold text-[#6E6A66]">
                {reverseLoading
                  ? t('جاري قراءة اسم الشارع...', 'Looking up address...')
                  : t('العنوان المحدد للتوصيل:', 'Selected delivery address:')}
              </span>
              <p className="text-xs sm:text-sm font-extrabold text-[#1C1917] leading-snug mt-0.5 break-words">
                {language === 'ar' ? draftAddressAr : draftAddressEn}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-6 py-3 rounded-xl bg-[#D6450D] hover:bg-[#B33808] text-white text-xs sm:text-sm font-extrabold transition-colors shrink-0 inline-flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>{t('تأكيد الموقع', 'Confirm This Location')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
