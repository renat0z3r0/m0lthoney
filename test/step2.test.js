import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createGatewayServer } from '../src/gateway/http.js'

let app

before(async () => {
  app = await createGatewayServer()
  await app.listen({ host: '127.0.0.1', port: 0 })
})

after(async () => {
  await app.close()
})

function url(path) {
  return `http://127.0.0.1:${app.server.address().port}${path}`
}

describe('Step 2 — Gateway HTTP', () => {
  it('GET / returns HTML with openclaw-app', async () => {
    const res = await fetch(url('/'))
    const body = await res.text()
    assert.ok(body.includes('openclaw-app'))
    assert.ok(body.includes('<title>OpenClaw</title>'))
  })

  it('GET /health returns JSON with version', async () => {
    const res = await fetch(url('/health'))
    const body = await res.json()
    assert.equal(body.status, 'ok')
    assert.equal(body.version, '2026.1.29')
    assert.equal(typeof body.uptime, 'number')
  })

  it('GET /v1/models returns 3 models', async () => {
    const res = await fetch(url('/v1/models'))
    const body = await res.json()
    assert.equal(body.data.length, 3)
    assert.equal(body.object, 'list')
  })

  it('GET /nonexistent returns 404', async () => {
    const res = await fetch(url('/nonexistent'))
    assert.equal(res.status, 404)
    const body = await res.json()
    assert.equal(body.error, 'not_found')
  })

  it('No Server header in response', async () => {
    const res = await fetch(url('/'))
    assert.equal(res.headers.get('server'), null)
  })

  it('Connection keep-alive header present', async () => {
    const res = await fetch(url('/health'))
    assert.equal(res.headers.get('connection'), 'keep-alive')
  })

  it('CORS header on API endpoints', async () => {
    const res = await fetch(url('/v1/models'))
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
  })

  it('GET /assets/index-Cl-Y9zqE.js returns JS', async () => {
    const res = await fetch(url('/assets/index-Cl-Y9zqE.js'))
    const body = await res.text()
    assert.ok(body.includes('openclaw'))
  })

  it('GET /_admin/ returns pairing HTML', async () => {
    const res = await fetch(url('/_admin/'))
    const body = await res.text()
    assert.ok(body.includes('Device Pairing'))
  })

  it('GET /debug/version returns version info', async () => {
    const res = await fetch(url('/debug/version'))
    const body = await res.json()
    assert.equal(body.version, '2026.1.29')
    assert.equal(body.serviceName, 'openclaw')
  })
})
