import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

let canvasApp, baseUrl

describe('Step 8 — Canvas, mDNS, fake-fs', () => {
  before(async () => {
    const { createCanvasServer } = await import('../src/canvas/server.js')
    canvasApp = await createCanvasServer({ host: '127.0.0.1', port: 0 })
    baseUrl = `http://127.0.0.1:${canvasApp.server.address().port}`
  })

  after(async () => {
    await canvasApp.close()
  })

  it('GET /__openclaw__/canvas/ returns listing with report.html', async () => {
    const res = await fetch(`${baseUrl}/__openclaw__/canvas/`)
    const body = await res.text()
    assert.ok(body.includes('report.html'))
    assert.ok(body.includes('screenshot.png'))
  })

  it('GET /__openclaw__/canvas/report.html returns HTML', async () => {
    const res = await fetch(`${baseUrl}/__openclaw__/canvas/report.html`)
    const body = await res.text()
    assert.ok(body.includes('Weekly'))
    assert.ok(body.includes('99.97%'))
  })

  it('GET /__openclaw__/canvas/screenshot.png returns PNG', async () => {
    const res = await fetch(`${baseUrl}/__openclaw__/canvas/screenshot.png`)
    assert.equal(res.headers.get('content-type'), 'image/png')
    const buf = await res.arrayBuffer()
    assert.ok(buf.byteLength > 0)
  })
})

describe('Step 8 — Fake filesystem', () => {
  it('getFile returns .env with canary keys', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const file = getFile('~/.openclaw/.env')
    assert.ok(file)
    assert.ok(file.content.includes('HONEYPOT'))
    assert.ok(file.content.includes('sk-ant-api03-'))
  })

  it('getFile returns openclaw.json config', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const file = getFile('~/.openclaw/openclaw.json')
    assert.ok(file)
    const cfg = JSON.parse(file.content)
    assert.ok(cfg.providers.anthropic.apiKey.startsWith('sk-ant-'))
  })

  it('getFile returns auth-profiles.json with same canary keys', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const { default: state } = await import('../src/state.js')
    const file = getFile('~/.openclaw/agents/main/agent/auth-profiles.json')
    assert.ok(file)
    const profiles = JSON.parse(file.content)
    assert.equal(profiles.profiles[0].apiKey, state.canaryKeys.anthropicApi)
    assert.equal(profiles.aws.accessKeyId, state.canaryKeys.awsAccessKey)
  })

  it('getFile returns MEMORY.md with personal info', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const file = getFile('~/.openclaw/agents/main/workspace/MEMORY.md')
    assert.ok(file)
    assert.ok(file.content.includes('Marco Rossi'))
    assert.ok(file.content.includes('Milan'))
  })

  it('getFile returns session transcript with 50+ lines', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const file = getFile('~/.openclaw/agents/main/sessions/main.jsonl')
    assert.ok(file)
    const lines = file.content.trim().split('\n')
    assert.ok(lines.length >= 50, `Expected 50+ lines, got ${lines.length}`)
  })

  it('getFile returns null for unknown paths', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    assert.equal(getFile('/nonexistent/path'), null)
  })

  it('getFile works with expanded home paths', async () => {
    const { getFile } = await import('../src/filesystem/fake-fs.js')
    const file = getFile('/home/user/.openclaw/.env')
    assert.ok(file)
    assert.ok(file.content.includes('ANTHROPIC_API_KEY'))
  })
})

describe('Step 8 — mDNS', () => {
  it('setupMdns runs without error', async () => {
    const { setupMdns } = await import('../src/mdns/setup.js')
    // Should not throw even without avahi directory
    setupMdns()
  })
})
