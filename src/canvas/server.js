import Fastify from 'fastify'
import config from '../config.js'
import { log, classify } from '../logger.js'
import { httpRateLimitHook } from '../utils/rate-limit.js'

// 1x1 red PNG placeholder
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==', 'base64')

const LISTING_HTML = `<!DOCTYPE html>
<html><head><title>Index of /__openclaw__/canvas/</title></head>
<body style="background:#0d1117;color:#c9d1d9;font-family:monospace;padding:2rem">
<h1>Index of /__openclaw__/canvas/</h1>
<hr>
<pre>
<a href="report.html">report.html</a>             2026-01-31 09:15   4.2K
<a href="screenshot.png">screenshot.png</a>          2026-01-31 09:15   24K
<a href="analysis.csv">analysis.csv</a>            2026-01-30 18:00   1.8K
</pre>
<hr>
</body></html>`

const REPORT_HTML = `<!DOCTYPE html>
<html><head><title>Weekly Report - OpenClaw</title></head>
<body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:2rem">
<h1>Weekly Infrastructure Report</h1>
<p>Generated: ${new Date().toISOString().slice(0, 10)}</p>
<h2>Summary</h2>
<ul>
<li>Uptime: 99.97%</li>
<li>Total requests: 1,247,832</li>
<li>Active sessions: 3</li>
<li>Alerts: 0 critical, 2 warnings</li>
</ul>
<h2>Resource Usage</h2>
<table border="1" cellpadding="8" style="border-collapse:collapse;border-color:#30363d">
<tr><th>Metric</th><th>Current</th><th>Avg (7d)</th></tr>
<tr><td>CPU</td><td>12%</td><td>8%</td></tr>
<tr><td>Memory</td><td>2.1 GB</td><td>1.8 GB</td></tr>
<tr><td>Disk</td><td>45%</td><td>42%</td></tr>
</table>
</body></html>`

export async function createCanvasServer(opts = {}) {
  const app = Fastify({ logger: false })
  const bindPort = opts.port || config.canvasPort
  const bindHost = opts.host || config.host

  app.addHook('onRequest', httpRateLimitHook)

  app.addHook('onSend', (request, reply, payload, done) => {
    reply.header('Connection', 'keep-alive')
    done()
  })

  app.addHook('onResponse', (request, reply, done) => {
    log({
      source_ip: request.ip,
      source_port: request.socket?.remotePort || 0,
      protocol: 'http',
      method: request.method,
      path: request.url,
      port: config.canvasPort,
      headers: { ...request.headers },
      body: request.body || null,
    })
    done()
  })

  app.get('/__openclaw__/canvas/', (request, reply) => {
    reply.type('text/html; charset=utf-8').send(LISTING_HTML)
  })

  app.get('/__openclaw__/canvas/report.html', (request, reply) => {
    reply.type('text/html; charset=utf-8').send(REPORT_HTML)
  })

  app.get('/__openclaw__/canvas/screenshot.png', (request, reply) => {
    reply.type('image/png').send(PLACEHOLDER_PNG)
  })

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).type('application/json; charset=utf-8').send({ error: 'not_found' })
  })

  await app.listen({ host: bindHost, port: bindPort })
  console.log(`[canvas] Listening on ${bindHost}:${bindPort}`)
  return app
}
