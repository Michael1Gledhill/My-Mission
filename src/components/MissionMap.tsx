import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { MapBoundaries } from '../types';

interface MissionMapProps {
  mapBoundaries: MapBoundaries;
  currentLat: number;
  currentLng: number;
  currentArea: string;
}

const MAP_CENTER: [number, number] = [43.6, -112.2];
const MAP_ZOOM = 7;

function areaColor(status: string): string {
  if (status === 'current') return '#C9A84C';
  if (status === 'completed') return '#2a7a4a';
  return '#9ca3af';
}

function makeCurrentIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:20px;height:20px;border-radius:50%;
      background:#C9A84C;border:3px solid white;
      box-shadow:0 3px 10px rgba(0,0,0,0.4);
      animation:mapPulse 2s infinite;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: ''
  });
}

export function MissionMap({ mapBoundaries, currentLat, currentLng, currentArea }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      scrollWheelZoom: false,
      zoomControl: true
    });

    mapRef.current = map;

    const road = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors, © CARTO',
      maxZoom: 14
    });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 14
    });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors, © OpenTopoMap',
      maxZoom: 14
    });

    road.addTo(map);
    L.control.layers({ Road: road, Satellite: satellite, Terrain: topo }, {}, { collapsed: false }).addTo(map);

    if (mapBoundaries.missionBoundary.length > 2) {
      L.polygon(mapBoundaries.missionBoundary, {
        color: '#1A2744',
        weight: 2.5,
        fillColor: 'rgba(201, 168, 76, 0.1)',
        fillOpacity: 1,
        dashArray: '6, 4'
      }).addTo(map);
    }

    mapBoundaries.areas.forEach((area) => {
      if (area.boundary.length > 2) {
        L.polygon(area.boundary, {
          color: areaColor(area.status),
          weight: 2,
          fillColor: areaColor(area.status),
          fillOpacity: 0.15
        }).addTo(map);
      }

      L.circleMarker([area.lat, area.lng], {
        radius: 7,
        fillColor: areaColor(area.status),
        color: '#fff',
        weight: 2,
        fillOpacity: 0.95
      })
        .addTo(map)
        .bindPopup(`<strong>${area.name}</strong><br><small>${area.status}</small>`);
    });

    mapBoundaries.cities.forEach((city) => {
      L.circleMarker([city.lat, city.lng], {
        radius: 4,
        fillColor: '#2E3F6E',
        color: '#fff',
        weight: 1.5,
        fillOpacity: 0.9
      })
        .addTo(map)
        .bindPopup(`<strong>${city.name}</strong>`);
    });

    const journey = mapBoundaries.areas
      .filter((a) => a.status === 'completed' || a.status === 'current')
      .map((a) => [a.lat, a.lng] as [number, number]);

    let clearJourneyTimer: number | null = null;
    if (journey.length >= 2) {
      const path = L.polyline(journey, {
        color: '#C9A84C',
        weight: 3,
        opacity: 0.9,
        dashArray: '8, 8'
      }).addTo(map);

      let dashOffset = 0;
      clearJourneyTimer = window.setInterval(() => {
        dashOffset = (dashOffset + 1) % 200;
        path.setStyle({ dashOffset: `${dashOffset}` });
      }, 60);
    }

    L.marker([currentLat, currentLng], { icon: makeCurrentIcon(), zIndexOffset: 1000 })
      .addTo(map)
      .bindPopup(`<strong>Currently: ${currentArea}</strong>`)
      .openPopup();

    return () => {
      if (clearJourneyTimer !== null) {
        window.clearInterval(clearJourneyTimer);
      }
      map.remove();
      mapRef.current = null;
    };
  }, [mapBoundaries, currentLat, currentLng, currentArea]);

  return <div id="home-map" ref={containerRef} style={{ height: '270px', borderRadius: 10 }} />;
}
