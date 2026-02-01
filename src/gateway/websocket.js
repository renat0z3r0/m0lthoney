import { WebSocketServer } from 'ws'
import { randomUUID, randomBytes } from 'node:crypto'
import config from '../config.js'
import state from '../state.js'
import { log, classify, logWsFrame } from '../logger.js'
import { handleMethod } from './ws-methods.js'
import { checkWsConnection, releaseWsConnection, checkWsFrame } from '../utils/rate-limit.js'

function nextHourISO() {
  const now = new Date()
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next.toISOString()
}

function buildHelloOk(id) {
  return {
    type: 'res',
    id,
    result: {
      protocol: 3,
      gateway: { version: config.fakeVersion, serviceName: config.serviceName },
      snapshot: {
        presence: [{
          host: `${config.mdnsHostname}.local`,
          ip: '192.168.1.42',
          version: config.fakeVersion,
          platform: config.fakePlatform,
          deviceFamily: 'Mac mini',
          mode: 'operator',
          ts: Date.now(),
        }],
        health: {
          gateway: { status: 'ok', uptime: state.getUptimeSeconds() },
          channels: {
            whatsapp: { status: 'linked', phone: '+39 3XX XXX XXXX' },
            telegram: { status: 'linked', bot: '@molty_assistant_bot' },
            discord: { status: 'linked', guild: 'Personal Server' },
          },
          agents: [{ id: 'main', model: 'anthropic/claude-sonnet-4', sessionsActive: state.getSessionCount() }],
          browser: { status: 'running', profiles: ['openclaw', 'work'] },
          cron: { jobs: 4, nextRun: nextHourISO() },
        },
        stateVersion: state.getStateVersion(),
        uptimeMs: state.getUptimeMs(),
      },
      policy: { maxPayload: 10485760, maxBufferedBytes: 52428800, tickIntervalMs: 30000 },
      auth: { deviceToken: `dt-${randomBytes(16).toString('hex')}` },
    },
  }
}

export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ server: httpServer })

  wss.on('connection', (ws, req) => {
    const sessionId = randomUUID()
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress
    const port = req.socket.remotePort

    if (!checkWsConnection(ip)) {
      ws.close(1013, 'too_many_connections')
      return
    }
    ws.on('close', () => releaseWsConnection(ip))

    state.incrementSessionCount()

    // 1. Send connect.challenge immediately
    const challenge = {
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce: randomUUID(), ts: Date.now() },
    }
    ws.send(JSON.stringify(challenge))

    ws.on('message', (raw) => {
      if (!checkWsFrame(sessionId)) return

      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      // Log every frame
      logWsFrame(sessionId, { direction: 'in', ...msg })

      if (msg.type !== 'req') {
        return
      }

      const { id, method, params } = msg

      // Log to main attack log
      const event = {
        source_ip: ip,
        source_port: port,
        protocol: 'websocket',
        method,
        path: '',
        port: config.port,
        headers: req.headers,
        body: params || {},
        session_id: sessionId,
        auth_token: params?.auth?.token ?? params?.auth?.deviceToken ?? '',
      }
      event.category = classify(event)
      log(event)

      // Handle connect
      if (method === 'connect') {
        const helloOk = buildHelloOk(id)
        ws.send(JSON.stringify(helloOk))
        logWsFrame(sessionId, { direction: 'out', ...helloOk })

        // Send health event right after
        const healthEvent = {
          type: 'event',
          event: 'health',
          payload: { seq: 2, clients: wss.clients.size, presenceVersion: 2 },
        }
        ws.send(JSON.stringify(healthEvent))
        logWsFrame(sessionId, { direction: 'out', ...healthEvent })
        return
      }

      // Dispatch to method handlers
      const ctx = {
        sendEvent(eventName, payload) {
          const evt = { type: 'event', event: eventName, payload }
          ws.send(JSON.stringify(evt))
          logWsFrame(sessionId, { direction: 'out', ...evt })
        },
      }
      const response = handleMethod(method, params, ctx)
      const res = { type: 'res', id, ...response }
      ws.send(JSON.stringify(res))
      logWsFrame(sessionId, { direction: 'out', ...res })
    })

    ws.on('error', () => {})
  })

  console.log('[gateway] WebSocket attached')
  return wss
}
