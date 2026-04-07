'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DemoSensor } from '@/types';

interface SensorMapProps {
  sensors: DemoSensor[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}

// Fix Leaflet's default icon issue with Next.js webpack
const createCustomIcon = (isSelected: boolean) => {
  return L.divIcon({
    html: `
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: ${isSelected ? '#14F195' : '#9ca3af'};
        border: 2px solid ${isSelected ? '#14F195' : '#d1d5db'};
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        cursor: pointer;
      ">
        <div style="width: 8px; height: 8px; background: ${isSelected ? '#000' : '#ffffff'}; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    className: 'custom-icon',
  });
};

export default function SensorMap({
  sensors,
  selectedId,
  onSelect,
  disabled = false,
}: SensorMapProps) {
  // Calculate map center from all sensors
  const center: [number, number] =
    sensors.length > 0
      ? [
          sensors.reduce((sum, s) => sum + s.lat, 0) / sensors.length,
          sensors.reduce((sum, s) => sum + s.lng, 0) / sensors.length,
        ]
      : [43.238, 76.945]; // Almaty default

  return (
    <div className={`rounded-xl border overflow-hidden ${
      disabled
        ? 'border-white/5 opacity-50 cursor-not-allowed'
        : 'border-white/10'
    }`}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: '400px', width: '100%' }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sensors.map((sensor) => (
          <Marker
            key={sensor.id}
            position={[sensor.lat, sensor.lng]}
            icon={createCustomIcon(sensor.id === selectedId)}
            eventHandlers={{
              click: () => !disabled && onSelect(sensor.id),
            }}
          >
            <Popup>
              <div className="text-sm font-medium text-slate-900">
                {sensor.name}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
