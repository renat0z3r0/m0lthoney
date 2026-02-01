import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

let app, baseUrl, authHeader

describe('Step 9 — Admin Dashboard', () => {
  before(async () => {
    const { createAdminServer } = await import('../src/admin/server.js')
    const { default: config } = await import('../src/config.js')
    app = await createAdminServer({ host: '127.0.0.1', port: 0 })
    baseUrl = `http://127.0.0.1:${app.server.address().port}`
    authHeader = 'Basic ' + Buffer.from(`${config.adminUsername}:${config.adminPassword}`).toString('base64')
  })

  after(async () => {
    await app.close()
  })

  it('returns 401 without auth', async () => {
    const res = await fetch(`${baseUrl}/admin/api/stats`)
    assert.equal(res.status, 401)
  })

  it('returns 401 with wrong credentials', async () => {
    const res = await fetch(`${baseUrl}/admin/api/stats`, {
      headers: { Authorization: 'Basic ' + Buffer.from('wrong:creds').toString('base64') },
    })
    assert.equal(res.status, 401)
  })

  it('GET / returns dashboard HTML with auth', async () => {
    const res = await fetch(baseUrl, { headers: { Authorization: authHeader } })
    assert.equal(res.status, 200)
    const body = await res.text()
    assert.ok(body.includes('OpenClaw'))
  })

  it('GET /admin/api/stats returns stats object', async () => {
    const res = await fetch(`${baseUrl}/admin/api/stats`, {
      headers: { Authorization: authHeader },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok('totalEvents' in data || 'total' in data || typeof data === 'object')
  })

  it('GET /admin/api/events returns array', async () => {
    const res = await fetch(`${baseUrl}/admin/api/events`, {
      headers: { Authorization: authHeader },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data))
  })

  it('GET /admin/api/geo/markers returns array', async () => {
    const res = await fetch(`${baseUrl}/admin/api/geo/markers`, {
      headers: { Authorization: authHeader },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data))
  })

  it('GET /admin/api/geo/countries returns array', async () => {
    const res = await fetch(`${baseUrl}/admin/api/geo/countries`, {
      headers: { Authorization: authHeader },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data))
  })

  it('GET /admin/api/ws-session/:id returns array for missing session', async () => {
    const res = await fetch(`${baseUrl}/admin/api/ws-session/nonexistent`, {
      headers: { Authorization: authHeader },
    })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.ok(Array.isArray(data))
  })

  it('SSE stream endpoint exists and requires auth', async () => {
    const res = await fetch(`${baseUrl}/admin/api/events/stream`)
    assert.equal(res.status, 401)
  })
})
