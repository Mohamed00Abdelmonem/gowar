import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';
import {
  formatDistanceAway,
  type EvaluatedStore,
} from '../../services/locationService';
import { formatEGP } from '../../utils/i18n';

interface NearbyStoresMapProps {
  stores: EvaluatedStore[];
}

function createCustomerIcon(label: string) {
  return L.divIcon({
    className: 'gowar-map-customer',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="padding:2px 8px;border-radius:9999px;background:#1C1917;color:#fff;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.25);margin-bottom:3px;">${label}</div>
      <div style="width:18px;height:18px;border-radius:9999px;background:#0284C7;border:3px solid #fff;box-shadow:0 0 0 4px rgba(2,132,199,0.25);"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createStoreIcon(deliverable: boolean, isOpen: boolean) {
  const bg = !isOpen ? '#475569' : deliverable ? '#D6450D' : '#D97706';
  return L.divIcon({
    className: 'gowar-map-store',
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
      <div style="width:30px;height:30px;border-radius:10px;background:${bg};border:2px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.25);">🏪</div>
      <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${bg};margin-top:-1px;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export const NearbyStoresMap: React.FC<NearbyStoresMapProps> = ({ stores }) => {
  const { language, t, customerLocation } = useApp();
  const navigate = useNavigate();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: [customerLocation.lat, customerLocation.lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // Map mounts once; layers update reactively below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const radiusMeters = customerLocation.searchRadiusKm * 1000;
    const circle = L.circle([customerLocation.lat, customerLocation.lng], {
      radius: radiusMeters,
      color: '#D6450D',
      weight: 2,
      opacity: 0.75,
      fillColor: '#D6450D',
      fillOpacity: 0.1,
    }).addTo(group);

    L.marker([customerLocation.lat, customerLocation.lng], {
      icon: createCustomerIcon(t('موقعك', 'You')),
      zIndexOffset: 500,
    }).addTo(group);

    stores.forEach(({ merchant, distanceKm, isDeliverable, deliveryStatus }) => {
      const marker = L.marker([merchant.coordinates.lat, merchant.coordinates.lng], {
        icon: createStoreIcon(isDeliverable, merchant.isOpen),
      }).addTo(group);

      const storeName = language === 'ar' ? merchant.nameAr : merchant.nameEn;
      const distText = formatDistanceAway(distanceKm, language, true);
      const statusText =
        deliveryStatus === 'deliverable'
          ? `${t('التوصيل:', 'Delivery:')} ${formatEGP(merchant.delivery.deliveryFee, language)}`
          : deliveryStatus === 'pickup_only'
            ? t('استلام من المحل فقط', 'Pickup only')
            : t('خارج نطاق التوصيل لعنوانك', 'Outside delivery coverage');

      const popupRoot = document.createElement('div');
      popupRoot.dir = language === 'ar' ? 'rtl' : 'ltr';
      popupRoot.style.minWidth = '185px';
      popupRoot.style.fontFamily = 'inherit';

      const titleEl = document.createElement('div');
      titleEl.textContent = storeName;
      titleEl.style.fontWeight = '800';
      titleEl.style.fontSize = '13px';
      titleEl.style.color = '#1C1917';

      const distEl = document.createElement('div');
      distEl.textContent = distText;
      distEl.style.fontSize = '11px';
      distEl.style.color = '#6E6A66';
      distEl.style.marginTop = '3px';

      const badgeEl = document.createElement('div');
      badgeEl.textContent = statusText;
      badgeEl.style.fontSize = '11px';
      badgeEl.style.fontWeight = '700';
      badgeEl.style.marginTop = '4px';
      badgeEl.style.color = isDeliverable ? '#D6450D' : '#B45309';

      const btnEl = document.createElement('button');
      btnEl.type = 'button';
      btnEl.textContent = t('شوف المنتجات', 'View Products');
      btnEl.style.marginTop = '8px';
      btnEl.style.width = '100%';
      btnEl.style.padding = '6px 10px';
      btnEl.style.borderRadius = '10px';
      btnEl.style.border = 'none';
      btnEl.style.background = '#D6450D';
      btnEl.style.color = '#FFFFFF';
      btnEl.style.fontWeight = '800';
      btnEl.style.fontSize = '11px';
      btnEl.style.cursor = 'pointer';
      btnEl.onclick = () => navigate(`/stores/${merchant.id}`);

      popupRoot.appendChild(titleEl);
      popupRoot.appendChild(distEl);
      popupRoot.appendChild(badgeEl);
      popupRoot.appendChild(btnEl);

      marker.bindPopup(popupRoot);
    });

    map.fitBounds(circle.getBounds(), { padding: [24, 24], animate: true });
  }, [stores, customerLocation, language, t, navigate]);

  return (
    <div className="bg-white rounded-2xl border border-[#EAE6E1] overflow-hidden shadow-2xs">
      <div className="px-4 py-2.5 border-b border-[#EAE6E1] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#1C1917]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
            {t('موقعك المحدد', 'Your Location')}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#1C1917]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D6450D]" />
            {t('محل متاح للتوصيل', 'Delivers to You')}
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#6E6A66]">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
            {t('خارج نطاق التوصيل / استلام فقط', 'Outside Delivery / Pickup')}
          </span>
        </div>
        <span className="text-[11px] text-[#6E6A66]">
          {t('المسافات المعروضة جوية تقريبية', 'Distances are approximate straight-line')}
        </span>
      </div>
      <div ref={containerRef} className="w-full h-[380px] sm:h-[460px]" />
    </div>
  );
};
