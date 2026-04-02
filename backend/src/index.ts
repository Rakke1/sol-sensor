import express from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config';
import healthRouter from './routes/health';
import sensorsRouter from './routes/sensors';

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/sensors', sensorsRouter);

app.listen(PORT, () => {
  console.log(`[SolSensor] API server running on http://localhost:${PORT}`);
  console.log(`[SolSensor] CORS origin: ${CORS_ORIGIN}`);
});

export default app;
