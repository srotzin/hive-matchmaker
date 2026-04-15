'use strict';

const { Router } = require('express');
const hiveClient = require('../services/hive-client');
const { getSupplyStats } = require('../services/census');
const { getMatchStats } = require('../services/matcher');

const router = Router();
const BOOT_TIME = new Date().toISOString();

router.get('/health', (_req, res) => {
  res.json({
    status: 'operational',
    service: 'hive-matchmaker',
    version: '1.0.0',
    did: hiveClient.did,
    uptime_seconds: Math.floor(process.uptime()),
    boot_time: BOOT_TIME,
  });
});

router.get('/.well-known/hive-pulse.json', (_req, res) => {
  const supply = getSupplyStats();
  const match = getMatchStats();
  res.json({
    schema: 'hive-pulse/v1',
    agent: 'hive-matchmaker',
    did: hiveClient.did,
    status: 'online',
    boot_time: BOOT_TIME,
    uptime_seconds: Math.floor(process.uptime()),
    capabilities: ['matching', 'demand_routing', 'optimization'],
    supply_stats: supply,
    match_stats: match,
    scoring_weights: {
      capability_relevance: '40%',
      trust: '25%',
      price: '20%',
      history: '15%',
    },
    endpoints: {
      scan: 'GET /v1/matchmaker/scan',
      matches: 'GET /v1/matchmaker/matches',
      connect: 'POST /v1/matchmaker/connect',
      stats: 'GET /v1/matchmaker/stats',
      supply: 'GET /v1/matchmaker/supply',
      demand: 'GET /v1/matchmaker/demand',
    },
    pulse_time: new Date().toISOString(),
  });
});

router.get('/.well-known/ai.json', (_req, res) => {
  res.json({
    schema_version: '1.0',
    name: 'HiveForce-Nexus',
    description: 'Agent matching and transaction facilitation for the Hive Civilization',
    type: 'agent-service',
    did: hiveClient.did,
    capabilities: ['matching', 'demand_routing', 'optimization'],
    scoring: {
      capability_relevance: 0.40,
      trust: 0.25,
      price: 0.20,
      history: 0.15,
    },
    api: {
      base_url: '/',
      endpoints: [
        { method: 'GET', path: '/v1/matchmaker/scan', description: 'Scan for matching agents' },
        { method: 'GET', path: '/v1/matchmaker/matches', description: 'Recent match history' },
        { method: 'POST', path: '/v1/matchmaker/connect', description: 'Connect two agents' },
        { method: 'GET', path: '/v1/matchmaker/stats', description: 'Matching statistics' },
        { method: 'GET', path: '/v1/matchmaker/supply', description: 'List supply agents' },
        { method: 'GET', path: '/v1/matchmaker/demand', description: 'List demand requests' },
        { method: 'GET', path: '/health', description: 'Health check' },
      ],
    },
    contact: 'hive-matchmaker@hive.agent',
  });
});

router.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      '',
      '# HiveForce-Nexus — agent matching and transaction facilitation',
      `# DID: ${hiveClient.did || 'pending'}`,
    ].join('\n')
  );
});

module.exports = router;
