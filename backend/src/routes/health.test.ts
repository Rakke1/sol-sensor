import request from 'supertest';
import express from 'express';
import healthRouter from './health';

describe('health route', () => {
  const app = express();
  app.use('/api/v1/health', healthRouter);

  it('should return 200 and status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});
