export type SensorType = 'AQI' | 'TEMPERATURE' | 'HUMIDITY';

export interface Location {
  lat: number;
  lng: number;
}

export interface AqiSensorData {
  sensorType: 'AQI';
  aqi: number;
  pm25: number;
  pm10: number;
  temperature: number;
  humidity: number;
  timestamp: number;
  location: Location;
}

export type SensorData = AqiSensorData;

export interface DataProof {
  /** Base58-encoded Ed25519 signature over the canonical data hash */
  signature: string;
  /** Base58-encoded Ed25519 public key of the sensor */
  sensorPubkey: string;
  /** Base64-encoded canonical data hash that was signed */
  message: string;
}

export interface SensorResponse {
  data: SensorData;
  proof: DataProof;
}

export interface PaymentAccounts {
  sensorPool: string;
  poolVault: string;
  hardwareEntry: string;
  hardwareOwner: string;
  usdcMint: string;
  hardwareOwnerUsdc: string;
  globalState: string;
}

export interface PaymentDetails {
  programId: string;
  instruction: string;
  price: {
    amount: number;
    currency: string;
    decimals: number;
  };
  suggestedNonce: string;
  accounts: PaymentAccounts;
}

export interface PaymentChallenge {
  status: 402;
  message: string;
  payment: PaymentDetails;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  solana: {
    rpcUrl: string;
    connected: boolean;
    slot?: number;
  };
  programId: string;
}
