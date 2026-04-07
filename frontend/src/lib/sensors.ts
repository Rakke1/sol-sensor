/** Demo sensor definition */
export interface DemoSensor {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** Demo sensor stations clustered in Almaty, Kazakhstan */
export const DEMO_SENSORS: DemoSensor[] = [
  { id: 'almaty-1', name: 'Downtown Center', lat: 43.238, lng: 76.945 },
  { id: 'almaty-2', name: 'Bostandyk District', lat: 43.27, lng: 76.917 },
  { id: 'almaty-3', name: 'Medeu Canyon', lat: 43.209, lng: 76.97 },
  { id: 'almaty-4', name: 'Alatau Foothills', lat: 43.19, lng: 76.93 },
  { id: 'almaty-5', name: 'Auezov Area', lat: 43.255, lng: 76.9 },
];
