import Fastify from 'fastify'
import { randomBytes } from 'node:crypto'
import config from '../config.js'
import state from '../state.js'
import { log, classify } from '../logger.js'
import { delay, llmDelay, lsDate } from '../utils/timing.js'
import { buildNonStreamingResponse, streamResponse } from './streaming.js'
import { httpRateLimitHook } from '../utils/rate-limit.js'

function getControlHtml() {
  const name = config.serviceName
  const titleMap = { openclaw: 'OpenClaw', moltbot: 'Moltbot Control', clawdbot: 'Clawdbot Control' }
  const idMap = { openclaw: 'openclaw-app', moltbot: 'moltbot-app', clawdbot: 'clawdbot-app' }
  const title = titleMap[name] || 'OpenClaw'
  const appId = idMap[name] || 'openclaw-app'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/index-DEPfFcOb.css" />
</head>
<body>
  <div id="${appId}" class="${appId}"></div>
  <script type="module" src="/assets/index-Cl-Y9zqE.js"></script>
</body>
</html>`
}

const JS_STUB = `// OpenClaw Control UI - stub\nconsole.log('[openclaw] loading control ui...');\n`

const CSS_STUB = `*{margin:0;padding:0;box-sizing:border-box}body{background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}#openclaw-app,#moltbot-app,#clawdbot-app{display:flex;align-items:center;justify-content:center;min-height:100vh}.loading{color:#58a6ff;font-size:1.2rem}\n`

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Device Pairing</title></head>
<body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div style="text-align:center">
<h2>Device Pairing</h2>
<p>Enter the pairing code displayed on your device</p>
<form><input type="text" placeholder="XXXX-XXXX" style="padding:8px;font-size:1.2rem;background:#161b22;border:1px solid #30363d;color:#c9d1d9;border-radius:4px"><br><br>
<button type="submit" style="padding:8px 24px;background:#238636;color:#fff;border:none;border-radius:4px;cursor:pointer">Pair</button></form>
</div></body></html>`

export async function createGatewayServer() {
  const app = Fastify({ logger: false })

  // Rate limiting
  app.addHook('onRequest', httpRateLimitHook)

  // Remove x-powered-by (Fastify doesn't add Server header by default)
  // Global hooks for headers + logging
  app.addHook('onSend', (request, reply, payload, done) => {
    reply.header('Connection', 'keep-alive')
    done()
  })

  app.addHook('onResponse', (request, reply, done) => {
    const event = {
      source_ip: request.ip,
      source_port: request.socket?.remotePort || 0,
      protocol: 'http',
      method: request.method,
      path: request.url,
      port: config.port,
      headers: { ...request.headers },
      body: request.body || null,
    }
    event.category = classify(event)
    log(event)
    done()
  })

  // GET /
  app.get('/', (request, reply) => {
    reply.type('text/html; charset=utf-8').send(getControlHtml())
  })

  // Assets
  app.get('/assets/index-Cl-Y9zqE.js', (request, reply) => {
    reply.type('application/javascript; charset=utf-8').send(JS_STUB)
  })

  app.get('/assets/index-DEPfFcOb.css', (request, reply) => {
    reply.type('text/css; charset=utf-8').send(CSS_STUB)
  })

  // Health
  app.get('/health', (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ status: 'ok', version: config.fakeVersion, uptime: state.getUptimeSeconds() })
  })

  // Models
  app.get('/v1/models', (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({
        object: 'list',
        data: [
          { id: 'anthropic/claude-sonnet-4', object: 'model', owned_by: 'anthropic' },
          { id: 'google/gemini-2.5-pro', object: 'model', owned_by: 'google' },
          { id: 'openai/gpt-4o', object: 'model', owned_by: 'openai' },
        ],
      })
  })

  // Admin pairing
  app.get('/_admin/', (request, reply) => {
    reply.type('text/html; charset=utf-8').send(ADMIN_HTML)
  })

  // Debug
  app.get('/debug/processes', (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({
        pid: 1,
        uptime: state.getUptimeSeconds(),
        memory: { rss: 67108864, heapUsed: 41943040, heapTotal: 52428800 },
        cpu: { user: 245000, system: 89000 },
        versions: { node: '20.11.0', v8: '11.3.244.8' },
      })
  })

  app.get('/debug/version', (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({
        version: config.fakeVersion,
        serviceName: config.serviceName,
        platform: config.fakePlatform,
        nodeVersion: 'v20.11.0',
        buildDate: new Date(Date.now() - 259200000).toISOString().replace(/\.\d+Z$/, 'Z'),
        gitCommit: 'a3f8c2d',
      })
  })

  // --- Step 6 endpoints ---

  // POST /v1/chat/completions
  app.post('/v1/chat/completions', async (request, reply) => {
    const body = request.body || {}
    const isStream = body.stream === true

    if (isStream) {
      await streamResponse(reply)
      return
    }

    // Non-streaming
    const sessionId = `sess-${randomBytes(8).toString('hex')}`
    const { response } = buildNonStreamingResponse(sessionId)
    const delayMs = llmDelay(response.choices[0].message.content.length)
    await delay(delayMs)

    reply
      .header('Access-Control-Allow-Origin', '*')
      .header('x-openclaw-session-key', sessionId)
      .type('application/json; charset=utf-8')
      .send(response)
  })

  // POST /v1/responses — stub
  app.post('/v1/responses', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ id: `resp-${randomBytes(8).toString('hex')}`, object: 'response', status: 'completed' })
  })

  // POST /tools/invoke
  app.post('/tools/invoke', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ ok: true, result: { output: `total 24\ndrwxr-xr-x  5 user user 4096 ${lsDate(3600000)} .`, exitCode: 0, duration: 45 } })
  })

  // POST /hooks/:hookId
  app.post('/hooks/:hookId', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ ok: true, queued: true })
  })

  // POST /hooks/:hookId/push (e.g. /hooks/gmail/push)
  app.post('/hooks/:hookId/push', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ ok: true, queued: true })
  })

  // Catch-all 404
  app.setNotFoundHandler((request, reply) => {
    reply
      .code(404)
      .header('Access-Control-Allow-Origin', '*')
      .type('application/json; charset=utf-8')
      .send({ error: 'not_found' })
  })

  return app
}
