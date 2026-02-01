import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'

let cdp, baseUrl, port

describe('Step 7 — CDP Browser Service', () => {
  before(async () => {
    const { createCdpServer } = await import('../src/cdp/server.js')
    cdp = await createCdpServer({ host: '127.0.0.1', port: 0 })
    port = cdp.app.server.address().port
    baseUrl = `http://127.0.0.1:${port}`
  })

  after(async () => {
    for (const client of cdp.wss.clients) client.terminate()
    cdp.wss.close()
    await cdp.app.close()
  })

  it('GET /json returns 3 tabs', async () => {
    const res = await fetch(`${baseUrl}/json`)
    const body = await res.json()
    assert.equal(body.length, 3)
    assert.equal(body[0].title, 'Gmail - Inbox (4)')
    assert.equal(body[0].type, 'page')
    assert.ok(body[0].webSocketDebuggerUrl)
  })

  it('GET /json/version returns Chrome info', async () => {
    const res = await fetch(`${baseUrl}/json/version`)
    const body = await res.json()
    assert.equal(body.Browser, 'Chrome/131.0.6778.140')
    assert.equal(body['Protocol-Version'], '1.3')
  })

  it('GET /json/protocol returns schema', async () => {
    const res = await fetch(`${baseUrl}/json/protocol`)
    const body = await res.json()
    assert.ok(body.domains.length > 0)
  })

  it('CDP WS: Network.getCookies returns cookies', async () => {
    const ws = await new Promise((resolve, reject) => {
      const w = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/TAB001`)
      w.on('open', () => resolve(w))
      w.on('error', reject)
    })
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ id: 1, method: 'Network.getCookies', params: {} }))
    })
    assert.equal(res.id, 1)
    assert.ok(res.result.cookies.length > 0)
    assert.equal(res.result.cookies[0].name, 'SSID')
    ws.terminate()
  })

  it('CDP WS: Runtime.evaluate returns result', async () => {
    const ws = await new Promise((resolve, reject) => {
      const w = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/TAB002`)
      w.on('open', () => resolve(w))
      w.on('error', reject)
    })
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.evaluate', params: { expression: 'document.cookie' } }))
    })
    assert.equal(res.result.result.type, 'string')
    ws.terminate()
  })

  it('CDP WS: unknown method returns error', async () => {
    const ws = await new Promise((resolve, reject) => {
      const w = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/TAB001`)
      w.on('open', () => resolve(w))
      w.on('error', reject)
    })
    const res = await new Promise((resolve) => {
      ws.once('message', (d) => resolve(JSON.parse(d.toString())))
      ws.send(JSON.stringify({ id: 3, method: 'Unknown.method', params: {} }))
    })
    assert.equal(res.error.code, -32601)
    ws.terminate()
  })
})
