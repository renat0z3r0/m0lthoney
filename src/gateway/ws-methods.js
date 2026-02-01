import state from '../state.js'
import config from '../config.js'
import { lsDate } from '../utils/timing.js'

function nextHourISO() {
  const now = new Date()
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next.toISOString()
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const chatResponses = [
  "I've completed the task. The changes have been applied successfully.",
  "Sure, I can help with that. Let me look into it and get back to you with the details.",
  "The deployment is in progress. I'll monitor the status and notify you when it's complete.",
  "I've analyzed the logs and everything looks normal. No issues detected in the last 24 hours.",
  "Done! The configuration has been updated. You might want to verify the changes in the dashboard.",
  "I've scheduled that for you. It will run at the next available window.",
  "The backup completed successfully. All data has been synced to the remote storage.",
  "I found a few potential issues in the codebase. Would you like me to create a detailed report?",
  "The API endpoint is responding normally. Average latency is 45ms over the last hour.",
  "I've sent the notification through all configured channels. Let me know if you need anything else.",
]

const methods = {
  'agent.identity.get'() {
    return { id: 'main', name: 'Molty', model: 'anthropic/claude-sonnet-4', workspace: '/root/clawd' }
  },

  'agents.list'() {
    return [{ id: 'main', name: 'Molty', model: 'anthropic/claude-sonnet-4', status: 'active' }]
  },

  'sessions.list'() {
    const now = Date.now()
    return [
      { id: 'sess-001', agentId: 'main', model: 'anthropic/claude-sonnet-4', status: 'active', createdAt: new Date(now - 7200000).toISOString(), lastMessageAt: new Date(now - 300000).toISOString(), messageCount: 24 },
      { id: 'sess-002', agentId: 'main', model: 'anthropic/claude-sonnet-4', status: 'idle', createdAt: new Date(now - 86400000).toISOString(), lastMessageAt: new Date(now - 3600000).toISOString(), messageCount: 47 },
      { id: 'sess-003', agentId: 'main', model: 'google/gemini-2.5-pro', status: 'idle', createdAt: new Date(now - 172800000).toISOString(), lastMessageAt: new Date(now - 43200000).toISOString(), messageCount: 12 },
    ]
  },

  'node.list'() {
    return [
      { id: 'node-local', name: 'macmini-studio', platform: 'darwin', status: 'online', capabilities: ['shell', 'fs', 'browser', 'docker'] },
      { id: 'node-remote', name: 'dev-server', platform: 'linux', status: 'online', capabilities: ['shell', 'fs', 'docker'] },
    ]
  },

  'device.pair.list'() {
    const now = Date.now()
    return [
      { id: 'dev-001', name: 'MacBook Pro', type: 'browser', pairedAt: new Date(now - 604800000).toISOString(), lastSeen: new Date(now - 60000).toISOString() },
      { id: 'dev-002', name: 'iPhone 15', type: 'mobile', pairedAt: new Date(now - 2592000000).toISOString(), lastSeen: new Date(now - 7200000).toISOString() },
    ]
  },

  'chat.history'() {
    return state.getChatHistory()
  },

  // --- Step 4 methods ---

  'config.get'() {
    return state.getConfig()
  },

  'config.set'(params) {
    return { ok: true, stateVersion: state.incrementStateVersion() }
  },

  'config.apply'() {
    return { ok: true, restarting: true }
  },

  'config.schema'() {
    return {
      type: 'object',
      properties: {
        gateway: { type: 'object' },
        agents: { type: 'object' },
        providers: { type: 'object' },
        channels: { type: 'object' },
        hooks: { type: 'object' },
        logging: { type: 'object' },
      },
    }
  },

  'chat.send'(params, ctx) {
    const content = chatResponses[rand(0, chatResponses.length - 1)]
    const delay = rand(500, 3000)

    // Send immediate ack
    const ack = { ok: true, sessionKey: params?.sessionKey || 'main' }

    // Schedule delayed chat.message event
    if (ctx?.sendEvent) {
      setTimeout(() => {
        ctx.sendEvent('chat.message', {
          role: 'assistant',
          content,
          model: 'anthropic/claude-sonnet-4',
          tokens: { input: rand(200, 2000), output: rand(50, 500) },
        })
      }, delay)
    }

    return ack
  },

  'chat.abort'() {
    return { ok: true }
  },

  'chat.inject'() {
    return { ok: true }
  },

  'channels.status'() {
    return {
      whatsapp: { status: 'linked', phone: '+39 3XX XXX XXXX' },
      telegram: { status: 'linked', bot: '@molty_assistant_bot' },
      discord: { status: 'linked', guild: 'Personal Server' },
    }
  },

  'skills.list'() {
    return [
      { name: 'web-search', enabled: true },
      { name: 'image-gen', enabled: true },
      { name: 'browser-automation', enabled: true },
      { name: 'code-exec', enabled: false },
    ]
  },

  'models.list'() {
    return {
      object: 'list',
      data: [
        { id: 'anthropic/claude-sonnet-4', object: 'model', owned_by: 'anthropic' },
        { id: 'google/gemini-2.5-pro', object: 'model', owned_by: 'google' },
        { id: 'openai/gpt-4o', object: 'model', owned_by: 'openai' },
      ],
    }
  },

  'tools.list'() {
    return [
      { name: 'shell', enabled: true },
      { name: 'fs', enabled: true },
      { name: 'browser', enabled: true },
    ]
  },

  'cron.list'() {
    const now = new Date()
    const next1 = new Date(now)
    next1.setMinutes(0, 0, 0)
    next1.setHours(next1.getHours() + 1)
    const next2 = new Date(now)
    next2.setHours(6, 0, 0, 0)
    if (next2 <= now) next2.setDate(next2.getDate() + 1)

    return [
      { id: 'cron-001', schedule: '0 * * * *', message: 'Check system health and report anomalies', enabled: true, nextRun: next1.toISOString() },
      { id: 'cron-002', schedule: '0 6 * * *', message: 'Generate daily summary and send to Telegram', enabled: true, nextRun: next2.toISOString() },
    ]
  },

  // --- Step 5 methods ---

  'node.invoke'() {
    return { output: `total 24\ndrwxr-xr-x  5 user user 4096 ${lsDate(3600000)} .\ndrwxr-xr-x  3 root root 4096 ${lsDate(1382400000)} ..`, exitCode: 0, duration: 45 }
  },

  'exec.approvals.list'() {
    return ['node', 'python', 'git', 'ls', 'cat']
  },

  'exec.approvals.edit'(params) {
    return { ok: true, approvals: params?.approvals || ['node', 'python', 'git', 'ls', 'cat'] }
  },

  'skills.install'(params) {
    return { ok: true, installed: params?.name || params?.url || 'unknown' }
  },

  'skills.enable'(params) {
    return { ok: true }
  },

  'cron.create'(params) {
    const next = new Date()
    next.setMinutes(next.getMinutes() + 5)
    return { ok: true, id: `cron-${rand(100, 999)}`, nextRun: next.toISOString() }
  },

  'cron.run'() {
    return { ok: true, running: true }
  },

  'update.run'() {
    return { ok: true, updating: true }
  },

  'web.login.qr'() {
    // 1x1 white PNG as base64 placeholder
    return { qr: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' }
  },

  'send'(params) {
    return { ok: true, delivered: true, channel: params?.channel || 'unknown' }
  },

  'status.get'() {
    return state.getSnapshot()
  },

  'sessions.get'(params) {
    const now = Date.now()
    return {
      id: params?.id || 'sess-001',
      agentId: 'main',
      model: 'anthropic/claude-sonnet-4',
      status: 'active',
      createdAt: new Date(now - 7200000).toISOString(),
      lastMessageAt: new Date(now - 300000).toISOString(),
      messageCount: 24,
      messages: state.getChatHistory(),
    }
  },

  'sessions.patch'() {
    return { ok: true }
  },

  'webhook.list'() {
    return [{ id: 'email', type: 'gmail', active: true }]
  },

  // --- Low priority stubs ---

  'health'() {
    return { status: 'ok', uptime: state.getUptimeSeconds() }
  },

  'system-presence'() {
    return [{ host: `${config.mdnsHostname}.local`, ip: '192.168.1.42', version: config.fakeVersion }]
  },

  'system-event'() {
    return { ok: true }
  },

  'node.pair.list'() {
    return []
  },

  'node.pair.start'() {
    return { ok: true, code: 'ABCD-1234' }
  },

  'node.pair.complete'() {
    return { ok: true }
  },

  'node.describe'() {
    return { id: 'node-local', name: 'macmini-studio', platform: 'darwin', capabilities: ['shell', 'fs', 'browser', 'docker'] }
  },
}

export function handleMethod(method, params, ctx) {
  const handler = methods[method]
  if (handler) {
    return { result: handler(params, ctx) }
  }
  return { error: { code: -32601, message: 'method_not_found' } }
}
