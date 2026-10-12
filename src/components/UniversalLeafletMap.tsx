import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { IBI_KKG_CAMPUS_CENTER, RouteOptionCandidate } from './LiveGpsTrackerMap';
import { Stall } from '../data/kantinData';

interface UniversalLeafletMapProps {
  center: { lat: number; lng: number };
  mapTypeId: 'roadmap' | 'hybrid';
  cameraPanTrigger: string;
  tapPinModeEnabled: boolean;
  onPickCoordinate: (lat: number, lng: number) => void;
  studentGps: { lat: number; lng: number } | null;
  stallsToRender: Stall[];
  targetStallId?: string;
  onSelectStallMarker: (stallId: string) => void;
  infoOpenStallId: string | null;
  onCloseInfoWindow: () => void;
  onOpenStallMenu?: (stallId: string) => void;
  showMenuButtonInPopup: boolean;
  routeCandidates: RouteOptionCandidate[];
  selectedRouteIndex: number;
  onSelectRouteIndex: (idx: number) => void;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const UniversalLeafletMap: React.FC<UniversalLeafletMapProps> = ({
  center,
  mapTypeId,
  cameraPanTrigger,
  tapPinModeEnabled,
  onPickCoordinate,
  studentGps,
  stallsToRender,
  targetStallId,
  onSelectStallMarker,
  routeCandidates,
  selectedRouteIndex,
  onSelectRouteIndex,
  onOpenStallMenu,
  showMenuButtonInPopup,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const tapHandlerRef = useRef<{
    enabled: boolean;
    cb: (lat: number, lng: number) => void;
  }>({
    enabled: tapPinModeEnabled,
    cb: onPickCoordinate,
  });

  tapHandlerRef.current = {
    enabled: tapPinModeEnabled,
    cb: onPickCoordinate,
  };

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 18,
      zoomControl: true,
      attributionControl: true,
    });

    const initialUrl =
      mapTypeId === 'hybrid'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const tl = L.tileLayer(initialUrl, {
      maxZoom: 20,
      attribution: '&copy; Google Maps / OpenStreetMap',
    }).addTo(map);

    tileLayerRef.current = tl;
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (tapHandlerRef.current.enabled) {
        tapHandlerRef.current.cb(ev.latlng.lat, ev.latlng.lng);
      }
    });

    // Global delegate for popup "Lihat Menu & Pesan" button
    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const btn = target?.closest('[data-stall-menu-btn]') as HTMLElement | null;
      if (btn && onOpenStallMenu) {
        const sid = btn.getAttribute('data-stall-menu-btn');
        if (sid) onOpenStallMenu(sid);
      }
    };
    const el = containerRef.current;
    el.addEventListener('click', handleContainerClick);

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      el.removeEventListener('click', handleContainerClick);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch between Satellite+Labels (lyrs=y) and Roadmap (lyrs=m)
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const nextUrl =
      mapTypeId === 'hybrid'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current.setUrl(nextUrl);
  }, [mapTypeId]);

  // Pan to target when cameraPanTrigger or center changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.panTo([center.lat, center.lng], { animate: true });
  }, [cameraPanTrigger, center.lat, center.lng]);

  // Render markers (Buyer "Posisi Kamu" + Seller Stalls)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // Buyer GPS marker
    if (studentGps) {
      const buyerIcon = L.divIcon({
        className: 'kantinku-buyer-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-90%);">
            <div style="padding:2px 10px;border-radius:9999px;background:#2563eb;color:#ffffff;font-size:10px;font-weight:700;white-space:nowrap;border:1.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);margin-bottom:4px;">
              Posisi Kamu
            </div>
            <div style="width:20px;height:20px;border-radius:9999px;background:#2563eb;border:2.5px solid #ffffff;box-shadow:0 0 0 5px rgba(59,130,246,0.38),0 2px 6px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      L.marker([studentGps.lat, studentGps.lng], {
        icon: buyerIcon,
        zIndexOffset: 900,
      }).addTo(group);
    }

    // Seller stall markers
    stallsToRender.forEach((st) => {
      const pos = st.gpsLocation
        ? { lat: st.gpsLocation.lat, lng: st.gpsLocation.lng }
        : IBI_KKG_CAMPUS_CENTER;
      const isSelected = st.id === targetStallId;

      const badgeBg = !st.isOpen
        ? '#b91c1c'
        : isSelected
        ? '#047857'
        : '#ffffff';
      const badgeColor = !st.isOpen || isSelected ? '#ffffff' : '#0f172a';
      const badgeBorder = !st.isOpen || isSelected ? '#ffffff' : '#059669';
      const pinColor = !st.isOpen
        ? '#dc2626'
        : isSelected
        ? '#047857'
        : '#0284c7';
      const dotColor = st.isOpen ? '#6ee7b7' : '#fca5a5';

      const stallIcon = L.divIcon({
        className: 'kantinku-stall-marker',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);cursor:pointer;">
            <div style="padding:3px 9px;border-radius:8px;background:${badgeBg};color:${badgeColor};border:1.5px solid ${badgeBorder};font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;gap:5px;margin-bottom:3px;">
              <span style="width:7px;height:7px;border-radius:9999px;background:${dotColor};display:inline-block;"></span>
              <span>${escapeHtml(st.code)}: ${escapeHtml(st.name)}</span>
            </div>
            <div style="width:26px;height:26px;border-radius:9999px 9999px 9999px 0;background:${pinColor};border:2px solid #ffffff;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
              <div style="width:8px;height:8px;border-radius:9999px;background:#ffffff;"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([pos.lat, pos.lng], {
        icon: stallIcon,
        zIndexOffset: isSelected ? 1000 : 500,
      }).addTo(group);

      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:200px;max-width:240px;color:#0f172a;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#d1fae5;color:#065f46;">
              ${escapeHtml(st.code)} • ${st.isOpen ? 'Buka' : 'Tutup'}
            </span>
            <span style="font-size:10px;color:#475569;">
              ${escapeHtml(st.gpsLocation?.updatedAt || 'Titik Kampus')}
            </span>
          </div>
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;">
            ${escapeHtml(st.name)}
          </div>
          <div style="font-size:11px;color:#334155;margin-bottom:4px;">
            <strong>Patokan Penjual:</strong> ${escapeHtml(
              st.gpsLocation?.locationNote || st.locationDetail
            )}
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px;">
            ${escapeHtml(st.walkingGuide)}
          </div>
          ${
            showMenuButtonInPopup
              ? `<button type="button" data-stall-menu-btn="${escapeHtml(
                  st.id
                )}" style="width:100%;padding:6px 10px;border-radius:8px;background:#047857;color:#ffffff;font-size:11px;font-weight:700;border:none;cursor:pointer;">
                  Lihat Menu &amp; Pesan →
                </button>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupHtml, { closeButton: true, offset: [0, -34] });
      marker.on('click', () => {
        onSelectStallMarker(st.id);
      });
    });
  }, [
    studentGps?.lat,
    studentGps?.lng,
    stallsToRender,
    targetStallId,
    showMenuButtonInPopup,
  ]);

  // Render multi-route polylines (clickable grey alternatives + emerald active route)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const rGroup = routesLayerRef.current;
    if (!map || !rGroup) return;

    rGroup.clearLayers();

    if (routeCandidates.length === 0) return;

    const safeIdx =
      selectedRouteIndex >= 0 && selectedRouteIndex < routeCandidates.length
        ? selectedRouteIndex
        : 0;

    // 1. Draw unselected alternative routes underneath in clickable slate/grey
    routeCandidates.forEach((cand, idx) => {
      if (idx === safeIdx) return;
      const latlngs = cand.path.map((pt) => [pt.lat, pt.lng] as [number, number]);
      if (latlngs.length < 2) return;

      const altOuter = L.polyline(latlngs, {
        color: '#334155',
        weight: 8,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(rGroup);

      const altInner = L.polyline(latlngs, {
        color: '#94a3b8',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(rGroup);

      const handlePick = () => onSelectRouteIndex(idx);
      altOuter.on('click', handlePick);
      altInner.on('click', handlePick);
    });

    // 2. Draw selected route on top in vibrant emerald green
    const activeCand = routeCandidates[safeIdx];
    if (activeCand && activeCand.path.length >= 2) {
      const latlngs = activeCand.path.map(
        (pt) => [pt.lat, pt.lng] as [number, number]
      );

      L.polyline(latlngs, {
        color: '#064e3b',
        weight: 10,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(rGroup);

      L.polyline(latlngs, {
        color: '#10b981',
        weight: 6,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(rGroup);

      // Fit bounds cleanly when route candidates arrive
      const allPoints: [number, number][] = [];
      routeCandidates.forEach((c) =>
        c.path.forEach((p) => allPoints.push([p.lat, p.lng]))
      );
      if (allPoints.length >= 2) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 19 });
      }
    }
  }, [routeCandidates, selectedRouteIndex]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
};
