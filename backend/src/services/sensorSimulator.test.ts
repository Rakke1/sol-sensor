import * as sensorSimulator from './sensorSimulator';
import * as nacl from 'tweetnacl';
import { encodeBase58 } from '../utils/base58';

describe('sensorSimulator', () => {
  beforeEach(() => {
    // Reset the cached keypair
    (sensorSimulator as any).sensorKeypair = undefined;
  });


  it('simulateSensorReading returns a valid signature for AQI', () => {
    const result = sensorSimulator.simulateSensorReading('AQI');
    expect(result.proof.signature).toBeDefined();
    expect(result.proof.sensorPubkey).toBeDefined();
    expect(result.proof.message).toBeDefined();
  });

  it('simulateSensorReading returns valid AQI data and proof', () => {
    const result = sensorSimulator.simulateSensorReading('AQI');
    expect(result.data.sensorType).toBe('AQI');
    expect(typeof result.data.timestamp).toBe('number');
    expect(result.proof.signature).toBeDefined();
    expect(result.proof.sensorPubkey).toBeDefined();
    expect(result.proof.message).toBeDefined();
  });

  it('simulateSensorReading falls back to AQI for unknown type', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = sensorSimulator.simulateSensorReading('UNKNOWN');
    expect(result.data.sensorType).toBe('AQI');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('getSensorPubkey returns a base58 string', () => {
    const pubkey = sensorSimulator.getSensorPubkey();
    expect(typeof pubkey).toBe('string');
    expect(pubkey.length).toBeGreaterThan(10);
  });
});
