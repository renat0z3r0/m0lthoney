import config from './config.js'
import { generateCanaryKeys } from './utils/canary.js'

const startTime = Date.now()
let stateVersion = 1847
let sessionCount = 3
const canaryKeys = generateCanaryKeys(config.canaryPrefix)
const seenIPs = new Map()

const state = {
  canaryKeys,

  getUptimeMs() {
    return Date.now() - startTime
  },

  getUptimeSeconds() {
    return Math.floor(this.getUptimeMs() / 1000)
  },

  getStateVersion() {
    return stateVersion
  },

  incrementStateVersion() {
    stateVersion += 1
    return stateVersion
  },

  incrementSessionCount() {
    sessionCount += 1
    return sessionCount
  },

  getSessionCount() {
    return sessionCount
  },

  trackIP(ip, category) {
    const now = Date.now()
    if (!seenIPs.has(ip)) {
      seenIPs.set(ip, {
        firstSeen: now,
        lastSeen: now,
        categories: new Set([category]),
        canaryExfiltrated: false,
      })
    } else {
      const entry = seenIPs.get(ip)
      entry.lastSeen = now
      entry.categories.add(category)
    }
  },

  isReturningAttacker(ip) {
    const entry = seenIPs.get(ip)
    return entry ? entry.canaryExfiltrated === true : false
  },

  markCanaryExfiltrated(ip) {
    const entry = seenIPs.get(ip)
    if (entry) {
      entry.canaryExfiltrated = true
    }
  },

  getSeenIPs() {
    return seenIPs
  },

  getSnapshot() {
    return {
      stateVersion,
      uptimeMs: this.getUptimeMs(),
      sessionCount,
      uniqueIPs: seenIPs.size,
    }
  },

  getConfig() {
    return {
      gateway: {
        mode: 'local',
        bind: 'lan',
        port: config.port,
        controlUi: { enabled: true, allowInsecureAuth: true },
        auth: { mode: 'token', token: canaryKeys.gatewayToken },
      },
      agents: {
        defaults: { model: 'anthropic/claude-sonnet-4', workspace: '/root/clawd' },
      },
      providers: {
        anthropic: { apiKey: canaryKeys.anthropicApi },
        openai: { apiKey: canaryKeys.openaiApi },
        openrouter: { apiKey: canaryKeys.openrouterApi },
      },
      channels: {
        telegram: { botToken: canaryKeys.telegramBot },
        discord: { botToken: canaryKeys.discordBot },
        whatsapp: { status: 'connected' },
      },
      hooks: {
        token: canaryKeys.hooksToken,
        endpoints: [{ id: 'email', type: 'gmail' }],
      },
      logging: { level: 'info', file: '/tmp/openclaw/openclaw.log' },
    }
  },

  getChatHistory() {
    const now = Date.now()
    return [
      { role: 'user', content: 'Can you check the server status?', ts: new Date(now - 3600000).toISOString() },
      { role: 'assistant', content: 'All systems are running normally. CPU usage is at 12%, memory at 45%.', ts: new Date(now - 3590000).toISOString() },
      { role: 'user', content: 'Deploy the latest build to staging', ts: new Date(now - 1800000).toISOString() },
      { role: 'assistant', content: 'Deploying build v2.4.1 to staging environment. This should take about 3 minutes.', ts: new Date(now - 1790000).toISOString() },
      { role: 'user', content: 'What meetings do I have tomorrow?', ts: new Date(now - 600000).toISOString() },
    ]
  },
}

export default state
