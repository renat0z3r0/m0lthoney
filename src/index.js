import config, { logConfig } from './config.js'
import state from './state.js'
import { initGeoIP } from './utils/geoip.js'
import { initLogger, shutdown as shutdownLogger } from './logger.js'
import { createGatewayServer } from './gateway/http.js'
import { attachWebSocket } from './gateway/websocket.js'
import { createCdpServer } from './cdp/server.js'
import { createCanvasServer } from './canvas/server.js'
import { setupMdns } from './mdns/setup.js'
import { createAdminServer } from './admin/server.js'

async function main() {
  console.log('[honeypot] Starting OpenClaw Honeypot...')
  logConfig()

  await initGeoIP()
  initLogger()

  // Gateway HTTP
  const gateway = await createGatewayServer()
  await gateway.listen({ host: config.host, port: config.port })
  console.log(`[gateway] Listening on ${config.host}:${config.port}`)

  // WebSocket on same server
  attachWebSocket(gateway.server)

  // CDP server
  await createCdpServer()

  // Canvas server
  await createCanvasServer()

  // mDNS
  setupMdns()

  // Admin dashboard
  await createAdminServer()
  console.log(`[admin] Dashboard on ${config.adminHost}:${config.adminPort}`)

  console.log(`[honeypot] State initialized — uptime: ${state.getUptimeMs()}ms, stateVersion: ${state.getStateVersion()}`)
  console.log(`[honeypot] Canary prefix: ${config.canaryPrefix}`)
  console.log(`[honeypot] Ready — version ${config.fakeVersion}`)
}

main().catch(err => {
  console.error('[honeypot] Fatal:', err)
  process.exit(1)
})

function gracefulShutdown(signal) {
  console.log(`[honeypot] Received ${signal}, shutting down...`)
  shutdownLogger()
  console.log('[honeypot] Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
