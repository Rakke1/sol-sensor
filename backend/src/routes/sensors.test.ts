
import request from 'supertest';
import express from 'express';
import * as http402 from '../middleware/http402';
import * as receiptVerifier from '../middleware/receiptVerifier';
import * as sensorSimulator from '../services/sensorSimulator';
import * as solana from '../services/solana';

describe('sensors route', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function setupAppWithRouter() {
    const express = require('express');
    const app: import('express').Express = express();
    app.use(express.json());
    const router = require('./sensors').default || require('./sensors');
    app.use('/api/v1/sensors', router);
    return app;
  }

  it('returns 402 if no x-query-receipt header', async () => {
    jest.doMock('../middleware/http402', () => ({
      http402: async (req: any, res: any, next: any) => {
        res.status(402).json({ test: 'challenge' });
      },
    }));
    const app = setupAppWithRouter();
    const res = await request(app).get('/api/v1/sensors/AQI');
    expect(res.status).toBe(402);
    expect(res.body).toEqual({ test: 'challenge' });
  });

  it('returns 200 and sensor data if receipt is valid', async () => {
    jest.doMock('../middleware/http402', () => ({
      http402: async (req: any, res: any, next: any) => await next(),
    }));
    jest.doMock('../middleware/receiptVerifier', () => ({
      receiptVerifier: async (req: any, res: any, next: any) => {
        res.locals.receipt = { payer: 'payer' };
        res.locals.receiptPda = 'pda';
        res.locals.nonce = new Uint8Array(32);
        await next();
      },
    }));
    jest.doMock('../services/sensorSimulator', () => ({
      simulateSensorReading: () => ({
        data: {
          sensorType: 'AQI',
          aqi: 42,
          pm25: 10,
          pm10: 20,
          temperature: 25,
          humidity: 50,
          timestamp: 1,
          location: { lat: 0, lng: 0 },
        },
        proof: { signature: 'sig', sensorPubkey: 'pub', message: 'msg' }
      }),
    }));
    const solana = require('../services/solana');
    const sendConsumeSpy = jest.spyOn(solana, 'sendConsumeReceipt').mockResolvedValue(undefined);
    const app = setupAppWithRouter();
    const res = await request(app).get('/api/v1/sensors/AQI').set('x-query-receipt', 'pda').set('x-query-nonce', Buffer.alloc(32).toString('base64url'));
    expect(res.status).toBe(200);
    expect(res.body.data.sensorType).toBe('AQI');
    expect(sendConsumeSpy).toHaveBeenCalledWith('pda', expect.any(Uint8Array), 'payer');
  });

  it('returns 500 on simulateSensorReading error', async () => {
    jest.doMock('../middleware/http402', () => ({
      http402: async (req: any, res: any, next: any) => await next(),
    }));
    jest.doMock('../middleware/receiptVerifier', () => ({
      receiptVerifier: async (req: any, res: any, next: any) => {
        res.locals.receipt = { payer: 'payer' };
        res.locals.receiptPda = 'pda';
        res.locals.nonce = new Uint8Array(32);
        await next();
      },
    }));
    jest.doMock('../services/sensorSimulator', () => ({
      simulateSensorReading: () => { throw new Error('fail'); },
    }));
    const app = setupAppWithRouter();
    const res = await request(app).get('/api/v1/sensors/AQI').set('x-query-receipt', 'pda').set('x-query-nonce', Buffer.alloc(32).toString('base64url'));
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal/i);
  });
});
