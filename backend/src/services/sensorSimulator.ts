import * as nacl from 'tweetnacl';
import { SENSOR_KEYPAIR_PATH, loadKeypairBytes } from '../config';
import { encodeBase58 } from '../utils/base58';
import type { SensorData, DataProof, SensorResponse } from '../types';

/** Sensor keypair — generated once at startup. */
let sensorKeypair: nacl.SignKeyPair;

function getSensorKeypair(): nacl.SignKeyPair {
  if (sensorKeypair) return sensorKeypair;

  const stored = loadKeypairBytes('SENSOR_KEY_JSON', SENSOR_KEYPAIR_PATH);
  if (stored && (stored.length === 64 || stored.length === 32)) {
    if (stored.length === 32) {
      sensorKeypair = nacl.sign.keyPair.fromSeed(stored);
    } else {
      sensorKeypair = nacl.sign.keyPair.fromSecretKey(stored);
    }
  } else {
    console.warn(
      '[SensorSimulator] Keypair file not found or invalid — generating ephemeral keypair.',
    );
    sensorKeypair = nacl.sign.keyPair();
  }
  return sensorKeypair;
}

/** Generate realistic pseudo-random AQI sensor data within plausible ranges. */
function generateAqiData(): Omit<
  Extract<SensorData, { sensorType: 'AQI' }>,
  'sensorType' | 'timestamp' | 'location'
> {
  const aqi = Math.floor(Math.random() * 100) + 1;
  const pm25 = parseFloat((Math.random() * 35 + 1).toFixed(1));
  const pm10 = parseFloat((pm25 * (1.5 + Math.random())).toFixed(1));
  const temperature = parseFloat((Math.random() * 30 + 5).toFixed(1));
  const humidity = Math.floor(Math.random() * 60) + 30;
  return { aqi, pm25, pm10, temperature, humidity };
}

/**
 * Simulate a signed AQI sensor reading.
 * Signs the canonical JSON of the data payload using Ed25519.
 */
export function simulateSensorReading(sensorType: string): SensorResponse {
  const keypair = getSensorKeypair();
  const timestamp = Math.floor(Date.now() / 1000);

  let data: SensorData;
  if (sensorType.toUpperCase() !== 'AQI') {
    // MVP only supports AQI — all other sensor types fall back to AQI data.
    console.warn(
      `[SensorSimulator] Unsupported sensorType "${sensorType}" — defaulting to AQI`,
    );
  }

  data = {
    sensorType: 'AQI',
    timestamp,
    location: { lat: 43.238, lng: 76.945 },
    ...generateAqiData(),
  };

  const canonical = JSON.stringify(data, Object.keys(data).sort());
  const messageBytes = new TextEncoder().encode(canonical);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);

  const proof: DataProof = {
    signature: encodeBase58(signature),
    sensorPubkey: encodeBase58(keypair.publicKey),
    message: Buffer.from(messageBytes).toString('base64'),
  };

  return { data, proof };
}

/** Return the sensor's base58 public key (for payment challenge accounts). */
export function getSensorPubkey(): string {
  return encodeBase58(getSensorKeypair().publicKey);
}
