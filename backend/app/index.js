'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health', require('./api/routes_health'));
app.use('/api/auth', require('./api/routes_auth'));
app.use('/api/chat', require('./api/routes_chat'));
app.use('/api/bias', require('./api/routes_bias'));
app.use('/api/dashboard', require('./api/routes_dashboard'));
app.use('/api/logs', require('./api/routes_logs'));
app.use('/api/retrain', require('./api/routes_retrain'));

// ── Static Files ──────────────────────────────────────────────────────────────
const possiblePaths = [
  path.join(process.cwd(), 'frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, '../../frontend/dist')
];
const finalDistPath = possiblePaths.find(p => require('fs').existsSync(p)) || possiblePaths[0];

console.log(`[Static] Final path: ${finalDistPath}`);
app.use(express.static(finalDistPath));

// ── SPA Catch-all ─────────────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  
  const indexPath = path.join(finalDistPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  
  // Failsafe: if we are in production and frontend is missing, don't 500
  res.status(404).send('Frontend assets not found. API is running.');
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' });
});

// ── Error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`✓ Backend running on http://localhost:${config.port}`);
  console.log(`✓ Environment: ${config.nodeEnv}`);
  console.log(`✓ Bias detector: ${config.biasDetectorUrl}`);
});

module.exports = app;
