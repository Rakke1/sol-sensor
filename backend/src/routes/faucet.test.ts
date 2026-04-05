import request from 'supertest';
import express from 'express';
import faucetRouter from './faucet';

describe('faucet route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/faucet', faucetRouter);

  it('should 400 on missing wallet', async () => {
    const res = await request(app).post('/api/v1/faucet').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wallet/);
  });

  it('should 400 on invalid wallet', async () => {
    const res = await request(app).post('/api/v1/faucet').send({ wallet: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/wallet/);
  });

  // Add more integration tests as needed
});
