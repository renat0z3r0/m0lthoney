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

function collectMessages(ws, count, timeout = 5000) {
  return new Promise((resolve) => {
    const msgs = []
    const handler = (d) => {
      msgs.push(JSON.parse(d.toString()))
      if (msgs.length >= count) {
        ws.removeListener('message', handler)
        resolve(msgs)
      }
    }
    ws.on('message', handler)
    setTimeout(() => { ws.removeListener('message', handler); resolve(msgs) }, timeout)
  })
}

describe('Step 4 — WS config/chat/channels', () => {
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

  it('config.get returns canary keys', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'c1', method: 'config.get', params: {} })
    assert.ok(res.result.providers.anthropic.apiKey.startsWith('sk-ant-api03-HONEYPOT-'))
    assert.ok(res.result.providers.openai.apiKey.startsWith('sk-proj-HONEYPOT-'))
    assert.ok(res.result.gateway.auth.token.startsWith('HONEYPOT-GW-'))
    assert.equal(res.result.gateway.controlUi.allowInsecureAuth, true)
    ws.terminate()
  })

  it('config.set increments stateVersion', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'c2', method: 'config.set', params: { logging: { level: 'debug' } } })
    assert.equal(res.result.ok, true)
    assert.equal(typeof res.result.stateVersion, 'number')
    ws.terminate()
  })

  it('config.apply returns restarting', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'c3', method: 'config.apply', params: {} })
    assert.equal(res.result.restarting, true)
    ws.terminate()
  })

  it('chat.send returns ack then chat.message event', async () => {
    const { ws } = await connectAndCollect(1)
    // Send chat and collect ack + delayed event
    const promise = collectMessages(ws, 2, 5000)
    ws.send(JSON.stringify({ type: 'req', id: 'ch1', method: 'chat.send', params: { content: 'hello', sessionKey: 'main' } }))
    const msgs = await promise
    assert.ok(msgs.length >= 1)
    // First is the res ack
    const ack = msgs[0]
    assert.equal(ack.type, 'res')
    assert.equal(ack.result.ok, true)
    // Second should be the chat.message event (may take up to 3s)
    if (msgs.length >= 2) {
      const evt = msgs[1]
      assert.equal(evt.event, 'chat.message')
      assert.equal(evt.payload.role, 'assistant')
      assert.ok(evt.payload.content.length > 0)
      assert.ok(evt.payload.tokens.input >= 200)
    }
    ws.terminate()
  })

  it('channels.status returns linked channels', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'ch2', method: 'channels.status', params: {} })
    assert.equal(res.result.whatsapp.status, 'linked')
    assert.equal(res.result.telegram.status, 'linked')
    ws.terminate()
  })

  it('skills.list returns 4 skills', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 's1', method: 'skills.list', params: {} })
    assert.equal(res.result.length, 4)
    ws.terminate()
  })

  it('tools.list returns 3 tools', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 't1', method: 'tools.list', params: {} })
    assert.equal(res.result.length, 3)
    assert.equal(res.result[0].name, 'shell')
    ws.terminate()
  })

  it('cron.list returns crons with future nextRun', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'cr1', method: 'cron.list', params: {} })
    assert.equal(res.result.length, 2)
    const nextRun = new Date(res.result[0].nextRun).getTime()
    assert.ok(nextRun > Date.now())
    ws.terminate()
  })

  it('chat.inject returns ok', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await sendAndReceive(ws, { type: 'req', id: 'ci1', method: 'chat.inject', params: { content: 'injected' } })
    assert.equal(res.result.ok, true)
    ws.terminate()
  })
})
