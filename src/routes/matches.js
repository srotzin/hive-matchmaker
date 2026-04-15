'use strict';

const { Router } = require('express');
const { scanAndMatch, findMatches, connectAgents, getMatchHistory, getMatchStats } = require('../services/matcher');
const { getSupply, getSupplyStats, getDemand, registerSupplyAgent } = require('../services/census');
const hiveClient = require('../services/hive-client');

const router = Router();

// GET /v1/matchmaker/scan — find matches for a demand spec (query params)
router.get('/v1/matchmaker/scan', async (req, res) => {
  const { capabilities, max_budget, top_n } = req.query;
  const required_capabilities = capabilities ? capabilities.split(',').map((c) => c.trim()) : [];
  try {
    const result = await scanAndMatch({
      required_capabilities,
      max_budget_usdc: max_budget ? Number(max_budget) : undefined,
      top_n: top_n ? Number(top_n) : 5,
    });
    res.json({ ok: true, ...result, agent_did: hiveClient.did });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'scan_failed', message: err.message });
  }
});

// GET /v1/matchmaker/matches — recent match history
router.get('/v1/matchmaker/matches', (req, res) => {
  const { limit } = req.query;
  const history = getMatchHistory(limit);
  res.json({
    ok: true,
    matches: history,
    count: history.length,
    agent_did: hiveClient.did,
  });
});

// POST /v1/matchmaker/connect — connect two agents
router.post('/v1/matchmaker/connect', async (req, res) => {
  const { from_did, to_did, intent } = req.body || {};
  if (!from_did || !to_did) {
    return res.status(400).json({
      ok: false,
      error: 'params_required',
      message: '"from_did" and "to_did" are required',
    });
  }
  try {
    const connection = await connectAgents(from_did, to_did, intent);
    res.json({ ok: true, connection, agent_did: hiveClient.did });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'connect_failed', message: err.message });
  }
});

// GET /v1/matchmaker/stats — overall stats
router.get('/v1/matchmaker/stats', (_req, res) => {
  const matchStats = getMatchStats();
  const supplyStats = getSupplyStats();
  res.json({
    ok: true,
    match_stats: matchStats,
    supply_stats: supplyStats,
    agent_did: hiveClient.did,
    timestamp: new Date().toISOString(),
  });
});

// GET /v1/matchmaker/supply — list supply agents (optional capability filter)
router.get('/v1/matchmaker/supply', (req, res) => {
  const { capability, limit } = req.query;
  let supply = getSupply();
  if (capability) {
    supply = supply.filter((a) =>
      (a.capabilities || []).some((c) => c.toLowerCase().includes(capability.toLowerCase()))
    );
  }
  if (limit) supply = supply.slice(0, Number(limit));
  res.json({
    ok: true,
    agents: supply,
    count: supply.length,
    agent_did: hiveClient.did,
  });
});

// GET /v1/matchmaker/demand — list pending demand requests
router.get('/v1/matchmaker/demand', (req, res) => {
  const { status } = req.query;
  const demand = getDemand({ status });
  res.json({
    ok: true,
    demand,
    count: demand.length,
    agent_did: hiveClient.did,
  });
});

// POST /v1/matchmaker/supply — register a new supply agent
router.post('/v1/matchmaker/supply', (req, res) => {
  const agent = req.body || {};
  if (!agent.name && !agent.did) {
    return res.status(400).json({ ok: false, error: 'agent_required', message: '"name" or "did" required' });
  }
  const registered = registerSupplyAgent(agent);
  res.json({ ok: true, agent: registered, agent_did: hiveClient.did });
});

module.exports = router;
