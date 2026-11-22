import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertCircle,
  Loader2,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { merchantDeliveryApi } from '../../../services/gowarApi';
import type { MerchantDeliveryDriver } from '../../../types';
import {
  DriverLocationBadge,
  DriverOperationalBadge,
  formatRelativeTime,
} from '../../../components/merchant/DriverStatusBadges';
import { formatDateTime } from '../../../utils/i18n';

export const MerchantDeliveryTrackingPage: React.FC = () => {
  const { t, language, activeMerchant } = useApp();
  const [drivers, setDrivers] = useState<MerchantDeliveryDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const loadTracking = useCallback(async () => {
    setError(null);
    try {
      const res = await merchantDeliveryApi.fetchTracking();
      setDrivers(res.drivers);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('تعذر تحميل بيانات التتبع المباشر', 'Failed to load live tracking')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadTracking();
    const timer = window.setInterval(() => {
      void loadTracking();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadTracking]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const centerLat = activeMerchant?.coordinates?.lat ?? 31.0409;
    const centerLng = activeMerchant?.coordinates?.lng ?? 31.3785;
    const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, [activeMerchant?.coordinates?.lat, activeMerchant?.coordinates?.lng]);

  // Sync markers whenever drivers or selectedDriverId changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    // Store marker
    if (activeMerchant?.coordinates?.lat && activeMerchant?.coordinates?.lng) {
      const storeIcon = L.divIcon({
        className: 'gowar-store-pin',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:#1C1917;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">S</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const storePos: L.LatLngTuple = [
        activeMerchant.coordinates.lat,
        activeMerchant.coordinates.lng,
      ];
      L.marker(storePos, { icon: storeIcon })
        .bindPopup(`<b>${language === 'ar' ? activeMerchant.nameAr : activeMerchant.nameEn}</b>`)
        .addTo(layer);
      bounds.push(storePos);
    }

    drivers.forEach((d) => {
      if (d.last_latitude === null || d.last_longitude === null) return;
      const isSelected = d.id === selectedDriverId;
      const color =
        d.location_status === 'live'
          ? '#1B8E53'
          : d.location_status === 'stale'
            ? '#D97706'
            : '#64748B';

      const driverIcon = L.divIcon({
        className: 'gowar-driver-pin',
        html: `<div style="padding:4px 8px;border-radius:999px;background:${color};color:#fff;font-weight:800;font-size:11px;white-space:nowrap;border:2px solid ${
          isSelected ? '#1C1917' : '#fff'
        };box-shadow:0 2px 8px rgba(0,0,0,0.28);">${d.first_name || d.full_name}</div>`,
        iconSize: [80, 26],
        iconAnchor: [40, 13],
      });

      const pos: L.LatLngTuple = [d.last_latitude, d.last_longitude];
      bounds.push(pos);

      const popupLines = [
        `<b>${d.full_name}</b>`,
        `${d.phone_number}`,
        d.current_order ? `Order #${d.current_order.order_number}` : '',
      ]
        .filter(Boolean)
        .join('<br/>');

      const marker = L.marker(pos, { icon: driverIcon }).bindPopup(popupLines).addTo(layer);
      marker.on('click', () => setSelectedDriverId(d.id));

      // Customer destination pin if selected or active order has coordinates
      if (
        d.current_order &&
        d.current_order.customer_latitude != null &&
        d.current_order.customer_longitude != null &&
        (isSelected || selectedDriverId === null)
      ) {
        const custPos: L.LatLngTuple = [
          Number(d.current_order.customer_latitude),
          Number(d.current_order.customer_longitude),
        ];
        bounds.push(custPos);
        const destIcon = L.divIcon({
          className: 'gowar-dest-pin',
          html: `<div style="width:24px;height:24px;border-radius:50%;background:#059669;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">C</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker(custPos, { icon: destIcon })
          .bindPopup(
            `<b>${d.current_order.customer_name}</b><br/>#${d.current_order.order_number}<br/>${d.current_order.customer_address}`
          )
          .addTo(layer);
      }
    });

    if (selectedDriverId) {
      const sel = drivers.find((x) => x.id === selectedDriverId);
      if (sel?.last_latitude != null && sel?.last_longitude != null) {
        map.setView([sel.last_latitude, sel.last_longitude], 15);
        return;
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
  }, [drivers, selectedDriverId, activeMerchant, language]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917]">
            {t('التتبع المباشر للمناديب', 'Live Driver Tracking')}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E6A66]">
            {t(
              'آخر موقع معروف لكل مندوب (يتم التحديث تلقائياً كل 15 ثانية أثناء مشاركة المندوب لموقعه)',
              'Latest reported location for each driver (auto-refreshes every 15s while sharing)'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadTracking()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#EAE6E1] bg-white text-xs font-bold text-[#1C1917] hover:bg-[#FAF9F7] self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('تحديث الآن', 'Refresh Now')}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Interactive Map */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-[#EAE6E1] flex items-center justify-between text-xs">
            <span className="font-bold text-[#1C1917] inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#1B8E53]" />
              {t('خريطة التوصيل', 'Delivery Map')}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-[#6E6A66]">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1C1917]" />
                {t('المتجر', 'Store')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1B8E53]" />
                {t('مندوب', 'Driver')}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                {t('العميل', 'Customer')}
              </span>
            </div>
          </div>
          <div ref={mapContainerRef} className="w-full h-[360px] sm:h-[440px] z-0" />
        </div>

        {/* Driver List */}
        <div className="bg-white rounded-2xl border border-[#EAE6E1] p-4 shadow-2xs space-y-3 max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#1C1917]">
              {t('المناديب', 'Drivers')} ({drivers.length})
            </h2>
            {selectedDriverId && (
              <button
                type="button"
                onClick={() => setSelectedDriverId(null)}
                className="text-xs font-bold text-[#1B8E53] hover:underline"
              >
                {t('عرض الكل', 'Show All')}
              </button>
            )}
          </div>

          {loading && drivers.length === 0 ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#6E6A66]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1B8E53]" />
              <span>{t('جاري التحميل...', 'Loading...')}</span>
            </div>
          ) : drivers.length === 0 ? (
            <p className="text-xs text-[#6E6A66] py-6 text-center">
              {t('لا يوجد مناديب نشطين حالياً', 'No drivers found')}
            </p>
          ) : (
            drivers.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedDriverId(d.id)}
                className={`w-full text-start p-3 rounded-xl border transition-colors space-y-2 ${
                  selectedDriverId === d.id
                    ? 'border-[#1B8E53] bg-[#E6F5EC]/50'
                    : 'border-[#EAE6E1] bg-[#FAF9F7]/60 hover:border-[#1B8E53]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#1C1917]">{d.full_name}</span>
                  <DriverOperationalBadge status={d.operational_status} />
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <DriverLocationBadge status={d.location_status} />
                  <span className="text-[#6E6A66]">
                    {d.last_location_at
                      ? formatRelativeTime(d.last_location_at, t)
                      : t('لا يوجد موقع بعد', 'No GPS yet')}
                  </span>
                </div>

                {d.last_location_at && (
                  <div className="text-[10px] text-[#6E6A66]">
                    {t('آخر تحديث:', 'Updated:')} {formatDateTime(d.last_location_at, language)}
                  </div>
                )}

                {d.current_order && (
                  <div className="pt-1.5 border-t border-[#EAE6E1] text-xs space-y-0.5">
                    <div className="font-bold text-[#1B8E53] inline-flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      <span>#{d.current_order.order_number}</span>
                    </div>
                    <div className="text-[11px] text-[#6E6A66] inline-flex items-start gap-1">
                      <Navigation className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-1">{d.current_order.customer_address}</span>
                    </div>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
