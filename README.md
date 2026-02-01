# OpenClaw Honeypot

Honeypot that simulates a vulnerable [OpenClaw](https://github.com/example/openclaw) instance (v2026.1.29, pre-security-patch) exposed without authentication. Captures and classifies attacks for threat intelligence.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Download GeoIP databases
MAXMIND_LICENSE_KEY=your_key ./scripts/download-geoip.sh

# 3. Start
npm start

# Or with Docker
ADMIN_PASSWORD=changeme docker compose up -d
```

The honeypot listens on:
- **:18789** — Gateway HTTP + WebSocket
- **:18791** — Chrome DevTools Protocol
- **:18793** — Canvas file server
- **:41892** — Admin dashboard (localhost only)

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HONEYPOT_HOST` | `0.0.0.0` | Bind address |
| `HONEYPOT_PORT` | `18789` | Gateway port |
| `CDP_PORT` | `18791` | CDP port |
| `CANVAS_PORT` | `18793` | Canvas port |
| `ADMIN_HOST` | `127.0.0.1` | Dashboard bind (keep loopback) |
| `ADMIN_PORT` | `41892` | Dashboard port |
| `ADMIN_USERNAME` | `admin` | Dashboard username |
| `ADMIN_PASSWORD` | *(random)* | Dashboard password (printed at startup) |
| `FAKE_VERSION` | `2026.1.29` | Simulated OpenClaw version |
| `CANARY_PREFIX` | `HONEYPOT` | Prefix in canary tokens |
| `MDNS_ENABLED` | `false` | Enable mDNS/Avahi advertisement |
| `MDNS_HOSTNAME` | `macmini-studio` | mDNS hostname |
| `DATA_DIR` | `./data` | Log output directory |
| `GEOIP_DB` | `./data/GeoLite2-City.mmdb` | GeoIP city database |
| `GEOIP_ASN_DB` | `./data/GeoLite2-ASN.mmdb` | GeoIP ASN database |

## Architecture

```
Internet → :18789 (Fastify HTTP + WS)  → JSONL logger → data/attacks/
         → :18791 (CDP HTTP + WS)      → JSONL logger → data/cdp-sessions/
         → :18793 (Canvas file server)  → JSONL logger
         → mDNS advertisement

Admin    → :41892 (Basic Auth) → Live feed, stats, geo map, session replay
```

**Key design decisions:**
- All authentication is accepted (simulates `allowInsecureAuth: true`)
- Canary tokens generated once at startup, consistent across all endpoints
- No real commands are ever executed
- Fake filesystem served from in-memory templates
- 16 attack classification categories

## Reading Logs

Logs are written as JSONL to `data/attacks/YYYY-MM-DD.jsonl`:

```bash
# Categories summary
cat data/attacks/$(date +%Y-%m-%d).jsonl | jq -r '.category' | sort | uniq -c | sort -rn

# Unique IPs
cat data/attacks/$(date +%Y-%m-%d).jsonl | jq -r '.source_ip' | sort -u | wc -l

# Filter by country
cat data/attacks/$(date +%Y-%m-%d).jsonl | jq 'select(.geo.country == "CN")'

# RCE attempts
cat data/attacks/$(date +%Y-%m-%d).jsonl | jq 'select(.category == "rce_attempt")'
```

Attack categories: `scan`, `recon`, `exploit`, `rce_attempt`, `lfi_attempt`, `token_bypass`, `data_exfil`, `prompt_injection`, `webhook_injection`, `skill_poisoning`, `persistence`, `impersonation`, `cdp_exploit`, `proxy_abuse`, `returning_attacker`, `brute_force`.

## GeoIP

The honeypot works without GeoIP databases — the `geo` field will be `null`. For geo enrichment, register at [maxmind.com](https://www.maxmind.com/en/geolite2/signup) (free) and run:

```bash
MAXMIND_LICENSE_KEY=your_key ./scripts/download-geoip.sh
```

## Rate Limiting

- HTTP: 100 requests/sec per IP
- WebSocket: 10 concurrent connections per IP, 1000 frames/min per session

## Testing

```bash
npm test              # Unit/integration tests
bash test/e2e.sh      # E2E test (requires running instance)
```

## Legal Considerations

- This is a **passive honeypot** — it does not attack back or exploit visitors
- Under Italian law (and most EU jurisdictions), operating a passive honeypot is lawful
- GDPR applies to collected IP addresses: implement a 90-day retention policy
- Inform your ISP/hosting provider that you are running a honeypot
- Do not use captured credentials or tokens for any purpose other than analysis
- Keep the admin dashboard on loopback or behind a VPN

## License

ISC
