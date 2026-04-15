'use strict';

const { v4: uuidv4 } = require('uuid');
const { getSupply, addDemand, updateDemandStatus, getDemand } = require('./census');
const hiveClient = require('./hive-client');

// Scoring weights
const WEIGHTS = {
  capability_relevance: 0.40,
  trust:                0.25,
  price:                0.20,
  history:              0.15,
};

// In-memory match history
const matchHistory = [];

// In-memory interaction counts for history scoring
const interactionCounts = new Map(); // did → count

function _capabilityScore(agentCaps, requiredCaps) {
  if (!requiredCaps || requiredCaps.length === 0) return 0.5;
  const agentSet = new Set((agentCaps || []).map((c) => c.toLowerCase()));
  const required = requiredCaps.map((c) => c.toLowerCase());
  const matched = required.filter((c) => agentSet.has(c)).length;
  return matched / required.length;
}

function _trustScore(agent) {
  const score = agent.trust_score || 50;
  return Math.min(score / 100, 1.0);
}

function _priceScore(agent, maxBudget) {
  if (!maxBudget || maxBudget <= 0) return 0.5;
  const price = agent.price_usdc || 0.01;
  if (price > maxBudget) return 0; // over budget
  return 1.0 - (price / maxBudget) * 0.5; // cheaper = higher score (up to 1.0)
}

function _historyScore(agentDid) {
  const count = interactionCounts.get(agentDid) || 0;
  return Math.min(count / 10, 1.0); // saturates at 10 interactions
}

function scoreAgent(agent, { required_capabilities, max_budget_usdc }) {
  const capScore     = _capabilityScore(agent.capabilities, required_capabilities);
  const trustScore   = _trustScore(agent);
  const priceScore   = _priceScore(agent, max_budget_usdc);
  const historyScore = _historyScore(agent.did);

  const composite =
    WEIGHTS.capability_relevance * capScore +
    WEIGHTS.trust                * trustScore +
    WEIGHTS.price                * priceScore +
    WEIGHTS.history              * historyScore;

  return {
    composite: +composite.toFixed(4),
    breakdown: {
      capability_relevance: +capScore.toFixed(4),
      trust: +trustScore.toFixed(4),
      price: +priceScore.toFixed(4),
      history: +historyScore.toFixed(4),
    },
  };
}

function findMatches({ required_capabilities, max_budget_usdc, top_n = 5, exclude_dids = [] }) {
  const supply = getSupply();
  const excludeSet = new Set(exclude_dids || []);

  const scored = supply
    .filter((a) => !excludeSet.has(a.did))
    .map((agent) => ({
      ...agent,
      score: scoreAgent(agent, { required_capabilities, max_budget_usdc }),
    }))
    .filter((a) => a.score.composite > 0)
    .sort((a, b) => b.score.composite - a.score.composite)
    .slice(0, Math.min(Number(top_n) || 5, 20));

  return scored;
}

async function scanAndMatch(demandSpec) {
  const demand = addDemand(demandSpec);
  const matches = findMatches({
    required_capabilities: demandSpec.required_capabilities,
    max_budget_usdc: demandSpec.max_budget_usdc,
    top_n: demandSpec.top_n || 5,
    exclude_dids: demandSpec.exclude_dids,
  });

  const result = {
    match_id: `match_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
    demand_id: demand.demand_id,
    demand: demandSpec,
    matches,
    match_count: matches.length,
    top_match: matches[0] || null,
    weights_used: WEIGHTS,
    scored_at: new Date().toISOString(),
  };

  updateDemandStatus(demand.demand_id, 'matched', result);

  matchHistory.unshift({
    match_id: result.match_id,
    demand_id: demand.demand_id,
    match_count: matches.length,
    top_match_did: matches[0]?.did || null,
    top_score: matches[0]?.score?.composite || 0,
    scored_at: result.scored_at,
  });
  if (matchHistory.length > 500) matchHistory.pop();

  // Log to HiveMind
  hiveClient.storeMemory({
    type: 'match_result',
    match_id: result.match_id,
    match_count: matches.length,
    top_match: matches[0]?.did,
  }).catch(() => {});

  return result;
}

async function connectAgents(from_did, to_did, intent_description) {
  if (!from_did || !to_did) throw new Error('from_did and to_did are required');

  // Record interaction
  interactionCounts.set(to_did, (interactionCounts.get(to_did) || 0) + 1);
  interactionCounts.set(from_did, (interactionCounts.get(from_did) || 0) + 1);

  // Execute intent via HiveExecute
  let executeResult = null;
  try {
    executeResult = await hiveClient.executeIntent({
      from: from_did,
      to: to_did,
      intent: intent_description || 'agent_connection',
      type: 'match_connect',
    });
  } catch (err) {
    console.warn(`[matcher] executeIntent failed (non-fatal): ${err.message}`);
  }

  const connection = {
    connection_id: `conn_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
    from_did,
    to_did,
    intent: intent_description || 'agent_connection',
    execute_result: executeResult,
    connected_at: new Date().toISOString(),
  };

  hiveClient.storeMemory({ type: 'agent_connection', ...connection }).catch(() => {});
  return connection;
}

function getMatchHistory(limit = 50) {
  return matchHistory.slice(0, Math.min(Number(limit), 200));
}

function getMatchStats() {
  const total = matchHistory.length;
  const avgScore = total
    ? +(matchHistory.reduce((s, m) => s + (m.top_score || 0), 0) / total).toFixed(4)
    : 0;
  return {
    total_matches: total,
    avg_top_score: avgScore,
    weights: WEIGHTS,
    pending_demand: getDemand({ status: 'pending' }).length,
    matched_demand: getDemand({ status: 'matched' }).length,
  };
}

module.exports = { findMatches, scanAndMatch, connectAgents, getMatchHistory, getMatchStats, scoreAgent };
