import React, { useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  normalizeStallLocation,
  OrderTransaction,
  SellerLiveGpsLocation,
  Stall,
} from '../data/kantinData';

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

interface WalkingRouteOverlayProps {
  origin: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  travelMode: 'WALKING' | 'TWO_WHEELER' | 'DRIVING';
  selectedRouteIndex: number;
  onSelectRouteIndex: (idx: number) => void;
  onRoutesComputed: (
    routes: RouteOptionCandidate[],
    activeSummary: {
      distanceMeters: number;
      durationSeconds: number;
      usingFallbackLine: boolean;
      steps?: RouteStepInstruction[];
      viaSummary?: string;
      label?: string;
    } | null
  ) => void;
}

const WalkingRouteOverlay: React.FC<WalkingRouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  selectedRouteIndex,
  onSelectRouteIndex,
  onRoutesComputed,
}) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [computedCandidates, setComputedCandidates] = useState<RouteOptionCandidate[]>([]);
  const [isFallbackDirect, setIsFallbackDirect] = useState<boolean>(false);

  // 1. Fetch primary + alternative routes whenever origin, destination, or travelMode changes
  useEffect(() => {
    if (!map || !origin || !destination) {
      setComputedCandidates([]);
      onRoutesComputed([], null);
      return;
    }

    let cancelled = false;
    const directMeters = calculateHaversineMeters(origin, destination);
    const isInsideCampusWalk = travelMode === 'WALKING' && directMeters <= 350;

    const fetchAllRouteAlternatives = async () => {
      // Engine A: Valhalla Turn-by-Turn Multi-Route Engine (`alternates: 2`)
      // Strictly enforces one-way streets (`oneway=yes`), U-turns, and travel-mode rules
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
          alternates: 2, // Request up to 3 routes total (1 fastest + 2 alternatives)
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

            // Filter out pure route numbers like "1" or "2" when building "Via Jl. ..."
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

          if (!cancelled && parsedRaw.length > 0) {
            const labeled = labelAndClassifyRouteCandidates(parsedRaw);
            setIsFallbackDirect(false);
            setComputedCandidates(labeled);

            const bounds = new google.maps.LatLngBounds();
            labeled.forEach((cand) => cand.path.forEach((pt) => bounds.extend(pt)));
            map.fitBounds(bounds, 56);
            return;
          }
        }
      } catch {
        // Fallback to OSRM with alternatives=3 below
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

          if (!cancelled && parsedRaw.length > 0) {
            const labeled = labelAndClassifyRouteCandidates(parsedRaw);
            setIsFallbackDirect(false);
            setComputedCandidates(labeled);

            const bounds = new google.maps.LatLngBounds();
            labeled.forEach((cand) => cand.path.forEach((pt) => bounds.extend(pt)));
            map.fitBounds(bounds, 56);
            return;
          }
        } catch {
          // try next server
        }
      }

      if (!cancelled) {
        const fallbackCandidate: RouteOptionCandidate = {
          id: 'route-opt-0',
          label: 'Rute Langsung',
          tagType: 'fastest',
          viaSummary: 'Jalur Langsung Area Kampus',
          distanceMeters: directMeters,
          durationSeconds: Math.max(15, Math.round(directMeters / 1.25)),
          path: [origin, destination],
          steps: [],
        };
        setIsFallbackDirect(true);
        setComputedCandidates([fallbackCandidate]);
      }
    };

    fetchAllRouteAlternatives();

    return () => {
      cancelled = true;
    };
  }, [map, origin?.lat, origin?.lng, destination?.lat, destination?.lng, travelMode]);

  // 2. Render both unselected alternative routes (interactive clickable grey lines) and the selected primary route (emerald green with directional arrows)
  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || computedCandidates.length === 0 || typeof google === 'undefined') {
      return;
    }

    const safeIdx =
      selectedRouteIndex >= 0 && selectedRouteIndex < computedCandidates.length
        ? selectedRouteIndex
        : 0;

    const createdPolylines: google.maps.Polyline[] = [];

    // Draw UNSELECTED alternative routes first (underneath, in Google Maps slate/grey style, clickable!)
    computedCandidates.forEach((cand, idx) => {
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

    // Draw SELECTED active route on top (Shopee/Google Maps vibrant emerald with directional flow arrows)
    const activeCand = computedCandidates[safeIdx];
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

      onRoutesComputed(computedCandidates, {
        distanceMeters: activeCand.distanceMeters,
        durationSeconds: activeCand.durationSeconds,
        usingFallbackLine: isFallbackDirect,
        steps: activeCand.steps,
        viaSummary: activeCand.viaSummary,
        label: activeCand.label,
      });
    }

    polylinesRef.current = createdPolylines;

    return () => {
      createdPolylines.forEach((p) => p.setMap(null));
    };
  }, [map, computedCandidates, selectedRouteIndex, isFallbackDirect]);

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
  const [routeSummary, setRouteSummary] = useState<{
    distanceMeters: number;
    durationSeconds: number;
    usingFallbackLine: boolean;
    steps?: RouteStepInstruction[];
    viaSummary?: string;
    label?: string;
  } | null>(null);
  const [infoOpenStallId, setInfoOpenStallId] = useState<string | null>(null);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string | null>(null);

  // Reset selected route to 0 (Rute Tercepat) when user switches travel mode or target stall
  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [travelMode, activeStallId]);

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
    <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-6 shadow-sm border border-outline-variant/25 flex flex-col gap-4">
      {/* SHOPEEFOOD-STYLE ORDER TRACKING HEADER BANNER WHEN ORDER IS PRESENT */}
      {order && orderStepMeta && (
        <div className="p-4 rounded-xl bg-secondary-container/35 border border-secondary/30 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">
                  {order.status === 'ready_pickup' ? 'directions_walk' : 'soup_kitchen'}
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-primary">
                    ORDER #{order.id}
                  </span>
                  <span className="text-outline-variant">•</span>
                  <span className="text-xs font-semibold text-secondary">
                    Live GPS Pembeli ➔ Penjual
                  </span>
                </div>
                <h4 className="font-headline-md text-sm sm:text-base font-bold text-on-surface">
                  {orderStepMeta.headline}
                </h4>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-lg font-label-sm text-xs font-bold ${orderStepMeta.badgeClass}`}
            >
              {order.pickupTime}
            </span>
          </div>

          {orderStepMeta.step > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full ${
                    orderStepMeta.step >= 1 ? 'bg-secondary' : 'bg-surface-container-high'
                  }`}
                />
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  1. Pesanan Masuk
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full ${
                    orderStepMeta.step >= 2 ? 'bg-secondary' : 'bg-surface-container-high'
                  }`}
                />
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  2. Sedang Dimasak
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <div
                  className={`h-1.5 rounded-full ${
                    orderStepMeta.step >= 3 ? 'bg-secondary' : 'bg-surface-container-high'
                  }`}
                />
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  3. Siap Diambil (Ikuti Rute)
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-on-surface-variant leading-relaxed">
            {orderStepMeta.subtext}
          </p>
        </div>
      )}

      {/* SECTION 1: CLEAN HEADER & DEVICE GPS TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2.5 py-0.5 rounded-md font-label-sm text-[11px] font-bold inline-flex items-center gap-1.5 ${
                isTargetUsingRealSellerPhoneGps
                  ? 'bg-secondary text-on-secondary'
                  : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isTargetUsingRealSellerPhoneGps ? 'bg-on-secondary animate-ping' : 'bg-secondary'
                }`}
              />
              <span>
                {isTargetUsingRealSellerPhoneGps
                  ? 'LIVE GPS HP PENJUAL'
                  : 'TITIK KANTIN KAMPUS IBI KKG'}
              </span>
            </span>

            {mode !== 'seller-broadcast' && studentGps && (
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-700 font-mono text-[11px] font-semibold inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">smartphone</span>
                <span>
                  Titik Kamu: {studentGps.lat.toFixed(4)}, {studentGps.lng.toFixed(4)}
                  {studentGps.accuracy ? ` (±${studentGps.accuracy}m)` : ''}
                </span>
              </span>
            )}
          </div>

          {!compact && (
            <h3 className="font-headline-md text-base sm:text-lg font-bold text-on-surface leading-snug">
              {mode === 'seller-broadcast'
                ? `Pancarkan Lokasi GPS Anda (${sellerStall?.name || 'Penjual'})`
                : `Navigasi Rute ke ${targetStall?.name} (${targetStall?.code})`}
            </h3>
          )}
        </div>

        {/* Right Toolbar: Map View Switcher + GPS Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/25">
            <button
              type="button"
              onClick={() => setMapTypeId('hybrid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-sm cursor-pointer transition-colors ${
                mapTypeId === 'hybrid'
                  ? 'bg-primary text-on-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Satelit
            </button>
            <button
              type="button"
              onClick={() => setMapTypeId('roadmap')}
              className={`px-3 py-1.5 rounded-lg text-xs font-label-sm cursor-pointer transition-colors ${
                mapTypeId === 'roadmap'
                  ? 'bg-primary text-on-primary font-bold shadow-2xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Peta Jalan
            </button>
          </div>

          {mode === 'seller-broadcast' ? (
            <>
              <button
                type="button"
                onClick={toggleSellerLiveBroadcast}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-label-md text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                  isWatchingSellerGps
                    ? 'bg-error text-on-error'
                    : 'bg-secondary text-on-secondary hover:opacity-95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isWatchingSellerGps ? 'location_disabled' : 'my_location'}
                </span>
                <span>
                  {isWatchingSellerGps ? 'Hentikan Live GPS' : 'Pancarkan GPS HP Saya'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAllowTapOnMapToPin((prev) => !prev)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl font-label-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer border ${
                  allowTapOnMapToPin
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/30'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>{allowTapOnMapToPin ? 'Ketuk Peta Aktif' : 'Geser Pin'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetToCampusDefault}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs font-semibold cursor-pointer"
              >
                Reset ke Kampus
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startBuyerPhoneGpsTracking(true)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-label-md text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                  studentGps?.source === 'device-gps' && isWatchingStudentGps
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-primary text-on-primary hover:opacity-95'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isLocatingBuyerGps
                    ? 'sync'
                    : studentGps?.source === 'device-gps'
                    ? 'my_location'
                    : 'location_searching'}
                </span>
                <span>
                  {isLocatingBuyerGps
                    ? 'Mendeteksi GPS...'
                    : studentGps?.source === 'device-gps'
                    ? 'Perbarui GPS'
                    : 'Deteksi GPS Saya'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAllowBuyerManualPin((prev) => !prev)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl font-label-sm text-xs font-semibold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                  allowBuyerManualPin
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container-low text-on-surface border-outline-variant/30 hover:bg-surface-container'
                }`}
                title="Klik posisi Anda secara manual di peta"
              >
                <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                <span>{allowBuyerManualPin ? 'Ketuk Peta...' : 'Titik Manual'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Prompt banner ONLY if buyer GPS is not yet acquired */}
      {mode !== 'seller-broadcast' && !studentGps && (
        <div className="p-3 rounded-xl bg-tertiary-fixed/45 border border-tertiary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-tertiary animate-pulse">
              location_searching
            </span>
            <span>
              {isLocatingBuyerGps
                ? 'Sedang mendeteksi koordinat lokasi perangkat Anda...'
                : 'Izinkan akses lokasi GPS atau gunakan tombol "Titik Manual" untuk melihat rute ke penjual.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => startBuyerPhoneGpsTracking(true)}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-xs cursor-pointer shrink-0"
          >
            Aktifkan GPS Sekarang
          </button>
        </div>
      )}

      {/* Seller Patokan Note Input when in seller-broadcast mode */}
      {mode === 'seller-broadcast' && (
        <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/25 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-on-surface shrink-0">
            <span className="material-symbols-outlined text-[18px] text-primary">
              edit_location_alt
            </span>
            <span>Patokan Posisi Penjual:</span>
          </div>
          <input
            type="text"
            value={sellerLocationNote}
            onChange={(e) => setSellerLocationNote(e.target.value)}
            placeholder="Contoh: Di depan pintu Hall D / Dekat parkiran motor Gedung A"
            className="flex-1 h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-xs border border-outline-variant/25 focus:outline-none focus:ring-2 focus:ring-primary"
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
              onShowToast?.('Patokan lokasi penjual berhasil diperbarui untuk mahasiswa!');
            }}
            className="min-h-[40px] px-4 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-semibold cursor-pointer shrink-0"
          >
            Simpan Patokan
          </button>
        </div>
      )}

      {/* SECTION 2: UNIFIED NAVIGATION CONTROL PANEL (Stall Selector + Travel Mode + Route Comparison Cards) */}
      {mode !== 'seller-broadcast' && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-surface-container-low/70 border border-outline-variant/25 flex flex-col gap-3.5">
          {/* Row A: Stall Selector Pills (Only in student-directory mode) */}
          {mode === 'student-directory' && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                1. Pilih Stan Kantin Tujuan
              </span>
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
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
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-label-sm text-xs flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer border transition-all ${
                        isSelected
                          ? 'bg-primary text-on-primary border-primary font-bold shadow-xs'
                          : 'bg-surface-container-lowest text-on-surface border-outline-variant/25 hover:bg-surface-container'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          !st.isOpen
                            ? 'bg-error'
                            : isSelected
                            ? 'bg-on-primary animate-ping'
                            : 'bg-secondary'
                        }`}
                      />
                      <span>
                        {st.code} • {st.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row B: Travel Mode Selector + Route Alternatives Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                {mode === 'student-directory'
                  ? '2. Pilih Moda & Jalur Rute (Ala Google Maps)'
                  : 'Pilih Moda & Jalur Rute Perjalanan'}
              </span>
              <span className="text-xs text-on-surface-variant">
                Garis <strong className="text-emerald-700">Hijau</strong> = Rute Aktif • Garis{' '}
                <strong className="text-slate-600">Abu-abu</strong> = Alternatif (Bisa diklik di peta)
              </span>
            </div>

            {/* Segmented Control for Travel Mode */}
            <div className="inline-flex items-center bg-surface-container-lowest p-1 rounded-xl border border-outline-variant/30 self-start sm:self-auto">
              {(
                [
                  { id: 'WALKING', label: 'Jalan Kaki', icon: 'directions_walk' },
                  { id: 'TWO_WHEELER', label: 'Motor', icon: 'two_wheeler' },
                  { id: 'DRIVING', label: 'Mobil', icon: 'directions_car' },
                ] as const
              ).map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  onClick={() => setTravelMode(tm.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-label-sm flex items-center gap-1.5 cursor-pointer transition-all ${
                    travelMode === tm.id
                      ? 'bg-primary text-on-primary font-bold shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tm.icon}</span>
                  <span>{tm.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row C: Google Maps-Style Route Comparison Cards */}
          {routeCandidates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                    className={`p-3 rounded-xl text-left flex flex-col justify-between gap-1.5 cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-surface-container-lowest border-emerald-600 ring-2 ring-emerald-600/25 shadow-xs'
                        : 'bg-surface-container-lowest/70 border-outline-variant/25 hover:bg-surface-container-lowest'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 truncate ${
                          isSelected
                            ? 'bg-emerald-700 text-white'
                            : cand.tagType === 'fastest'
                            ? 'bg-primary-fixed text-on-primary-fixed'
                            : cand.tagType === 'shortest'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {cand.tagType === 'fastest'
                            ? 'bolt'
                            : cand.tagType === 'shortest'
                            ? 'straighten'
                            : 'alt_route'}
                        </span>
                        <span className="truncate">{cand.label}</span>
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-base font-extrabold ${
                          isSelected ? 'text-emerald-700' : 'text-on-surface'
                        }`}
                      >
                        {minutes} menit
                      </span>
                      <span className="text-xs font-mono font-bold text-on-surface-variant">
                        {distText}
                      </span>
                    </div>

                    <div className="text-[11px] text-on-surface-variant truncate border-t border-outline-variant/15 pt-1">
                      {cand.viaSummary} • {cand.hasToll ? 'Lewat Tol' : 'Non-Tol'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {gpsErrorMsg && (
        <div className="p-3 rounded-xl bg-tertiary-fixed/60 text-on-tertiary-fixed text-xs flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">info</span>
            <span>{gpsErrorMsg}</span>
          </div>
          {mode !== 'seller-broadcast' && (
            <button
              type="button"
              onClick={() => startBuyerPhoneGpsTracking(true)}
              className="px-3 py-1 rounded-lg bg-primary text-on-primary font-bold text-[11px] cursor-pointer"
            >
              Coba Lagi GPS
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: GOOGLE MAP CANVAS WITH FLOATING SUMMARY BAR */}
      <div
        className={`relative w-full ${
          compact ? 'h-[280px] sm:h-[320px]' : 'h-[380px] sm:h-[440px]'
        } rounded-2xl overflow-hidden border border-outline-variant/30 shadow-inner`}
      >
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

          {studentGps && targetCoords && (
            <WalkingRouteOverlay
              origin={studentGps}
              destination={targetCoords}
              travelMode={travelMode}
              selectedRouteIndex={selectedRouteIndex}
              onSelectRouteIndex={setSelectedRouteIndex}
              onRoutesComputed={(candidates, summary) => {
                setRouteCandidates(candidates);
                setRouteSummary(summary);
              }}
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

        {/* FLOATING BOTTOM SUMMARY BAR */}
        {targetStall && (
          <div className="absolute bottom-3 left-3 right-3 z-10 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-xl border border-outline-variant/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-xs">
                <span className="material-symbols-outlined text-[18px]">route</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-on-surface truncate">
                    {targetStall.name} ({targetStall.code})
                  </span>
                  {liveDistanceMeters !== null ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                      {liveDistanceMeters >= 1000
                        ? `${(liveDistanceMeters / 1000).toFixed(2)} km`
                        : `${liveDistanceMeters.toLocaleString('id-ID')} m`}{' '}
                      •{' '}
                      {routeSummary
                        ? `${Math.max(1, Math.ceil(routeSummary.durationSeconds / 60))} mnt`
                        : `${Math.max(1, Math.ceil(liveDistanceMeters / 75))} mnt`}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold">
                      Menunggu GPS...
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-on-surface-variant truncate">
                  {routeSummary?.viaSummary ? `${routeSummary.viaSummary} • ` : ''}
                  {targetStall.gpsLocation?.locationNote || targetStall.walkingGuide}
                  {compassInfo ? ` • Arah ${compassInfo.cardinal}` : ''}
                </span>
              </div>
            </div>

            {mode === 'student-directory' && onSelectStall && (
              <button
                type="button"
                onClick={() => onSelectStall(targetStall.id)}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                <span>Lihat Menu Stan</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* SECTION 4: TURN-BY-TURN DIRECTIONS STRIP */}
      {mode !== 'seller-broadcast' && routeSummary?.steps && routeSummary.steps.length > 0 && (
        <div className="p-3.5 rounded-xl bg-surface-container-low/70 border border-outline-variant/25 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                turn_right
              </span>
              <span>Panduan Belokan Jalan (Searah &amp; Putar Balik):</span>
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-secondary-container text-on-secondary-container font-bold">
              {routeSummary.viaSummary || 'Jalur Resmi'}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {routeSummary.steps.map((st, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/25 text-xs text-on-surface flex items-center gap-2 shrink-0"
              >
                <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium">{st.instruction}</span>
                {st.distanceMeters > 0 && (
                  <span className="text-[10px] text-on-surface-variant font-mono">
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
  );
};
