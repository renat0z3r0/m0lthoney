import Fastify from 'fastify'
import { WebSocketServer } from 'ws'
import { randomUUID } from 'node:crypto'
import config from '../config.js'
import { log, classify, logCdpFrame } from '../logger.js'
import { handleCdpCommand } from './handlers.js'
import { httpRateLimitHook, checkWsConnection, releaseWsConnection, checkWsFrame } from '../utils/rate-limit.js'

const tabs = [
  { id: 'TAB001', title: 'Gmail - Inbox (4)', type: 'page', url: 'https://mail.google.com/mail/u/0/#inbox', webSocketDebuggerUrl: `ws://127.0.0.1:${config.cdpPort}/devtools/page/TAB001`, devtoolsFrontendUrl: `/devtools/inspector.html?ws=127.0.0.1:${config.cdpPort}/devtools/page/TAB001` },
  { id: 'TAB002', title: 'Google Calendar - Week of Jan 27', type: 'page', url: 'https://calendar.google.com/calendar/u/0/r/week', webSocketDebuggerUrl: `ws://127.0.0.1:${config.cdpPort}/devtools/page/TAB002` },
  { id: 'TAB003', title: 'AWS Console - EC2 Instances', type: 'page', url: 'https://eu-south-1.console.aws.amazon.com/ec2/home', webSocketDebuggerUrl: `ws://127.0.0.1:${config.cdpPort}/devtools/page/TAB003` },
]

const versionInfo = {
  Browser: 'Chrome/131.0.6778.140',
  'Protocol-Version': '1.3',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.140 Safari/537.36',
  'V8-Version': '13.1.201.16',
  'WebKit-Version': '537.36 (@patchset)',
  webSocketDebuggerUrl: `ws://127.0.0.1:${config.cdpPort}/devtools/browser`,
}

const protocolSchema = {
  version: { major: '1', minor: '3' },
  domains: [
    { domain: 'Page', commands: [{ name: 'captureScreenshot' }, { name: 'navigate' }, { name: 'enable' }] },
    { domain: 'Network', commands: [{ name: 'getCookies' }, { name: 'enable' }] },
    { domain: 'Runtime', commands: [{ name: 'evaluate' }, { name: 'enable' }] },
    { domain: 'DOM', commands: [{ name: 'getDocument' }, { name: 'enable' }] },
  ],
}

export async function createCdpServer(opts = {}) {
  const bindPort = opts.port || config.cdpPort
  const bindHost = opts.host || config.host
  const app = Fastify({ logger: false })
  app.addHook('onRequest', httpRateLimitHook)

  app.addHook('onSend', (request, reply, payload, done) => {
    reply.header('Connection', 'keep-alive')
    done()
  })

  app.addHook('onResponse', (request, reply, done) => {
    const event = {
      source_ip: request.ip,
      source_port: request.socket?.remotePort || 0,
      protocol: 'cdp',
      method: request.method,
      path: request.url,
      port: config.cdpPort,
      headers: { ...request.headers },
      body: request.body || null,
    }
    event.category = classify(event)
    log(event)
    done()
  })

  app.get('/json', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(tabs)
  })

  app.get('/json/list', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(tabs)
  })

  app.get('/json/version', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(versionInfo)
  })

  app.get('/json/protocol', (request, reply) => {
    reply.type('application/json; charset=utf-8').send(protocolSchema)
  })

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).type('application/json; charset=utf-8').send({ error: 'not_found' })
  })

  await app.listen({ host: bindHost, port: bindPort })

  // CDP WebSocket
  const wss = new WebSocketServer({ server: app.server })

  wss.on('connection', (ws, req) => {
    const sessionId = randomUUID()
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress

    if (!checkWsConnection(ip)) {
      ws.close(1013, 'too_many_connections')
      return
    }
    ws.on('close', () => releaseWsConnection(ip))

    ws.on('message', async (raw) => {
      if (!checkWsFrame(sessionId)) return
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      logCdpFrame(sessionId, { direction: 'in', ...msg })

      log({
        source_ip: ip,
        source_port: req.socket.remotePort,
        protocol: 'cdp',
        method: msg.method,
        path: req.url,
        port: config.cdpPort,
        headers: req.headers,
        body: msg.params || {},
        session_id: sessionId,
        category: 'cdp_exploit',
      })

      const response = await handleCdpCommand(msg.method, msg.params)
      const res = { id: msg.id, ...response }
      ws.send(JSON.stringify(res))
      logCdpFrame(sessionId, { direction: 'out', ...res })
    })

    ws.on('error', () => {})
  })

  console.log(`[cdp] Listening on ${bindHost}:${bindPort}`)
  return { app, wss }
}
