import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

export interface MapEditorProps {
  boundary: [number, number][];
  currentArea: string;
  onBoundaryChange: (boundary: [number, number][]) => void;
  onCurrentAreaChange: (area: string) => void;
}

const MAP_CENTER: [number, number] = [43.6, -112.2];
const MAP_ZOOM = 7;

const ROAD_TILE = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const SATELLITE_TILE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TOPO_TILE = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

export function MapEditor({ boundary, currentArea, onBoundaryChange, onCurrentAreaChange }: MapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayerRef = useRef<L.FeatureGroup | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true
    });

    mapRef.current = map;

    const road = L.tileLayer(ROAD_TILE, { attribution: '© OpenStreetMap contributors, © CARTO', maxZoom: 14 });
    const satellite = L.tileLayer(SATELLITE_TILE, { attribution: '© Esri', maxZoom: 14 });
    const topo = L.tileLayer(TOPO_TILE, { attribution: '© OpenStreetMap contributors, © OpenTopoMap', maxZoom: 14 });
    road.addTo(map);

    L.control.layers({ Road: road, Satellite: satellite, Terrain: topo }, {}, { position: 'topright', collapsed: false }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    drawnLayerRef.current = drawnItems;
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        remove: true
      },
      draw: {
        polygon: {},
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false
      }
    });
    map.addControl(drawControl);

    const currentIcon = L.divIcon({
      html: `<div style="width:20px;height:20px;border-radius:50%;background:#C9A84C;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);animation:mapPulse 2s infinite;"></div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const currentMarker = L.marker([43.4917, -112.0339], { draggable: true, icon: currentIcon }).addTo(map);
    currentMarker.bindPopup(`<strong>📍 ${currentArea}</strong><br>Current Location`);
    currentMarker.on('dragend', () => {
      const latlng = currentMarker.getLatLng();
      onCurrentAreaChange(`${currentArea} (${latlng.lat.toFixed(3)}, ${latlng.lng.toFixed(3)})`);
    });
    currentMarkerRef.current = currentMarker;

    const updateBoundaryLayer = (coords: [number, number][]) => {
      if (boundaryLayerRef.current) {
        drawnItems.removeLayer(boundaryLayerRef.current);
      }
      if (coords.length === 0) return;
      boundaryLayerRef.current = L.polygon(coords, {
        color: '#1A2744',
        weight: 2.5,
        fillColor: 'rgba(201, 168, 76, 0.1)',
        fillOpacity: 1,
        dashArray: '6, 4'
      }).addTo(drawnItems);
      map.fitBounds(boundaryLayerRef.current.getBounds(), { padding: [30, 30] });
    };

    updateBoundaryLayer(boundary);

    map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer as L.Polygon;
      const drawn = layer.getLatLngs();
      const firstRing = Array.isArray(drawn[0]) ? (drawn[0] as L.LatLng[]) : [];
      const coords = firstRing.map((point) => [point.lat, point.lng] as [number, number]);
      if (coords.length > 0) {
        const mode = window.confirm('OK = use as mission boundary. Cancel = replace current area boundary.');
        if (mode) {
          onBoundaryChange(coords);
        } else {
          onBoundaryChange(coords);
        }
        updateBoundaryLayer(coords);
      }
    });

    map.on(L.Draw.Event.EDITED, (event: any) => {
      const layers = event.layers as L.LayerGroup;
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs();
          const ring = Array.isArray(latlngs[0]) ? (latlngs[0] as L.LatLng[]) : [];
          const coords = ring.map((point) => [point.lat, point.lng] as [number, number]);
          onBoundaryChange(coords);
        }
      });
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      currentMarker.setLatLng(e.latlng);
      currentMarker.openPopup();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      drawnLayerRef.current = null;
      boundaryLayerRef.current = null;
      currentMarkerRef.current = null;
    };
  }, [boundary, currentArea, onBoundaryChange, onCurrentAreaChange]);

  useEffect(() => {
    if (!drawnLayerRef.current || !mapRef.current) return;
    drawnLayerRef.current.clearLayers();
    if (boundary.length > 0) {
      const polygon = L.polygon(boundary, {
        color: '#1A2744',
        weight: 2.5,
        fillColor: 'rgba(201, 168, 76, 0.1)',
        fillOpacity: 1,
        dashArray: '6, 4'
      });
      polygon.addTo(drawnLayerRef.current);
      mapRef.current.fitBounds(polygon.getBounds(), { padding: [30, 30] });
    }
  }, [boundary]);

  return (
    <div>
      <div className="map-toolbar">
        <button type="button" className="map-tb-btn on">Road / Satellite / Terrain</button>
        <button type="button" className="map-tb-btn">Draw Polygon</button>
        <button type="button" className="map-tb-btn">Edit Shapes</button>
        <button type="button" className="map-tb-btn">Delete Shapes</button>
      </div>
      <div ref={containerRef} id="map" />
    </div>
  );
}
