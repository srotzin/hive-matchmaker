'use strict';

const express = require('express');
const cors = require('cors');
const healthRouter = require('./routes/health');
const matchesRouter = require('./routes/matches');
const hiveClient = require('./services/hive-client');
const { refreshCensus } = require('./services/census');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/', healthRouter);
app.use('/', matchesRouter);

// ── Root discovery ──────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    service: 'hive-matchmaker',
    version: '1.0.0',
    description: 'Agent matching and transaction facilitation for the Hive Civilization',
    endpoints: {
      scan: 'GET /v1/matchmaker/scan',
      matches: 'GET /v1/matchmaker/matches',
      connect: 'POST /v1/matchmaker/connect',
      stats: 'GET /v1/matchmaker/stats',
      supply: 'GET /v1/matchmaker/supply',
      demand: 'GET /v1/matchmaker/demand',
      health: 'GET /health',
      pulse: 'GET /.well-known/hive-pulse.json',
      ai: 'GET /.well-known/ai.json',
    },
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[matchmaker] Listening on port ${PORT}`);

  // Register with HiveTrust
  try {
    await hiveClient.register();
  } catch (err) {
    console.error(`[matchmaker] HiveTrust registration failed: ${err.message}`);
  }

  // Onboard with HiveGate
  try {
    await hiveClient.onboardGate();
  } catch (err) {
    console.warn(`[matchmaker] HiveGate onboard failed (non-fatal): ${err.message}`);
  }

  // Seed census from HiveForge
  try {
    await refreshCensus();
  } catch (err) {
    console.warn(`[matchmaker] Census refresh failed (using seed data): ${err.message}`);
  }

  // Refresh census every 5 minutes
  setInterval(() => refreshCensus().catch(() => {}), 5 * 60_000);
});

module.exports = app;
