export function jitter(baseMs, percent = 0.2) {
  const range = baseMs * percent
  return baseMs + (Math.random() * range * 2 - range)
}

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export function llmDelay(responseLength) {
  return jitter(500 + responseLength * 15)
}

export function streamTokenDelay() {
  return jitter(50)
}

export function lsDate(offsetMs = 0) {
  const d = new Date(Date.now() - offsetMs)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const day = String(d.getDate()).padStart(2, ' ')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mon} ${day} ${hh}:${mm}`
}
