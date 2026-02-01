import { existsSync } from 'node:fs'
import { Reader } from '@maxmind/geoip2-node'
import config from '../config.js'

let cityReader = null
let asnReader = null

const PRIVATE_RESULT = Object.freeze({
  country: 'PRIVATE',
  countryName: 'Private Network',
  city: null,
  latitude: null,
  longitude: null,
  asn: null,
  asnOrg: null,
})

const privateRanges = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc/,
  /^fd/,
]

function isPrivate(ip) {
  return privateRanges.some(r => r.test(ip))
}

export async function initGeoIP() {
  try {
    if (existsSync(config.geoipDb)) {
      cityReader = await Reader.open(config.geoipDb)
      console.log('[honeypot] GeoIP City database loaded')
    } else {
      console.warn('[honeypot] WARNING: GeoIP City database not found at', config.geoipDb)
    }
  } catch (err) {
    console.warn('[honeypot] WARNING: Failed to load GeoIP City:', err.message)
  }

  try {
    if (existsSync(config.geoipAsnDb)) {
      asnReader = await Reader.open(config.geoipAsnDb)
      console.log('[honeypot] GeoIP ASN database loaded')
    } else {
      console.warn('[honeypot] WARNING: GeoIP ASN database not found at', config.geoipAsnDb)
    }
  } catch (err) {
    console.warn('[honeypot] WARNING: Failed to load GeoIP ASN:', err.message)
  }
}

export function lookup(ip) {
  if (isPrivate(ip)) {
    return PRIVATE_RESULT
  }

  if (!cityReader && !asnReader) {
    return null
  }

  const result = {
    country: null,
    countryName: null,
    city: null,
    latitude: null,
    longitude: null,
    asn: null,
    asnOrg: null,
  }

  try {
    if (cityReader) {
      const city = cityReader.city(ip)
      result.country = city.country?.isoCode || null
      result.countryName = city.country?.names?.en || null
      result.city = city.city?.names?.en || null
      result.latitude = city.location?.latitude || null
      result.longitude = city.location?.longitude || null
    }
  } catch {
    // IP not found in city db
  }

  try {
    if (asnReader) {
      const asn = asnReader.asn(ip)
      result.asn = asn.autonomousSystemNumber || null
      result.asnOrg = asn.autonomousSystemOrganization || null
    }
  } catch {
    // IP not found in ASN db
  }

  return result
}
