const httpCounters = new Map()
const wsConnections = new Map()
const wsFrameCounters = new Map()

const HTTP_MAX_PER_SEC = 100
const WS_MAX_CONCURRENT = 10
const WS_MAX_FRAMES_PER_MIN = 1000
const CLEANUP_INTERVAL = 60000

function getIp(request) {
  return request.headers['x-forwarded-for']?.split(',')[0]?.trim() || request.ip || request.socket?.remoteAddress || '0.0.0.0'
}

export function httpRateLimitHook(request, reply, done) {
  const ip = getIp(request)
  const now = Math.floor(Date.now() / 1000)
  const key = `${ip}:${now}`
  const count = (httpCounters.get(key) || 0) + 1
  httpCounters.set(key, count)

  if (count > HTTP_MAX_PER_SEC) {
    reply.code(429).send({ error: 'rate_limited', message: 'Too many requests' })
    return done()
  }
  done()
}

export function checkWsConnection(ip) {
  const current = wsConnections.get(ip) || 0
  if (current >= WS_MAX_CONCURRENT) {
    return false
  }
  wsConnections.set(ip, current + 1)
  return true
}

export function releaseWsConnection(ip) {
  const current = wsConnections.get(ip) || 1
  if (current <= 1) {
    wsConnections.delete(ip)
  } else {
    wsConnections.set(ip, current - 1)
  }
}

export function checkWsFrame(sessionId) {
  const now = Math.floor(Date.now() / 60000)
  const key = `${sessionId}:${now}`
  const count = (wsFrameCounters.get(key) || 0) + 1
  wsFrameCounters.set(key, count)
  return count <= WS_MAX_FRAMES_PER_MIN
}

// Cleanup old entries periodically
setInterval(() => {
  const nowSec = Math.floor(Date.now() / 1000)
  for (const key of httpCounters.keys()) {
    const ts = parseInt(key.split(':').pop(), 10)
    if (nowSec - ts > 5) httpCounters.delete(key)
  }
  const nowMin = Math.floor(Date.now() / 60000)
  for (const key of wsFrameCounters.keys()) {
    const ts = parseInt(key.split(':').pop(), 10)
    if (nowMin - ts > 2) wsFrameCounters.delete(key)
  }
}, CLEANUP_INTERVAL).unref()
