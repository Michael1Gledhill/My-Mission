import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MissionMapProps {
  boundary: [number, number][];
  currentLat: number;
  currentLng: number;
  currentArea: string;
  areas?: Array<{ id: string; name: string; lat: number; lng: number; status: string }>;
}

// Default Idaho Falls Mission boundary
const DEFAULT_BOUNDARY: [number, number][] = [
  [44.7, -115.5], [44.9, -114.2], [45.1, -113.5], [45.5, -113.2], [45.7, -112.8],
  [45.7, -111.5], [45.4, -111.0], [45.2, -110.8], [44.8, -110.7], [44.5, -110.8],
  [44.2, -111.0], [44.1, -111.3], [43.8, -111.5], [43.5, -111.5], [43.2, -111.6],
  [43.0, -112.0], [42.5, -112.2], [42.0, -112.5], [41.8, -112.8], [41.9, -113.5],
  [42.0, -114.0], [42.1, -114.5], [42.5, -115.0], [43.0, -115.5], [43.5, -115.8],
  [44.0, -115.7], [44.3, -115.6], [44.7, -115.5]
];

const DEFAULT_CITIES = [
  { name: 'Twin Falls', lat: 42.5629, lng: -114.4609 },
  { name: 'Blackfoot', lat: 43.1908, lng: -112.3449 },
  { name: 'American Falls', lat: 42.7877, lng: -112.8607 },
  { name: 'Rigby', lat: 43.6724, lng: -111.9135 },
  { name: 'St Anthony', lat: 43.9690, lng: -111.6824 },
  { name: 'Soda Springs', lat: 42.6541, lng: -111.6046 },
  { name: 'Montpelier', lat: 42.3213, lng: -111.2988 },
  { name: 'Preston', lat: 42.0963, lng: -111.8766 },
  { name: 'Salmon', lat: 45.1763, lng: -113.8958 },
  { name: 'Ashton', lat: 44.0716, lng: -111.4488 },
  { name: 'Burley', lat: 42.5360, lng: -113.7918 }
];

export function MissionMap({
  boundary = DEFAULT_BOUNDARY,
  currentLat,
  currentLng,
  currentArea,
  areas = []
}: MissionMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    // Initialize map
    const map = L.map(container.current, {
      center: [43.6, -112.2],
      zoom: 7,
      scrollWheelZoom: false,
      zoomControl: true
    });

    mapRef.current = map;

    // Tile layers
    const roadLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { 
        attribution: '© OpenStreetMap, © CARTO',
        maxZoom: 14,
        className: 'map-tile'
      }
    );

    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { 
        attribution: '© Esri',
        maxZoom: 14,
        className: 'map-tile'
      }
    );

    const topoLayer = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      { 
        attribution: '© OpenStreetMap, © OpenTopoMap',
        maxZoom: 14,
        className: 'map-tile'
      }
    );

    roadLayer.addTo(map);

    // Layer control
    const layerControl = L.control.layers(
      {
        'Road Map': roadLayer,
        'Satellite': satLayer,
        'Terrain': topoLayer
      },
      {},
      { position: 'topright', collapsed: false }
    );
    layerControl.addTo(map);

    // Mission boundary
    if (boundary.length > 0) {
      const polygon = L.polygon(boundary, {
        color: '#1A2744',
        weight: 2.5,
        fillColor: 'rgba(201, 168, 76, 0.1)',
        fillOpacity: 1,
        dashArray: '6, 4'
      });
      polygon.addTo(map);
      polygon.bindPopup('Idaho Idaho Falls Mission Boundary');
    }

    // Cities
    DEFAULT_CITIES.forEach((city) => {
      const marker = L.circleMarker([city.lat, city.lng], {
        radius: 4,
        fillColor: '#6b7280',
        color: '#fff',
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.8
      });
      marker.bindPopup(`<strong>${city.name}</strong><br>City`, { maxWidth: 150 });
      marker.addTo(map);
    });

    // Area markers
    areas.forEach((area) => {
      let color = '#9ca3af'; // future
      if (area.status === 'current') color = '#C9A84C'; // gold
      if (area.status === 'completed') color = '#2a7a4a'; // green

      const marker = L.circleMarker([area.lat, area.lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9
      });

      const statusBadge = `<span style="background:${color};color:white;padding:2px 6px;border-radius:3px;font-size:0.75rem;font-weight:bold;">${area.status.toUpperCase()}</span>`;
      marker.bindPopup(`<strong>${area.name}</strong><br>${statusBadge}`, { maxWidth: 150 });
      marker.addTo(map);
    });

    // Current location pin with animation
    const currentIcon = L.divIcon({
      html: `<div class="map-current-pin" style="
        width:20px; height:20px; 
        border-radius:50%;
        background:#C9A84C; 
        border:3px solid white;
        box-shadow:0 3px 10px rgba(0,0,0,0.4);
        animation: mapPulse 2s infinite;
      "></div>
      <style>
        @keyframes mapPulse {
          0%,100% { box-shadow: 0 3px 10px rgba(0,0,0,0.4), 0 0 0 0 rgba(201,168,76,0.5); }
          60% { box-shadow: 0 3px 10px rgba(0,0,0,0.4), 0 0 0 10px rgba(201,168,76,0); }
        }
      </style>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      className: '',
      popupAnchor: [0, -15]
    });

    const currentMarker = L.marker([currentLat, currentLng], { icon: currentIcon });
    currentMarker.bindPopup(`<strong>📍 ${currentArea}</strong><br>Current Location`, { maxWidth: 150 });
    currentMarker.addTo(map);

    // Fit bounds to show all content
    if (boundary.length > 0) {
      const bounds = L.latLngBounds(boundary);
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [boundary, currentLat, currentLng, currentArea, areas]);

  return (
    <div
      ref={container}
      style={{
        width: '100%',
        height: '350px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid #e5e7eb'
      }}
    />
  );
}
