import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import config from '../config.js'

export function setupMdns() {
  if (!config.mdnsEnabled) {
    console.log('[mdns] Disabled')
    return
  }

  const serviceType = `_${config.serviceName}-gw._tcp`
  const xml = `<?xml version="1.0" standalone='no'?>
<!DOCTYPE service-group SYSTEM "avahi-service.dtd">
<service-group>
  <name replace-wildcards="yes">${config.mdnsHostname}</name>
  <service>
    <type>${serviceType}</type>
    <port>${config.port}</port>
    <txt-record>role=gateway</txt-record>
    <txt-record>gatewayPort=${config.port}</txt-record>
    <txt-record>transport=ws</txt-record>
    <txt-record>version=${config.fakeVersion}</txt-record>
    <txt-record>cliPath=/home/user/.${config.serviceName}/bin/${config.serviceName}</txt-record>
    <txt-record>sshPort=22</txt-record>
  </service>
</service-group>
`

  const avahiDir = '/etc/avahi/services'
  try {
    if (existsSync(avahiDir)) {
      writeFileSync(`${avahiDir}/${config.serviceName}.service`, xml)
      console.log(`[mdns] Wrote Avahi service file: ${avahiDir}/${config.serviceName}.service`)
    } else {
      console.log(`[mdns] Avahi services directory not found (${avahiDir}), skipping file write`)
      console.log(`[mdns] Service type: ${serviceType}, hostname: ${config.mdnsHostname}`)
    }
  } catch (err) {
    console.warn(`[mdns] Could not write Avahi service file: ${err.message}`)
    console.log(`[mdns] Service type: ${serviceType}, hostname: ${config.mdnsHostname}`)
  }
}
