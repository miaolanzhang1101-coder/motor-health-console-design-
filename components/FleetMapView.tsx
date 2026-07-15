'use client';
import { MapContainer, TileLayer, CircleMarker, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Agent, AgentStatus } from '../lib/agentStream';

interface FleetMapViewProps {
  agents: Agent[];
  selectedId: string | null;
  onMapClick: (lat: number, lng: number) => void;
  statusColors: Record<AgentStatus, string>;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FleetMapView({ agents, selectedId, onMapClick, statusColors }: FleetMapViewProps) {
  const center: [number, number] = agents.length ? [agents[0].lat, agents[0].lng] : [29.749, -95.358];

  return (
    <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%', background: '#0A0B0D' }}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap contributors &copy; CARTO'
      />
      <ClickHandler onClick={onMapClick} />

      {agents.map((a) => (
        <Polyline
          key={`trail-${a.id}`}
          positions={a.trail}
          pathOptions={{ color: statusColors[a.status], weight: 1.5, opacity: 0.5 }}
        />
      ))}

      {agents.map((a) => (
        <CircleMarker
          key={a.id}
          center={[a.lat, a.lng]}
          radius={a.id === selectedId ? 9 : 6}
          pathOptions={{
            color: statusColors[a.status],
            fillColor: statusColors[a.status],
            fillOpacity: 0.9,
            weight: a.id === selectedId ? 3 : 1.5,
          }}
        />
      ))}
    </MapContainer>
  );
}