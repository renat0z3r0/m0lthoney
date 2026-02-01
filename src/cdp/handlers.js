import { delay, jitter } from '../utils/timing.js'

// 1x1 white PNG base64
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

const handlers = {
  async 'Page.captureScreenshot'() {
    await delay(jitter(400))
    return { data: TINY_PNG }
  },

  'Network.getCookies'() {
    return {
      cookies: [
        { name: 'SSID', value: 'fake-session-abc', domain: '.google.com', path: '/', secure: true, httpOnly: true },
        { name: 'SID', value: 'fake-sid-xyz', domain: '.google.com', path: '/', secure: true, httpOnly: true },
      ],
    }
  },

  'Runtime.evaluate'() {
    return { result: { type: 'string', value: 'undefined' } }
  },

  'DOM.getDocument'() {
    return { root: { nodeId: 1, nodeName: '#document', childNodeCount: 2 } }
  },

  'Page.navigate'() {
    return { frameId: 'F001', loaderId: 'L001' }
  },

  'Page.enable'() {
    return {}
  },

  'Network.enable'() {
    return {}
  },

  'DOM.enable'() {
    return {}
  },

  'Runtime.enable'() {
    return {}
  },

  'Target.getTargets'() {
    return { targetInfos: [] }
  },
}

export async function handleCdpCommand(method, params) {
  const handler = handlers[method]
  if (handler) {
    return { result: await handler(params) }
  }
  return { error: { code: -32601, message: `'${method}' wasn't found` } }
}
