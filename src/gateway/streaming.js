import { randomBytes } from 'node:crypto'
import { delay, streamTokenDelay } from '../utils/timing.js'

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

function randomResponse() {
  return chatResponses[Math.floor(Math.random() * chatResponses.length)]
}

function randomId() {
  return `chatcmpl-${randomBytes(12).toString('hex')}`
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function buildNonStreamingResponse(sessionId) {
  const content = randomResponse()
  const promptTokens = rand(200, 2000)
  const completionTokens = rand(50, 500)
  return {
    response: {
      id: randomId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'openclaw',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
    },
    sessionId,
  }
}

export async function streamResponse(reply) {
  const content = randomResponse()
  const id = randomId()
  const tokens = content.split(/(\s+)/).filter(Boolean)

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'x-openclaw-session-key': `sess-${randomBytes(8).toString('hex')}`,
  })

  // Role chunk
  const roleChunk = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] }
  reply.raw.write(`data: ${JSON.stringify(roleChunk)}\n\n`)

  // Content chunks
  for (const token of tokens) {
    await delay(streamTokenDelay())
    const chunk = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: token }, finish_reason: null }] }
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }

  // Stop chunk
  const stopChunk = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
  reply.raw.write(`data: ${JSON.stringify(stopChunk)}\n\n`)
  reply.raw.write('data: [DONE]\n\n')
  reply.raw.end()
}
