import { randomBytes } from 'node:crypto'

function randomHex(length) {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
}

export function generateCanaryKeys(prefix) {
  return Object.freeze({
    anthropicApi: `sk-ant-api03-${prefix}-${randomHex(64)}`,
    openaiApi: `sk-proj-${prefix}-${randomHex(48)}`,
    openrouterApi: `sk-or-${prefix}-${randomHex(32)}`,
    gatewayToken: `${prefix}-GW-${randomHex(12)}`,
    telegramBot: `${prefix}-TG:AAF_${randomHex(32)}`,
    discordBot: `${prefix}-DC.${randomHex(32)}`,
    hooksToken: `${prefix}-HK-${randomHex(12)}`,
    awsAccessKey: `AKIA${prefix}${randomHex(16).toUpperCase()}`,
    awsSecretKey: randomHex(40),
    googleOAuth: `ya29.${prefix}-${randomHex(24)}`,
  })
}
