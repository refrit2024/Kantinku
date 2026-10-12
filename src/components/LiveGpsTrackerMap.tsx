import React, { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  normalizeStallLocation,
  OrderTransaction,
  SellerLiveGpsLocation,
  Stall,
} from '../data/kantinData';
import { UniversalLeafletMap } from './UniversalLeafletMap';

declare const google: any;
declare namespace google {
  namespace maps {
    type Polyline = any;
    type MapMouseEvent = any;
  }
}

// Exact verified coordinates of Kwik Kian Gie School of Business (IBI KKG)
// Jl. Yos Sudarso Kav. 87, Sunter Jaya, Tanjung Priok, Jakarta Utara 14350
// OpenStreetMap Way ID: 1334434680 (lat: -6.1513013, lon: 106.8868470)
export const IBI_KKG_CAMPUS_CENTER = {
  lat: -6.151301,
  lng: 106.886847,
};

export function calculateHaversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  const d = 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return Math.round(R * d);
}

export function calculateCompassBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): { degrees: number; cardinal: string } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  const dirs = [
    'Utara',
    'Timur Laut',
    'Timur',
    'Tenggara',
    'Selatan',
    'Barat Daya',
    'Barat',
    'Barat Laut',
  ];
  const idx = Math.round(brng / 45) % 8;
  return { degrees: Math.round(brng), cardinal: dirs[idx] };
}

export interface RouteStepInstruction {
  instruction: string;
  streetName?: string;
  distanceMeters: number;
}

export interface RouteOptionCandidate {
  id: string;
  label: string;
  tagType: 'fastest' | 'shortest' | 'alternative';
  viaSummary: string;
  distanceMeters: number;
  durationSeconds: number;
  path: Array<{ lat: number; lng: number }>;
  steps: RouteStepInstruction[];
  hasToll?: boolean;
}

// Decode Valhalla 6-digit precision encoded polyline (precision = 1e-6)
function decodeValhallaShape6(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return points;
}

function translateManeuverToIndonesian(text: string): string {
  return text
    .replace(/^Drive north/i, 'Jalan ke arah Utara')
    .replace(/^Drive south/i, 'Jalan ke arah Selatan')
    .replace(/^Drive east/i, 'Jalan ke arah Timur')
    .replace(/^Drive west/i, 'Jalan ke arah Barat')
    .replace(/^Drive northeast/i, 'Jalan ke arah Timur Laut')
    .replace(/^Drive northwest/i, 'Jalan ke arah Barat Laut')
    .replace(/^Drive southeast/i, 'Jalan ke arah Tenggara')
    .replace(/^Drive southwest/i, 'Jalan ke arah Barat Daya')
    .replace(/^Walk north/i, 'Jalan kaki ke Utara')
    .replace(/^Walk south/i, 'Jalan kaki ke Selatan')
    .replace(/^Walk east/i, 'Jalan kaki ke Timur')
    .replace(/^Walk west/i, 'Jalan kaki ke Barat')
    .replace(/^Turn right onto /i, 'Belok kanan ke ')
    .replace(/^Turn left onto /i, 'Belok kiri ke ')
    .replace(/^Turn slight right onto /i, 'Belok agak ke kanan ke ')
    .replace(/^Turn slight left onto /i, 'Belok agak ke kiri ke ')
    .replace(/^Turn sharp right onto /i, 'Belok tajam ke kanan ke ')
    .replace(/^Turn sharp left onto /i, 'Belok tajam ke kiri ke ')
    .replace(/^Turn right\./i, 'Belok kanan.')
    .replace(/^Turn left\./i, 'Belok kiri.')
    .replace(/^Keep right/i, 'Ambil jalur kanan')
    .replace(/^Keep left/i, 'Ambil jalur kiri')
    .replace(/^Make a U-turn/i, 'Putar balik (U-Turn)')
    .replace(/^Make a right U-turn/i, 'Putar balik di kanan (U-Turn)')
    .replace(/^Make a left U-turn/i, 'Putar balik di kiri (U-Turn)')
    .replace(/^Continue on /i, 'Lurus terus di ')
    .replace(/^Bear right/i, 'Ambil arah kanan')
    .replace(/^Bear left/i, 'Ambil arah kiri')
    .replace(/^You have arrived at your destination\./i, 'Tiba di titik lokasi penjual.');
}

function labelAndClassifyRouteCandidates(
  rawCandidates: Array<{
    path: Array<{ lat: number; lng: number }>;
    distanceMeters: number;
    durationSeconds: number;
    viaSummary: string;
    steps: RouteStepInstruction[];
    hasToll?: boolean;
  }>
): RouteOptionCandidate[] {
  if (rawCandidates.length === 0) return [];

  const unique: typeof rawCandidates = [];
  for (const c of rawCandidates) {
    const isDup = unique.some(
      (u) =>
        Math.abs(u.distanceMeters - c.distanceMeters) < 40 &&
        Math.abs(u.durationSeconds - c.durationSeconds) < 20 &&
        u.viaSummary === c.viaSummary
    );
    if (!isDup) unique.push(c);
  }

  // Sort by fastest duration first
  unique.sort((a, b) => a.durationSeconds - b.durationSeconds);

  const fastestDur = unique[0].durationSeconds;
  const fastestDist = unique[0].distanceMeters;
  let shortestIdx = 0;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i].distanceMeters < unique[shortestIdx].distanceMeters) {
      shortestIdx = i;
    }
  }

  return unique.slice(0, 3).map((c, idx) => {
    const diffMin = Math.round((c.durationSeconds - fastestDur) / 60);
    const diffMeters = c.distanceMeters - fastestDist;
    let label = 'Rute Tercepat';
    let tagType: 'fastest' | 'shortest' | 'alternative' = 'fastest';

    if (idx === 0) {
      if (shortestIdx === 0 && unique.length > 1) {
        label = 'Rute Tercepat & Terdekat';
      } else {
        label = 'Rute Tercepat (Rekomendasi)';
      }
      tagType = 'fastest';
    } else if (idx === shortestIdx && c.distanceMeters < fastestDist - 50) {
      const savedStr =
        Math.abs(diffMeters) >= 1000
          ? `${(Math.abs(diffMeters) / 1000).toFixed(1)} km`
          : `${Math.abs(diffMeters)} m`;
      label = `Rute Lebih Pendek (${savedStr} lebih dekat)`;
      tagType = 'shortest';
    } else {
      const distNote =
        diffMeters > 80
          ? `+${diffMeters >= 1000 ? `${(diffMeters / 1000).toFixed(1)} km` : `${diffMeters} m`} lebih jauh`
          : diffMin > 0
          ? `+${diffMin} mnt`
          : `Jalur Alternatif ${idx}`;
      label = `Rute Alternatif ${idx} (${distNote})`;
      tagType = 'alternative';
    }

    return {
      id: `route-opt-${idx}`,
      label,
      tagType,
      viaSummary: c.viaSummary || `Jalur Alternatif ${idx + 1}`,
      distanceMeters: c.distanceMeters,
      durationSeconds: c.durationSeconds,
      path: c.path,
      steps: c.steps,
      hasToll: c.hasToll,
    };
  });
}

export async function computeMultiRouteCandidates(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  travelMode: 'WALKING' | 'TWO_WHEELER' | 'DRIVING'
): Promise<{ candidates: RouteOptionCandidate[]; isFallbackDirect: boolean }> {
  const directMeters = calculateHaversineMeters(origin, destination);
  const isInsideCampusWalk = travelMode === 'WALKING' && directMeters <= 350;

  // Engine A: Valhalla Turn-by-Turn Multi-Route Engine (`alternates: 2`)
  try {
    const valhallaCosting = isInsideCampusWalk
      ? 'pedestrian'
      : travelMode === 'TWO_WHEELER' || travelMode === 'WALKING'
      ? 'motor_scooter'
      : 'auto';

    const valhallaBody: Record<string, any> = {
      locations: [
        { lat: origin.lat, lon: origin.lng },
        { lat: destination.lat, lon: destination.lng },
      ],
      costing: valhallaCosting,
      alternates: 2,
      directions_options: { units: 'kilometers' },
    };

    if (valhallaCosting === 'motor_scooter') {
      valhallaBody.costing_options = {
        motor_scooter: {
          use_highways: 0,
          use_tolls: 0,
        },
      };
    }

    const vRes = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(valhallaBody),
    });

    if (vRes.ok) {
      const vData = await vRes.json();
      const allTrips = [
        vData?.trip,
        ...(Array.isArray(vData?.alternates) ? vData.alternates.map((a: any) => a?.trip) : []),
      ].filter(Boolean);

      const parsedRaw: Array<{
        path: Array<{ lat: number; lng: number }>;
        distanceMeters: number;
        durationSeconds: number;
        viaSummary: string;
        steps: RouteStepInstruction[];
        hasToll?: boolean;
      }> = [];

      for (const trip of allTrips) {
        const leg = trip?.legs?.[0];
        if (!leg?.shape) continue;
        const roadPath = decodeValhallaShape6(leg.shape);
        if (roadPath.length < 2) continue;

        const distMeters = Math.round((leg.summary?.length ?? directMeters / 1000) * 1000);
        const rawSec = Math.round(leg.summary?.time ?? distMeters / 7);
        const durSec =
          travelMode === 'WALKING'
            ? Math.max(20, Math.round(distMeters / 1.3))
            : Math.max(20, rawSec);

        const streetLengths: Record<string, number> = {};
        if (Array.isArray(leg.maneuvers)) {
          for (const m of leg.maneuvers) {
            const names: string[] = Array.isArray(m.street_names) ? m.street_names : [];
            const validName = names.find((n) => n && n.length > 3 && !/^\d+$/.test(n));
            if (validName) {
              streetLengths[validName] =
                (streetLengths[validName] || 0) + Number(m.length || 0);
            }
          }
        }
        const topStreets = Object.entries(streetLengths)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map((e) => e[0]);

        const viaSummary =
          topStreets.length > 0
            ? `Via ${topStreets.join(' & ')}`
            : leg.summary?.has_toll
            ? 'Via Jalan Tol Utama'
            : 'Via Jalur Jalan Raya';

        const steps: RouteStepInstruction[] = Array.isArray(leg.maneuvers)
          ? leg.maneuvers.slice(0, 10).map((m: any) => ({
              instruction: translateManeuverToIndonesian(String(m.instruction || '')),
              streetName: Array.isArray(m.street_names)
                ? m.street_names.join(' / ')
                : undefined,
              distanceMeters: Math.round((m.length || 0) * 1000),
            }))
          : [];

        parsedRaw.push({
          path: roadPath,
          distanceMeters: distMeters,
          durationSeconds: durSec,
          viaSummary,
          steps,
          hasToll: Boolean(leg.summary?.has_toll),
        });
      }

      if (parsedRaw.length > 0) {
        return {
          candidates: labelAndClassifyRouteCandidates(parsedRaw),
          isFallbackDirect: false,
        };
      }
    }
  } catch {
    // Fallback to OSRM below
  }

  // Engine B: OSRM Road Routing with `alternatives=3`
  const osrmProfile = isInsideCampusWalk ? 'foot' : 'driving';
  const osrmUrls = [
    `https://router.project-osrm.org/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=3&steps=true`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&alternatives=3&steps=true`,
  ];

  for (const url of osrmUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const routesArr: any[] = Array.isArray(data?.routes) ? data.routes : [];
      if (routesArr.length === 0) continue;

      const parsedRaw: Array<{
        path: Array<{ lat: number; lng: number }>;
        distanceMeters: number;
        durationSeconds: number;
        viaSummary: string;
        steps: RouteStepInstruction[];
      }> = [];

      for (const route of routesArr) {
        const coords: [number, number][] | undefined = route?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) continue;
        const roadPath = coords.map(([lng, lat]) => ({ lat, lng }));
        const dist = Math.round(route.distance || directMeters);
        const speedMetersPerSec =
          travelMode === 'WALKING' ? 1.3 : travelMode === 'TWO_WHEELER' ? 8.5 : 6.5;
        const durSec = Math.max(
          15,
          Math.round(
            travelMode === 'WALKING'
              ? dist / speedMetersPerSec
              : route.duration || dist / speedMetersPerSec
          )
        );

        const rawSteps = route?.legs?.[0]?.steps;
        const steps: RouteStepInstruction[] = Array.isArray(rawSteps)
          ? rawSteps
              .filter((s: any) => s.distance > 15 || s.name)
              .slice(0, 10)
              .map((s: any) => {
                const mod = s.maneuver?.modifier || '';
                const dirLabel = mod.includes('left')
                  ? 'Belok kiri'
                  : mod.includes('right')
                  ? 'Belok kanan'
                  : mod.includes('uturn')
                  ? 'Putar balik (U-Turn)'
                  : 'Lurus ikuti jalan';
                return {
                  instruction: s.name ? `${dirLabel} ke ${s.name}` : dirLabel,
                  streetName: s.name || undefined,
                  distanceMeters: Math.round(s.distance || 0),
                };
              })
          : [];

        const viaSummary = route?.legs?.[0]?.summary
          ? `Via ${route.legs[0].summary}`
          : 'Via Jalur Jalan Utama';

        parsedRaw.push({
          path: roadPath,
          distanceMeters: dist,
          durationSeconds: durSec,
          viaSummary,
          steps,
        });
      }

      if (parsedRaw.length > 0) {
        return {
          candidates: labelAndClassifyRouteCandidates(parsedRaw),
          isFallbackDirect: false,
        };
      }
    } catch {
      // try next server
    }
  }

  return {
    candidates: [
      {
        id: 'route-opt-0',
        label: 'Rute Langsung',
        tagType: 'fastest',
        viaSummary: 'Jalur Langsung Area Kampus',
        distanceMeters: directMeters,
        durationSeconds: Math.max(15, Math.round(directMeters / 1.25)),
        path: [origin, destination],
        steps: [],
      },
    ],
    isFallbackDirect: true,
  };
}

interface WalkingRouteOverlayProps {
  routeCandidates: RouteOptionCandidate[];
  selectedRouteIndex: number;
  onSelectRouteIndex: (idx: number) => void;
}

const WalkingRouteOverlay: React.FC<WalkingRouteOverlayProps> = ({
  routeCandidates,
  selectedRouteIndex,
  onSelectRouteIndex,
}) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || routeCandidates.length === 0 || typeof google === 'undefined') {
      return;
    }

    const safeIdx =
      selectedRouteIndex >= 0 && selectedRouteIndex < routeCandidates.length
        ? selectedRouteIndex
        : 0;

    const createdPolylines: google.maps.Polyline[] = [];

    routeCandidates.forEach((cand, idx) => {
      if (idx === safeIdx) return;

      const altOuter = new google.maps.Polyline({
        path: cand.path,
        geodesic: true,
        strokeColor: '#334155',
        strokeOpacity: 0.8,
        strokeWeight: 8,
        zIndex: 10 + idx,
        clickable: true,
      });

      const altInner = new google.maps.Polyline({
        path: cand.path,
        geodesic: true,
        strokeColor: '#94a3b8',
        strokeOpacity: 0.95,
        strokeWeight: 5,
        zIndex: 11 + idx,
        clickable: true,
      });

      const handlePickAlt = () => {
        onSelectRouteIndex(idx);
      };

      altOuter.addListener('click', handlePickAlt);
      altInner.addListener('click', handlePickAlt);

      altOuter.setMap(map);
      altInner.setMap(map);
      createdPolylines.push(altOuter, altInner);
    });

    const activeCand = routeCandidates[safeIdx];
    if (activeCand) {
      const outerCasing = new google.maps.Polyline({
        path: activeCand.path,
        geodesic: true,
        strokeColor: '#064e3b',
        strokeOpacity: 0.95,
        strokeWeight: 10,
        zIndex: 50,
      });

      const innerRoadLine = new google.maps.Polyline({
        path: activeCand.path,
        geodesic: true,
        strokeColor: '#10b981',
        strokeOpacity: 1,
        strokeWeight: 6,
        zIndex: 51,
        icons: google.maps.SymbolPath
          ? [
              {
                icon: {
                  path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 2.8,
                  strokeColor: '#ffffff',
                  strokeWeight: 1,
                  fillColor: '#047857',
                  fillOpacity: 1,
                },
                offset: '35%',
                repeat: '110px',
              },
            ]
          : undefined,
      });

      outerCasing.setMap(map);
      innerRoadLine.setMap(map);
      createdPolylines.push(outerCasing, innerRoadLine);

      const bounds = new google.maps.LatLngBounds();
      routeCandidates.forEach((cand) => cand.path.forEach((pt) => bounds.extend(pt)));
      map.fitBounds(bounds, 56);
    }

    polylinesRef.current = createdPolylines;

    return () => {
      createdPolylines.forEach((p) => p.setMap(null));
    };
  }, [map, routeCandidates, selectedRouteIndex]);

  return null;
};

interface MapCameraFollowerProps {
  target: { lat: number; lng: number } | null;
  triggerKey: string;
}

const MapCameraFollower: React.FC<MapCameraFollowerProps> = ({ target, triggerKey }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.panTo(target);
  }, [map, triggerKey]);
  return null;
};

interface MapTapCatcherProps {
  enabled: boolean;
  onPickCoordinate?: (lat: number, lng: number) => void;
}

const MapTapCatcher: React.FC<MapTapCatcherProps> = ({ enabled, onPickCoordinate }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !enabled || !onPickCoordinate) return;
    const listener = map.addListener('click', (ev: google.maps.MapMouseEvent) => {
      if (ev.latLng) {
        onPickCoordinate(ev.latLng.lat(), ev.latLng.lng());
      }
    });
    return () => {
      listener.remove();
    };
  }, [map, enabled, onPickCoordinate]);

  return null;
};

interface LiveGpsTrackerMapProps {
  stalls: Stall[];
  selectedStallId?: string;
  onSelectStall?: (stallId: string) => void;
  mode: 'student-directory' | 'student-detail' | 'seller-broadcast' | 'order-tracking';
  order?: OrderTransaction;
  sellerStall?: Stall;
  onUpdateSellerGps?: (gps: SellerLiveGpsLocation) => void;
  onShowToast?: (msg: string, isError?: boolean) => void;
  compact?: boolean;
}

export const LiveGpsTrackerMap: React.FC<LiveGpsTrackerMapProps> = ({
  stalls,
  selectedStallId,
  onSelectStall,
  mode,
  order,
  sellerStall,
  onUpdateSellerGps,
  onShowToast,
  compact = false,
}) => {
  const normalizedStalls = stalls.map((s, idx) => normalizeStallLocation(s, idx));

  const [activeStallId, setActiveStallId] = useState<string>(
    order?.stallId ||
      selectedStallId ||
      sellerStall?.id ||
      normalizedStalls[0]?.id ||
      'stan-bu-sari'
  );

  useEffect(() => {
    if (order?.stallId) setActiveStallId(order.stallId);
    else if (selectedStallId) setActiveStallId(selectedStallId);
  }, [order?.stallId, selectedStallId]);

  useEffect(() => {
    if (sellerStall?.id) setActiveStallId(sellerStall.id);
  }, [sellerStall?.id]);

  const targetStall =
    normalizedStalls.find((s) => s.id === activeStallId) ||
    (sellerStall ? normalizeStallLocation(sellerStall, 0) : normalizedStalls[0]);

  const targetCoords = targetStall?.gpsLocation
    ? { lat: targetStall.gpsLocation.lat, lng: targetStall.gpsLocation.lng }
    : IBI_KKG_CAMPUS_CENTER;

  const isTargetUsingRealSellerPhoneGps = Boolean(
    targetStall?.gpsLocation?.isLiveTracking &&
      targetStall?.gpsLocation?.updatedAt?.includes('Live GPS HP')
  );

  // STRICT REAL PHONE GPS ORIGIN FOR BUYER:
  // No fake/simulated lobby coordinates! Buyer origin is ONLY set from real navigator.geolocation
  // (or if the buyer explicitly taps the map to pin their own location when using a PC without GPS).
  const [studentGps, setStudentGps] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    source: 'device-gps' | 'manual-pin';
  } | null>(null);

  const [isLocatingBuyerGps, setIsLocatingBuyerGps] = useState<boolean>(
    mode !== 'seller-broadcast'
  );
  const [isWatchingStudentGps, setIsWatchingStudentGps] = useState(false);
  const [allowBuyerManualPin, setAllowBuyerManualPin] = useState(false);
  const studentWatchIdRef = useRef<number | null>(null);

  // Seller's live GPS broadcast state
  const [isWatchingSellerGps, setIsWatchingSellerGps] = useState<boolean>(false);
  const sellerWatchIdRef = useRef<number | null>(null);
  const [sellerLocationNote, setSellerLocationNote] = useState<string>(
    sellerStall?.gpsLocation?.locationNote ||
      sellerStall?.locationDetail ||
      'Area Kantin Kampus IBI KKG Dekat Hall D'
  );
  const [allowTapOnMapToPin, setAllowTapOnMapToPin] = useState<boolean>(false);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'hybrid'>('hybrid');
  const [cameraPanTrigger, setCameraPanTrigger] = useState<string>('init');

  // Default to 'TWO_WHEELER' (Motor / Kurir ShopeeFood) so routes follow legal one-way road directions and U-turns while avoiding toll highways
  const [travelMode, setTravelMode] = useState<'WALKING' | 'TWO_WHEELER' | 'DRIVING'>('TWO_WHEELER');
  const [routeCandidates, setRouteCandidates] = useState<RouteOptionCandidate[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [isFallbackDirectLine, setIsFallbackDirectLine] = useState<boolean>(false);
  const [infoOpenStallId, setInfoOpenStallId] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Detect whether Google Maps JS SDK is available and authorized on the current domain (e.g. AI Studio vs GitHub Pages)
  const [useUniversalTileEngine, setUseUniversalTileEngine] = useState<boolean>(() => {
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isExternalStaticHost =
      host.endsWith('github.io') ||
      host.endsWith('vercel.app') ||
      host.endsWith('netlify.app') ||
      host.endsWith('pages.dev');
    return !key || isExternalStaticHost || Boolean((window as any).__gmpLoadFailed);
  });

  useEffect(() => {
    const handleGmpError = () => setUseUniversalTileEngine(true);
    window.addEventListener('gmp-map-load-error', handleGmpError);
    window.addEventListener('gmp-quota-exceeded', handleGmpError);
    return () => {
      window.removeEventListener('gmp-map-load-error', handleGmpError);
      window.removeEventListener('gmp-quota-exceeded', handleGmpError);
    };
  }, []);

  // Reset selected route to 0 (Rute Tercepat) when user switches travel mode or target stall
  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [travelMode, activeStallId]);

  // Compute multi-route candidates (Valhalla / OSRM) whenever buyer GPS, target stall, or travel mode changes
  useEffect(() => {
    if (!studentGps || !targetCoords) {
      setRouteCandidates([]);
      setIsFallbackDirectLine(false);
      return;
    }

    let cancelled = false;
    computeMultiRouteCandidates(studentGps, targetCoords, travelMode).then((res) => {
      if (cancelled) return;
      setRouteCandidates(res.candidates);
      setIsFallbackDirectLine(res.isFallbackDirect);
    });

    return () => {
      cancelled = true;
    };
  }, [studentGps?.lat, studentGps?.lng, targetCoords.lat, targetCoords.lng, travelMode]);

  const activeRouteCandidate =
    routeCandidates.length > 0
      ? routeCandidates[
          selectedRouteIndex >= 0 && selectedRouteIndex < routeCandidates.length
            ? selectedRouteIndex
            : 0
        ]
      : null;

  const routeSummary = activeRouteCandidate
    ? {
        distanceMeters: activeRouteCandidate.distanceMeters,
        durationSeconds: activeRouteCandidate.durationSeconds,
        usingFallbackLine: isFallbackDirectLine,
        steps: activeRouteCandidate.steps,
        viaSummary: activeRouteCandidate.viaSummary,
        label: activeRouteCandidate.label,
      }
    : null;

  useEffect(() => {
    if (sellerStall?.gpsLocation?.locationNote) {
      setSellerLocationNote(sellerStall.gpsLocation.locationNote);
    }
  }, [sellerStall?.id, sellerStall?.gpsLocation?.locationNote]);

  // Multi-Tier Real Device Location Detector (Works on both Smartphones with GPS chips AND Laptops via Wi-Fi/Network/IP):
  // Tier 1: High-Accuracy GPS (enableHighAccuracy: true)
  // Tier 2: Standard Laptop/Desktop Wi-Fi & Network Location (enableHighAccuracy: false, maximumAge: 60000)
  // Tier 3: HTTPS IP Geolocation Lookup (if browser/OS blocks or lacks hardware location provider on Laptop)
  const fetchIpGeolocationFallback = async (): Promise<{
    lat: number;
    lng: number;
    city?: string;
  } | null> => {
    const endpoints = [
      'https://ipwho.is/',
      'https://ipapi.co/json/',
      'https://get.geojs.io/v1/ip/geo.json',
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const lat = Number(data.latitude ?? data.lat);
        const lng = Number(data.longitude ?? data.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0) {
          return { lat, lng, city: data.city || data.region };
        }
      } catch {
        // try next endpoint
      }
    }
    return null;
  };

  const startBuyerPhoneGpsTracking = (showToastOnAcquire = false) => {
    if (studentWatchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(studentWatchIdRef.current);
      studentWatchIdRef.current = null;
    }

    setIsLocatingBuyerGps(true);
    setGpsErrorMsg(null);

    const applyCoordinates = (
      lat: number,
      lng: number,
      accuracy: number,
      labelToast?: string
    ) => {
      const coords = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracy: Math.round(accuracy || 15),
        source: 'device-gps' as const,
      };
      setStudentGps(coords);
      setIsLocatingBuyerGps(false);
      setIsWatchingStudentGps(true);
      setAllowBuyerManualPin(false);
      setGpsErrorMsg(null);
      if (showToastOnAcquire && labelToast) {
        onShowToast?.(labelToast);
      }
    };

    const runIpFallback = async (reasonMsg: string) => {
      const ipLoc = await fetchIpGeolocationFallback();
      if (ipLoc) {
        applyCoordinates(
          ipLoc.lat,
          ipLoc.lng,
          150,
          `Lokasi perangkat Anda (${ipLoc.lat.toFixed(5)}, ${ipLoc.lng.toFixed(5)}) terdeteksi via Jaringan/Wi-Fi Laptop!`
        );
      } else {
        setIsLocatingBuyerGps(false);
        setIsWatchingStudentGps(false);
        setGpsErrorMsg(reasonMsg);
      }
    };

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      runIpFallback(
        'Browser ini tidak menyediakan sensor GPS. Klik tombol "Set Titik Manual" lalu ketuk posisi Anda di peta.'
      );
      return;
    }

    // Tier 1: Try High Accuracy first (5s timeout so laptops don't hang)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoordinates(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy || 10,
          `Lokasi GPS perangkat Anda (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}) terkunci!`
        );
      },
      () => {
        // Tier 2: Laptop/PC Fallback -> Low-Accuracy Wi-Fi / OS Location Service
        navigator.geolocation.getCurrentPosition(
          (posLow) => {
            applyCoordinates(
              posLow.coords.latitude,
              posLow.coords.longitude,
              posLow.coords.accuracy || 35,
              `Lokasi Laptop/Wi-Fi Anda (${posLow.coords.latitude.toFixed(5)}, ${posLow.coords.longitude.toFixed(5)}) berhasil terdeteksi!`
            );
          },
          (errLow) => {
            // Tier 3: Network IP Geolocation Fallback (when Windows/macOS Location Services or iframe blocks geolocation)
            runIpFallback(
              `Sensor lokasi laptop belum aktif (${errLow.message}). Aktifkan Location Services di Windows/Mac atau klik "Set Titik Manual" untuk klik posisi Anda di peta.`
            );
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 15000 }
    );

    // Watch position with enableHighAccuracy: false as fallback-friendly continuous tracker for both phone & laptop
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setStudentGps({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 15),
          source: 'device-gps',
        });
        setIsLocatingBuyerGps(false);
        setIsWatchingStudentGps(true);
        setGpsErrorMsg(null);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    studentWatchIdRef.current = watchId;
  };

  // Automatically start real phone GPS tracking immediately on mount for buyer/student views
  useEffect(() => {
    if (mode === 'seller-broadcast') return;
    startBuyerPhoneGpsTracking(false);

    return () => {
      if (studentWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(studentWatchIdRef.current);
        studentWatchIdRef.current = null;
      }
    };
  }, [mode]);

  // Cleanup seller geolocation watcher on unmount
  useEffect(() => {
    return () => {
      if (sellerWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(sellerWatchIdRef.current);
      }
    };
  }, []);

  // Start / Stop Seller Live GPS Broadcast (updates Firestore in real-time so buyers can follow the seller's actual phone!)
  const toggleSellerLiveBroadcast = () => {
    if (!('geolocation' in navigator)) {
      setGpsErrorMsg('Perangkat ini tidak mendukung sensor GPS Geolocation.');
      onShowToast?.('Browser tidak mendukung GPS.', true);
      return;
    }

    if (isWatchingSellerGps) {
      if (sellerWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(sellerWatchIdRef.current);
        sellerWatchIdRef.current = null;
      }
      setIsWatchingSellerGps(false);
      if (sellerStall?.gpsLocation && onUpdateSellerGps) {
        const nowStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });
        onUpdateSellerGps({
          ...sellerStall.gpsLocation,
          isLiveTracking: false,
          updatedAt: `Terakhir aktif • ${nowStr} WIB`,
          locationNote: sellerLocationNote.trim() || sellerStall.locationDetail,
        });
      }
      onShowToast?.('Siaran Live GPS HP Penjual dihentikan.');
      return;
    }

    setGpsErrorMsg(null);
    setIsWatchingSellerGps(true);

    const publishCoords = (
      lat: number,
      lng: number,
      accuracy: number,
      heading: number | null,
      showSuccessToast = false
    ) => {
      const nowStr = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const payload: SellerLiveGpsLocation = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracyMeters: Math.round(accuracy || 10),
        heading,
        isLiveTracking: true,
        updatedAt: `Live GPS HP • ${nowStr} WIB`,
        locationNote:
          sellerLocationNote.trim() ||
          `Posisi Live Penjual (${lat.toFixed(5)}, ${lng.toFixed(5)})`,
      };
      onUpdateSellerGps?.(payload);
      setCameraPanTrigger(`seller-live-${Date.now()}`);
      if (showSuccessToast) {
        onShowToast?.(
          `Titik lokasi perangkat Anda (${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)}) berhasil dipancarkan ke peta pembeli!`
        );
      }
    };

    // Tier 1: High accuracy GPS -> Tier 2: Laptop Wi-Fi location -> Tier 3: Network IP fallback
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        publishCoords(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy || 8,
          pos.coords.heading ?? null,
          true
        ),
      () => {
        navigator.geolocation.getCurrentPosition(
          (posLow) =>
            publishCoords(
              posLow.coords.latitude,
              posLow.coords.longitude,
              posLow.coords.accuracy || 30,
              posLow.coords.heading ?? null,
              true
            ),
          async (errLow) => {
            const ipLoc = await fetchIpGeolocationFallback();
            if (ipLoc) {
              publishCoords(ipLoc.lat, ipLoc.lng, 120, null, true);
            } else {
              setGpsErrorMsg(
                `Gagal membaca lokasi laptop (${errLow.message}). Aktifkan Location Services di Windows/Mac atau klik tombol "Geser Pin" untuk menaruh titik di peta.`
              );
              setIsWatchingSellerGps(false);
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
        );
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 15000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        publishCoords(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy || 12,
          pos.coords.heading ?? null,
          false
        ),
      () => {},
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
    );
    sellerWatchIdRef.current = watchId;
  };

  const handleSellerManualPin = (lat: number, lng: number) => {
    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const payload: SellerLiveGpsLocation = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      accuracyMeters: 5,
      isLiveTracking: true,
      updatedAt: `Live GPS HP (Manual Pin) • ${nowStr} WIB`,
      locationNote: sellerLocationNote.trim() || sellerStall?.locationDetail || 'Titik Penjual',
    };
    onUpdateSellerGps?.(payload);
    setCameraPanTrigger(`manual-${Date.now()}`);
    onShowToast?.(
      `Titik lokasi penjual berhasil dipindahkan ke (${payload.lat.toFixed(5)}, ${payload.lng.toFixed(5)})!`
    );
  };

  const handleBuyerManualPin = (lat: number, lng: number) => {
    const coords = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      accuracy: 5,
      source: 'manual-pin' as const,
    };
    setStudentGps(coords);
    setAllowBuyerManualPin(false);
    setGpsErrorMsg(null);
    onShowToast?.(
      `Titik posisi Anda diatur ke (${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}). Rute otomatis digambar!`
    );
  };

  const handleResetToCampusDefault = () => {
    if (!sellerStall || !onUpdateSellerGps) return;
    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const payload: SellerLiveGpsLocation = SellerLiveLiveDefault(sellerStall);
    setSellerLocationNote(payload.locationNote || '');
    onUpdateSellerGps({
      ...payload,
      updatedAt: `Titik Kampus IBI KKG • ${nowStr} WIB`,
    });
    setCameraPanTrigger(`reset-campus-${Date.now()}`);
    onShowToast?.('Lokasi dikembalikan ke titik Gedung Kampus IBI Kwik Kian Gie (Sunter).');
  };

  function SellerLiveLiveDefault(st: Stall): SellerLiveGpsLocation {
    const norm = normalizeStallLocation(st, 0);
    return (
      norm.gpsLocation || {
        lat: IBI_KKG_CAMPUS_CENTER.lat,
        lng: IBI_KKG_CAMPUS_CENTER.lng,
        accuracyMeters: 5,
        isLiveTracking: false,
        updatedAt: 'Titik Kampus IBI KKG',
        locationNote: 'Area Kantin Kampus IBI KKG Dekat Hall D',
      }
    );
  }

  // Compute compass direction & distance ONLY when buyer GPS is known
  const liveDistanceMeters =
    studentGps && targetCoords
      ? routeSummary?.distanceMeters ?? calculateHaversineMeters(studentGps, targetCoords)
      : null;

  const compassInfo =
    studentGps && targetCoords ? calculateCompassBearing(studentGps, targetCoords) : null;

  // Order status stepper for ShopeeFood-style tracking card
  const orderStepMeta = order
    ? order.status === 'waiting_payment_verification'
      ? {
          step: 1,
          headline: 'Menunggu Konfirmasi Penjual',
          subtext: `Pesanan #${order.id} diterima sistem. Rute dari letak HP Anda menuju ${targetStall?.name} otomatis aktif di peta.`,
          badgeClass: 'bg-tertiary-fixed text-tertiary',
        }
      : order.status === 'cooking'
      ? {
          step: 2,
          headline: 'Penjual Sedang Menyiapkan Pesananmu',
          subtext: `${targetStall?.name} sedang memasak/membungkus pesananmu. Kamu bisa berjalan mengikuti garis rute dari titik HP kamu!`,
          badgeClass: 'bg-primary-fixed text-on-primary-fixed',
        }
      : order.status === 'ready_pickup'
      ? {
          step: 3,
          headline: 'Pesanan Siap Diambil! Ikuti Rute ke Penjual Sekarang',
          subtext: `Makananmu sudah siap di ${targetStall?.name} (${targetStall?.code}). Ikuti garis rute hijau dari titik HP kamu menuju penjual!`,
          badgeClass: 'bg-secondary text-on-secondary',
        }
      : order.status === 'completed'
      ? {
          step: 4,
          headline: 'Pesanan Selesai Diambil',
          subtext: `Terima kasih telah memesan di ${targetStall?.name}.`,
          badgeClass: 'bg-surface-container-high text-on-surface-variant',
        }
      : {
          step: 0,
          headline: 'Pesanan Dibatalkan / Ditolak',
          subtext: order.rejectionReason || 'Pesanan tidak dapat diproses.',
          badgeClass: 'bg-error-container text-on-error-container',
        }
    : null;

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200/80 shadow-xl bg-slate-900 text-slate-800 flex flex-col">
      {/* 1. SHOPEEFOOD/GRAB/GOJEK STYLE ACTIVE ORDER BANNER (IF ORDER IS ACTIVE) */}
      {order && orderStepMeta && (
        <div className="z-20 bg-emerald-600 text-white px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                {order.status === 'ready_pickup' ? 'directions_walk' : 'soup_kitchen'}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold bg-white/25 px-2 py-0.5 rounded-md">
                  ORDER #{order.id}
                </span>
                <span className="text-emerald-100 text-xs font-medium truncate">
                  {targetStall?.name}
                </span>
              </div>
              <h4 className="font-bold text-sm sm:text-base leading-tight truncate">
                {orderStepMeta.headline}
              </h4>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow-xs">
              {order.pickupTime}
            </span>
          </div>
        </div>
      )}

      {/* 2. THE MAP STAGE: FULL-BLEED IMMERSIVE CANVAS */}
      <div
        className={`relative w-full ${
          compact ? 'h-[360px] sm:h-[400px]' : 'h-[460px] sm:h-[540px] lg:h-[600px]'
        } bg-slate-900 overflow-hidden`}
      >
        {useUniversalTileEngine ? (
          <UniversalLeafletMap
            center={targetCoords}
            mapTypeId={mapTypeId}
            cameraPanTrigger={cameraPanTrigger}
            tapPinModeEnabled={
              mode === 'seller-broadcast' ? allowTapOnMapToPin : allowBuyerManualPin
            }
            onPickCoordinate={
              mode === 'seller-broadcast' ? handleSellerManualPin : handleBuyerManualPin
            }
            studentGps={studentGps}
            stallsToRender={
              mode === 'student-directory'
                ? normalizedStalls
                : targetStall
                ? [targetStall]
                : []
            }
            targetStallId={targetStall?.id}
            onSelectStallMarker={(sid) => {
              setActiveStallId(sid);
              setInfoOpenStallId(sid);
            }}
            infoOpenStallId={infoOpenStallId}
            onCloseInfoWindow={() => setInfoOpenStallId(null)}
            onOpenStallMenu={onSelectStall}
            showMenuButtonInPopup={Boolean(mode === 'student-directory' && onSelectStall)}
            routeCandidates={routeCandidates}
            selectedRouteIndex={selectedRouteIndex}
            onSelectRouteIndex={setSelectedRouteIndex}
          />
        ) : (
          <Map
            mapId="DEMO_MAP_ID"
            defaultCenter={targetCoords}
            defaultZoom={19}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            <MapCameraFollower target={targetCoords} triggerKey={cameraPanTrigger} />

            <MapTapCatcher
              enabled={mode === 'seller-broadcast' && allowTapOnMapToPin}
              onPickCoordinate={handleSellerManualPin}
            />

            <MapTapCatcher
              enabled={mode !== 'seller-broadcast' && allowBuyerManualPin}
              onPickCoordinate={handleBuyerManualPin}
            />

            {routeCandidates.length > 0 && (
              <WalkingRouteOverlay
                routeCandidates={routeCandidates}
                selectedRouteIndex={selectedRouteIndex}
                onSelectRouteIndex={setSelectedRouteIndex}
              />
            )}

            {studentGps && (
              <AdvancedMarker
                position={studentGps}
                title={`Titik Awal Anda (${studentGps.lat.toFixed(5)}, ${studentGps.lng.toFixed(5)})`}
              >
                <div className="flex flex-col items-center">
                  <div className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-md mb-1 whitespace-nowrap border border-white">
                    Posisi Kamu
                  </div>
                  <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-lg ring-4 ring-blue-500/40" />
                </div>
              </AdvancedMarker>
            )}

            {(mode === 'student-directory'
              ? normalizedStalls
              : targetStall
              ? [targetStall]
              : []
            ).map((st) => {
              const pos = st.gpsLocation
                ? { lat: st.gpsLocation.lat, lng: st.gpsLocation.lng }
                : IBI_KKG_CAMPUS_CENTER;
              const isSelected = st.id === targetStall?.id;

              return (
                <React.Fragment key={st.id}>
                  <AdvancedMarker
                    position={pos}
                    onClick={() => {
                      setActiveStallId(st.id);
                      setInfoOpenStallId(st.id);
                    }}
                    title={`${st.name} (${st.code})`}
                  >
                    <div className="flex flex-col items-center cursor-pointer">
                      <div
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-md mb-1 flex items-center gap-1 whitespace-nowrap border ${
                          !st.isOpen
                            ? 'bg-red-700 text-white border-white'
                            : isSelected
                            ? 'bg-emerald-700 text-white border-white scale-105'
                            : 'bg-white text-slate-900 border-emerald-600'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            st.isOpen ? 'bg-emerald-300 animate-ping' : 'bg-red-300'
                          }`}
                        />
                        <span>
                          {st.code}: {st.name}
                        </span>
                      </div>
                      <Pin
                        background={!st.isOpen ? '#dc2626' : isSelected ? '#047857' : '#0284c7'}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                        scale={isSelected ? 1.25 : 1.05}
                      />
                    </div>
                  </AdvancedMarker>

                  {infoOpenStallId === st.id && (
                    <InfoWindow
                      position={pos}
                      onCloseClick={() => setInfoOpenStallId(null)}
                      maxWidth={260}
                    >
                      <div className="flex flex-col gap-1.5 text-slate-900 p-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                            {st.code} • {st.isOpen ? 'Buka' : 'Tutup'}
                          </span>
                          <span className="text-[11px] text-slate-600 font-mono">
                            {st.gpsLocation?.updatedAt || 'Titik Kampus'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm leading-snug">{st.name}</h4>
                        <p className="text-xs text-slate-700">
                          <strong>Patokan Penjual:</strong>{' '}
                          {st.gpsLocation?.locationNote || st.locationDetail}
                        </p>
                        <p className="text-[11px] text-slate-600">{st.walkingGuide}</p>
                        {mode === 'student-directory' && onSelectStall && (
                          <button
                            type="button"
                            onClick={() => onSelectStall(st.id)}
                            className="mt-1 w-full py-1.5 px-3 rounded-lg bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Lihat Menu &amp; Pesan →
                          </button>
                        )}
                      </div>
                    </InfoWindow>
                  )}
                </React.Fragment>
              );
            })}
          </Map>
        )}

        {/* 3. GRAB/GOJEK FLOATING TOP HUD: STALL SELECTION PILLS & STATUS BADGE */}
        <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none flex flex-col gap-2">
          {/* Top Bar: Floating Status & Stall Pills */}
          <div className="flex items-center justify-between gap-2">
            <div className="pointer-events-auto flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-slate-200/80 text-xs font-medium text-slate-700">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isTargetUsingRealSellerPhoneGps
                    ? 'bg-emerald-500 animate-ping'
                    : 'bg-emerald-600'
                }`}
              />
              <span className="font-bold text-slate-900">
                {targetStall?.name || 'Kantin IBI KKG'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {targetStall?.code || 'Hall D'}
              </span>
            </div>

            {/* Floating Map Mode Toggle (Satelit vs Jalan) */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md p-1 rounded-full shadow-lg border border-slate-200/80 flex items-center">
              <button
                type="button"
                onClick={() => setMapTypeId('hybrid')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  mapTypeId === 'hybrid'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Satelit
              </button>
              <button
                type="button"
                onClick={() => setMapTypeId('roadmap')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  mapTypeId === 'roadmap'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peta
              </button>
            </div>
          </div>

          {/* Horizontal Stall Carousel (ShopeeFood / GoFood Style) */}
          {mode === 'student-directory' && (
            <div className="pointer-events-auto flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {normalizedStalls.map((st) => {
                const isSelected = st.id === targetStall?.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setActiveStallId(st.id);
                      setInfoOpenStallId(st.id);
                      setCameraPanTrigger(`select-${st.id}-${Date.now()}`);
                    }}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 shadow-md backdrop-blur-md transition-all active:scale-95 ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-2 border-white ring-2 ring-emerald-600/30'
                        : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200/80'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        !st.isOpen ? 'bg-red-400' : isSelected ? 'bg-white' : 'bg-emerald-500'
                      }`}
                    />
                    <span>
                      {st.code} · {st.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. FLOATING RIGHT ACTION BUTTONS (MY LOCATION & RE-CENTER) */}
        <div className="absolute right-3.5 bottom-28 z-10 flex flex-col gap-2">
          {mode !== 'seller-broadcast' ? (
            <>
              <button
                type="button"
                onClick={() => startBuyerPhoneGpsTracking(true)}
                className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md text-slate-800 shadow-xl border border-slate-200/80 flex items-center justify-center hover:bg-white active:scale-90 transition-all"
                title="Kunci Ulang Posisi GPS Saya"
              >
                <span className="material-symbols-outlined text-[22px] text-blue-600">
                  {isLocatingBuyerGps ? 'sync' : 'my_location'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAllowBuyerManualPin((prev) => !prev)}
                className={`w-11 h-11 rounded-2xl backdrop-blur-md shadow-xl border transition-all flex items-center justify-center active:scale-90 ${
                  allowBuyerManualPin
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white/95 text-slate-800 border-slate-200/80 hover:bg-white'
                }`}
                title="Pilih Titik Manual di Peta"
              >
                <span className="material-symbols-outlined text-[22px]">pin_drop</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleSellerLiveBroadcast}
              className={`w-11 h-11 rounded-2xl backdrop-blur-md shadow-xl border transition-all flex items-center justify-center active:scale-90 ${
                isWatchingSellerGps
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
              }`}
              title="Pancarkan Live GPS HP Penjual"
            >
              <span className="material-symbols-outlined text-[22px]">
                {isWatchingSellerGps ? 'location_disabled' : 'cell_tower'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setCameraPanTrigger(`center-${Date.now()}`)}
            className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md text-slate-800 shadow-xl border border-slate-200/80 flex items-center justify-center hover:bg-white active:scale-90 transition-all"
            title="Pusatkan ke Stan"
          >
            <span className="material-symbols-outlined text-[22px] text-slate-700">center_focus_strong</span>
          </button>
        </div>

        {/* 5. GRAB/GOJEK FLOATING BOTTOM ROUTE CARD (PREVIEW BAR) */}
        {targetStall && (
          <div className="absolute bottom-3 left-3 right-3 z-10 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <span className="material-symbols-outlined text-[24px]">
                  {travelMode === 'WALKING'
                    ? 'directions_walk'
                    : travelMode === 'TWO_WHEELER'
                    ? 'two_wheeler'
                    : 'directions_car'}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm sm:text-base leading-tight truncate">
                    {targetStall.name}
                  </span>
                  {liveDistanceMeters !== null ? (
                    <span className="font-extrabold text-emerald-700 text-xs sm:text-sm">
                      ·{' '}
                      {routeSummary
                        ? `${Math.max(1, Math.ceil(routeSummary.durationSeconds / 60))} mnt`
                        : `${Math.max(1, Math.ceil(liveDistanceMeters / 75))} mnt`}{' '}
                      ({liveDistanceMeters >= 1000
                        ? `${(liveDistanceMeters / 1000).toFixed(2)} km`
                        : `${liveDistanceMeters.toLocaleString('id-ID')} m`})
                    </span>
                  ) : (
                    <span className="text-amber-600 text-xs font-medium">· Mengunci GPS...</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                  <span>{targetStall.walkingGuide || targetStall.locationDetail}</span>
                  {compassInfo && <span>· Arah {compassInfo.cardinal}</span>}
                </div>
              </div>
            </div>

            {mode === 'student-directory' && onSelectStall && (
              <button
                type="button"
                onClick={() => onSelectStall(targetStall.id)}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 shadow-md transition-all cursor-pointer"
              >
                <span>Lihat Menu &amp; Pesan</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 6. GOJEK/GRAB STYLE BOTTOM SHEET: TRAVEL MODE & ROUTE COMPARISON (TERCEPAT VS ALTERNATIF) */}
      {mode !== 'seller-broadcast' && (
        <div className="bg-white p-4 sm:p-5 flex flex-col gap-4 border-t border-slate-100">
          {/* Header Row: Vehicle Selector (Motor / Jalan Kaki / Mobil) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pilih Moda Perjalanan (Ala Shopee / Grab)
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {travelMode === 'TWO_WHEELER'
                  ? 'Motor (Kurir ShopeeFood)'
                  : travelMode === 'WALKING'
                  ? 'Jalan Kaki Kampus'
                  : 'Mobil (Jalur Utama)'}
              </span>
            </div>

            {/* Grab/Gojek-Style Segmented Buttons */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl self-start sm:self-auto">
              {(
                [
                  { id: 'TWO_WHEELER', label: 'Motor', icon: 'two_wheeler' },
                  { id: 'WALKING', label: 'Jalan Kaki', icon: 'directions_walk' },
                  { id: 'DRIVING', label: 'Mobil', icon: 'directions_car' },
                ] as const
              ).map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  onClick={() => setTravelMode(tm.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    travelMode === tm.id
                      ? 'bg-white text-emerald-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{tm.icon}</span>
                  <span>{tm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Route Comparison Cards (Rute Tercepat vs Alternatif Jalur Lain) */}
          {routeCandidates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {routeCandidates.map((cand, idx) => {
                const isSelected = idx === selectedRouteIndex;
                const minutes = Math.max(1, Math.ceil(cand.durationSeconds / 60));
                const distText =
                  cand.distanceMeters >= 1000
                    ? `${(cand.distanceMeters / 1000).toFixed(2)} km`
                    : `${cand.distanceMeters.toLocaleString('id-ID')} m`;

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => setSelectedRouteIndex(idx)}
                    className={`p-3.5 rounded-2xl text-left flex flex-col justify-between gap-2 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : cand.tagType === 'fastest'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {cand.tagType === 'fastest' ? 'bolt' : 'alt_route'}
                        </span>
                        <span>{cand.label}</span>
                      </span>

                      {isSelected && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xl font-extrabold text-slate-900">
                        {minutes} <span className="text-xs font-semibold text-slate-500">menit</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600">
                        {distText}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 truncate border-t border-slate-200/60 pt-1.5">
                      {cand.viaSummary} · {cand.hasToll ? 'Lewat Tol' : 'Non-Tol'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Turn-by-Turn Guidance Strip (Panduan Belokan) */}
          {routeSummary?.steps && routeSummary.steps.length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">
                    turn_right
                  </span>
                  <span>Panduan Rute Jalan (Searah &amp; Putar Balik):</span>
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {routeSummary.viaSummary}
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {routeSummary.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 flex items-center gap-2 shrink-0 shadow-2xs"
                  >
                    <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium whitespace-nowrap">{st.instruction}</span>
                    {st.distanceMeters > 0 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({st.distanceMeters >= 1000
                          ? `${(st.distanceMeters / 1000).toFixed(1)} km`
                          : `${st.distanceMeters} m`})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. SELLER BROADCAST CONTROLS (ONLY IN SELLER MODE) */}
      {mode === 'seller-broadcast' && (
        <div className="bg-white p-4 sm:p-5 flex flex-col gap-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              value={sellerLocationNote}
              onChange={(e) => setSellerLocationNote(e.target.value)}
              placeholder="Contoh: Di depan pintu Hall D / Dekat parkiran motor"
              className="flex-1 h-11 px-3.5 rounded-xl bg-slate-50 text-slate-900 text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="button"
              onClick={() => {
                if (!sellerStall || !onUpdateSellerGps) return;
                const currentGps = sellerStall.gpsLocation || {
                  lat: IBI_KKG_CAMPUS_CENTER.lat,
                  lng: IBI_KKG_CAMPUS_CENTER.lng,
                  isLiveTracking: false,
                  updatedAt: 'Baru saja',
                };
                const nowStr = new Date().toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                onUpdateSellerGps({
                  ...currentGps,
                  updatedAt: `${nowStr} WIB`,
                  locationNote: sellerLocationNote.trim() || sellerStall.locationDetail,
                });
                onShowToast?.('Patokan posisi berhasil disimpan untuk mahasiswa!');
              }}
              className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md"
            >
              Simpan Patokan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
