import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { PORT, CORS_ORIGIN } from './config';
import healthRouter from './routes/health';
import sensorsRouter from './routes/sensors';

const app = express();

app.use(cors({
  origin: [CORS_ORIGIN, CORS_ORIGIN.replace('localhost', '127.0.0.1'), CORS_ORIGIN.replace('127.0.0.1', 'localhost')],
}));
app.use(express.json());

app.use('/api/v1/health', healthRouter);
app.use('/api/v1/sensors', sensorsRouter);

const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[SolSensor] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`[SolSensor] API server running on http://localhost:${PORT}`);
  console.log(`[SolSensor] CORS origin: ${CORS_ORIGIN}`);
});

export default app;
