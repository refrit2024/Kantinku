import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  normalizeStallLocation,
  Stall,
} from '../data/kantinData';
import { IBI_KKG_CAMPUS_CENTER } from './LiveGpsTrackerMap';

export interface CampusLandmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  description: string;
  shortLabel: string;
}

export const CAMPUS_LANDMARKS: CampusLandmark[] = [
  {
    id: 'hall-d',
    name: 'Hall D Kantin IBI KKG',
    lat: -6.151301,
    lng: 106.886847,
    category: 'canteen',
    description: 'Pusat Kantin Mahasiswa & Dosen',
    shortLabel: 'Hall D',
  },
  {
    id: 'hall-a',
    name: 'Lobi Utama Gedung A',
    lat: -6.151759,
    lng: 106.887494,
    category: 'lobby',
    description: 'Pintu Masuk Utama Kampus',
    shortLabel: 'Lobi A',
  },
];

export type MapStyleMode = 'osm_campus' | 'satellite_hd' | 'street_atlas';

// Real OpenStreetMap Polygon Geometries for Kwik Kian Gie School of Business (Way 1334434680 & Buildings)
const KKG_CAMPUS_BOUNDARY: [number, number][] = [
  [-6.1517599, 106.8874948],
  [-6.1516246, 106.887255],
  [-6.1515313, 106.8867843],
  [-6.1520448, 106.8866898],
  [-6.1519633, 106.8863296],
  [-6.151498, 106.886449],
  [-6.1513446, 106.8858965],
  [-6.1511686, 106.8860118],
  [-6.1505233, 106.8861084],
  [-6.1505466, 106.8863719],
  [-6.1504919, 106.8864222],
  [-6.1507046, 106.8871129],
  [-6.1510313, 106.8870096],
  [-6.151258, 106.8877951],
  [-6.1517599, 106.8874948],
];

const KKG_MAIN_BUILDING_POLYGON: [number, number][] = [
  [-6.1508573, 106.8865945],
  [-6.151356, 106.8864818],
  [-6.1514253, 106.8868332],
  [-6.1513266, 106.8869485],
  [-6.151364, 106.8870306],
  [-6.1513853, 106.8870773],
  [-6.1512386, 106.8871443],
  [-6.1512226, 106.8871045],
  [-6.1511879, 106.8870183],
  [-6.1511293, 106.8870558],
  [-6.1510146, 106.8869271],
  [-6.1509319, 106.8869459],
  [-6.1508573, 106.8865945],
];

const KKG_HALL_D_BUILDING_POLYGON: [number, number][] = [
  [-6.1506051, 106.8865609],
  [-6.1506936, 106.8869178],
  [-6.1508943, 106.8868674],
  [-6.1508058, 106.8865106],
  [-6.1506051, 106.8865609],
];

const KKG_CANTEEN_WING_POLYGON: [number, number][] = [
  [-6.15054, 106.886155],
  [-6.150578, 106.8863533],
  [-6.1510281, 106.8862663],
  [-6.1509903, 106.8860679],
  [-6.15054, 106.886155],
];

function computeHaversineMeters(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((dest.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((dest.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((origin.lat * Math.PI) / 180) *
      Math.cos((dest.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(20, Math.round(R * c));
}

function buildCampusWalkwayPath(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  landmarkId: string
): [number, number][] {
  // Real campus walkway corridor inside Kwik Kian Gie School of Business
  const lobbyDropoff: [number, number] = [-6.15126, 106.88708];
  const centralCorridor: [number, number] = [-6.15095, 106.88654];

  if (landmarkId === 'halte-sunter') {
    return [
      [origin.lat, origin.lng],
      lobbyDropoff,
      centralCorridor,
      [dest.lat, dest.lng],
    ];
  }
  if (landmarkId === 'lobi-utama') {
    return [
      [origin.lat, origin.lng],
      centralCorridor,
      [dest.lat, dest.lng],
    ];
  }
  return [
    [origin.lat, origin.lng],
    centralCorridor,
    [dest.lat, dest.lng],
  ];
}

interface CampusMapExplorerProps {
  stalls: Stall[];
  onSelectStall: (stallId: string) => void;
  focusedStallId?: string;
  compactMode?: boolean;
}

export const CampusMapExplorer: React.FC<CampusMapExplorerProps> = ({
  stalls: rawStalls,
  onSelectStall,
  focusedStallId,
  compactMode = false,
}) => {
  const stalls = rawStalls.map((s, idx) => normalizeStallLocation(s, idx));

  const [selectedStallId, setSelectedStallId] = useState<string | null>(
    focusedStallId || stalls[0]?.id || null
  );
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string>('lobi-utama');
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('osm_campus');
  const [userGpsLocation, setUserGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>('');

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const campusFootprintLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (focusedStallId) {
      setSelectedStallId(focusedStallId);
    }
  }, [focusedStallId]);

  const activeStall = stalls.find((s) => s.id === selectedStallId) || stalls[0];
  const activeLandmark: CampusLandmark =
    CAMPUS_LANDMARKS.find((l) => l.id === selectedLandmarkId) || CAMPUS_LANDMARKS[0];

  const routeOrigin = userGpsLocation
    ? userGpsLocation
    : { lat: activeLandmark.lat, lng: activeLandmark.lng };

  const normalizedActiveStall = activeStall ? normalizeStallLocation(activeStall) : null;
  const routeDestination =
    normalizedActiveStall?.gpsLocation?.lat && normalizedActiveStall?.gpsLocation?.lng
      ? { lat: normalizedActiveStall.gpsLocation.lat, lng: normalizedActiveStall.gpsLocation.lng }
      : IBI_KKG_CAMPUS_CENTER;

  const computedDistanceMeters = userGpsLocation
    ? computeHaversineMeters(routeOrigin, routeDestination)
    : activeStall?.distanceMeters || computeHaversineMeters(routeOrigin, routeDestination);

  const computedWalkingMinutes = Math.max(1, Math.round(computedDistanceMeters / 65));

  // Initialize & Update Leaflet Engine at the EXACT Kwik Kian Gie School of Business coordinates
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const mapInstance = L.map(mapContainerRef.current, {
        center: [IBI_KKG_CAMPUS_CENTER.lat, IBI_KKG_CAMPUS_CENTER.lng],
        zoom: 18,
        minZoom: 15,
        maxZoom: 19,
        zoomControl: true,
        attributionControl: true,
      });

      campusFootprintLayerRef.current = L.layerGroup().addTo(mapInstance);
      routeLayerRef.current = L.layerGroup().addTo(mapInstance);
      markersLayerRef.current = L.layerGroup().addTo(mapInstance);
      leafletMapRef.current = mapInstance;
    }

    const map = leafletMapRef.current;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    let tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let attribution =
      '&copy; OpenStreetMap • Kwik Kian Gie School of Business (Jl. Yos Sudarso Kav. 87)';

    if (mapStyle === 'satellite_hd') {
      tileUrl =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Citra Satelit Gedung Asli &copy; Esri World Imagery';
    } else if (mapStyle === 'street_atlas') {
      tileUrl =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Peta Jalan &copy; Esri World Street Map';
    }

    tileLayerRef.current = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution,
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [mapStyle]);

  // Draw Exact Campus Boundary, Building Polygons (Gedung Utama, Hall D, Selasar Kantin), Route & Pins
  useEffect(() => {
    const map = leafletMapRef.current;
    const footprintGroup = campusFootprintLayerRef.current;
    const markersGroup = markersLayerRef.current;
    const routeGroup = routeLayerRef.current;
    if (!map || !footprintGroup || !markersGroup || !routeGroup) return;

    footprintGroup.clearLayers();
    markersGroup.clearLayers();
    routeGroup.clearLayers();

    // 1. Highlight Exact Kwik Kian Gie School of Business Campus Perimeter (from OpenStreetMap Way 1334434680)
    L.polygon(KKG_CAMPUS_BOUNDARY, {
      color: '#1677FF',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#1677FF',
      fillOpacity: mapStyle === 'satellite_hd' ? 0.08 : 0.05,
    })
      .bindTooltip('Area Kampus IBI Kwik Kian Gie (Jl. Yos Sudarso Kav. 87)', {
        sticky: true,
        direction: 'top',
      })
      .addTo(footprintGroup);

    // 2. Highlight Main 8-Story University Building (OSM Way 528379562)
    L.polygon(KKG_MAIN_BUILDING_POLYGON, {
      color: '#0F172A',
      weight: 1.5,
      fillColor: '#3B82F6',
      fillOpacity: mapStyle === 'satellite_hd' ? 0.28 : 0.18,
    })
      .bindTooltip('Gedung Utama Perkuliahan & Lobi IBI KKG (8 Lantai)', {
        direction: 'center',
      })
      .addTo(footprintGroup);

    // 3. Highlight Hall D Building (OSM Way 498447278)
    L.polygon(KKG_HALL_D_BUILDING_POLYGON, {
      color: '#0D9488',
      weight: 2,
      fillColor: '#14B8A6',
      fillOpacity: mapStyle === 'satellite_hd' ? 0.35 : 0.25,
    })
      .bindTooltip('Gedung Hall D IBI KKG', {
        direction: 'center',
      })
      .addTo(footprintGroup);

    // 4. Highlight Canteen Wing Building (OSM Way 498447279)
    L.polygon(KKG_CANTEEN_WING_POLYGON, {
      color: '#15803D',
      weight: 2,
      fillColor: '#22C55E',
      fillOpacity: mapStyle === 'satellite_hd' ? 0.35 : 0.25,
    })
      .bindTooltip('Area Selasar Kantin Kampus (Dekat Hall D)', {
        direction: 'center',
      })
      .addTo(footprintGroup);

    // 5. Draw Walking Route Polyline
    const walkwayCoords = userGpsLocation
      ? ([
          [routeOrigin.lat, routeOrigin.lng],
          [routeDestination.lat, routeDestination.lng],
        ] as [number, number][])
      : buildCampusWalkwayPath(routeOrigin, routeDestination, selectedLandmarkId);

    L.polyline(walkwayCoords, {
      color: '#FFFFFF',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(routeGroup);

    L.polyline(walkwayCoords, {
      color: '#1677FF',
      weight: 4.5,
      opacity: 1,
      dashArray: '8, 8',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(routeGroup);

    // 6. Draw Campus Landmarks (Starting Points)
    CAMPUS_LANDMARKS.forEach((lm) => {
      const isSelectedOrigin = !userGpsLocation && lm.id === selectedLandmarkId;
      const landmarkIcon = L.divIcon({
        className: 'custom-landmark-marker',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 999px;
            background: ${isSelectedOrigin ? '#1677FF' : '#1E293B'};
            color: #FFFFFF;
            font-size: 10.5px;
            font-weight: 700;
            white-space: nowrap;
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 8px rgba(0,0,0,0.28);
            transform: translate(-50%, -50%) ${isSelectedOrigin ? 'scale(1.06)' : 'scale(0.92)'};
          ">
            <span>🚩</span>
            <span>${lm.shortLabel}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lm.lat, lm.lng], { icon: landmarkIcon }).addTo(markersGroup);
      marker.on('click', () => {
        setUserGpsLocation(null);
        setSelectedLandmarkId(lm.id);
      });
    });

    // 7. Draw Live User GPS Marker if active
    if (userGpsLocation) {
      const gpsIcon = L.divIcon({
        className: 'custom-gps-marker',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 9px;
            border-radius: 999px;
            background: #1677FF;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 0 6px rgba(22,119,255,0.25);
            transform: translate(-50%, -50%);
          ">
            <span>📍 GPS Saya</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker([userGpsLocation.lat, userGpsLocation.lng], { icon: gpsIcon }).addTo(markersGroup);
    }

    // 8. Draw Canteen Stall Pins around Hall D & Canteen Wing
    stalls.forEach((rawStall, idx) => {
      const stall = normalizeStallLocation(rawStall, idx);
      const baseLat = stall.gpsLocation?.lat ?? IBI_KKG_CAMPUS_CENTER.lat;
      const baseLng = stall.gpsLocation?.lng ?? IBI_KKG_CAMPUS_CENTER.lng;
      const lat = idx >= 5 ? baseLat + ((idx % 3) - 1) * 0.00014 : baseLat;
      const lng = idx >= 5 ? baseLng + ((idx % 2 === 0 ? 1 : -1) * 0.00016) : baseLng;

      const isSelected = stall.id === activeStall?.id;
      const bgColor = stall.isFrozen
        ? '#DC2626'
        : stall.isOpen
        ? '#15803D'
        : '#64748B';

      const codeText = stall.code || `Stan 0${idx + 1}`;
      const labelText = isSelected ? `${codeText} • ${stall.name}` : codeText;

      const stallIcon = L.divIcon({
        className: 'custom-stall-marker',
        html: `
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: ${isSelected ? '5px 11px' : '3.5px 8.5px'};
            border-radius: 999px;
            background: ${bgColor};
            color: #FFFFFF;
            font-size: ${isSelected ? '11.5px' : '10.5px'};
            font-weight: 800;
            white-space: nowrap;
            border: 2px solid #FFFFFF;
            box-shadow: ${
              isSelected
                ? '0 0 0 4px rgba(22,119,255,0.4), 0 6px 14px rgba(0,0,0,0.35)'
                : '0 2px 6px rgba(0,0,0,0.28)'
            };
            transform: translate(-50%, -50%);
            cursor: pointer;
          ">
            <span>🍽️</span>
            <span>${labelText}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const sMarker = L.marker([lat, lng], {
        icon: stallIcon,
        zIndexOffset: isSelected ? 1000 : 200 + idx * 10,
      }).addTo(markersGroup);

      sMarker.on('click', () => {
        setSelectedStallId(stall.id);
      });
    });

    // Fit map view cleanly around the Kwik Kian Gie campus polygon
    const campusBounds = L.latLngBounds(KKG_CAMPUS_BOUNDARY);
    if (userGpsLocation) {
      campusBounds.extend([userGpsLocation.lat, userGpsLocation.lng]);
    }
    map.fitBounds(campusBounds, { padding: [24, 24], maxZoom: 18 });
  }, [
    mapStyle,
    stalls,
    activeStall?.id,
    selectedLandmarkId,
    userGpsLocation,
    routeOrigin.lat,
    routeOrigin.lng,
    routeDestination.lat,
    routeDestination.lng,
  ]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const handleResetCampusView = () => {
    if (!leafletMapRef.current) return;
    setUserGpsLocation(null);
    setGpsStatusText('');
    const campusBounds = L.latLngBounds(KKG_CAMPUS_BOUNDARY);
    leafletMapRef.current.fitBounds(campusBounds, { padding: [24, 24], maxZoom: 18 });
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsStatusText('Browser Anda tidak mendukung fitur GPS.');
      return;
    }
    setGpsStatusText('Mendeteksi koordinat GPS Anda...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserGpsLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsStatusText('Lokasi GPS Anda aktif! Menampilkan rute langsung ke stan kantin.');
      },
      () => {
        setGpsStatusText(
          'Izin GPS belum diaktifkan. Menggunakan titik awal Lobi Utama Kampus IBI KKG.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // External Navigation URLs (AMap Global / Gaode & Google Maps)
  const amapNavigationUrl = activeStall
    ? `https://uri.amap.com/navigation?from=${routeOrigin.lng},${routeOrigin.lat},${encodeURIComponent(
        userGpsLocation ? 'Lokasi Saya' : activeLandmark.shortLabel
      )}&to=${routeDestination.lng},${routeDestination.lat},${encodeURIComponent(
        `${activeStall.name} (IBI KKG)`
      )}&mode=walk&policy=0&src=kantinku_ibikkg&coordinate=wgs84&callnative=1`
    : 'https://www.amap.com';

  const googleMapsNavigationUrl = activeStall
    ? `https://www.google.com/maps/dir/?api=1&origin=${routeOrigin.lat},${routeOrigin.lng}&destination=${routeDestination.lat},${routeDestination.lng}&travelmode=walking`
    : 'https://maps.google.com';

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/25 overflow-hidden flex flex-col">
      {/* Top Map Header & Style Switcher */}
      <div className="p-4 sm:p-5 border-b border-outline-variant/20 flex flex-col gap-3.5 bg-surface-container-low/50">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#1677FF] text-white font-label-sm text-[11px] font-bold">
                <span className="material-symbols-outlined text-[14px]">verified_location</span>
                <span>Koordinat Presisi Kampus IBI Kwik Kian Gie (Sunter)</span>
              </span>
              <span className="font-label-sm text-xs text-on-surface-variant">
                Jl. Yos Sudarso Kav. 87 (Sebelah Gedung Graha Kirana &amp; Altira Business Park)
              </span>
            </div>
            <h2 className="fluid-headline-md text-on-surface font-bold">
              {compactMode
                ? `Denah Gedung & Rute Jalan Kaki ke ${activeStall?.name || 'Kantin'}`
                : 'Denah Gedung Kampus IBI KKG & Rute Jalan Kaki ke Kantin Hall D'}
            </h2>
          </div>

          {/* Map Engine / Theme Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              {
                id: 'osm_campus' as MapStyleMode,
                label: 'Denah Gedung Kampus',
                icon: 'domain',
              },
              {
                id: 'satellite_hd' as MapStyleMode,
                label: 'Foto Udara Satelit HD',
                icon: 'satellite_alt',
              },
              {
                id: 'street_atlas' as MapStyleMode,
                label: 'Peta Jalan Yos Sudarso',
                icon: 'map',
              },
            ].map((mode) => {
              const active = mapStyle === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMapStyle(mode.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                    active
                      ? 'bg-[#1677FF] text-white shadow-xs'
                      : 'bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-outline-variant/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleResetCampusView}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-outline-variant/30 font-label-sm text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Fokus kembali ke tengah gedung kampus IBI KKG"
            >
              <span className="material-symbols-outlined text-[15px] text-primary">
                center_focus_strong
              </span>
              <span>Fokus Kampus</span>
            </button>

            <button
              type="button"
              onClick={handleLocateMe}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-secondary-container text-on-secondary-container hover:opacity-95 font-label-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[15px]">my_location</span>
              <span>{userGpsLocation ? 'GPS Aktif' : 'GPS Saya'}</span>
            </button>
          </div>
        </div>

        {/* Starting Point Selector & Walking Route Summary Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-outline-variant/20">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-label-sm text-xs text-on-surface-variant font-semibold mr-1">
              Titik Awal di Kampus:
            </span>
            {CAMPUS_LANDMARKS.map((lm) => {
              const isSelected = !userGpsLocation && selectedLandmarkId === lm.id;
              return (
                <button
                  key={lm.id}
                  type="button"
                  onClick={() => {
                    setUserGpsLocation(null);
                    setSelectedLandmarkId(lm.id);
                  }}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg font-label-sm text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#1677FF] text-white font-semibold shadow-2xs'
                      : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container border border-outline-variant/25'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  <span>{lm.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {activeStall && (
            <div className="flex flex-wrap items-center gap-2 bg-primary-fixed/40 border border-primary/25 px-3 py-1.5 rounded-lg">
              <span className="material-symbols-outlined text-[18px] text-[#1677FF]">
                directions_walk
              </span>
              <span className="font-label-sm text-xs text-on-surface">
                Rute dari{' '}
                <strong>{userGpsLocation ? 'GPS Anda' : activeLandmark.shortLabel}</strong> ke{' '}
                <strong>{activeStall.name}</strong>:
              </span>
              <span className="font-label-sm text-xs font-bold text-[#1677FF]">
                ±{computedDistanceMeters} meter (~{computedWalkingMinutes} menit jalan kaki)
              </span>
            </div>
          )}
        </div>

        {gpsStatusText && (
          <div className="text-xs font-body-sm text-secondary bg-secondary-container/40 px-3 py-1.5 rounded-lg flex items-center justify-between gap-2">
            <span>{gpsStatusText}</span>
            {userGpsLocation && (
              <button
                type="button"
                onClick={handleResetCampusView}
                className="underline font-semibold cursor-pointer"
              >
                Kembali ke Titik Kampus IBI KKG
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Map Area + Selected Stall Card Below Map & Sidebar */}
      <div
        className={`grid grid-cols-1 ${
          compactMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'
        } items-stretch`}
      >
        {/* Left Column: Map Canvas + Selected Stall Navigation Bar */}
        <div className={compactMode ? 'w-full flex flex-col' : 'lg:col-span-8 flex flex-col'}>
          <div
            className={`${
              compactMode ? 'h-[340px]' : 'h-[380px] sm:h-[440px]'
            } w-full relative bg-surface-container overflow-hidden`}
          >
            <div ref={mapContainerRef} className="w-full h-full z-0" />
          </div>

          {/* Selected Stall Navigation Card */}
          {activeStall && (
            <div className="bg-surface-container-lowest border-t border-outline-variant/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-[#1677FF] text-white font-label-sm text-[11px] font-bold">
                    {activeStall.code} • Dekat Hall D
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-label-sm text-[11px] font-bold ${
                      activeStall.isOpen
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-error-container text-on-error-container'
                    }`}
                  >
                    {activeStall.isOpen ? 'Buka Sekarang' : 'Sedang Tutup'}
                  </span>
                  <span className="text-xs font-bold text-[#1677FF]">
                    • ±{computedDistanceMeters}m dari{' '}
                    {userGpsLocation ? 'GPS Anda' : activeLandmark.shortLabel}
                  </span>
                </div>
                <h4 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface truncate">
                  {activeStall.name} — {activeStall.specialty}
                </h4>
                <p className="text-xs text-on-surface-variant">
                  <strong>Panduan Jalan Kaki:</strong> {activeStall.walkingGuide}
                </p>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                {!compactMode && (
                  <button
                    type="button"
                    onClick={() => onSelectStall(activeStall.id)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[15px]">restaurant_menu</span>
                    <span>Buka Menu</span>
                  </button>
                )}
                <a
                  href={amapNavigationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka navigasi jalan kaki di aplikasi/web AMap Global (Gaode Maps)"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#1677FF] hover:opacity-95 text-white font-label-sm text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">near_me</span>
                  <span>AMap Global</span>
                </a>
                <a
                  href={googleMapsNavigationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Buka rute jalan kaki di Google Maps"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface font-label-sm text-xs font-semibold flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  <span>G-Maps</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Column on Full Explorer Mode: Stall Pin List & Walking Guide */}
        {!compactMode && (
          <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-outline-variant/20 p-4 flex flex-col justify-between gap-4 bg-surface-container-lowest">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Daftar Titik Stan di Peta ({stalls.length})
                </h3>
                <span className="text-[11px] text-on-surface-variant">Klik untuk fokus rute</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {stalls.map((s) => {
                  const isCurrent = s.id === activeStall?.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStallId(s.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isCurrent
                          ? 'bg-primary-fixed/40 border-[#1677FF] shadow-xs'
                          : 'bg-surface-container-low hover:bg-surface-container border-outline-variant/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-label-sm text-xs font-bold text-primary">
                          {s.code} • {s.name}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            s.isOpen
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {s.isOpen ? 'Buka' : 'Tutup'}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant line-clamp-2">
                        {s.walkingGuide}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] font-semibold text-[#1677FF] flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">
                            directions_walk
                          </span>
                          <span>±{s.distanceMeters}m dari Lobi Utama</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStall(s.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-semibold cursor-pointer"
                        >
                          Lihat Menu
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex flex-col gap-1.5 text-[11px] text-on-surface-variant">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#3B82F6]/40 border border-[#0F172A] inline-block"></span>
                  <span>Gedung Utama (8 Lt)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-[#22C55E]/45 border border-[#15803D] inline-block"></span>
                  <span>Hall D &amp; Selasar Kantin</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-outline-variant/15">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#15803D] inline-block"></span>
                  <span>Stan Buka</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#64748B] inline-block"></span>
                  <span>Stan Tutup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#1677FF] inline-block"></span>
                  <span>Rute Jalan Kaki</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
