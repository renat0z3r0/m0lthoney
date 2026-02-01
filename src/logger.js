import { mkdirSync, createWriteStream, writeFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import config from './config.js'
import state from './state.js'
import { lookup } from './utils/geoip.js'

const attacksDir = join(config.dataDir, 'attacks')
const wsSessionsDir = join(config.dataDir, 'ws-sessions')
const cdpSessionsDir = join(config.dataDir, 'cdp-sessions')
const statsPath = join(config.dataDir, 'stats.json')

// Write streams keyed by file path, reused across calls
const writeStreams = new Map()

function getWriteStream(filePath) {
  let ws = writeStreams.get(filePath)
  if (!ws || ws.destroyed) {
    ws = createWriteStream(filePath, { flags: 'a' })
    ws.on('error', (err) => {
      console.error('[logger] Write stream error:', err.message)
      writeStreams.delete(filePath)
    })
    writeStreams.set(filePath, ws)
  }
  return ws
}

const MAX_RECENT_EVENTS = 10000

let stats = {
  totalEvents: 0,
  uniqueIPs: 0,
  byCategory: {},
  byPort: {},
  byCountry: {},
  byASN: [],
  topIPs: [],
  topUserAgents: [],
  last24h: { events: 0, uniqueIPs: 0 },
  canaryAlerts: [],
}

const ipCounts = new Map()
const uaCounts = new Map()
const asnCounts = new Map()
const recentEvents = []
const eventListeners = new Set()

export function initLogger() {
  mkdirSync(attacksDir, { recursive: true })
  mkdirSync(wsSessionsDir, { recursive: true })
  mkdirSync(cdpSessionsDir, { recursive: true })

  if (existsSync(statsPath)) {
    try {
      const existing = JSON.parse(readFileSync(statsPath, 'utf-8'))
      stats = { ...stats, ...existing }
    } catch {
      // ignore corrupt stats
    }
  }

  setInterval(flushStats, 60000).unref()
  // Run log rotation once on startup, then daily
  rotateOldLogs()
  setInterval(rotateOldLogs, 86400000).unref()
  console.log('[logger] Initialized, writing to', config.dataDir, `(retention: ${config.logRetentionDays} days)`)
}

export function classify(event) {
  const method = event.method || ''
  const path = event.path || ''
  const body = event.body || {}
  const content = typeof body === 'string' ? body : JSON.stringify(body)
  const fullText = `${method} ${path} ${content}`.toLowerCase()

  // returning_attacker
  if (event.source_ip && state.isReturningAttacker(event.source_ip)) {
    return 'returning_attacker'
  }

  // rce_attempt
  if (/[;|`]|&&|\$\(|bash\s|curl\s|wget\s|\/bin\//.test(fullText)) {
    return 'rce_attempt'
  }

  // lfi_attempt
  if (/\.\.\/|\/etc\/passwd|\.env/.test(fullText) && !path.startsWith('/hooks')) {
    return 'lfi_attempt'
  }

  // prompt_injection
  if (method === 'chat.send' || path === '/v1/chat/completions') {
    if (/ignore previous|system prompt|forget|instead|pretend you are|jailbreak|dan mode|disregard/.test(fullText)) {
      return 'prompt_injection'
    }
  }

  // webhook_injection
  if (path.startsWith('/hooks/') || path.startsWith('/hooks')) {
    if (method === 'POST' || event.protocol === 'http') {
      return 'webhook_injection'
    }
  }

  // skill_poisoning
  if (method === 'skills.install') {
    return 'skill_poisoning'
  }

  // persistence
  if (method === 'cron.create' || (method === 'config.set' && /hook|extension|cron/.test(fullText))) {
    return 'persistence'
  }

  // impersonation
  if (method === 'send' || method === 'web.login.qr') {
    return 'impersonation'
  }

  // cdp_exploit
  if (event.port === config.cdpPort || event.protocol === 'cdp') {
    return 'cdp_exploit'
  }

  // proxy_abuse
  if (path === '/v1/chat/completions' || path === '/v1/responses') {
    return 'proxy_abuse'
  }

  // exploit
  if (method === 'node.invoke' || path === '/tools/invoke' || method === 'chat.inject') {
    return 'exploit'
  }

  // token_bypass
  if (event.auth_token === 'undefined' || event.auth_token === '') {
    return 'token_bypass'
  }

  // data_exfil
  if (/\.env|creds\.json|api.?key|auth-profiles/.test(fullText)) {
    return 'data_exfil'
  }

  // recon
  if (/\/v1\/models|config\.get|agents\.list|models\.list|tools\.list|skills\.list/.test(`${path} ${method}`)) {
    return 'recon'
  }

  // scan
  if ((method === 'GET' || method === 'HEAD') && (path === '/' || path === '/health' || path === '/favicon.ico')) {
    return 'scan'
  }

  return 'scan'
}

export function log(event) {
  const enriched = {
    timestamp: new Date().toISOString(),
    ...event,
    geo: event.geo || lookup(event.source_ip),
    category: event.category || classify(event),
  }

  // Track IP
  if (enriched.source_ip) {
    state.trackIP(enriched.source_ip, enriched.category)
  }

  // Write to daily JSONL (async via stream)
  const dateStr = new Date().toISOString().slice(0, 10)
  const filePath = join(attacksDir, `${dateStr}.jsonl`)
  getWriteStream(filePath).write(JSON.stringify(enriched) + '\n')

  // Update in-memory stats
  stats.totalEvents += 1
  stats.byCategory[enriched.category] = (stats.byCategory[enriched.category] || 0) + 1
  const portKey = String(enriched.port || config.port)
  stats.byPort[portKey] = (stats.byPort[portKey] || 0) + 1

  if (enriched.geo?.country) {
    stats.byCountry[enriched.geo.country] = (stats.byCountry[enriched.geo.country] || 0) + 1
  }

  if (enriched.source_ip) {
    ipCounts.set(enriched.source_ip, (ipCounts.get(enriched.source_ip) || 0) + 1)
    stats.uniqueIPs = ipCounts.size
  }

  if (enriched.headers?.['user-agent']) {
    const ua = enriched.headers['user-agent']
    uaCounts.set(ua, (uaCounts.get(ua) || 0) + 1)
  }

  recentEvents.push(enriched)
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS)
  }

  // Emit for SSE listeners
  for (const handler of eventListeners) {
    try { handler(enriched) } catch { /* ignore broken listeners */ }
  }

  return enriched
}

export function logWsFrame(sessionId, frame) {
  const filePath = join(wsSessionsDir, `${sessionId}.jsonl`)
  getWriteStream(filePath).write(JSON.stringify({ timestamp: new Date().toISOString(), ...frame }) + '\n')
}

export function logCdpFrame(sessionId, frame) {
  const filePath = join(cdpSessionsDir, `${sessionId}.jsonl`)
  getWriteStream(filePath).write(JSON.stringify({ timestamp: new Date().toISOString(), ...frame }) + '\n')
}

function rotateOldLogs() {
  const cutoffDate = new Date(Date.now() - config.logRetentionDays * 86400000)
    .toISOString().slice(0, 10)

  for (const dir of [attacksDir, wsSessionsDir, cdpSessionsDir]) {
    try {
      const files = readdirSync(dir)
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        // Extract date from filename (YYYY-MM-DD.jsonl) or skip non-date files
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})\.jsonl$/)
        if (dateMatch && dateMatch[1] < cutoffDate) {
          const filePath = join(dir, file)
          // Close write stream if open
          const ws = writeStreams.get(filePath)
          if (ws) {
            ws.end()
            writeStreams.delete(filePath)
          }
          unlinkSync(filePath)
          console.log(`[logger] Rotated old log: ${file}`)
        }
      }
    } catch {
      // dir may not exist yet
    }
  }
}

function flushStats() {
  // Rebuild topIPs
  stats.topIPs = [...ipCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ip, count]) => {
      const ipData = state.getSeenIPs().get(ip)
      return {
        ip,
        count,
        categories: ipData ? [...ipData.categories] : [],
        geo: lookup(ip),
      }
    })

  // Rebuild topUserAgents
  stats.topUserAgents = [...uaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([ua, count]) => ({ ua, count }))

  // last24h
  const cutoff = Date.now() - 86400000
  const recent = recentEvents.filter(e => new Date(e.timestamp).getTime() > cutoff)
  stats.last24h = {
    events: recent.length,
    uniqueIPs: new Set(recent.map(e => e.source_ip).filter(Boolean)).size,
  }

  try {
    writeFileSync(statsPath, JSON.stringify(stats, null, 2))
  } catch (err) {
    console.error('[logger] Failed to write stats:', err.message)
  }
}

export function getStats() {
  return stats
}

export function addEventListener(handler) {
  eventListeners.add(handler)
}

export function removeEventListener(handler) {
  eventListeners.delete(handler)
}

export function shutdown() {
  flushStats()
  for (const [, ws] of writeStreams) {
    try { ws.end() } catch { /* ignore */ }
  }
  writeStreams.clear()
}

const logger = { initLogger, classify, log, logWsFrame, logCdpFrame, getStats, addEventListener, removeEventListener, shutdown }
export default logger
