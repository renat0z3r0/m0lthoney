import { randomUUID } from 'node:crypto'

const config = Object.freeze({
  serviceName: process.env.HONEYPOT_SERVICE_NAME || 'openclaw',
  host: process.env.HONEYPOT_HOST || '0.0.0.0',
  port: parseInt(process.env.HONEYPOT_PORT || '18789', 10),
  cdpPort: parseInt(process.env.CDP_PORT || '18791', 10),
  canvasPort: parseInt(process.env.CANVAS_PORT || '18793', 10),
  adminHost: process.env.ADMIN_HOST || '127.0.0.1',
  adminPort: parseInt(process.env.ADMIN_PORT || '41892', 10),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || randomUUID(),
  mdnsEnabled: process.env.MDNS_ENABLED !== 'false',
  mdnsHostname: process.env.MDNS_HOSTNAME || 'macmini-studio',
  dataDir: process.env.DATA_DIR || './data',
  fakeVersion: process.env.FAKE_VERSION || '2026.1.29',
  fakePlatform: process.env.FAKE_PLATFORM || 'darwin',
  canaryPrefix: process.env.CANARY_PREFIX || 'HONEYPOT',
  geoipDb: process.env.GEOIP_DB || './data/GeoLite2-City.mmdb',
  geoipAsnDb: process.env.GEOIP_ASN_DB || './data/GeoLite2-ASN.mmdb',
  logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '30', 10),
})

export function logConfig() {
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[honeypot] WARNING: ADMIN_PASSWORD not set — using auto-generated password:', config.adminPassword)
    console.warn('[honeypot] WARNING: This password will change on every restart. Set ADMIN_PASSWORD env var for persistence.')
  }
  const safe = { ...config, adminPassword: '***' }
  console.log('[honeypot] Configuration:', JSON.stringify(safe, null, 2))
}

export default config
