'use client';

import { useEffect, useRef } from 'react';

interface Treasure {
  id: string;
  lat: number;
  lng: number;
  hint: string | null;
  score: number;
  reveal_radius: number;
  claim_radius: number;
  is_found: boolean;
  found_by: string | null;
  isVisible: boolean;
  isClaimable: boolean;
  distance?: number;
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface Props {
  treasures: Treasure[];
  userLocation: UserLocation | null;
  myUserId: string;
  onMapClick?: (lat: number, lng: number) => void;
  isAdmin?: boolean;
}

export default function TreasureMap({ treasures, userLocation, myUserId, onMapClick, isAdmin = false }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<unknown[]>([]);
  const userMarkerRef = useRef<unknown>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Dynamic import Leaflet only on client
    import('leaflet').then(L => {
      // Fix Leaflet default icon path issue with Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (mapInstanceRef.current) return;

      const defaultCenter: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [37.5665, 126.9780]; // Seoul default

      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: 16,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      // Admin: click to place treasure
      if (isAdmin && onMapClick) {
        map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
          onMapClick(e.latlng.lat, e.latlng.lng);
        });
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when treasures change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then(L => {
      const map = mapInstanceRef.current as { addLayer: (l: unknown) => void; removeLayer: (l: unknown) => void };

      // Clear old markers
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];

      treasures.forEach(treasure => {
        if (!treasure.isVisible && !isAdmin) return;

        let iconHtml = '';
        let size: [number, number] = [32, 32];

        if (treasure.is_found) {
          iconHtml = `<div style="background:#94a3b8;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2)">✓</div>`;
        } else if (treasure.isClaimable) {
          iconHtml = `<div style="background:#f59e0b;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 12px rgba(245,158,11,0.5);animation:pulse 1s infinite">💎</div>`;
          size = [36, 36];
        } else if (treasure.isVisible || isAdmin) {
          iconHtml = `<div style="background:#3b82f6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.4)">🗺️</div>`;
        }

        if (!iconHtml) return;

        const icon = L.divIcon({
          html: iconHtml,
          className: '',
          iconSize: size,
          iconAnchor: [size[0] / 2, size[1] / 2],
        });

        const marker = L.marker([treasure.lat, treasure.lng], { icon });

        let popupContent = `<b>${treasure.hint || '보물'}</b><br/>${treasure.score}점`;
        if (treasure.is_found) popupContent += '<br/><span style="color:#94a3b8">발견됨</span>';
        if (isAdmin) {
          popupContent += `<br/><small>노출반경:${treasure.reveal_radius}m / 획득반경:${treasure.claim_radius}m</small>`;
        }

        marker.bindPopup(popupContent);
        (marker as unknown as { addTo: (m: unknown) => void }).addTo(mapInstanceRef.current!);
        markersRef.current.push(marker);

        // Draw circles in admin mode
        if (isAdmin && !treasure.is_found) {
          const revealCircle = L.circle([treasure.lat, treasure.lng], {
            radius: treasure.reveal_radius,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.05,
            weight: 1,
            dashArray: '5,5',
          });
          (revealCircle as unknown as { addTo: (m: unknown) => void }).addTo(mapInstanceRef.current!);
          markersRef.current.push(revealCircle);

          const claimCircle = L.circle([treasure.lat, treasure.lng], {
            radius: treasure.claim_radius,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.1,
            weight: 2,
          });
          (claimCircle as unknown as { addTo: (m: unknown) => void }).addTo(mapInstanceRef.current!);
          markersRef.current.push(claimCircle);
        }
      });
    });
  }, [treasures, isAdmin]);

  // Update user location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;

    import('leaflet').then(L => {
      const map = mapInstanceRef.current as {
        addLayer: (l: unknown) => void;
        removeLayer: (l: unknown) => void;
        setView: (c: [number, number], z: number) => void;
      };

      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current as object);
      }

      const userIcon = L.divIcon({
        html: `<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      marker.bindPopup('내 위치');
      (marker as unknown as { addTo: (m: unknown) => void }).addTo(mapInstanceRef.current!);
      userMarkerRef.current = marker;

      map.setView([userLocation.lat, userLocation.lng], 17);
    });
  }, [userLocation]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}
