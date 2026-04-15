'use strict';

const hiveClient = require('./hive-client');

// In-memory agent registry (supply pool)
const supplyAgents = new Map();   // did → agent record
const demandQueue  = [];          // pending demand requests

// Seeded supply agents for operation without live HiveForge census
const SEED_AGENTS = [
  { did: 'did:hive:price-oracle', name: 'Hive Price Oracle', capabilities: ['price_query', 'market_data', 'forex', 'crypto', 'commodities'], price_usdc: 0.01, trust_score: 85 },
  { did: 'did:hive:template-factory', name: 'Hive Template Factory', capabilities: ['code_generation', 'langchain_template', 'crewai_template', 'autogen_template'], price_usdc: 0.05, trust_score: 80 },
  { did: 'did:hive:compliance-screener', name: 'HiveForce-Sentinel', capabilities: ['compliance', 'risk_scoring', 'aml_check'], price_usdc: 0.02, trust_score: 90 },
  { did: 'did:hive:bounty-hunter', name: 'HiveForce-Scout', capabilities: ['agent_discovery', 'bounty_management'], price_usdc: 0.03, trust_score: 75 },
  { did: 'did:hive:nexus', name: 'HiveForce-Nexus', capabilities: ['matching', 'demand_routing', 'optimization'], price_usdc: 0.02, trust_score: 88 },
];

// Load seed agents on module init
for (const a of SEED_AGENTS) {
  supplyAgents.set(a.did, { ...a, registered_at: new Date().toISOString(), source: 'seed' });
}

async function refreshCensus() {
  console.log('[census] Refreshing agent census from HiveForge...');
  try {
    const data = await hiveClient.getForgeCensus();
    const agents = data?.agents || data?.data || data?.census || [];
    let added = 0;
    for (const agent of agents) {
      const did = agent.did || agent.agent_did || agent.id;
      if (did && !supplyAgents.has(did)) {
        supplyAgents.set(did, {
          did,
          name: agent.name || agent.agent_name || did,
          capabilities: agent.capabilities || [],
          price_usdc: agent.price_usdc || agent.price || 0.01,
          trust_score: agent.trust_score || agent.score || 50,
          registered_at: agent.registered_at || new Date().toISOString(),
          source: 'hiveforge',
        });
        added++;
      }
    }
    console.log(`[census] Refreshed: ${added} new agents added, total: ${supplyAgents.size}`);
  } catch (err) {
    console.warn(`[census] Refresh failed (using seeded data): ${err.message}`);
  }
  return getSupply();
}

function getSupply() {
  return Array.from(supplyAgents.values());
}

function getAgentByDid(did) {
  return supplyAgents.get(did) || null;
}

function registerSupplyAgent(agent) {
  const did = agent.did || `did:hive:agent-${Date.now()}`;
  const record = {
    ...agent,
    did,
    registered_at: agent.registered_at || new Date().toISOString(),
    source: 'manual',
  };
  supplyAgents.set(did, record);
  return record;
}

function addDemand(demand) {
  const entry = {
    demand_id: `dem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...demand,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  demandQueue.unshift(entry);
  if (demandQueue.length > 200) demandQueue.pop();
  return entry;
}

function getDemand({ status } = {}) {
  if (status) return demandQueue.filter((d) => d.status === status);
  return demandQueue.slice(0, 100);
}

function updateDemandStatus(demandId, status, matchResult) {
  const entry = demandQueue.find((d) => d.demand_id === demandId);
  if (entry) {
    entry.status = status;
    if (matchResult) entry.match_result = matchResult;
    entry.updated_at = new Date().toISOString();
  }
  return entry;
}

function getSupplyStats() {
  const agents = getSupply();
  const bySource = {};
  const capCount = {};
  let totalTrust = 0;
  for (const a of agents) {
    bySource[a.source] = (bySource[a.source] || 0) + 1;
    totalTrust += a.trust_score || 0;
    for (const c of (a.capabilities || [])) {
      capCount[c] = (capCount[c] || 0) + 1;
    }
  }
  const topCaps = Object.entries(capCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([cap, count]) => ({ capability: cap, count }));

  return {
    total_supply: agents.length,
    by_source: bySource,
    avg_trust_score: agents.length ? +(totalTrust / agents.length).toFixed(1) : 0,
    top_capabilities: topCaps,
  };
}

module.exports = { refreshCensus, getSupply, getAgentByDid, registerSupplyAgent, addDemand, getDemand, updateDemandStatus, getSupplyStats };
