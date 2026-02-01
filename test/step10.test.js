import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Step 10 — Rate limiting', () => {
  it('httpRateLimitHook exports correctly', async () => {
    const { httpRateLimitHook, checkWsConnection, releaseWsConnection, checkWsFrame } = await import('../src/utils/rate-limit.js')
    assert.equal(typeof httpRateLimitHook, 'function')
    assert.equal(typeof checkWsConnection, 'function')
    assert.equal(typeof releaseWsConnection, 'function')
    assert.equal(typeof checkWsFrame, 'function')
  })

  it('checkWsConnection allows up to 10 connections per IP', async () => {
    const { checkWsConnection, releaseWsConnection } = await import('../src/utils/rate-limit.js')
    const ip = '10.99.99.99'
    for (let i = 0; i < 10; i++) {
      assert.ok(checkWsConnection(ip), `connection ${i + 1} should be allowed`)
    }
    assert.equal(checkWsConnection(ip), false, '11th connection should be rejected')
    releaseWsConnection(ip)
    assert.ok(checkWsConnection(ip), 'after release, connection should be allowed again')
    // Cleanup
    for (let i = 0; i < 10; i++) releaseWsConnection(ip)
  })

  it('checkWsFrame allows up to 1000 frames per minute', async () => {
    const { checkWsFrame } = await import('../src/utils/rate-limit.js')
    const sid = 'test-session-ratelimit'
    for (let i = 0; i < 1000; i++) {
      assert.ok(checkWsFrame(sid))
    }
    assert.equal(checkWsFrame(sid), false)
  })
})

describe('Step 10 — Docker files exist', () => {
  it('Dockerfile exists', async () => {
    const { readFileSync } = await import('node:fs')
    const content = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf-8')
    assert.ok(content.includes('node:20-slim'))
    assert.ok(content.includes('EXPOSE 18789'))
  })

  it('docker-compose.yml exists', async () => {
    const { readFileSync } = await import('node:fs')
    const content = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf-8')
    assert.ok(content.includes('network_mode: host'))
    assert.ok(content.includes('ADMIN_PASSWORD'))
  })

  it('download-geoip.sh exists and is executable', async () => {
    const { accessSync, constants } = await import('node:fs')
    accessSync(new URL('../scripts/download-geoip.sh', import.meta.url), constants.X_OK)
  })
})
