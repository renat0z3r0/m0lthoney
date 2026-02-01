import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'

let app, port, wss

function connectAndCollect(count) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const msgs = []
    ws.on('open', () => {})
    ws.on('message', (data) => {
      msgs.push(JSON.parse(data.toString()))
      if (msgs.length === count) {
        resolve({ ws, msgs })
      }
    })
    ws.on('error', reject)
  })
}

function openWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const msgs = []
    ws.on('message', (data) => msgs.push(JSON.parse(data.toString())))
    ws.on('open', () => resolve({ ws, msgs }))
    ws.on('error', reject)
  })
}

function sendAndCollect(ws, msgs, msg, expectedTotal) {
  return new Promise((resolve) => {
    const check = () => {
      if (msgs.length >= expectedTotal) resolve(msgs)
    }
    const orig = ws.listeners('message')
    ws.on('message', () => setTimeout(check, 10))
    ws.send(JSON.stringify(msg))
    setTimeout(check, 50)
  })
}

describe('Step 3 — WebSocket', () => {
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

  it('receives connect.challenge', async () => {
    const { ws, msgs } = await connectAndCollect(1)
    assert.equal(msgs[0].event, 'connect.challenge')
    assert.ok(msgs[0].payload.nonce)
    ws.terminate()
  })

  it('connect returns hello-ok + health', async () => {
    // Collect: 1 challenge + 1 hello-ok res + 1 health event = 3
    const { ws } = await connectAndCollect(1) // challenge
    const collected = await new Promise((resolve) => {
      const all = []
      ws.on('message', (data) => {
        all.push(JSON.parse(data.toString()))
        if (all.length === 2) resolve(all)
      })
      ws.send(JSON.stringify({
        type: 'req', id: 't1', method: 'connect',
        params: { minProtocol: 3, maxProtocol: 3, client: { id: 'test' }, auth: {} },
      }))
    })
    const res = collected[0]
    const health = collected[1]
    assert.equal(res.result.protocol, 3)
    assert.equal(res.result.gateway.version, '2026.1.29')
    assert.ok(res.result.snapshot.uptimeMs > 0)
    assert.ok(res.result.auth.deviceToken.startsWith('dt-'))
    assert.equal(health.event, 'health')
    ws.terminate()
  })

  it('accepts no auth', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't2', method: 'connect', params: {} }))
    })
    assert.equal(res.result.protocol, 3)
    ws.terminate()
  })

  it('agent.identity.get', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't3', method: 'agent.identity.get', params: {} }))
    })
    assert.equal(res.result.name, 'Molty')
    ws.terminate()
  })

  it('agents.list', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't4', method: 'agents.list', params: {} }))
    })
    assert.ok(Array.isArray(res.result))
    ws.terminate()
  })

  it('sessions.list', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't5', method: 'sessions.list', params: {} }))
    })
    assert.ok(res.result.length >= 2)
    ws.terminate()
  })

  it('node.list', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't6', method: 'node.list', params: {} }))
    })
    assert.ok(res.result[0].capabilities.includes('shell'))
    ws.terminate()
  })

  it('chat.history', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't7', method: 'chat.history', params: {} }))
    })
    assert.ok(res.result.length >= 5)
    ws.terminate()
  })

  it('unknown method returns -32601', async () => {
    const { ws } = await connectAndCollect(1)
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ type: 'req', id: 't8', method: 'nonexistent.method', params: {} }))
    })
    assert.equal(res.error.code, -32601)
    ws.terminate()
  })
})
