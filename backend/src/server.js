import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { correlationId } from './middleware/correlationId.js';
import authRoutes from './routes/auth.js';
import inventoryRoutes from './routes/inventory.js';
import slotsRoutes from './routes/slots.js';
import auditRoutes from './routes/audit.js';
import coldChainRoutes from './routes/cold-chain.js';
import dashboardRoutes from './routes/dashboard.js';
import profileRoutes from './routes/profile.js';
import maintenanceRoutes from './routes/maintenance.js';
import floorPlanUploadRoutes from './routes/floor-plan-upload.js';
import notificationsRoutes from './routes/notifications.js';
import qcRoutes from './routes/qc.js';
import zonesRoutes from './routes/zones.js';
import ingestionHistoryRoutes from './routes/ingestion-history.js';

const app = express();
const PORT = process.env.PORT || 4000;

// CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'https://main.d1duzg6kl2wvnh.amplifyapp.com',
  ],
  credentials: true,
}));

// Correlation ID middleware (before body parsing and routes)
app.use(correlationId);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/cold-chain', coldChainRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/floor-plan-upload', floorPlanUploadRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/qc', qcRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/ingestion-history', ingestionHistoryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    correlationId: req.correlationId
  });
});

// Global error handler with structured error response
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    correlationId: req.correlationId,
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  }));

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.expose ? err.message : 'Internal Server Error',
    code: err.code || 'INTERNAL_ERROR',
    correlationId: req.correlationId
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AromaSys Backend running on http://localhost:${PORT}`);
});
