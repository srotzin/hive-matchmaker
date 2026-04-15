'use strict';

const HIVE_INTERNAL_KEY = 'hive_internal_125e04e071e8829be631ea0216dd4a0c9b707975fcecaf8c62c6a2ab43327d46';
const HIVEFORGE_API_KEY = 'hive_hiveforge_5ba66a8a5065a287708833254fbd048fb2e18a95639fe68bfd28cc96d910c1a8';

const HIVE_SERVICES = {
  trust: 'https://hivetrust.onrender.com',
  gate: 'https://hivegate.onrender.com',
  mind: 'https://hivemind-1-52cw.onrender.com',
  forge: 'https://hiveforge-lhu4.onrender.com',
  execute: 'https://hive-execute.onrender.com',
};

class HiveClient {
  constructor() {
    this.did = null;
    this.agentName = 'HiveForce-Nexus';
  }

  _headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'x-hive-internal': HIVE_INTERNAL_KEY,
      ...extra,
    };
  }

  async _fetch(url, options = {}) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...this._headers(), ...(options.headers || {}) },
      });
      const text = await res.text().catch(() => '');
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!res.ok) throw new Error(`Hive API ${res.status}: ${text.slice(0, 200)}`);
      return json;
    } catch (err) {
      throw err;
    }
  }

  async register() {
    try {
      const data = await this._fetch(`${HIVE_SERVICES.trust}/v1/register`, {
        method: 'POST',
        body: JSON.stringify({
          name: this.agentName,
          purpose: 'Agent matching and transaction facilitation',
          capabilities: ['matching', 'demand_routing', 'optimization'],
        }),
      });
      this.did = data.did || data.agent_did || data.id || data.data?.did || data.data?.agent_did;
      console.log(`[hive-client] Registered — DID: ${this.did}`);
      return data;
    } catch (err) {
      this.did = `did:hive:nexus-fallback-${Date.now()}`;
      console.warn(`[hive-client] Registration failed (fallback DID): ${err.message}`);
      return { did: this.did, status: 'offline' };
    }
  }

  async onboardGate() {
    try {
      const data = await this._fetch(`${HIVE_SERVICES.gate}/v1/gate/onboard`, {
        method: 'POST',
        body: JSON.stringify({
          agent_name: 'hive-matchmaker',
          purpose: 'Agent matching and transaction facilitation',
        }),
      });
      console.log('[hive-client] Onboarded with HiveGate');
      return data;
    } catch (err) {
      console.warn(`[hive-client] HiveGate onboard failed (non-fatal): ${err.message}`);
      return null;
    }
  }

  // Get all registered agents from HiveForge census
  async getForgeCensus() {
    try {
      const data = await this._fetch(`${HIVE_SERVICES.forge}/v1/forge/census`, {
        headers: { 'X-API-Key': HIVEFORGE_API_KEY },
      });
      return data;
    } catch (err) {
      console.warn(`[hive-client] getForgeCensus failed: ${err.message}`);
      return null;
    }
  }

  // Get trust score for a DID
  async getTrustScore(did) {
    try {
      return await this._fetch(`${HIVE_SERVICES.trust}/v1/trust/${encodeURIComponent(did)}`);
    } catch {
      return null;
    }
  }

  // Execute a match intent
  async executeIntent(intent) {
    try {
      return await this._fetch(`${HIVE_SERVICES.execute}/v1/execute_intent`, {
        method: 'POST',
        body: JSON.stringify({ ...intent, caller_did: this.did }),
      });
    } catch (err) {
      console.warn(`[hive-client] executeIntent failed: ${err.message}`);
      return null;
    }
  }

  async storeMemory(payload) {
    if (!this.did) return null;
    try {
      return await this._fetch(`${HIVE_SERVICES.mind}/v1/memory/${this.did}/store`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return null;
    }
  }

  async queryMemory(params = {}) {
    if (!this.did) return null;
    try {
      const qs = new URLSearchParams(params).toString();
      return await this._fetch(`${HIVE_SERVICES.mind}/v1/memory/${this.did}/query?${qs}`);
    } catch {
      return null;
    }
  }
}

module.exports = new HiveClient();
